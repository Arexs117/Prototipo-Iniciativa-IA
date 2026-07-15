/**
 * response/response-generator.js
 * Paso 9 del pipeline: convierte resultados de datos (o la falta de ellos) en lenguaje
 * natural. Si hay varias intenciones resueltas en el mismo turno, las integra en una sola
 * respuesta narrativa (no una lista de respuestas separadas). Nunca expone mecanismos
 * internos (reglas, nombres de archivo, stack traces) — todo error se convierte en una
 * frase conversacional.
 */

import { formatearFecha, elegirAlAzar, CONECTORES } from './templates.js';

const NOMBRE_SLOT = {
  numero_pedido: 'el número de pedido',
  tienda: 'la tienda',
  proveedor: 'el proveedor',
  material: 'el material',
  cedis: 'el CEDIS',
};

function unirNatural(nombres) {
  if (nombres.length === 0) return '';
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

function minusculaInicial(texto) {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}

function estadoLegible(estadoGeneral) {
  const mapa = {
    Abierto: 'abierto (aún sin recepción)',
    Parcial: 'parcial (recepción incompleta)',
    Cerrado: 'cerrado (recepción completa)',
  };
  return mapa[estadoGeneral] || estadoGeneral?.toLowerCase() || 'sin estado registrado';
}

// ---------------------------------------------------------------------------
// Aclaración / dato faltante
// ---------------------------------------------------------------------------

function construirPreguntaAclaracion({ candidatos }) {
  const nombres = candidatos.map((c) => c.nombre);
  const texto = `Encontré más de una coincidencia: ${unirNatural(nombres)}. ¿Podrías indicarme a cuál te refieres?`;
  return { texto, tono: 'aclaracion', opciones: candidatos };
}

function construirPreguntaDatoFaltante({ slot }) {
  const nombreSlot = NOMBRE_SLOT[slot] || 'ese dato';
  return { texto: `Para ayudarte necesito que me compartas ${nombreSlot}. ¿Me lo confirmas?`, tono: 'dato_faltante', slot };
}

// ---------------------------------------------------------------------------
// Formateadores por intención
// ---------------------------------------------------------------------------

function formatearComparacionPedidos(comparacion) {
  const partes = comparacion.map(({ pedido }) => {
    if (!pedido) return 'uno de los pedidos no lo encontré en el sistema';
    return `el ${pedido.numero_pedido} está ${estadoLegible(pedido.estado_general)}`;
  });
  return `Comparando ambos pedidos: ${partes.join('; ')}.`;
}

function formatearConsultarPedido({ pedido, recepciones, pedidosMultiples, etiqueta, comparacion }) {
  if (comparacion?.length > 1) {
    return formatearComparacionPedidos(comparacion);
  }
  if (pedidosMultiples?.length) {
    const lista = pedidosMultiples.map((p) => `${p.numero_pedido} (${p.estado_general.toLowerCase()})`).join(', ');
    return `Encontré ${pedidosMultiples.length} pedidos que coinciden con ${etiqueta}: ${lista}. ¿Cuál te interesa?`;
  }
  if (!pedido) return `No encontré ningún pedido para ${etiqueta ?? 'esos datos'} — ¿podrías confirmarme el número de pedido?`;

  const fecha = formatearFecha(pedido.fecha_creacion);
  let texto = `El pedido ${pedido.numero_pedido} de ${pedido.proveedor?.nombre ?? 'un proveedor no registrado'} para ${pedido.tienda?.nombre ?? 'una tienda no registrada'} está ${estadoLegible(pedido.estado_general)}`;
  texto += fecha ? `, creado el ${fecha}. ` : '. ';

  if (pedido.posiciones?.length) {
    texto += `Incluye ${pedido.posiciones.length} material(es): ${pedido.posiciones.map((p) => `${p.material?.descripcion ?? p.material} (${p.cantidad_solicitada} ${p.material?.unidad_medida ?? 'uds'})`).join(', ')}. `;
  }

  if (recepciones?.length && pedido.estado_general !== 'Abierto') {
    const conFaltante = recepciones.filter((r) => r.cantidad_recibida < r.cantidad_solicitada);
    if (conFaltante.length > 0) {
      texto += `Todavía falta por recibir: ${conFaltante.map((r) => `${r.material?.descripcion ?? r.material} (${r.cantidad_recibida}/${r.cantidad_solicitada})`).join(', ')}.`;
    } else {
      texto += 'Ya se recibió todo lo solicitado.';
    }
  }

  return texto.trim();
}

function formatearConsultarLlegada({ recepciones, llegada }) {
  if (!llegada && !recepciones?.length) {
    return 'No encontré información logística para ese pedido.';
  }

  const partes = [];

  if (recepciones?.length) {
    const completos = recepciones.filter((r) => r.estado_posicion === 'Completa').length;
    partes.push(`De los ${recepciones.length} materiales del pedido, ${completos} ya se recibieron por completo.`);
    const pendientes = recepciones.filter((r) => r.estado_posicion !== 'Completa');
    if (pendientes.length > 0) {
      partes.push(`Pendientes: ${pendientes.map((r) => `${r.material?.descripcion ?? r.material} (${r.estado_posicion.toLowerCase()})`).join(', ')}.`);
    }
  }

  if (llegada) {
    if (llegada.recibo_cedis) {
      partes.push(`El CEDIS ya recibió la mercancía${llegada.fecha_recibo_cedis ? ` el ${formatearFecha(llegada.fecha_recibo_cedis)}` : ''}.`);
    } else {
      partes.push('El CEDIS todavía no recibe la mercancía del proveedor.');
    }
    if (llegada.cedis_entrega_tienda) {
      partes.push(`El CEDIS ya despachó hacia la tienda${llegada.fecha_entrega_tienda ? ` el ${formatearFecha(llegada.fecha_entrega_tienda)}` : ''}.`);
    } else if (llegada.recibo_cedis) {
      partes.push('Aún no sale del CEDIS hacia la tienda.');
    }
    if (llegada.recibo_tienda) {
      partes.push(`La tienda ya la recibió${llegada.fecha_recibo_tienda ? ` el ${formatearFecha(llegada.fecha_recibo_tienda)}` : ''}.`);
    }
    if (llegada.pendiente_cita) {
      partes.push('Todavía está pendiente agendar una cita de entrega.');
    }
  }

  return partes.join(' ');
}

function formatearConsultarCita(cita) {
  if (!cita) {
    return 'Todavía no hay una cita registrada para este pedido — en cuanto se agende te la puedo confirmar.';
  }
  const fecha = formatearFecha(cita.fecha);
  let texto = `La cita con ${cita.proveedor?.nombre ?? 'el proveedor'} está ${cita.estado.toLowerCase()}, programada para el ${fecha} a las ${cita.hora}.`;
  if (cita.estado === 'Vencida') {
    texto += ' No se cumplió a tiempo — podría valer la pena dar seguimiento con el proveedor.';
  } else if (cita.estado === 'Cumplida') {
    texto += cita.entrega_realizada ? ' La entrega se completó en esa cita.' : '';
  }
  return texto;
}

function formatearFilaInventario(fila) {
  let texto = `${fila.material?.descripcion ?? fila.material}: ${fila.inventario_disponible} disponibles`;
  if (fila.inventario_transito > 0) texto += `, ${fila.inventario_transito} en tránsito`;
  if (fila.faltante > 0) texto += `, con un faltante de ${fila.faltante}`;
  return `${texto}.`;
}

function formatearConsultarInventario(resultado) {
  if (resultado === null) {
    return 'No tengo registro de inventario para esa combinación de tienda y material.';
  }
  if (Array.isArray(resultado)) {
    if (resultado.length === 0) return 'No encontré inventario registrado para esa tienda.';
    return `Así está el inventario de la tienda: ${resultado.map(formatearFilaInventario).join(' ')}`;
  }
  return formatearFilaInventario(resultado);
}

function formatearBuscarPedidos(pedidos, etiquetaFiltro) {
  if (!pedidos || pedidos.length === 0) {
    return `No encontré pedidos para ${etiquetaFiltro}.`;
  }
  const lista = pedidos.map((p) => `${p.numero_pedido} (${p.estado_general.toLowerCase()})`).join(', ');
  return `Encontré ${pedidos.length} pedido(s) para ${etiquetaFiltro}: ${lista}.`;
}

// ---------------------------------------------------------------------------

function formatearSeccion(intencion, resultado) {
  switch (intencion) {
    case 'consultar_pedido':
      return formatearConsultarPedido(resultado);
    case 'consultar_llegada':
      return formatearConsultarLlegada(resultado);
    case 'consultar_cita':
      return formatearConsultarCita(resultado);
    case 'consultar_inventario':
      return formatearConsultarInventario(resultado);
    case 'buscar_pedidos_por_tienda':
      return formatearBuscarPedidos(resultado.pedidos, resultado.etiqueta);
    case 'buscar_pedidos_por_proveedor':
      return formatearBuscarPedidos(resultado.pedidos, `el proveedor ${resultado.etiqueta}`);
    default:
      return null;
  }
}

function unirSecciones(secciones) {
  const validas = secciones.filter(Boolean);
  if (validas.length === 0) {
    return 'No logré encontrar información para responderte eso. ¿Podrías darme un poco más de detalle?';
  }
  return validas
    .map((seccion, indice) => {
      if (indice === 0) return seccion;
      const conector = elegirAlAzar(CONECTORES);
      return `${conector}${minusculaInicial(seccion)}`;
    })
    .join(' ');
}

/**
 * @param {object} resolucion - salida de ambiguity-resolver.resolverAmbiguedad
 * @param {object} resultados - mapa intencion -> datos ya consultados por el orquestador
 * @param {string[]} sugerencias - frases opcionales de suggestion-engine.js (se anexan al final)
 */
function generarRespuesta({ resolucion, resultados, sugerencias = [] }) {
  if (resolucion.necesitaAclaracion) {
    return construirPreguntaAclaracion(resolucion.necesitaAclaracion);
  }
  if (resolucion.necesitaDatoFaltante) {
    return construirPreguntaDatoFaltante(resolucion.necesitaDatoFaltante);
  }
  if (!resolucion.listas || resolucion.listas.length === 0) {
    return {
      texto: 'Disculpa, no logré entender bien tu solicitud. Puedo ayudarte con pedidos, llegadas, citas e inventario — ¿me das un poco más de detalle?',
      tono: 'fallback',
    };
  }

  const secciones = resolucion.listas.map((intencion) => formatearSeccion(intencion, resultados[intencion]));
  let texto = unirSecciones(secciones);

  if (sugerencias.length > 0) {
    texto += ` ${sugerencias.join(' ')}`;
  }

  return { texto: texto.trim(), tono: 'respuesta' };
}

export { generarRespuesta };
