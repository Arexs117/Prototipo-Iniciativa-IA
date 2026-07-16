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
import { detectarConfirmacion } from '../nlu/confirmation-detector.js';
import { normalizar } from '../shared/text-utils.js';

import {
  crearSessionState,
  resolverEntidadesConContexto,
  actualizarContexto,
  esReferenciaAContextoAnterior,
  restaurarContextoAnterior,
  registrarTurno,
  TIPOS_ENTIDAD,
} from './session-state.js';

import {
  generarRespuesta,
  generarRespuestaSugerenciaDeclinada,
  generarRespuestaSugerenciaSinIntencion,
} from '../response/response-generator.js';
import { generarSugerencias } from '../response/suggestion-engine.js';
import { crearIndicadorPensando } from '../response/thinking-simulator.js';

async function inicializarMotor(rutaExcel) {
  await cargarDatos(rutaExcel);
}

// ---------------------------------------------------------------------------
// Continuación de una intención "en espera" (slot pendiente de un turno anterior)
// ---------------------------------------------------------------------------

/**
 * Si el turno anterior ofreció opciones concretas (chips de aclaración) y este mensaje
 * coincide EXACTO con el nombre de una de ellas, esa es la respuesta — sin pasar por la
 * extracción difusa de entidades. Necesario porque el usuario suele responder tal cual una
 * de las opciones que nosotros mismos ofrecimos (p. ej. clic en un chip), y esa opción puede
 * ser, a la vez, un prefijo textual de otra ("Tienda Cumbres" es prefijo de "Tienda Cumbres
 * Sur") — la búsqueda difusa por diseño seguiría reportando ambigüedad en ese caso.
 */
function coincideConOpcionOfrecida(pendiente, textoNormalizado) {
  if (!pendiente.opcionesOfrecidas || !textoNormalizado) return null;
  const texto = normalizar(textoNormalizado);
  return pendiente.opcionesOfrecidas.find((op) => normalizar(op.nombre) === texto) || null;
}

function construirEntidadesDesdePendiente(estado, entidadesDelTurno, textoNormalizado) {
  const pendiente = estado.pendiente;
  const opcionElegida = coincideConOpcionOfrecida(pendiente, textoNormalizado);
  const candidatosDelTurno = entidadesDelTurno[pendiente.slot] || [];

  const entidadesResueltas = {};
  for (const tipo of TIPOS_ENTIDAD) {
    if (tipo === pendiente.slot) {
      if (opcionElegida) {
        entidadesResueltas[tipo] = { valor: opcionElegida.codigo, origen: 'turno_actual' };
      } else if (candidatosDelTurno.length > 1) {
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
  const opcionesOfrecidas = resolucion.necesitaAclaracion?.candidatos || null;
  estado.pendiente = { intencion, slot, entidadesParciales, opcionesOfrecidas };
}

// ---------------------------------------------------------------------------
// Confirmación de una sugerencia proactiva ("¿quieres que revise si tiene cita?" -> "sí")
// ---------------------------------------------------------------------------

/**
 * Una sugerencia proactiva (suggestion-engine.js) es, en el fondo, una pregunta de sí/no que el
 * propio asistente hizo. Antes no quedaba registro de ESA pregunta en la sesión, así que un
 * "sí" del usuario llegaba al turno siguiente como un mensaje nuevo, sin entidades reconocibles
 * y sin intención clasificable — el motor respondía con el fallback genérico de "no entendí tu
 * solicitud" justo cuando el usuario estaba aceptando lo que se le acababa de ofrecer. Esta
 * función resuelve esa confirmación usando el contexto/memoria ya vigente (el pedido, tienda,
 * etc. de la respuesta anterior siguen activos, así que no hace falta que el usuario los repita).
 *
 * @returns el resultado de turno ya finalizado, o null si el mensaje no fue una confirmación
 *   clara (en ese caso el llamador debe seguir el flujo normal, tratándolo como mensaje nuevo).
 */
function manejarConfirmacionSugerencia(estado, mensajeUsuario, textoNormalizado, indicadorPensando) {
  const sugerencia = estado.sugerenciaPendiente;
  estado.sugerenciaPendiente = null; // se consume: nunca sigue vigente más de un turno

  const confirmacion = detectarConfirmacion(mensajeUsuario);
  if (!confirmacion) return null;

  if (confirmacion === 'negativa') {
    const respuesta = generarRespuestaSugerenciaDeclinada();
    registrarTurno(estado, { mensajeUsuario, textoNormalizado, intencionesDetectadas: [], tono: respuesta.tono });
    return { respuesta, indicadorPensando, intenciones: [], entidadesResueltas: {}, resultados: {} };
  }

  // Afirmativa, pero la sugerencia no se puede ejecutar solo con un "sí" (p. ej. faltaba saber
  // cuál pedido en particular): se pregunta puntualmente lo que falta, sin fallback genérico.
  if (!sugerencia.intencionConfirmacion) {
    const respuesta = generarRespuestaSugerenciaSinIntencion(sugerencia.preguntaSeguimiento);
    registrarTurno(estado, { mensajeUsuario, textoNormalizado, intencionesDetectadas: [], tono: respuesta.tono });
    return { respuesta, indicadorPensando, intenciones: [], entidadesResueltas: {}, resultados: {} };
  }

  const { entidadesResueltas: base } = resolverEntidadesConContexto(estado, {}, textoNormalizado);
  let entidadesResueltas = enriquecerConPedidoDelTurno(base);
  if (sugerencia.evitarSlot) {
    // Reintentar consultar_inventario sin el material forzado (para que caiga al slot
    // alternativo "solo tienda" y muestre el listado completo, en vez de repetir el mismo
    // resultado vacío que originó la sugerencia).
    entidadesResueltas = { ...entidadesResueltas, [sugerencia.evitarSlot]: { valor: null, origen: 'sin_resolver' } };
  }

  const resolucion = resolverAmbiguedad(
    [{ intencion: sugerencia.intencionConfirmacion, señales: ['continuacion_sugerencia'], confianza: 1 }],
    entidadesResueltas
  );

  if (resolucion.listas.length === 0 && (resolucion.necesitaAclaracion || resolucion.necesitaDatoFaltante)) {
    guardarPendiente(estado, sugerencia.intencionConfirmacion, resolucion, entidadesResueltas);
  }

  return finalizarTurno(estado, { resolucion, entidadesResueltas, textoNormalizado, mensajeUsuario, indicadorPensando });
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
          // Se incluye `llegada` (no solo pedido/recepciones) para que la comparación pueda
          // decir "cuál llegó primero" con datos reales, en vez de solo listar estados.
          comparacion: valoresMultiples.map((np) => ({
            pedido: obtenerPedido(np),
            recepciones: obtenerRecepcionesPorPedido(np),
            llegada: obtenerLlegadaPorPedido(np),
          })),
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
function entidadesDesdePedido(pedido) {
  const derivadas = {};
  if (pedido?.tienda) derivadas.tienda = pedido.tienda.codigo_tienda;
  if (pedido?.proveedor) derivadas.proveedor = pedido.proveedor.codigo_proveedor;
  if (pedido?.cedis) derivadas.cedis = pedido.cedis.codigo_cedis;
  return derivadas;
}

function derivarEntidadesDeResultados(resultados) {
  const derivadas = entidadesDesdePedido(resultados.consultar_pedido?.pedido);
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

/**
 * Consultas múltiples en un solo mensaje ("¿ya llegó el pedido 4500105 y cuánto inventario
 * hay en la tienda?") necesitan que el número de pedido explícito de ESTE turno también
 * resuelva tienda/proveedor/cedis para las intenciones hermanas del mismo mensaje — si no,
 * consultar_inventario no tiene tienda, nunca queda "lista", y esa parte de la pregunta se
 * descarta en silencio sin que el usuario sepa por qué. Se resuelve antes de evaluar
 * ambigüedad, con el mismo dato que ya se cachea en memoria (sin costo real).
 */
function enriquecerConPedidoDelTurno(entidadesResueltas) {
  const numeroPedido = entidadesResueltas.numero_pedido?.valor;
  if (!numeroPedido) return entidadesResueltas;
  const pedido = obtenerPedido(numeroPedido);
  if (!pedido) return entidadesResueltas;
  return fusionarEntidadesDerivadas(entidadesResueltas, entidadesDesdePedido(pedido));
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
      const entidadesResueltas = construirEntidadesDesdePendiente(estado, entidadesDelTurno, mensajeUsuario);
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

  // Confirmación (o rechazo) de una sugerencia proactiva del turno anterior ("¿quieres que
  // revise si tiene cita?" -> "sí"). Si el mensaje no es un sí/no claro, se sigue el flujo
  // normal como si fuera un mensaje nuevo (la sugerencia ya quedó consumida/descartada).
  if (estado.sugerenciaPendiente) {
    const resultadoConfirmacion = manejarConfirmacionSugerencia(estado, mensajeUsuario, textoCorregido, indicadorPensando);
    if (resultadoConfirmacion) return resultadoConfirmacion;
  }

  // "El pedido de hace rato": restaura el contexto archivado más reciente antes de resolver.
  if (esReferenciaAContextoAnterior(textoCorregido)) {
    restaurarContextoAnterior(estado);
  }

  // Paso 4: intención(es) candidata(s).
  const candidatosIntencion = clasificarIntenciones({ textoExpandido, textoOriginalNormalizado: textoCorregido, conceptos });

  // Paso 6: resolución de contexto (contexto activo / memoria de sesión).
  const { entidadesResueltas: entidadesDelPaso6, huboCambioDeTema } = resolverEntidadesConContexto(estado, entidadesDelTurno, textoCorregido);
  const entidadesResueltas = enriquecerConPedidoDelTurno(entidadesDelPaso6);

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

  // Motor de sugerencias (proactivo, opcional). Se recuerda cuál fue la última sugerencia (si
  // hubo alguna) para poder interpretar un "sí"/"no" del usuario en el turno siguiente — ver
  // manejarConfirmacionSugerencia(). Si este turno no generó sugerencia, se limpia cualquier
  // rastro de una anterior: ya no aplica confirmarla fuera de contexto.
  const sugerencias = generarSugerencias({ listas: resolucion.listas, resultados });
  estado.sugerenciaPendiente = sugerencias.length > 0
    ? {
        intencionConfirmacion: sugerencias[0].intencionConfirmacion,
        preguntaSeguimiento: sugerencias[0].preguntaSeguimiento,
        evitarSlot: sugerencias[0].evitarSlot,
      }
    : null;

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

  // `resultados` se expone para que una UI pueda construir tarjetas-resumen estructuradas
  // (Pedido/Proveedor/Estado/...) además del texto narrativo — el texto sigue siendo la
  // fuente de verdad conversacional, esto es un complemento visual opcional.
  return { respuesta, indicadorPensando, intenciones: resolucion.listas, entidadesResueltas, resultados };
}

export { inicializarMotor, procesarMensaje, crearSessionState };
