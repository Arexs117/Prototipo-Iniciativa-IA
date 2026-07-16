/**
 * nlu/spelling-tolerance.js
 * Paso 2 del pipeline: corrige errores ortográficos frecuentes token por token, comparando
 * contra el "vocabulario clave" del dominio (config/synonyms.js + config/intents.js) mediante
 * distancia de Levenshtein. No toca números ni códigos (numero_pedido, T001, M002...), esos
 * los resuelve entity-extractor.js más adelante.
 */

import { normalizar, distanciaLevenshtein } from '../shared/text-utils.js';
import { SINONIMOS, VOCABULARIO_ADICIONAL } from '../config/synonyms.js';
import { VERBOS_CONSULTA, PALABRAS_PREGUNTA } from '../config/intents.js';

const PATRON_CODIGO = /^[a-z]{1,3}\d{1,5}$/; // t001, m002, p001, c01, cit0001...
const PATRON_NUMERICO = /^\d+$/;

/**
 * Errores frecuentes conocidos que requieren más de una edición (p. ej. "yego" -> "llego"
 * es distancia 2). Se resuelven por diccionario exacto, no por Levenshtein genérico, para no
 * abrir la puerta a "corregir" palabras válidas que casualmente caen cerca de una palabra del
 * vocabulario (ver nota de diseño más abajo).
 */
const CORRECCIONES_COMUNES = {
  yego: 'llego',
  pedico: 'pedido',
};

function construirVocabulario() {
  const palabras = new Set();
  for (const variantes of Object.values(SINONIMOS)) {
    for (const variante of variantes) {
      for (const palabra of normalizar(variante).split(' ')) {
        if (palabra.length >= 3) palabras.add(palabra);
      }
    }
  }
  for (const palabra of [...VOCABULARIO_ADICIONAL, ...VERBOS_CONSULTA, ...PALABRAS_PREGUNTA]) {
    for (const p of normalizar(palabra).split(' ')) {
      if (p.length >= 3) palabras.add(p);
    }
  }
  return [...palabras];
}

const VOCABULARIO_CLAVE = construirVocabulario();

// Deliberadamente conservador: como el vocabulario incluye jerga genérica ("distribuidor",
// "venta", "camino"...), permitir distancia 2 corregía de más palabras válidas que sólo
// pasaban cerca de una palabra del vocabulario por coincidencia (p. ej. "cambio" -> "camino",
// "vega" -> "venta"), corrompiendo nombres propios (proveedores, tiendas) antes de que
// entity-extractor.js pudiera reconocerlos. Con distancia máxima 1 esos falsos positivos
// desaparecen y los typos "grandes" conocidos se cubren con CORRECCIONES_COMUNES.
function toleranciaPermitida(longitud) {
  return longitud <= 2 ? 0 : 1;
}

function pareceCodigoOEntidad(token) {
  return PATRON_NUMERICO.test(token) || PATRON_CODIGO.test(token);
}

function corregirToken(token) {
  if (token.length < 3) return token;
  if (pareceCodigoOEntidad(token)) return token;
  if (CORRECCIONES_COMUNES[token]) return CORRECCIONES_COMUNES[token];
  if (VOCABULARIO_CLAVE.includes(token)) return token;

  const tolerancia = toleranciaPermitida(token.length);
  let mejorCandidato = null;
  let mejorDistancia = Infinity;

  for (const palabraVocabulario of VOCABULARIO_CLAVE) {
    const distancia = distanciaLevenshtein(token, palabraVocabulario);
    if (distancia < mejorDistancia) {
      mejorDistancia = distancia;
      mejorCandidato = palabraVocabulario;
    }
  }

  if (mejorCandidato && mejorDistancia <= tolerancia && mejorDistancia < token.length) {
    return mejorCandidato;
  }
  return token;
}

/**
 * Recibe texto ya normalizado (ver normalizer.js) y devuelve una versión con errores
 * ortográficos comunes corregidos contra el vocabulario del dominio.
 */
function aplicarToleranciaOrtografica(textoNormalizado) {
  if (!textoNormalizado) return textoNormalizado;
  return textoNormalizado
    .split(' ')
    .map(corregirToken)
    .join(' ');
}

export { aplicarToleranciaOrtografica, VOCABULARIO_CLAVE };
