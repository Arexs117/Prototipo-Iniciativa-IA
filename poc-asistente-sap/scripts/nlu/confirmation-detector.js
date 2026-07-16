/**
 * nlu/confirmation-detector.js
 * Reconoce cuando un mensaje ES, por completo, una confirmación o un rechazo corto ("sí",
 * "dale", "no gracias") — típico de responder a una sugerencia proactiva del asistente
 * (ver suggestion-engine.js). Solo se activa cuando el mensaje normalizado coincide EXACTO
 * con una de estas frases cortas, nunca como subcadena de un mensaje más largo: así un "si"
 * condicional dentro de una oración ("si llega tarde avísame") jamás se confunde con una
 * confirmación real.
 */

import { normalizar } from '../shared/text-utils.js';

const FRASES_AFIRMATIVAS = new Set([
  'si', 'sí', 'sip', 'simon', 'claro', 'claro que si', 'va', 'dale', 'ok', 'okay',
  'de acuerdo', 'correcto', 'exacto', 'asi es', 'afirmativo', 'adelante', 'hazlo',
  'por favor', 'si por favor', 'si porfavor', 'porfa', 'si porfa', 'obvio', 'claro que sí',
]);

const FRASES_NEGATIVAS = new Set([
  'no', 'no gracias', 'no por ahora', 'mejor no', 'no por el momento', 'negativo',
  'no aun', 'no aún', 'no de momento', 'ahorita no',
]);

/** @returns {'afirmativa'|'negativa'|null} */
function detectarConfirmacion(textoUsuario) {
  const texto = normalizar(textoUsuario);
  if (FRASES_AFIRMATIVAS.has(texto)) return 'afirmativa';
  if (FRASES_NEGATIVAS.has(texto)) return 'negativa';
  return null;
}

export { detectarConfirmacion };
