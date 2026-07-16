/**
 * config/intents.js
 * Catálogo de intenciones soportadas: slots obligatorios, slots alternativos y qué
 * conceptos canónicos (config/synonyms.js) o entidades disparan cada intención.
 * nlu/intent-classifier.js consume este catálogo — agregar una intención nueva no debería
 * requerir tocar el clasificador, solo describirla aquí.
 */

const INTENCIONES = {
  consultar_pedido: {
    slotsObligatorios: ['numero_pedido'],
    // Slot alternativo: si no hay número de pedido, tienda + proveedor permiten buscarlo.
    slotsAlternativos: [['tienda', 'proveedor']],
    // 'proveedor' se incluye para que preguntas sueltas de seguimiento como "¿quién era el
    // proveedor?" (sin volver a decir "pedido") sigan resolviendo sobre el pedido en contexto.
    conceptosDisparadores: ['pedido', 'estado_pedido', 'proveedor'],
  },
  consultar_llegada: {
    slotsObligatorios: ['numero_pedido'],
    slotsAlternativos: [],
    conceptosDisparadores: ['recepcion', 'recepcion_parcial', 'recepcion_total', 'en_transito'],
  },
  consultar_cita: {
    slotsObligatorios: ['numero_pedido'],
    slotsAlternativos: [],
    conceptosDisparadores: ['cita', 'cita_vencida', 'cita_futura'],
  },
  consultar_inventario: {
    slotsObligatorios: ['tienda', 'material'],
    // Slot alternativo: solo tienda -> se responde con el listado general de esa tienda.
    slotsAlternativos: [['tienda']],
    conceptosDisparadores: ['inventario', 'faltante'],
  },
  buscar_pedidos_por_tienda: {
    slotsObligatorios: ['tienda'],
    slotsAlternativos: [],
    conceptosDisparadores: ['pedido'],
  },
  buscar_pedidos_por_proveedor: {
    slotsObligatorios: ['proveedor'],
    slotsAlternativos: [],
    conceptosDisparadores: ['pedido'],
  },
};

/** Verbos/frases imperativas que indican "el usuario quiere que busquemos/mostremos algo". */
const VERBOS_CONSULTA = [
  'checa', 'busca', 'buscar', 'muestrame', 'muestra', 'dime', 'quiero', 'necesito',
  'dame', 'revisa', 'ver', 'consultar', 'consulta',
];

/** Palabras interrogativas que ayudan a distinguir una pregunta de una afirmación. */
const PALABRAS_PREGUNTA = ['que', 'cual', 'cuales', 'cuanto', 'cuantos', 'cuantas', 'donde', 'como', 'ya', 'tiene', 'hay'];

export { INTENCIONES, VERBOS_CONSULTA, PALABRAS_PREGUNTA };
