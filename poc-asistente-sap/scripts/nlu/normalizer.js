/**
 * nlu/normalizer.js
 * Paso 1 del pipeline: minúsculas, sin acentos, sin puntuación sobrante, espacios colapsados.
 * Envuelve la utilidad genérica de texto para que el resto del NLU dependa de "el normalizador
 * del motor" y no directamente de la utilidad compartida.
 */

import { normalizar } from '../shared/text-utils.js';

function normalizarMensaje(textoCrudo) {
  return normalizar(textoCrudo);
}

export { normalizarMensaje };
