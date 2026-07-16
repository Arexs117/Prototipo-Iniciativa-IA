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
} from '../data-connector/sap-connector.js';
import { SINONIMOS } from '../config/synonyms.js';
import { VERBOS_CONSULTA, PALABRAS_PREGUNTA } from '../config/intents.js';

const PATRON_NUMERO_PEDIDO = /\b\d{6,8}\b/g;
const PATRON_CODIGO_TIENDA = /^t\d{1,4}$/i;
const PATRON_CODIGO_PROVEEDOR = /^p\d{1,4}$/i;
const PATRON_CODIGO_CEDIS = /^c\d{1,4}$/i;
const PATRON_CODIGO_MATERIAL = /^m\d{1,4}$/i;

const CONCEPTOS_CANONICOS = new Set(Object.keys(SINONIMOS));

const STOPWORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'en', 'y', 'a', 'un', 'una', 'unos', 'unas',
  'mi', 'ese', 'esa', 'eso', 'esos', 'esas', 'con', 'para', 'si', 'lo', 'al',
  'lleva', 'trae', 'aun', 'todavia', 'todo', 'sobre', 'nos', 'les', 'algo', 'esta', 'este',
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

function extraerNumerosPedido(textoOriginalNormalizado) {
  const coincidencias = textoOriginalNormalizado.match(PATRON_NUMERO_PEDIDO) || [];
  return [...new Set(coincidencias)].map((codigo) => ({ codigo, score: 1, origen: 'codigo_explicito' }));
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
    candidatos.push(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
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

function extraerCandidatosPorNombre(tokens) {
  const candidatosTexto = generarCandidatosTexto(tokens);

  const busquedasTienda = candidatosTexto.map((c) => buscarTiendaPorNombreAproximado(c));
  const busquedasMaterial = candidatosTexto.map((c) => buscarMaterialPorNombreAproximado(c));
  const busquedasProveedor = candidatosTexto.map((c) => buscarProveedorPorNombreAproximado(c));

  return {
    tienda: fusionarCandidatos(busquedasTienda),
    material: fusionarCandidatos(busquedasMaterial),
    proveedor: fusionarCandidatos(busquedasProveedor),
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

  const combinarTipo = (directos, porNombre) => {
    const mapa = new Map();
    for (const c of directos) mapa.set(c.codigo, c);
    for (const c of porNombre) if (!mapa.has(c.codigo)) mapa.set(c.codigo, c);
    return [...mapa.values()];
  };

  return {
    numero_pedido,
    tienda: combinarTipo(codigosDirectos.tienda, candidatosPorNombre.tienda),
    proveedor: combinarTipo(codigosDirectos.proveedor, candidatosPorNombre.proveedor),
    cedis: codigosDirectos.cedis,
    material: combinarTipo(codigosDirectos.material, candidatosPorNombre.material),
  };
}

export { extraerEntidades };
