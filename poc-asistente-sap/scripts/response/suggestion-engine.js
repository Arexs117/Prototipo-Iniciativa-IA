/**
 * response/suggestion-engine.js
 * Motor de sugerencias: a partir de lo que se acaba de responder, propone (como máximo una)
 * pregunta de seguimiento natural y útil — nunca satura al usuario con una lista de opciones.
 * Independiente de la UI: cualquier interfaz futura puede ignorar, mostrar como texto o como
 * botones esta sugerencia.
 */

function generarSugerencias({ listas, resultados }) {
  const sugerencias = [];

  for (const intencion of listas) {
    const resultado = resultados[intencion];

    if (intencion === 'consultar_pedido' && resultado?.pedido && !listas.includes('consultar_cita')) {
      if (resultado.pedido.estado_general !== 'Cerrado') {
        sugerencias.push('¿Quieres que revise si ya tiene una cita de entrega agendada?');
      }
    }

    if (intencion === 'consultar_llegada' && resultado?.llegada?.pendiente_cita && !listas.includes('consultar_cita')) {
      sugerencias.push('Todavía no tiene cita agendada — ¿quieres que la revisemos?');
    }

    if (intencion === 'consultar_inventario') {
      const filas = Array.isArray(resultado) ? resultado : [resultado].filter(Boolean);
      if (filas.some((f) => f?.faltante > 0) && !listas.includes('consultar_llegada')) {
        sugerencias.push('¿Quieres que revise si hay algo en camino para cubrir ese faltante?');
      }
    }

    if ((intencion === 'buscar_pedidos_por_tienda' || intencion === 'buscar_pedidos_por_proveedor') && resultado?.pedidos?.length > 1) {
      sugerencias.push('¿Quieres el detalle completo de alguno de estos pedidos en particular?');
    }
  }

  return sugerencias.slice(0, 1);
}

export { generarSugerencias };
