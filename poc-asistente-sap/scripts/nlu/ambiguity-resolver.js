/**
 * nlu/ambiguity-resolver.js
 * Paso 7 del pipeline: con las intenciones candidatas (intent-classifier.js) y las entidades
 * ya resueltas contra el contexto (session-state.js), decide qué hacer:
 *   - responder directo (una o varias intenciones listas para ejecutarse),
 *   - pedir aclaración (un slot tiene más de un candidato posible, p. ej. "cumbres"),
 *   - pedir el dato faltante (un slot obligatorio no se resolvió de ningún lado).
 * Nunca elige un candidato al azar cuando hay ambigüedad real.
 */

import { INTENCIONES } from '../config/intents.js';

// Estas tres intenciones comparten el concepto disparador "pedido"; solo tiene sentido
// ejecutar la que realmente corresponde a lo que el usuario mencionó este turno.
const FAMILIA_PEDIDO = ['consultar_pedido', 'buscar_pedidos_por_tienda', 'buscar_pedidos_por_proveedor'];

function estadoDeSlot(entidadesResueltas, slot) {
  const r = entidadesResueltas[slot];
  if (r?.candidatos && r.candidatos.length > 1) return 'ambiguo';
  if (r?.valor) return 'resuelto';
  return 'faltante';
}

function evaluarIntencion(candidato, entidadesResueltas) {
  const { intencion } = candidato;
  const definicion = INTENCIONES[intencion];
  const estados = definicion.slotsObligatorios.map((slot) => ({ slot, estado: estadoDeSlot(entidadesResueltas, slot) }));
  const obligatoriosListos = estados.every((s) => s.estado === 'resuelto');
  const hayAmbiguedadObligatoria = estados.some((s) => s.estado === 'ambiguo');

  // Un slot alternativo (p. ej. "solo tienda" para consultar_inventario) nunca debe tapar una
  // ambigüedad real en un slot obligatorio: si el usuario dijo "cola" y hay dos coincidencias,
  // no hay que responder con el inventario completo de la tienda solo porque esa sí es clara
  // — hay que preguntar primero por la ambigüedad de "cola".
  const algunAlternativoListo = !hayAmbiguedadObligatoria && definicion.slotsAlternativos.some((combo) =>
    combo.every((slot) => estadoDeSlot(entidadesResueltas, slot) === 'resuelto')
  );

  return {
    intencion,
    listo: obligatoriosListos || algunAlternativoListo,
    ambiguos: estados.filter((s) => s.estado === 'ambiguo').map((s) => s.slot),
    faltantes: estados.filter((s) => s.estado === 'faltante').map((s) => s.slot),
    prefiereListado: Boolean(candidato.prefiereListado),
    señales: candidato.señales || [],
  };
}

/**
 * Dentro de la familia "pedido", prioriza la intención cuyo slot principal fue mencionado
 * explícitamente este turno (origen 'turno_actual'). Si ninguna lo fue pero el mensaje trae
 * marcas de listado ("cuáles otros pedidos...", plural), se prefiere buscar_pedidos_por_* sobre
 * un pedido puntual. En último caso, se prefiere consultar_pedido por ser la continuación más
 * común de una conversación ya en curso.
 */
function elegirDeFamiliaPedido(candidatosFamilia, entidadesResueltas) {
  const conOrigenExplicito = candidatosFamilia.filter((c) => {
    const slotPrincipal = INTENCIONES[c.intencion].slotsObligatorios[0];
    return entidadesResueltas[slotPrincipal]?.origen === 'turno_actual';
  });
  if (conOrigenExplicito.length > 0) return conOrigenExplicito;

  if (candidatosFamilia.some((c) => c.prefiereListado)) {
    const porProveedor = candidatosFamilia.find((c) => c.intencion === 'buscar_pedidos_por_proveedor');
    if (porProveedor) return [porProveedor];
    const porTienda = candidatosFamilia.find((c) => c.intencion === 'buscar_pedidos_por_tienda');
    if (porTienda) return [porTienda];
  }

  const consultarPedido = candidatosFamilia.find((c) => c.intencion === 'consultar_pedido');
  return consultarPedido ? [consultarPedido] : candidatosFamilia.slice(0, 1);
}

/**
 * @param {Array} candidatosIntencion - salida de intent-classifier.js
 * @param {Object} entidadesResueltas - salida de session-state.resolverEntidadesConContexto
 * @returns {{ listas: string[], necesitaAclaracion: object|null, necesitaDatoFaltante: object|null }}
 */
function resolverAmbiguedad(candidatosIntencion, entidadesResueltas) {
  if (!candidatosIntencion || candidatosIntencion.length === 0) {
    return { listas: [], necesitaAclaracion: null, necesitaDatoFaltante: null };
  }

  const evaluaciones = candidatosIntencion.map((c) => evaluarIntencion(c, entidadesResueltas));

  const familiaPedido = evaluaciones.filter((e) => FAMILIA_PEDIDO.includes(e.intencion));
  const otras = evaluaciones.filter((e) => !FAMILIA_PEDIDO.includes(e.intencion));

  const familiaPedidoListas = familiaPedido.filter((e) => e.listo);
  const familiaElegida = familiaPedidoListas.length > 1
    ? elegirDeFamiliaPedido(familiaPedidoListas, entidadesResueltas).map((c) => c.intencion)
    : familiaPedidoListas.map((e) => e.intencion);

  const listas = [...familiaElegida, ...otras.filter((e) => e.listo).map((e) => e.intencion)];

  if (listas.length > 0) {
    return { listas, necesitaAclaracion: null, necesitaDatoFaltante: null };
  }

  // Nada listo: primero se resuelve ambigüedad de datos (varios candidatos), luego dato faltante.
  const todas = [...familiaPedido, ...otras];
  const conAmbiguedad = todas.find((e) => e.ambiguos.length > 0);
  if (conAmbiguedad) {
    const slot = conAmbiguedad.ambiguos[0];
    return {
      listas: [],
      necesitaAclaracion: { intencion: conAmbiguedad.intencion, slot, candidatos: entidadesResueltas[slot].candidatos },
      necesitaDatoFaltante: null,
    };
  }

  // Al elegir qué dato pedir, se prioriza el que el propio usuario mencionó como concepto
  // este turno (p. ej. escribió "proveedor" pero el código no existe) sobre el orden interno
  // de las intenciones — así "¿qué pedidos tiene el proveedor XYZ?" con un código inválido
  // pregunta por el proveedor, no por un dato que el usuario nunca mencionó (la tienda).
  const conceptosMencionados = new Set(todas.flatMap((e) => e.señales));
  const conFaltante =
    todas.find((e) => e.faltantes.some((slot) => conceptosMencionados.has(slot))) ||
    todas.find((e) => e.faltantes.length > 0);
  if (conFaltante) {
    const slot = conFaltante.faltantes.find((s) => conceptosMencionados.has(s)) || conFaltante.faltantes[0];
    return {
      listas: [],
      necesitaAclaracion: null,
      necesitaDatoFaltante: { intencion: conFaltante.intencion, slot },
    };
  }

  return { listas: [], necesitaAclaracion: null, necesitaDatoFaltante: null };
}

export { resolverAmbiguedad };
