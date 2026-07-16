/**
 * ui/summary-card.js
 * Construye tarjetas-resumen estructuradas (Pedido/Proveedor/Estado/...) a partir de los
 * datos que ya devuelve el motor (`resultado.resultados`, ver Hito 3). Complementan la
 * respuesta conversacional, nunca la reemplazan — si no hay datos claros para una tarjeta,
 * simplemente no se genera ninguna.
 */

const TONO_POR_ESTADO = {
  Cerrado: 'success',
  Completa: 'success',
  Cumplida: 'success',
  Confirmada: 'success',
  Parcial: 'warning',
  Programada: 'warning',
  'En tránsito a tienda': 'warning',
  Abierto: 'neutral',
  Pendiente: 'neutral',
  Vencida: 'danger',
};

function tonoDeEstado(estado) {
  return TONO_POR_ESTADO[estado] || 'neutral';
}

function formatearFechaCorta(fecha) {
  if (!fecha) return null;
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function tarjetaPedido(pedido) {
  if (!pedido) return null;
  return {
    titulo: `Pedido ${pedido.numero_pedido}`,
    badge: { texto: pedido.estado_general, tono: tonoDeEstado(pedido.estado_general) },
    filas: [
      ['Proveedor', pedido.proveedor?.nombre],
      ['Tienda', pedido.tienda?.nombre],
      ['Creado', formatearFechaCorta(pedido.fecha_creacion)],
      ['Materiales', pedido.posiciones?.length ?? null],
    ],
  };
}

function tarjetasConsultarPedido(resultado) {
  if (!resultado) return [];
  if (resultado.comparacion?.length) {
    return resultado.comparacion.map((c) => tarjetaPedido(c.pedido)).filter(Boolean);
  }
  const tarjeta = tarjetaPedido(resultado.pedido);
  return tarjeta ? [tarjeta] : [];
}

function tarjetaLlegada(resultado) {
  if (!resultado?.llegada) return null;
  const l = resultado.llegada;
  const estadoTramo = (listo, fecha) => (listo ? `Sí${fecha ? ` · ${formatearFechaCorta(fecha)}` : ''}` : 'Todavía no');
  return {
    titulo: 'Llegada del pedido',
    badge: l.pendiente_cita ? { texto: 'Sin cita', tono: 'warning' } : { texto: 'En regla', tono: 'success' },
    filas: [
      ['CEDIS recibió', estadoTramo(l.recibo_cedis, l.fecha_recibo_cedis)],
      ['Salió a tienda', estadoTramo(l.cedis_entrega_tienda, l.fecha_entrega_tienda)],
      ['Tienda recibió', estadoTramo(l.recibo_tienda, l.fecha_recibo_tienda)],
    ],
  };
}

function tarjetaCita(cita) {
  if (!cita) return null;
  return {
    titulo: 'Cita de entrega',
    badge: { texto: cita.estado, tono: tonoDeEstado(cita.estado) },
    filas: [
      ['Proveedor', cita.proveedor?.nombre],
      ['Fecha', formatearFechaCorta(cita.fecha)],
      ['Hora', cita.hora],
    ],
  };
}

function tarjetaInventarioFila(fila) {
  return [fila.material?.descripcion ?? 'Material', `${fila.inventario_disponible} disp.${fila.faltante > 0 ? ` · faltan ${fila.faltante}` : ''}`];
}

function tarjetaInventario(resultado) {
  if (!resultado) return null;
  const filasDatos = Array.isArray(resultado) ? resultado : [resultado];
  if (filasDatos.length === 0) return null;
  return {
    titulo: Array.isArray(resultado) ? 'Inventario de la tienda' : (resultado.material?.descripcion ?? 'Inventario'),
    badge: null,
    filas: filasDatos.slice(0, 5).map(tarjetaInventarioFila),
  };
}

function tarjetaListaPedidos(resultado) {
  if (!resultado?.pedidos) return null;
  const { pedidos, etiqueta } = resultado;
  if (pedidos.length === 0) return null;
  const conteo = pedidos.reduce((acc, p) => {
    acc[p.estado_general] = (acc[p.estado_general] || 0) + 1;
    return acc;
  }, {});
  return {
    titulo: etiqueta,
    badge: { texto: `${pedidos.length} pedido(s)`, tono: 'neutral' },
    filas: Object.entries(conteo).map(([estado, n]) => [estado, String(n)]),
  };
}

const CONSTRUCTORES = {
  consultar_pedido: (r) => tarjetasConsultarPedido(r),
  consultar_llegada: (r) => [tarjetaLlegada(r)].filter(Boolean),
  consultar_cita: (r) => [tarjetaCita(r)].filter(Boolean),
  consultar_inventario: (r) => [tarjetaInventario(r)].filter(Boolean),
  buscar_pedidos_por_tienda: (r) => [tarjetaListaPedidos(r)].filter(Boolean),
  buscar_pedidos_por_proveedor: (r) => [tarjetaListaPedidos(r)].filter(Boolean),
};

/** @returns {Array<{titulo, badge, filas}>} */
function construirTarjetas(intenciones, resultados) {
  if (!intenciones || !resultados) return [];
  const tarjetas = [];
  for (const intencion of intenciones) {
    const constructor = CONSTRUCTORES[intencion];
    if (!constructor) continue;
    tarjetas.push(...constructor(resultados[intencion]));
  }
  return tarjetas.slice(0, 3);
}

function renderizarTarjeta(spec) {
  const filasHtml = spec.filas
    .filter(([, valor]) => valor !== null && valor !== undefined && valor !== '')
    .map(([label, valor]) => `
      <div class="summary-card__row">
        <span class="summary-card__row-label">${label}</span>
        <span class="summary-card__row-value">${valor}</span>
      </div>
    `)
    .join('');

  const badgeHtml = spec.badge
    ? `<span class="summary-card__badge" data-tone="${spec.badge.tono}">${spec.badge.texto}</span>`
    : '';

  const el = document.createElement('div');
  el.className = 'summary-card';
  el.innerHTML = `
    <div class="summary-card__header">
      <span class="summary-card__title">${spec.titulo}</span>
      ${badgeHtml}
    </div>
    <div class="summary-card__rows">${filasHtml}</div>
  `;
  return el;
}

export { construirTarjetas, renderizarTarjeta };
