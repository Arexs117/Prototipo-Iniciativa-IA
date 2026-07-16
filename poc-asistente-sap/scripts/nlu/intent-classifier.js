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

/**
 * Cuántas intenciones distintas usan cada concepto como disparador. Un concepto que SOLO
 * aparece en una intención (p. ej. 'cita', exclusivo de consultar_cita) es mucha más evidencia
 * de esa intención que uno compartido por varias (p. ej. 'pedido', que disparan por igual
 * consultar_pedido, buscar_pedidos_por_tienda Y buscar_pedidos_por_proveedor) — de ahí que el
 * peso de cada concepto sea inversamente proporcional a cuántas intenciones lo comparten.
 */
function construirFrecuenciaConceptos() {
  const frecuencia = new Map();
  for (const definicion of Object.values(INTENCIONES)) {
    for (const concepto of definicion.conceptosDisparadores) {
      frecuencia.set(concepto, (frecuencia.get(concepto) || 0) + 1);
    }
  }
  return frecuencia;
}
const FRECUENCIA_CONCEPTOS = construirFrecuenciaConceptos();
const pesoConcepto = (concepto) => 1 / (FRECUENCIA_CONCEPTOS.get(concepto) || 1);

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
      // Suma de pesos de los conceptos que SÍ coincidieron (no un ratio contra el total de
      // disparadores propios) — así una intención con un solo disparador compartido por varias
      // (buscar_pedidos_por_tienda/'pedido') no le gana en falso a otra que coincidió en un
      // concepto exclusivo y mucho más específico (consultar_cita/'cita'), como pasaba antes al
      // usar señales.length / conceptosDisparadores.length (ratio 1/1 = 1.0 siempre "perfecto"
      // para intenciones de un solo disparador, sin importar qué tan genérico fuera ese concepto).
      confianza: Number(señales.reduce((suma, c) => suma + pesoConcepto(c), 0).toFixed(3)),
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
