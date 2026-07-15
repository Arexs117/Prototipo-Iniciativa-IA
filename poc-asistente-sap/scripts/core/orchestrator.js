/**
 * core/orchestrator.js
 * Coordina el ciclo completo por turno (los 10 pasos descritos en el contexto de desarrollo),
 * invocando cada módulo en orden. Es el único módulo que conoce el pipeline completo — todos
 * los demás solo conocen su propia responsabilidad.
 *
 * Expone procesarMensaje(estado, mensajeUsuario), agnóstico de UI: cualquier interfaz
 * (Teams, web, chat) puede consumirlo llamando esta única función por turno.
 */

import { cargarDatos } from '../data-connector/excel-reader.js';
import {
  obtenerPedido,
  obtenerRecepcionesPorPedido,
  obtenerLlegadaPorPedido,
  obtenerCitaPorPedido,
  obtenerInventarioPorTiendaYMaterial,
  obtenerInventarioPorTienda,
  buscarPedidosPorTienda,
  buscarPedidosPorProveedor,
  obtenerTienda,
  obtenerProveedor,
} from '../data-connector/sap-connector.js';

import { normalizarMensaje } from '../nlu/normalizer.js';
import { aplicarToleranciaOrtografica } from '../nlu/spelling-tolerance.js';
import { expandirAbreviaciones } from '../nlu/abbreviations.js';
import { clasificarIntenciones } from '../nlu/intent-classifier.js';
import { extraerEntidades } from '../nlu/entity-extractor.js';
import { resolverAmbiguedad } from '../nlu/ambiguity-resolver.js';

import {
  crearSessionState,
  resolverEntidadesConContexto,
  actualizarContexto,
  esReferenciaAContextoAnterior,
  restaurarContextoAnterior,
  registrarTurno,
  TIPOS_ENTIDAD,
} from './session-state.js';

import { generarRespuesta } from '../response/response-generator.js';
import { generarSugerencias } from '../response/suggestion-engine.js';
import { crearIndicadorPensando } from '../response/thinking-simulator.js';

async function inicializarMotor(rutaExcel) {
  await cargarDatos(rutaExcel);
}

// ---------------------------------------------------------------------------
// Continuación de una intención "en espera" (slot pendiente de un turno anterior)
// ---------------------------------------------------------------------------

function construirEntidadesDesdePendiente(estado, entidadesDelTurno) {
  const pendiente = estado.pendiente;
  const candidatosDelTurno = entidadesDelTurno[pendiente.slot] || [];

  const entidadesResueltas = {};
  for (const tipo of TIPOS_ENTIDAD) {
    if (tipo === pendiente.slot) {
      if (candidatosDelTurno.length > 1) {
        entidadesResueltas[tipo] = { candidatos: candidatosDelTurno, origen: 'turno_actual_ambiguo' };
      } else if (candidatosDelTurno.length === 1) {
        entidadesResueltas[tipo] = { valor: candidatosDelTurno[0].codigo, origen: 'turno_actual' };
      } else {
        entidadesResueltas[tipo] = { valor: null, origen: 'sin_resolver' };
      }
    } else if (pendiente.entidadesParciales[tipo]) {
      entidadesResueltas[tipo] = { valor: pendiente.entidadesParciales[tipo], origen: 'pendiente_previo' };
    } else {
      const memoria = estado.memoriaEntidades[tipo];
      entidadesResueltas[tipo] = memoria
        ? { valor: memoria, origen: 'memoria_sesion' }
        : { valor: null, origen: 'sin_resolver' };
    }
  }
  return entidadesResueltas;
}

function guardarPendiente(estado, intencion, resolucion, entidadesResueltas) {
  const entidadesParciales = {};
  for (const tipo of TIPOS_ENTIDAD) {
    if (entidadesResueltas[tipo]?.valor) entidadesParciales[tipo] = entidadesResueltas[tipo].valor;
  }
  const slot = resolucion.necesitaAclaracion?.slot || resolucion.necesitaDatoFaltante?.slot;
  estado.pendiente = { intencion, slot, entidadesParciales };
}

// ---------------------------------------------------------------------------
// Ejecución de consultas contra el data-connector
// ---------------------------------------------------------------------------

function ejecutarConsulta(intencion, entidadesResueltas) {
  const valor = (tipo) => entidadesResueltas[tipo]?.valor ?? null;

  switch (intencion) {
    case 'consultar_pedido': {
      const valoresMultiples = entidadesResueltas.numero_pedido?.valoresMultiples;
      if (valoresMultiples?.length > 1) {
        return {
          comparacion: valoresMultiples.map((np) => ({ pedido: obtenerPedido(np), recepciones: obtenerRecepcionesPorPedido(np) })),
        };
      }
      const numeroPedido = valor('numero_pedido');
      if (numeroPedido) {
        return { pedido: obtenerPedido(numeroPedido), recepciones: obtenerRecepcionesPorPedido(numeroPedido) };
      }
      // Slot alternativo: tienda + proveedor, sin número de pedido explícito.
      const tienda = valor('tienda');
      const proveedor = valor('proveedor');
      const porTienda = buscarPedidosPorTienda(tienda).map((p) => p.numero_pedido);
      const coincidentes = buscarPedidosPorProveedor(proveedor).filter((p) => porTienda.includes(p.numero_pedido));
      if (coincidentes.length === 1) {
        const np = coincidentes[0].numero_pedido;
        return { pedido: obtenerPedido(np), recepciones: obtenerRecepcionesPorPedido(np) };
      }
      return {
        pedido: null,
        pedidosMultiples: coincidentes.length > 1 ? coincidentes : null,
        etiqueta: `${obtenerTienda(tienda)?.nombre ?? tienda} / ${obtenerProveedor(proveedor)?.nombre ?? proveedor}`,
      };
    }
    case 'consultar_llegada': {
      const numeroPedido = valor('numero_pedido');
      return { recepciones: obtenerRecepcionesPorPedido(numeroPedido), llegada: obtenerLlegadaPorPedido(numeroPedido) };
    }
    case 'consultar_cita':
      return obtenerCitaPorPedido(valor('numero_pedido'));
    case 'consultar_inventario': {
      const tienda = valor('tienda');
      const material = valor('material');
      return material ? obtenerInventarioPorTiendaYMaterial(tienda, material) : obtenerInventarioPorTienda(tienda);
    }
    case 'buscar_pedidos_por_tienda': {
      const tienda = valor('tienda');
      return { pedidos: buscarPedidosPorTienda(tienda), etiqueta: obtenerTienda(tienda)?.nombre ?? tienda };
    }
    case 'buscar_pedidos_por_proveedor': {
      const proveedor = valor('proveedor');
      return { pedidos: buscarPedidosPorProveedor(proveedor), etiqueta: obtenerProveedor(proveedor)?.nombre ?? proveedor };
    }
    default:
      return null;
  }
}

function ejecutarConsultas(listas, entidadesResueltas) {
  const resultados = {};
  for (const intencion of listas) {
    resultados[intencion] = ejecutarConsulta(intencion, entidadesResueltas);
  }
  return resultados;
}

/**
 * "Aprendizaje de sesión": una vez que se consulta un pedido concreto, el motor ya sabe su
 * tienda/proveedor/cedis aunque el usuario nunca los haya escrito — así "el proveedor de ese
 * pedido, ¿qué otros pedidos tiene?" puede resolver "proveedor" sin volver a preguntarlo.
 */
function derivarEntidadesDeResultados(resultados) {
  const derivadas = {};
  const pedido = resultados.consultar_pedido?.pedido;
  if (pedido) {
    if (pedido.tienda) derivadas.tienda = pedido.tienda.codigo_tienda;
    if (pedido.proveedor) derivadas.proveedor = pedido.proveedor.codigo_proveedor;
    if (pedido.cedis) derivadas.cedis = pedido.cedis.codigo_cedis;
  }
  const cita = resultados.consultar_cita;
  if (cita?.proveedor) derivadas.proveedor = derivadas.proveedor || cita.proveedor.codigo_proveedor;
  if (cita?.cedis) derivadas.cedis = derivadas.cedis || cita.cedis.codigo_cedis;
  return derivadas;
}

function fusionarEntidadesDerivadas(entidadesResueltas, derivadas) {
  const fusionadas = { ...entidadesResueltas };
  for (const [tipo, valor] of Object.entries(derivadas)) {
    if (!fusionadas[tipo]?.valor) fusionadas[tipo] = { valor, origen: 'derivado_de_datos' };
  }
  return fusionadas;
}

// ---------------------------------------------------------------------------
// Pipeline principal
// ---------------------------------------------------------------------------

/**
 * Procesa un mensaje del usuario de punta a punta y devuelve la respuesta lista para
 * mostrarse, junto con el indicador de "pensando" que la UI puede animar antes de mostrarla.
 */
function procesarMensaje(estado, mensajeUsuario) {
  const indicadorPensando = crearIndicadorPensando();

  // Paso 1-3: normalización, tolerancia ortográfica, expansión de jerga.
  const textoNormalizado = normalizarMensaje(mensajeUsuario);
  const textoCorregido = aplicarToleranciaOrtografica(textoNormalizado);
  const { texto: textoExpandido, conceptos } = expandirAbreviaciones(textoCorregido);

  // Paso 5: extracción de entidades (independiente de qué intención se proponga).
  const entidadesDelTurno = extraerEntidades(textoExpandido, textoCorregido);

  // Continuación de una intención en espera (slot pendiente de un turno anterior).
  if (estado.pendiente) {
    const candidatosNormales = clasificarIntenciones({ textoExpandido, textoOriginalNormalizado: textoCorregido, conceptos });
    // El fallback genérico de intent-classifier (dispara con solo ver un número) no cuenta como
    // "el usuario cambió de tema": si no hay señales de negocio reales, seguimos esperando la
    // respuesta al slot pendiente.
    const soloFallbackGenerico = candidatosNormales.length === 1 && candidatosNormales[0].señales.includes('verbo_consulta_generico');
    if (candidatosNormales.length === 0 || soloFallbackGenerico) {
      const entidadesResueltas = construirEntidadesDesdePendiente(estado, entidadesDelTurno);
      const resolucion = resolverAmbiguedad([{ intencion: estado.pendiente.intencion, señales: ['continuacion'], confianza: 1 }], entidadesResueltas);

      if (resolucion.listas.length > 0) {
        estado.pendiente = null;
        return finalizarTurno(estado, { resolucion, entidadesResueltas, textoNormalizado: textoCorregido, mensajeUsuario, indicadorPensando });
      }
      guardarPendiente(estado, estado.pendiente.intencion, resolucion, entidadesResueltas);
      return finalizarTurno(estado, { resolucion, entidadesResueltas, textoNormalizado: textoCorregido, mensajeUsuario, indicadorPensando, sinActualizarContexto: true });
    }
    // El usuario cambió de tema mientras esperábamos una aclaración: se abandona lo pendiente.
    estado.pendiente = null;
  }

  // "El pedido de hace rato": restaura el contexto archivado más reciente antes de resolver.
  if (esReferenciaAContextoAnterior(textoCorregido)) {
    restaurarContextoAnterior(estado);
  }

  // Paso 4: intención(es) candidata(s).
  const candidatosIntencion = clasificarIntenciones({ textoExpandido, textoOriginalNormalizado: textoCorregido, conceptos });

  // Paso 6: resolución de contexto (contexto activo / memoria de sesión).
  const { entidadesResueltas, huboCambioDeTema } = resolverEntidadesConContexto(estado, entidadesDelTurno, textoCorregido);

  // Paso 7: ambigüedad / confianza.
  const resolucion = resolverAmbiguedad(candidatosIntencion, entidadesResueltas);

  if (resolucion.listas.length === 0 && (resolucion.necesitaAclaracion || resolucion.necesitaDatoFaltante) && candidatosIntencion.length > 0) {
    guardarPendiente(estado, candidatosIntencion[0].intencion, resolucion, entidadesResueltas);
  }

  return finalizarTurno(estado, {
    resolucion,
    entidadesResueltas,
    huboCambioDeTema,
    textoNormalizado: textoCorregido,
    mensajeUsuario,
    indicadorPensando,
  });
}

function finalizarTurno(estado, { resolucion, entidadesResueltas, huboCambioDeTema, textoNormalizado, mensajeUsuario, indicadorPensando, sinActualizarContexto }) {
  // Paso 8: consulta de datos (solo para las intenciones que sí están listas).
  const resultados = ejecutarConsultas(resolucion.listas, entidadesResueltas);

  // Motor de sugerencias (proactivo, opcional).
  const sugerencias = generarSugerencias({ listas: resolucion.listas, resultados });

  // Paso 9: generación de respuesta natural.
  const respuesta = generarRespuesta({ resolucion, resultados, sugerencias });

  // Paso 10: actualización de memoria de sesión (incluye lo que se pudo derivar de los datos).
  if (!sinActualizarContexto && resolucion.listas.length > 0) {
    const entidadesParaContexto = fusionarEntidadesDerivadas(entidadesResueltas, derivarEntidadesDeResultados(resultados));
    actualizarContexto(estado, {
      intencion: resolucion.listas[0],
      entidadesResueltas: entidadesParaContexto,
      huboCambioDeTema,
      tema: resolucion.listas[0],
    });
  }
  registrarTurno(estado, {
    mensajeUsuario,
    textoNormalizado,
    intencionesDetectadas: resolucion.listas,
    tono: respuesta.tono,
  });

  return { respuesta, indicadorPensando, intenciones: resolucion.listas, entidadesResueltas };
}

export { inicializarMotor, procesarMensaje, crearSessionState };
