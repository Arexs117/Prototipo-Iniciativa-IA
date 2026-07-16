/**
 * nlu/abbreviations.js
 * Paso 3 del pipeline: expande abreviaciones/jerga de negocio a su forma canónica,
 * usando config/synonyms.js como única fuente de verdad.
 *
 * Devuelve tanto el texto con los conceptos canónicos insertados (útil para que
 * intent-classifier.js busque palabras simples) como la lista explícita de conceptos
 * detectados con la variante original que los disparó (útil para trazabilidad/aprendizaje
 * de sesión).
 */

import { normalizar } from '../shared/text-utils.js';
import { SINONIMOS } from '../config/synonyms.js';

function construirPares() {
  const pares = [];
  for (const [concepto, variantes] of Object.entries(SINONIMOS)) {
    for (const variante of variantes) {
      pares.push({ concepto, variante: normalizar(variante) });
    }
  }
  // Frases más largas primero, para que "llegó incompleto" no sea capturado por "llegó".
  pares.sort((a, b) => b.variante.length - a.variante.length);
  return pares;
}

const PARES_CONCEPTO_VARIANTE = construirPares();

function escaparRegExp(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Recibe texto ya normalizado y (opcionalmente) corregido ortográficamente.
 * Devuelve { texto, conceptos } donde `texto` reemplaza cada variante detectada por el
 * nombre del concepto canónico, y `conceptos` es la lista de coincidencias encontradas.
 */
function expandirAbreviaciones(textoNormalizado) {
  if (!textoNormalizado) return { texto: textoNormalizado, conceptos: [] };

  let texto = ` ${textoNormalizado} `;
  const conceptos = [];

  for (const { concepto, variante } of PARES_CONCEPTO_VARIANTE) {
    if (!variante) continue;
    const patron = new RegExp(`\\b${escaparRegExp(variante)}\\b`, 'g');
    if (patron.test(texto)) {
      conceptos.push({ concepto, variante });
      texto = texto.replace(patron, ` ${concepto} `).replace(/\s+/g, ' ');
    }
  }

  return { texto: texto.trim(), conceptos };
}

export { expandirAbreviaciones };
