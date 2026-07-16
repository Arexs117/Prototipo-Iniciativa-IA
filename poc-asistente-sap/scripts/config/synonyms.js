/**
 * config/synonyms.js
 * Diccionario de jerga/abreviaciones del negocio, agrupado por concepto canónico.
 * Fuente única de verdad para nlu/abbreviations.js y nlu/spelling-tolerance.js.
 * Basado en el catálogo del Hito 2 (sección 8), ampliado con las expresiones coloquiales
 * pedidas explícitamente en el Hito 3 ("¿ya cayó?", "¿ya descargaron?", "¿ya entregaron?", etc.).
 *
 * Para hacer crecer el vocabulario: agrega variantes aquí, en español natural (con acentos).
 * El motor normaliza internamente — no hace falta tocar ningún otro archivo.
 */

const SINONIMOS = {
  pedido: ['oc', 'orden', 'orden de compra', 'compra', 'pedido', 'pedidos', 'ped', 'pedico'],
  proveedor: ['prov', 'proveedor', 'proveedores', 'distribuidor'],
  cedis: ['cedis', 'centro de distribución', 'almacén', 'bodega central'],
  tienda: ['tda', 'sucursal', 'punto de venta', 'tienda', 'tiendas'],

  recepcion: [
    'recibo', 'entrega', 'llegó', 'descarga', 'ya llegó', 'ya entró', 'ya surtió',
    'ya cayó', 'cayó', 'ya descargaron', 'descargaron', 'ya entregaron', 'entregaron',
    'ya recibieron', 'recibieron', 'entregó', 'ya entregó',
  ],
  recepcion_parcial: ['llegó incompleto', 'llegó a medias', 'faltó', 'no llegó todo'],
  recepcion_total: ['llegó completo', 'ya está todo', 'se cerró'],

  inventario: ['stock', 'existencia', 'inventario', 'lo que hay', 'lo que tenemos'],
  faltante: ['falta', 'no alcanzó', 'quedó corto', 'se quedó corto'],
  en_transito: [
    'viene en camino', 'vienen en camino', 'va para acá', 'está en ruta',
    'todavía no llega', 'dónde viene',
  ],

  cita: ['cita', 'citas', 'cita de entrega', 'hora de entrega', 'tiene cita'],
  cita_vencida: ['se pasó la cita', 'ya se venció', 'no llegaron a la cita'],
  cita_futura: ['cita programada', 'va a llegar', 'tiene fecha'],

  material: ['material', 'materiales', 'producto', 'artículo', 'sku'],
  estado_pedido: [
    'cómo va', 'cómo van', 'en qué va', 'cómo está', 'qué status tiene', 'qué pasó con', 'qué pasó',
  ],
  numero_pedido: ['número de oc', 'folio', 'número de orden', 'número de pedido'],
};

/**
 * Vocabulario adicional (verbos de consulta, palabras de pregunta, estados) contra el cual
 * nlu/spelling-tolerance.js también corrige errores ortográficos, aunque no representen un
 * concepto de negocio por sí mismos (p. ej. "muestrame", "checa", "cuanto").
 */
const VOCABULARIO_ADICIONAL = [
  'checa', 'busca', 'muéstrame', 'muestra', 'dime', 'quiero', 'necesito', 'dame', 'revisa',
  'cuánto', 'cuántos', 'cuántas', 'dónde', 'cómo', 'cuál', 'cuáles', 'qué', 'tiene', 'hay', 'ya',
  'completo', 'incompleto', 'parcial', 'cerrado', 'abierto', 'pendiente', 'vencida', 'confirmada',
  'programada', 'cumplida', 'disponible', 'tránsito',
];

export { SINONIMOS, VOCABULARIO_ADICIONAL };
