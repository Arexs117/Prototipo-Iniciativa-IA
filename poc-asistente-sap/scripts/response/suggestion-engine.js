/**
 * response/suggestion-engine.js
 * Motor de sugerencias: a partir de lo que se acaba de responder, propone (como máximo una)
 * pregunta de seguimiento natural y útil — nunca satura al usuario con una lista de opciones.
 * Independiente de la UI: cualquier interfaz futura puede ignorar, mostrar como texto o como
 * botones esta sugerencia.
 *
 * Cada sugerencia lleva, además del texto, la intención que debe ejecutarse si el usuario
 * responde afirmativamente (p. ej. "sí") — sin esto, orchestrator.js no tenía forma de saber
 * qué hacer con una confirmación corta a su propia pregunta proactiva, y la conversación se
 * quedaba sin poder responder ("no entendí tu solicitud") justo cuando el usuario aceptaba lo
 * que el propio asistente había ofrecido. `intencionConfirmacion: null` marca sugerencias que
 * no se pueden ejecutar solo con un "sí" (falta saber CUÁL pedido, o falta un dato que no
 * tenemos en memoria); para esas se usa `preguntaSeguimiento` en vez de fallar en silencio.
 */

function generarSugerencias({ listas, resultados }) {
  const sugerencias = [];

  for (const intencion of listas) {
    const resultado = resultados[intencion];

    if (intencion === 'consultar_pedido' && resultado?.pedido && !listas.includes('consultar_cita')) {
      if (resultado.pedido.estado_general !== 'Cerrado') {
        sugerencias.push({
          texto: '¿Quieres que revise si ya tiene una cita de entrega agendada?',
          intencionConfirmacion: 'consultar_cita',
        });
      }
    }

    if (intencion === 'consultar_llegada' && resultado?.llegada?.pendiente_cita && !listas.includes('consultar_cita')) {
      sugerencias.push({
        texto: 'Todavía no tiene cita agendada — ¿quieres que la revisemos?',
        intencionConfirmacion: 'consultar_cita',
      });
    }

    if (intencion === 'consultar_inventario') {
      // Combinación tienda+material sin fila de inventario (ver response-generator.js): no hay
      // faltante que evaluar, pero sí vale ofrecer el listado completo de la tienda para que el
      // usuario compare — y esta vez si dice "sí" sí podemos cumplirlo (se repite la consulta
      // sin el slot de material, forzando el listado general).
      if (resultado?.fila === null && resultado.tienda && resultado.material) {
        sugerencias.push({
          texto: '¿Quieres que te muestre el inventario completo de esa tienda para comparar?',
          intencionConfirmacion: 'consultar_inventario',
          evitarSlot: 'material',
        });
        continue;
      }
      const filas = Array.isArray(resultado) ? resultado : [resultado?.fila].filter(Boolean);
      if (filas.some((f) => f?.faltante > 0) && !listas.includes('consultar_llegada')) {
        sugerencias.push({
          texto: '¿Quieres que revise si hay algo en camino para cubrir ese faltante?',
          intencionConfirmacion: null,
          preguntaSeguimiento: 'Para revisar eso necesito el número de pedido asociado — ¿me lo compartes?',
        });
      }
    }

    if ((intencion === 'buscar_pedidos_por_tienda' || intencion === 'buscar_pedidos_por_proveedor') && resultado?.pedidos?.length > 1) {
      sugerencias.push({
        texto: '¿Quieres el detalle completo de alguno de estos pedidos en particular?',
        intencionConfirmacion: null,
        preguntaSeguimiento: '¿Cuál número de pedido te interesa?',
      });
    }
  }

  return sugerencias.slice(0, 1);
}

export { generarSugerencias };
