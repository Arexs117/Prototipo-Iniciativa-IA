/**
 * response/templates.js
 * Fragmentos de lenguaje reutilizables (aperturas, conectores, formato de fecha/número) para
 * que response-generator.js componga texto natural y variado en vez de siempre la misma frase.
 */

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function formatearFecha(fecha) {
  if (!fecha) return null;
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function elegirAlAzar(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

const APERTURAS_PEDIDO = [
  'El pedido {numero} de {proveedor} para {tienda}',
  'Revisando el pedido {numero}: es de {proveedor}, destino {tienda},',
  'Aquí tienes el pedido {numero} ({proveedor} → {tienda}):',
];

const CONECTORES = ['Además, ', 'Por otro lado, ', 'También te comparto que ', 'Aprovechando, '];

const FRASES_SIN_DATO = [
  'Por ahora no tengo ese dato registrado.',
  'No encuentro esa información todavía.',
];

// Respuesta cuando el usuario declina una sugerencia proactiva ("¿quieres que revise...?" -> "no").
const FRASES_DECLINAR_SUGERENCIA = [
  'Entendido, aquí quedo si necesitas algo más.',
  'Perfecto, seguimos si te surge otra duda.',
  'De acuerdo, cualquier otra cosa me avisas.',
];

export {
  formatearFecha,
  elegirAlAzar,
  APERTURAS_PEDIDO,
  CONECTORES,
  FRASES_SIN_DATO,
  FRASES_DECLINAR_SUGERENCIA,
};
