/**
 * nlu/intent-classifier.js
 * Paso 4 del pipeline: propone intención(es) candidatas a partir de los conceptos de negocio
 * detectados por abbreviations.js y de una señal superficial de "hay algo que parece número
 * de pedido" (regex, no resolución real — eso es trabajo de entity-extractor.js en el paso 5).
 *
 * Deliberadamente permisivo: puede devolver varias intenciones candidatas para el mismo
 * mensaje (p. ej. "pedido" activa consultar_pedido / buscar_pedidos_por_tienda /
 * buscar_pedidos_por_proveedor a la vez). session-state.js (contexto) y
 * ambiguity-resolver.js (paso 7) son quienes, ya con las entidades resueltas, deciden cuáles
 * candidatas son realmente ejecutables.
 */

import { INTENCIONES, VERBOS_CONSULTA } from '../config/intents.js';

const PATRON_NUMERO_PEDIDO = /\b\d{6,8}\b/;
// Señales de que el usuario quiere un LISTADO ("cuáles otros pedidos...") y no un pedido puntual;
// se evalúa sobre el texto ya corregido pero SIN expandir, porque abbreviations.js normaliza
// "pedidos" (plural) al concepto singular "pedido" y perderíamos la marca de plural.
const PATRON_LISTADO = /\b(pedidos|otros|otras|cuales|cuáles|todos|todas)\b/;

function clasificarIntenciones({ textoExpandido, textoOriginalNormalizado, conceptos }) {
  const conceptosDetectados = new Set(conceptos.map((c) => c.concepto));
  const tieneNumeroPedido = PATRON_NUMERO_PEDIDO.test(textoOriginalNormalizado || textoExpandido || '');
  const prefiereListado = PATRON_LISTADO.test(textoOriginalNormalizado || '');

  const candidatos = [];
  for (const [intencion, definicion] of Object.entries(INTENCIONES)) {
    const señales = definicion.conceptosDisparadores.filter((c) => conceptosDetectados.has(c));
    if (señales.length === 0) continue;

    candidatos.push({
      intencion,
      señales,
      confianza: Number((señales.length / definicion.conceptosDisparadores.length).toFixed(2)),
      pistaNumeroPedido: tieneNumeroPedido,
      prefiereListado,
    });
  }

  if (candidatos.length === 0) {
    const texto = textoExpandido || '';
    const huboVerboConsulta = VERBOS_CONSULTA.some((verbo) => texto.includes(verbo));
    if (huboVerboConsulta || tieneNumeroPedido) {
      candidatos.push({
        intencion: 'consultar_pedido',
        señales: ['verbo_consulta_generico'],
        confianza: 0.2,
        pistaNumeroPedido: tieneNumeroPedido,
      });
    }
  }

  return candidatos.sort((a, b) => b.confianza - a.confianza);
}

export { clasificarIntenciones };
