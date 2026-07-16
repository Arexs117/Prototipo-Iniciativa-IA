/**
 * sap-connector.js
 * Responsabilidad única: exponer funciones con firma "SAP-ready" que consultan los datos
 * cacheados por excel-reader.js. Diseñado como si ya llamara a servicios reales, para que
 * el día de mañana el Excel se sustituya por endpoints SAP sin tocar el resto del motor.
 *
 * Ningún otro módulo debe leer mock-sap.xlsx directamente ni acceder a excel-reader.js:
 * todo pasa por aquí.
 */

import { obtenerDatosCacheados } from './excel-reader.js';
import { coincidenciaAproximada } from '../shared/text-utils.js';

const UMBRAL_COINCIDENCIA = 0.72;

/**
 * El Excel de demo se edita a mano entre hitos (agregar filas, corregir datos) y SheetJS puede
 * devolver el mismo código de negocio con distinta forma según cómo haya quedado la celda:
 * " T001" con espacio colgante, "t001" en minúscula, o un número de pedido leído como Number en
 * vez de string si alguien le quitó el formato de texto a la columna. Cualquiera de esas
 * variaciones rompía silenciosamente una comparación estricta (===) en un find/filter — el
 * registro SÍ existe, pero el motor respondía "no encontré" o "no tengo relación" porque el
 * código no calzaba carácter por carácter. Normalizar en el punto de comparación blinda todos
 * los lookups de catálogo contra esa clase de inconsistencia de datos, sin tener que depurar
 * fila por fila cada vez que ocurre.
 */
function normalizarCodigo(codigo) {
  if (codigo === null || codigo === undefined) return '';
  return codigo.toString().trim().toUpperCase();
}

// ---------------------------------------------------------------------------
// Catálogos maestros
// ---------------------------------------------------------------------------

function obtenerProveedor(codigoProveedor) {
  const { proveedores } = obtenerDatosCacheados();
  const buscado = normalizarCodigo(codigoProveedor);
  return proveedores.find((p) => normalizarCodigo(p.codigo_proveedor) === buscado) ?? null;
}

function obtenerCedis(codigoCedis) {
  const { cedis } = obtenerDatosCacheados();
  const buscado = normalizarCodigo(codigoCedis);
  return cedis.find((c) => normalizarCodigo(c.codigo_cedis) === buscado) ?? null;
}

function obtenerTienda(codigoTienda) {
  const { tiendas } = obtenerDatosCacheados();
  const buscado = normalizarCodigo(codigoTienda);
  return tiendas.find((t) => normalizarCodigo(t.codigo_tienda) === buscado) ?? null;
}

function obtenerMaterial(codigoMaterial) {
  const { materiales } = obtenerDatosCacheados();
  const buscado = normalizarCodigo(codigoMaterial);
  return materiales.find((m) => normalizarCodigo(m.codigo_material) === buscado) ?? null;
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

function construirPosicionesPedido(numeroPedido) {
  const { pedidoPosiciones } = obtenerDatosCacheados();
  const buscado = normalizarCodigo(numeroPedido);
  return pedidoPosiciones
    .filter((pos) => normalizarCodigo(pos.numero_pedido) === buscado)
    .sort((a, b) => a.posicion - b.posicion)
    .map((pos) => ({
      posicion: pos.posicion,
      cantidad_solicitada: pos.cantidad_solicitada,
      material: obtenerMaterial(pos.codigo_material),
    }));
}

/** Devuelve el pedido enriquecido con proveedor, tienda, cedis y sus posiciones. null si no existe. */
function obtenerPedido(numeroPedido) {
  const { pedidos } = obtenerDatosCacheados();
  const buscado = normalizarCodigo(numeroPedido);
  const pedido = pedidos.find((p) => normalizarCodigo(p.numero_pedido) === buscado);
  if (!pedido) return null;

  return {
    numero_pedido: pedido.numero_pedido,
    estado_general: pedido.estado_general,
    fecha_creacion: pedido.fecha_creacion,
    proveedor: obtenerProveedor(pedido.codigo_proveedor),
    tienda: obtenerTienda(pedido.codigo_tienda),
    cedis: obtenerCedis(pedido.codigo_cedis),
    posiciones: construirPosicionesPedido(pedido.numero_pedido),
  };
}

function buscarPedidosPorTienda(codigoTienda) {
  const { pedidos } = obtenerDatosCacheados();
  const buscado = normalizarCodigo(codigoTienda);
  return pedidos
    .filter((p) => normalizarCodigo(p.codigo_tienda) === buscado)
    .map((p) => obtenerPedido(p.numero_pedido));
}

function buscarPedidosPorProveedor(codigoProveedor) {
  const { pedidos } = obtenerDatosCacheados();
  const buscado = normalizarCodigo(codigoProveedor);
  return pedidos
    .filter((p) => normalizarCodigo(p.codigo_proveedor) === buscado)
    .map((p) => obtenerPedido(p.numero_pedido));
}

// ---------------------------------------------------------------------------
// Recepciones / Llegadas / Citas
// ---------------------------------------------------------------------------

function obtenerRecepcionesPorPedido(numeroPedido) {
  const { recepciones } = obtenerDatosCacheados();
  const buscado = normalizarCodigo(numeroPedido);
  return recepciones
    .filter((r) => normalizarCodigo(r.numero_pedido) === buscado)
    .sort((a, b) => a.posicion - b.posicion)
    .map((r) => ({
      posicion: r.posicion,
      material: obtenerMaterial(r.codigo_material),
      cantidad_solicitada: r.cantidad_solicitada,
      cantidad_recibida: r.cantidad_recibida,
      fecha_recepcion: r.fecha_recepcion,
      estado_posicion: r.estado_posicion,
    }));
}

/** 1 registro logístico por pedido (CEDIS -> Tienda). null si el pedido no existe. */
function obtenerLlegadaPorPedido(numeroPedido) {
  const { llegadas } = obtenerDatosCacheados();
  const buscado = normalizarCodigo(numeroPedido);
  return llegadas.find((l) => normalizarCodigo(l.numero_pedido) === buscado) ?? null;
}

/**
 * 0..1 cita por pedido. null es una respuesta VÁLIDA: significa "aún no hay cita registrada",
 * nunca debe tratarse como error (ver Hito2 sección 5.2 / regla de negocio 2).
 */
function obtenerCitaPorPedido(numeroPedido) {
  const { citas } = obtenerDatosCacheados();
  const buscado = normalizarCodigo(numeroPedido);
  const cita = citas.find((c) => normalizarCodigo(c.numero_pedido) === buscado);
  if (!cita) return null;

  return {
    id_cita: cita.id_cita,
    numero_pedido: cita.numero_pedido,
    proveedor: obtenerProveedor(cita.codigo_proveedor),
    cedis: obtenerCedis(cita.codigo_cedis),
    fecha: cita.fecha,
    hora: cita.hora,
    estado: cita.estado,
    entrega_realizada: cita.entrega_realizada,
  };
}

// ---------------------------------------------------------------------------
// Inventario
// ---------------------------------------------------------------------------

/**
 * Combinación tienda+material puntual. Siempre devuelve un objeto (nunca un `null` plano),
 * con `tienda` y `material` resueltos por separado del catálogo aunque no haya fila de
 * inventario — así response-generator.js puede explicar CON PRECISIÓN por qué no hay dato
 * (¿la tienda no se reconoce? ¿el material no se reconoce? ¿ambos existen pero simplemente no
 * hay fila para esa combinación?) en vez de un genérico "no existe esa relación" que resultaba
 * engañoso cuando tienda y material sí eran válidos por separado.
 */
function obtenerInventarioPorTiendaYMaterial(codigoTienda, codigoMaterial) {
  const { inventario } = obtenerDatosCacheados();
  const tiendaBuscada = normalizarCodigo(codigoTienda);
  const materialBuscado = normalizarCodigo(codigoMaterial);
  const fila = inventario.find(
    (i) => normalizarCodigo(i.codigo_tienda) === tiendaBuscada && normalizarCodigo(i.codigo_material) === materialBuscado
  );

  const tienda = obtenerTienda(codigoTienda);
  const material = obtenerMaterial(codigoMaterial);

  if (!fila) {
    return { fila: null, tienda, material };
  }

  return {
    fila: {
      tienda: obtenerTienda(fila.codigo_tienda),
      material: obtenerMaterial(fila.codigo_material),
      inventario_disponible: fila.inventario_disponible,
      inventario_transito: fila.inventario_transito,
      faltante: fila.faltante,
    },
    tienda,
    material,
  };
}

/** Lista completa de inventario de una tienda (slot alternativo de consultar_inventario). */
function obtenerInventarioPorTienda(codigoTienda) {
  const { inventario } = obtenerDatosCacheados();
  const buscado = normalizarCodigo(codigoTienda);
  return inventario
    .filter((i) => normalizarCodigo(i.codigo_tienda) === buscado)
    .map((i) => ({
      tienda: obtenerTienda(i.codigo_tienda),
      material: obtenerMaterial(i.codigo_material),
      inventario_disponible: i.inventario_disponible,
      inventario_transito: i.inventario_transito,
      faltante: i.faltante,
    }));
}

// ---------------------------------------------------------------------------
// Búsqueda aproximada (soporte a resolución de ambigüedad)
// ---------------------------------------------------------------------------

function buscarPorNombreAproximado(texto, filas, campoCodigo, campoNombre, mapearRegistro) {
  let candidatos = filas
    .map((fila) => {
      const { coincide, score } = coincidenciaAproximada(texto, fila[campoNombre], UMBRAL_COINCIDENCIA);
      return { fila, coincide, score };
    })
    .filter((c) => c.coincide)
    .sort((a, b) => b.score - a.score);

  // Si el texto coincide EXACTO con un nombre (score 1, p. ej. el usuario eligió "Tienda
  // Cumbres" desde un chip de aclaración), ese es el único resultado válido — sin este filtro,
  // "Tienda Cumbres" seguiría matcheando también "Tienda Cumbres Sur" por ser prefijo, y la
  // aclaración nunca se resolvería (bug crítico: el usuario elige una opción y el asistente
  // vuelve a preguntar lo mismo).
  const exactos = candidatos.filter((c) => c.score === 1);
  if (exactos.length > 0) candidatos = exactos;

  return candidatos.map((c) => ({
    codigo: c.fila[campoCodigo],
    nombre: c.fila[campoNombre],
    score: Number(c.score.toFixed(3)),
    registro: mapearRegistro ? mapearRegistro(c.fila) : c.fila,
  }));
}

/** "cumbres" -> [T001 Tienda Cumbres, T002 Tienda Cumbres Sur] */
function buscarTiendaPorNombreAproximado(texto) {
  const { tiendas } = obtenerDatosCacheados();
  return buscarPorNombreAproximado(texto, tiendas, 'codigo_tienda', 'nombre');
}

/** "leche" -> [M001 Leche Entera, M002 Leche Deslactosada] */
function buscarMaterialPorNombreAproximado(texto) {
  const { materiales } = obtenerDatosCacheados();
  return buscarPorNombreAproximado(texto, materiales, 'codigo_material', 'descripcion');
}

/** Extensión natural del mismo patrón, útil cuando el usuario nombra al proveedor en vez del código. */
function buscarProveedorPorNombreAproximado(texto) {
  const { proveedores } = obtenerDatosCacheados();
  return buscarPorNombreAproximado(texto, proveedores, 'codigo_proveedor', 'nombre');
}

export {
  obtenerProveedor,
  obtenerCedis,
  obtenerTienda,
  obtenerMaterial,
  obtenerPedido,
  buscarPedidosPorTienda,
  buscarPedidosPorProveedor,
  obtenerRecepcionesPorPedido,
  obtenerLlegadaPorPedido,
  obtenerCitaPorPedido,
  obtenerInventarioPorTiendaYMaterial,
  obtenerInventarioPorTienda,
  buscarTiendaPorNombreAproximado,
  buscarMaterialPorNombreAproximado,
  buscarProveedorPorNombreAproximado,
};
