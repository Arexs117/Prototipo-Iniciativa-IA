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

// ---------------------------------------------------------------------------
// Catálogos maestros
// ---------------------------------------------------------------------------

function obtenerProveedor(codigoProveedor) {
  const { proveedores } = obtenerDatosCacheados();
  return proveedores.find((p) => p.codigo_proveedor === codigoProveedor) ?? null;
}

function obtenerCedis(codigoCedis) {
  const { cedis } = obtenerDatosCacheados();
  return cedis.find((c) => c.codigo_cedis === codigoCedis) ?? null;
}

function obtenerTienda(codigoTienda) {
  const { tiendas } = obtenerDatosCacheados();
  return tiendas.find((t) => t.codigo_tienda === codigoTienda) ?? null;
}

function obtenerMaterial(codigoMaterial) {
  const { materiales } = obtenerDatosCacheados();
  return materiales.find((m) => m.codigo_material === codigoMaterial) ?? null;
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

function construirPosicionesPedido(numeroPedido) {
  const { pedidoPosiciones } = obtenerDatosCacheados();
  return pedidoPosiciones
    .filter((pos) => pos.numero_pedido === numeroPedido)
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
  const pedido = pedidos.find((p) => p.numero_pedido === numeroPedido);
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
  return pedidos
    .filter((p) => p.codigo_tienda === codigoTienda)
    .map((p) => obtenerPedido(p.numero_pedido));
}

function buscarPedidosPorProveedor(codigoProveedor) {
  const { pedidos } = obtenerDatosCacheados();
  return pedidos
    .filter((p) => p.codigo_proveedor === codigoProveedor)
    .map((p) => obtenerPedido(p.numero_pedido));
}

// ---------------------------------------------------------------------------
// Recepciones / Llegadas / Citas
// ---------------------------------------------------------------------------

function obtenerRecepcionesPorPedido(numeroPedido) {
  const { recepciones } = obtenerDatosCacheados();
  return recepciones
    .filter((r) => r.numero_pedido === numeroPedido)
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
  return llegadas.find((l) => l.numero_pedido === numeroPedido) ?? null;
}

/**
 * 0..1 cita por pedido. null es una respuesta VÁLIDA: significa "aún no hay cita registrada",
 * nunca debe tratarse como error (ver Hito2 sección 5.2 / regla de negocio 2).
 */
function obtenerCitaPorPedido(numeroPedido) {
  const { citas } = obtenerDatosCacheados();
  const cita = citas.find((c) => c.numero_pedido === numeroPedido);
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

/** Combinación tienda+material puntual. null si no existe esa combinación en el dataset. */
function obtenerInventarioPorTiendaYMaterial(codigoTienda, codigoMaterial) {
  const { inventario } = obtenerDatosCacheados();
  const fila = inventario.find(
    (i) => i.codigo_tienda === codigoTienda && i.codigo_material === codigoMaterial
  );
  if (!fila) return null;

  return {
    tienda: obtenerTienda(fila.codigo_tienda),
    material: obtenerMaterial(fila.codigo_material),
    inventario_disponible: fila.inventario_disponible,
    inventario_transito: fila.inventario_transito,
    faltante: fila.faltante,
  };
}

/** Lista completa de inventario de una tienda (slot alternativo de consultar_inventario). */
function obtenerInventarioPorTienda(codigoTienda) {
  const { inventario } = obtenerDatosCacheados();
  return inventario
    .filter((i) => i.codigo_tienda === codigoTienda)
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
