/**
 * nlu/entity-extractor.js
 * Paso 5 del pipeline: extrae entidades de negocio (numero_pedido, tienda, proveedor,
 * cedis, material, fecha) del texto ya normalizado/corregido/expandido.
 *
 * Para nombres en texto libre (p. ej. "cumbres", "leche") consulta las búsquedas
 * aproximadas del data-connector — es la única razón por la que este módulo, además de
 * NLU, toca sap-connector.js: necesita convertir una mención textual en candidatos reales.
 * Cuando hay más de un candidato, NO decide por sí mismo: reporta la lista completa y deja
 * que ambiguity-resolver.js decida qué hacer.
 */

import { normalizar } from '../shared/text-utils.js';
import {
  buscarTiendaPorNombreAproximado,
  buscarMaterialPorNombreAproximado,
  buscarProveedorPorNombreAproximado,
  mejorPuntajeTienda,
  mejorPuntajeMaterial,
  mejorPuntajeProveedor,
} from '../data-connector/sap-connector.js';
import { SINONIMOS } from '../config/synonyms.js';
import { VERBOS_CONSULTA, PALABRAS_PREGUNTA } from '../config/intents.js';

const PATRON_NUMERO_PEDIDO = /\b\d{6,8}\b/g;
// "Casi" números de pedido: el usuario claramente intentó dar un número (le faltó/sobró un
// dígito, o lo partió con un espacio/guión por error de captura) pero no calza con el formato
// estricto de arriba. Antes esto se descartaba en silencio — el turno quedaba sin
// numero_pedido, y session-state.js rellenaba con el de memoria (el pedido consultado
// ANTES), respondiendo con el detalle equivocado como si fuera el que se acababa de pedir.
// Reconocerlo como intento explícito (aunque el código resultante no exista) hace que la
// capa de datos honestamente diga "no encontré ese pedido", igual que ya pasa con un número
// de formato válido pero inexistente.
const PATRON_CASI_NUMERO_PEDIDO = /\b\d[\d\s.-]{2,14}\d\b/g;
const PATRON_CODIGO_TIENDA = /^t\d{1,4}$/i;
const PATRON_CODIGO_PROVEEDOR = /^p\d{1,4}$/i;
const PATRON_CODIGO_CEDIS = /^c\d{1,4}$/i;
const PATRON_CODIGO_MATERIAL = /^m\d{1,4}$/i;

const CONCEPTOS_CANONICOS = new Set(Object.keys(SINONIMOS));

const STOPWORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'en', 'y', 'a', 'un', 'una', 'unos', 'unas',
  'mi', 'ese', 'esa', 'eso', 'esos', 'esas', 'con', 'para', 'si', 'lo', 'al',
  'lleva', 'trae', 'aun', 'todavia', 'todo', 'sobre', 'nos', 'les', 'algo', 'esta', 'este',
  // 'otro/otra/otros/otras' son anafóricos ("cuáles OTROS pedidos tiene") — sin excluirlos,
  // el detector de "intento sin resolver" (más abajo) los confundía con un intento de nombrar
  // una tienda/material/proveedor nuevo.
  'otro', 'otra', 'otros', 'otras',
]);

function esCandidatoIrrelevante(token) {
  return (
    token.length < 3 ||
    STOPWORDS.has(token) ||
    CONCEPTOS_CANONICOS.has(token) ||
    VERBOS_CONSULTA.includes(token) ||
    PALABRAS_PREGUNTA.includes(token) ||
    /^\d+$/.test(token)
  );
}

/**
 * ¿Este "casi número" ya fue capturado tal cual por el patrón estricto (\d{6,8} sin
 * separadores)? Si sí, no se vuelve a agregar como intento fallido — ya está representado.
 * Si el usuario le puso un separador (espacio/guión/punto) o el total de dígitos NO cae en
 * 6-8, es una mención nueva que el patrón estricto no vio.
 */
function esCasiNumeroNuevo(coincidencia, soloDigitos) {
  const tieneSeparador = /[\s.-]/.test(coincidencia);
  if (tieneSeparador) return soloDigitos.length >= 4;
  const yaEsFormatoValido = soloDigitos.length >= 6 && soloDigitos.length <= 8;
  return !yaEsFormatoValido && soloDigitos.length >= 5;
}

function extraerNumerosPedido(textoOriginalNormalizado) {
  const estrictas = textoOriginalNormalizado.match(PATRON_NUMERO_PEDIDO) || [];
  const codigos = [...new Set(estrictas)];

  const casiCoincidencias = textoOriginalNormalizado.match(PATRON_CASI_NUMERO_PEDIDO) || [];
  for (const coincidencia of casiCoincidencias) {
    const soloDigitos = coincidencia.replace(/\D/g, '');
    if (esCasiNumeroNuevo(coincidencia, soloDigitos) && !codigos.includes(soloDigitos)) {
      codigos.push(soloDigitos);
    }
  }

  return codigos.map((codigo) => ({ codigo, score: 1, origen: 'codigo_explicito' }));
}

/**
 * Reconoce códigos con el FORMATO de tienda/proveedor/cedis/material (p. ej. "P999") aunque
 * no existan en el catálogo. Antes se descartaban en silencio si no existían, lo que hacía
 * que el motor ignorara por completo lo que el usuario escribió y terminara pidiendo un dato
 * distinto ("necesito la tienda") en vez de responder honestamente "no encontré el proveedor
 * P999" — la capa de datos (sap-connector) ya sabe devolver ese "sin resultados" con gracia;
 * aquí solo hace falta no destruir la mención explícita del usuario antes de llegar ahí.
 */
function extraerCodigosDirectos(tokens) {
  const codigos = { tienda: [], proveedor: [], cedis: [], material: [] };

  for (const token of tokens) {
    if (PATRON_CODIGO_TIENDA.test(token)) {
      codigos.tienda.push({ codigo: token.toUpperCase(), score: 1, origen: 'codigo_explicito' });
    } else if (PATRON_CODIGO_PROVEEDOR.test(token)) {
      codigos.proveedor.push({ codigo: token.toUpperCase(), score: 1, origen: 'codigo_explicito' });
    } else if (PATRON_CODIGO_CEDIS.test(token)) {
      codigos.cedis.push({ codigo: token.toUpperCase(), score: 1, origen: 'codigo_explicito' });
    } else if (PATRON_CODIGO_MATERIAL.test(token)) {
      codigos.material.push({ codigo: token.toUpperCase(), score: 1, origen: 'codigo_explicito' });
    }
  }
  return codigos;
}

function generarCandidatosTexto(tokens) {
  const relevantes = tokens.filter((t) => !esCandidatoIrrelevante(t));
  const candidatos = [...relevantes];

  // Bigramas/trigramas adyacentes en el texto original, para nombres de varias palabras
  // ("cumbres sur", "leon centro", "refresco de cola") aunque una de ellas sea un stopword.
  for (let i = 0; i < tokens.length - 1; i++) {
    if (!esCandidatoIrrelevante(tokens[i]) || !esCandidatoIrrelevante(tokens[i + 1])) {
      candidatos.push(`${tokens[i]} ${tokens[i + 1]}`);
    }
  }
  for (let i = 0; i < tokens.length - 2; i++) {
    // Igual que los bigramas: se exige que al menos una de las tres palabras aporte contenido
    // real. Sin este filtro, un trigrama formado enteramente por stopwords/conceptos (p. ej.
    // "proveedor de ese", de "el proveedor de ese pedido") se colaba como candidato de
    // búsqueda difusa — inofensivo contra el umbral de aceptación (0.72) pero suficiente para
    // disparar falsos "intento sin resolver" contra el umbral, más bajo, de esa detección.
    if (!esCandidatoIrrelevante(tokens[i]) || !esCandidatoIrrelevante(tokens[i + 1]) || !esCandidatoIrrelevante(tokens[i + 2])) {
      candidatos.push(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
    }
  }
  return [...new Set(candidatos)];
}

function fusionarCandidatos(listaBusquedas) {
  const porCodigo = new Map();
  for (const resultados of listaBusquedas) {
    for (const candidato of resultados) {
      const existente = porCodigo.get(candidato.codigo);
      if (!existente || candidato.score > existente.score) {
        porCodigo.set(candidato.codigo, { codigo: candidato.codigo, nombre: candidato.nombre, score: candidato.score, origen: 'nombre_aproximado' });
      }
    }
  }
  return [...porCodigo.values()].sort((a, b) => b.score - a.score);
}

/**
 * Cuando ningún candidato de este turno llegó al umbral de aceptación (0.72) para un tipo,
 * ¿el usuario de todos modos mencionó el CONCEPTO de ese tipo ("tienda", "material",
 * "proveedor" — ya canonicalizado por abbreviations.js, incluye jerga como "sucursal" o
 * "distribuidor") junto con alguna palabra de contenido que intentara nombrar algo? Si sí,
 * hubo un intento explícito — exista o no, y se parezca o no a algo real — muy distinto de
 * simplemente no haber mencionado ese tipo. Sin esta distinción, ambos casos lucían idénticos
 * (candidatosDelTurno vacío) y session-state.js rellenaba en silencio con la tienda/material/
 * proveedor de memoria de un turno anterior, respondiendo sobre algo que el usuario ni pidió.
 *
 * A propósito NO exige que la palabra se parezca a un nombre real: un nombre inventado
 * ("yogurt griego", "importadora zeta") por definición no se parece a nada del catálogo, así
 * que exigir similitud —aunque fuera un umbral bajo— nunca lo habría detectado. El puntaje
 * solo se usa para elegir CUÁL candidato mostrar si hay varios, no para decidir si cuenta.
 */
function intentoSinResolver(tokens, candidatosTexto, concepto, mejorPuntajeFn) {
  if (!tokens.includes(concepto)) return null;
  const relevantes = candidatosTexto.filter((texto) => texto !== concepto);
  if (relevantes.length === 0) return null;

  let mejorTexto = relevantes[0];
  let mejorScore = -1;
  for (const texto of relevantes) {
    const score = mejorPuntajeFn(texto);
    if (score > mejorScore) {
      mejorScore = score;
      mejorTexto = texto;
    }
  }
  return { codigo: mejorTexto.toUpperCase(), nombre: mejorTexto, score: 1, origen: 'intento_no_resuelto' };
}

function extraerCandidatosPorNombre(tokens) {
  const candidatosTexto = generarCandidatosTexto(tokens);

  const busquedasTienda = candidatosTexto.map((c) => buscarTiendaPorNombreAproximado(c));
  const busquedasMaterial = candidatosTexto.map((c) => buscarMaterialPorNombreAproximado(c));
  const busquedasProveedor = candidatosTexto.map((c) => buscarProveedorPorNombreAproximado(c));

  return {
    tienda: fusionarCandidatos(busquedasTienda),
    material: fusionarCandidatos(busquedasMaterial),
    proveedor: fusionarCandidatos(busquedasProveedor),
    candidatosTexto,
  };
}

/**
 * @param {string} textoExpandido - salida de abbreviations.js (normalizado + jerga expandida).
 * @param {string} textoOriginalNormalizado - salida de normalizer.js, antes de expandir jerga
 *   (se usa para el regex de número de pedido, por si la expansión llegó a tocar dígitos).
 */
function extraerEntidades(textoExpandido, textoOriginalNormalizado) {
  const tokens = normalizar(textoExpandido).split(' ').filter(Boolean);

  const numero_pedido = extraerNumerosPedido(textoOriginalNormalizado || textoExpandido);
  const codigosDirectos = extraerCodigosDirectos(tokens);
  const candidatosPorNombre = extraerCandidatosPorNombre(tokens);
  const { candidatosTexto } = candidatosPorNombre;

  const combinarTipo = (directos, porNombre) => {
    const mapa = new Map();
    for (const c of directos) mapa.set(c.codigo, c);
    for (const c of porNombre) if (!mapa.has(c.codigo)) mapa.set(c.codigo, c);
    return [...mapa.values()];
  };

  // Solo se busca "intento sin resolver" cuando NINGUNA fuente (código explícito o nombre
  // aproximado) aportó ya un candidato para ese tipo — nunca para complementar uno que ya
  // existe, así nunca compite en falso contra un código real ya resuelto este turno.
  const conIntentoSinResolver = (combinado, concepto, mejorPuntajeFn) => {
    if (combinado.length > 0) return combinado;
    const intento = intentoSinResolver(tokens, candidatosTexto, concepto, mejorPuntajeFn);
    return intento ? [intento] : combinado;
  };

  const tienda = conIntentoSinResolver(combinarTipo(codigosDirectos.tienda, candidatosPorNombre.tienda), 'tienda', mejorPuntajeTienda);
  const material = conIntentoSinResolver(combinarTipo(codigosDirectos.material, candidatosPorNombre.material), 'material', mejorPuntajeMaterial);
  const proveedor = conIntentoSinResolver(combinarTipo(codigosDirectos.proveedor, candidatosPorNombre.proveedor), 'proveedor', mejorPuntajeProveedor);

  return { numero_pedido, tienda, proveedor, cedis: codigosDirectos.cedis, material };
}

export { extraerEntidades };
