/**
 * core/session-state.js
 * Responsabilidad única: memoria conversacional en memoria de sesión (nunca localStorage,
 * ver decisión de arquitectura 3 del contexto de desarrollo). Modelo de "frames"
 * activos/archivados: el contexto activo nunca se borra al cambiar de tema, se archiva.
 *
 * También implementa el paso 6 del pipeline ("Resolución de contexto"): si al turno actual
 * le faltan entidades para completar un slot, este módulo decide si puede llenarlas desde el
 * contexto activo o desde la memoria de entidades recientes, antes de que ambiguity-resolver.js
 * tenga que pedirlas explícitamente.
 */

const TIPOS_ENTIDAD = ['numero_pedido', 'tienda', 'proveedor', 'cedis', 'material'];

const PATRON_CAMBIO_TEMA_EXPLICITO = /\b(cambio de tema|cambiando de tema|otra cosa|hablemos de otra cosa|dejemos eso)\b/;
const PATRON_REFERENCIA_ANTERIOR = /\b(hace rato|lo anterior|el de antes|anteriormente|lo de antes|el anterior)\b/;

function crearSessionState() {
  return {
    turnoActual: 0,
    contextoActivo: null,
    contextosArchivados: [],
    memoriaEntidades: {
      numero_pedido: null,
      tienda: null,
      proveedor: null,
      cedis: null,
      material: null,
    },
    preferenciasSesion: {},
    correccionesUsuario: [],
    historial: [],
  };
}

function tomarPrimeraEntidad(entidadesDelTurno, tipo) {
  const lista = entidadesDelTurno?.[tipo];
  if (!lista || lista.length === 0) return null;
  return lista[0];
}

/** ¿El turno trajo explícitamente una entidad de este tipo con un valor distinto al de memoria? */
function huboEntidadExplicitaDistinta(entidadesDelTurno, tipo, valorEnMemoria) {
  const candidatos = entidadesDelTurno?.[tipo];
  if (!candidatos || candidatos.length === 0) return false;
  if (!valorEnMemoria) return true;
  return !candidatos.some((c) => c.codigo === valorEnMemoria);
}

function detectarCambioDeTema(estado, entidadesDelTurno, textoNormalizado) {
  if (!estado.contextoActivo) return false;
  if (PATRON_CAMBIO_TEMA_EXPLICITO.test(textoNormalizado || '')) return true;

  const entidadesContexto = estado.contextoActivo.entidades;
  for (const tipo of TIPOS_ENTIDAD) {
    const valorContexto = entidadesContexto[tipo];
    if (!valorContexto) continue;
    if (huboEntidadExplicitaDistinta(entidadesDelTurno, tipo, valorContexto)) return true;
  }
  return false;
}

/**
 * Completa entidades faltantes del turno actual usando, en orden de prioridad:
 * 1) lo que el propio turno trajo explícitamente,
 * 2) el contexto activo (si el tema no cambió),
 * 3) la memoria de entidades recientes (aprendizaje de sesión: reduce preguntas repetidas).
 * Devuelve, por tipo de entidad, el valor resuelto + su origen (para trazabilidad).
 */
function resolverEntidadesConContexto(estado, entidadesDelTurno, textoNormalizado) {
  const huboCambioDeTema = detectarCambioDeTema(estado, entidadesDelTurno, textoNormalizado);
  const contextoDisponible = huboCambioDeTema ? null : estado.contextoActivo;

  const resueltas = {};
  for (const tipo of TIPOS_ENTIDAD) {
    const candidatosDelTurno = entidadesDelTurno?.[tipo] || [];

    // numero_pedido nunca se resuelve por nombre aproximado (siempre es un código explícito),
    // así que dos o más en el mismo turno no son ambigüedad: es una comparación ("el 4500101 y
    // el 4500117"). Para los demás tipos, dos candidatos sí es ambigüedad real a aclarar.
    if (candidatosDelTurno.length > 1 && tipo === 'numero_pedido') {
      resueltas[tipo] = {
        valor: candidatosDelTurno[0].codigo,
        valoresMultiples: candidatosDelTurno.map((c) => c.codigo),
        origen: 'turno_actual',
      };
      continue;
    }
    if (candidatosDelTurno.length > 1) {
      resueltas[tipo] = { candidatos: candidatosDelTurno, origen: 'turno_actual_ambiguo' };
      continue;
    }
    if (candidatosDelTurno.length === 1) {
      resueltas[tipo] = { valor: candidatosDelTurno[0].codigo, origen: 'turno_actual' };
      continue;
    }
    if (contextoDisponible?.entidades?.[tipo]) {
      resueltas[tipo] = { valor: contextoDisponible.entidades[tipo], origen: 'contexto_activo' };
      continue;
    }
    if (estado.memoriaEntidades[tipo]) {
      resueltas[tipo] = { valor: estado.memoriaEntidades[tipo], origen: 'memoria_sesion' };
      continue;
    }
    resueltas[tipo] = { valor: null, origen: 'sin_resolver' };
  }

  return { entidadesResueltas: resueltas, huboCambioDeTema };
}

function extraerValoresPlanos(entidadesResueltas) {
  const plano = {};
  for (const tipo of TIPOS_ENTIDAD) {
    const r = entidadesResueltas[tipo];
    plano[tipo] = r?.valor ?? null;
  }
  return plano;
}

/** Archiva el contexto activo (si existe) y establece uno nuevo. No se pierde nada: se apila. */
function actualizarContexto(estado, { intencion, entidadesResueltas, huboCambioDeTema, tema }) {
  const valoresPlanos = extraerValoresPlanos(entidadesResueltas);

  if (huboCambioDeTema && estado.contextoActivo) {
    estado.contextosArchivados.push(estado.contextoActivo);
  }

  if (huboCambioDeTema || !estado.contextoActivo) {
    estado.contextoActivo = {
      intencion,
      entidades: { ...valoresPlanos },
      tema: tema || intencion,
      turno: estado.turnoActual,
    };
  } else {
    estado.contextoActivo.intencion = intencion;
    estado.contextoActivo.turno = estado.turnoActual;
    for (const tipo of TIPOS_ENTIDAD) {
      if (valoresPlanos[tipo]) estado.contextoActivo.entidades[tipo] = valoresPlanos[tipo];
    }
  }

  for (const tipo of TIPOS_ENTIDAD) {
    if (valoresPlanos[tipo]) estado.memoriaEntidades[tipo] = valoresPlanos[tipo];
  }
}

/** Para "el de hace rato" / "lo anterior": el contexto archivado más reciente (LIFO). */
function buscarContextoAnteriorMasReciente(estado) {
  if (estado.contextosArchivados.length === 0) return null;
  return estado.contextosArchivados[estado.contextosArchivados.length - 1];
}

function esReferenciaAContextoAnterior(textoNormalizado) {
  return PATRON_REFERENCIA_ANTERIOR.test(textoNormalizado || '');
}

/**
 * "El pedido de hace rato": intercambia el contexto activo actual con el archivado más
 * reciente (LIFO), sin perder ninguno — el que estaba activo pasa a la pila de archivados.
 * Devuelve true si hubo algo que restaurar.
 */
function restaurarContextoAnterior(estado) {
  if (estado.contextosArchivados.length === 0) return false;
  const anterior = estado.contextosArchivados.pop();
  if (estado.contextoActivo) estado.contextosArchivados.push(estado.contextoActivo);
  estado.contextoActivo = anterior;
  return true;
}

function registrarCorreccionUsuario(estado, original, corregido) {
  estado.correccionesUsuario.push({ original, corregido, turno: estado.turnoActual });
}

function registrarTurno(estado, datosTurno) {
  estado.turnoActual += 1;
  estado.historial.push({ turno: estado.turnoActual, ...datosTurno });
}

export {
  crearSessionState,
  resolverEntidadesConContexto,
  actualizarContexto,
  buscarContextoAnteriorMasReciente,
  esReferenciaAContextoAnterior,
  restaurarContextoAnterior,
  detectarCambioDeTema,
  registrarCorreccionUsuario,
  registrarTurno,
  TIPOS_ENTIDAD,
};
