/**
 * tests/casos-prueba.js
 * Batería de pruebas del motor conversacional (Hito 3). Cada grupo es una conversación
 * (uno o más turnos sobre el MISMO estado de sesión); grupos distintos usan sesiones
 * distintas, salvo que se indique lo contrario.
 *
 * Cobertura exigida: consultas correctas, errores ortográficos, ambigüedad, cambio de
 * contexto, conversaciones largas, consultas múltiples, recuperación de contexto,
 * sinónimos, abreviaciones, jerga, sin resultados, múltiples resultados, información
 * insuficiente — más los 12 escenarios del catálogo del Hito 2 y los ejemplos de
 * comprensión de lenguaje del Hito 3.
 *
 * `verificar(resultado, estado)` recibe el resultado de orchestrator.procesarMensaje y el
 * estado de sesión ya actualizado; debe devolver true/false (o { ok, detalle }).
 */

const incluye = (texto, patron) => new RegExp(patron, 'i').test(texto);

const casosDePrueba = [
  // ---------------------------------------------------------------------
  // Consultas correctas / Hito2 escenario 1
  // ---------------------------------------------------------------------
  {
    nombre: 'Consulta correcta simple — pedido parcial (Hito2 #1)',
    turnos: [
      {
        mensaje: 'cómo va el pedido 4500102',
        verificar: (r) => r.intenciones.includes('consultar_pedido') && incluye(r.respuesta.texto, 'parcial'),
      },
    ],
  },

  // ---------------------------------------------------------------------
  // Abreviación + caso "problemático" (cita vencida) — Hito2 escenario 2
  // ---------------------------------------------------------------------
  {
    nombre: 'Abreviación "ped" + cita vencida (Hito2 #2)',
    turnos: [
      {
        mensaje: 'ped 4500108, ya tiene cita?',
        verificar: (r) =>
          r.intenciones.includes('consultar_pedido') &&
          r.intenciones.includes('consultar_cita') &&
          incluye(r.respuesta.texto, 'vencid'),
      },
    ],
  },

  // ---------------------------------------------------------------------
  // Ambigüedad doble deliberada — Hito2 escenario 3
  // ---------------------------------------------------------------------
  {
    nombre: 'Ambigüedad doble: tienda "cumbres" + material "leche" (Hito2 #3)',
    turnos: [
      {
        mensaje: 'cuanto stock hay de leche en la tienda cumbres',
        verificar: (r) =>
          r.intenciones.length === 0 &&
          r.respuesta.tono === 'aclaracion' &&
          incluye(r.respuesta.texto, 'cumbres'),
      },
    ],
  },
  {
    nombre: 'Ambigüedad simple: tienda "cumbres" en búsqueda de pedidos',
    turnos: [
      {
        mensaje: 'que pedidos tiene la tienda cumbres',
        verificar: (r) => r.respuesta.tono === 'aclaracion' && incluye(r.respuesta.texto, 'Cumbres'),
      },
    ],
  },

  // ---------------------------------------------------------------------
  // Narrativa larga continua: Hito2 escenarios 4, 5, 6, 7, 8 (adaptado), 12
  // ---------------------------------------------------------------------
  {
    nombre: 'Narrativa larga: ortografía, memoria, cambio y recuperación de contexto',
    turnos: [
      // Hito2 #4: tolerancia ortográfica ("pedico" -> pedido, "yego" -> llego).
      {
        mensaje: 'el pedico 4500105 ya yego completo?',
        verificar: (r) =>
          r.intenciones.includes('consultar_pedido') &&
          incluye(r.respuesta.texto, 'parcial'),
      },
      // Hito2 #5: memoria conversacional — "el proveedor de ese pedido" sin repetir el número.
      {
        mensaje: 'y el proveedor de ese pedido, cuales otros pedidos tiene?',
        verificar: (r) =>
          r.intenciones.includes('buscar_pedidos_por_proveedor') &&
          incluye(r.respuesta.texto, 'Alimentos San Miguel'),
      },
      // Hito2 #6: cambio de tema explícito.
      {
        mensaje: 'cambio de tema, que tal el inventario de la tienda leon centro',
        verificar: (r) =>
          r.intenciones.includes('consultar_inventario') &&
          incluye(r.respuesta.texto, 'disponibles'),
      },
      // Hito2 #7: recuperación de contexto archivado ("el pedido de hace rato").
      {
        mensaje: 'oye y el pedido de hace rato, ya tuvo su cita?',
        verificar: (r, estado) =>
          r.intenciones.includes('consultar_cita') &&
          estado.contextoActivo.entidades.numero_pedido === '4500105',
      },
      // Hito2 #12: consulta múltiple combinada en una sola respuesta narrativa.
      {
        mensaje: 'necesito saber si ya llego todo lo del pedido 4500101 y si el cedis ya se lo entrego a la tienda',
        verificar: (r) =>
          r.intenciones.includes('consultar_pedido') &&
          r.intenciones.includes('consultar_llegada') &&
          incluye(r.respuesta.texto, 'CEDIS'),
      },
    ],
  },

  // ---------------------------------------------------------------------
  // Comparación de dos pedidos del mismo proveedor — Hito2 escenario 8
  // ---------------------------------------------------------------------
  {
    nombre: 'Consulta múltiple: comparar dos pedidos explícitos (Hito2 #8)',
    turnos: [
      {
        mensaje: 'como van los pedidos 4500101 y 4500117 del mismo proveedor',
        verificar: (r) =>
          r.intenciones.includes('consultar_pedido') &&
          incluye(r.respuesta.texto, '4500101') &&
          incluye(r.respuesta.texto, '4500117'),
      },
    ],
  },

  // ---------------------------------------------------------------------
  // Búsqueda por tienda con múltiples resultados — Hito2 escenario 10
  // ---------------------------------------------------------------------
  {
    nombre: 'Búsqueda por tienda, múltiples resultados (Hito2 #10)',
    turnos: [
      {
        mensaje: 'que pedidos tiene la tienda satelite',
        verificar: (r) =>
          r.intenciones.includes('buscar_pedidos_por_tienda') &&
          incluye(r.respuesta.texto, '4500107') &&
          incluye(r.respuesta.texto, '4500113') &&
          incluye(r.respuesta.texto, '4500119'),
      },
    ],
  },

  // ---------------------------------------------------------------------
  // Jerga de negocio — variantes de "recepción"
  // ---------------------------------------------------------------------
  {
    nombre: 'Jerga: "¿ya cayó?" (Hito3 comprensión de lenguaje)',
    turnos: [
      { mensaje: 'muestrame el pedido 4500109', verificar: (r) => r.intenciones.includes('consultar_pedido') },
      {
        mensaje: 'ya cayo?',
        verificar: (r) => r.intenciones.includes('consultar_llegada') && incluye(r.respuesta.texto, 'CEDIS'),
      },
    ],
  },
  {
    nombre: 'Jerga: "¿ya descargaron?" / "¿ya entregaron?"',
    turnos: [
      { mensaje: 'checa la oc 4500110', verificar: (r) => r.intenciones.includes('consultar_pedido') },
      { mensaje: 'ya descargaron?', verificar: (r) => r.intenciones.includes('consultar_llegada') },
      { mensaje: 'ya entregaron en la tienda?', verificar: (r) => r.intenciones.includes('consultar_llegada') },
    ],
  },
  {
    nombre: 'Jerga: "¿dónde viene mi pedido?" / "¿qué pasó con la orden?"',
    turnos: [
      {
        mensaje: 'donde viene mi pedido 4500103',
        verificar: (r) => r.intenciones.includes('consultar_llegada'),
      },
      {
        mensaje: 'que paso con la orden 4500106',
        verificar: (r) => r.intenciones.includes('consultar_pedido') && incluye(r.respuesta.texto, '4500106'),
      },
    ],
  },
  {
    nombre: 'Jerga: "busca la compra" / "¿tiene cita?"',
    turnos: [
      {
        mensaje: 'busca la compra 4500111',
        verificar: (r) => r.intenciones.includes('consultar_pedido') && incluye(r.respuesta.texto, 'cerrado'),
      },
      { mensaje: 'tiene cita?', verificar: (r) => r.intenciones.includes('consultar_cita') },
    ],
  },

  // ---------------------------------------------------------------------
  // Sinónimos de negocio (inventario/stock, faltante)
  // ---------------------------------------------------------------------
  {
    nombre: 'Sinónimos: "stock" y "faltante" para inventario',
    turnos: [
      {
        mensaje: 'cuanto stock hay del material m001 en la tienda t002',
        verificar: (r) =>
          r.intenciones.includes('consultar_inventario') &&
          incluye(r.respuesta.texto, 'faltante'),
      },
    ],
  },

  // ---------------------------------------------------------------------
  // Conversación larga con memoria de varios tipos de entidad
  // ---------------------------------------------------------------------
  {
    nombre: 'Conversación larga: memoria de pedido, cita e inventario en cadena',
    turnos: [
      { mensaje: 'muestrame la oc 4500116', verificar: (r) => r.intenciones.includes('consultar_pedido') },
      { mensaje: 'ya llego?', verificar: (r) => r.intenciones.includes('consultar_llegada') },
      {
        mensaje: 'quien era el proveedor?',
        verificar: (r) => r.intenciones.includes('consultar_pedido') && incluye(r.respuesta.texto, 'Comercial Hermanos Soto'),
      },
      { mensaje: 'tiene cita?', verificar: (r) => r.intenciones.includes('consultar_cita') && incluye(r.respuesta.texto, 'cumplida') },
      {
        mensaje: 'y como va el inventario?',
        verificar: (r) => r.intenciones.includes('consultar_inventario'),
      },
    ],
  },

  // ---------------------------------------------------------------------
  // Caso sin resultados
  // ---------------------------------------------------------------------
  {
    nombre: 'Caso sin resultados: pedido inexistente',
    turnos: [
      {
        mensaje: 'cómo va el pedido 9999999',
        verificar: (r) => incluye(r.respuesta.texto, 'no encontré'),
      },
    ],
  },
  {
    nombre: 'Caso sin cita registrada (pedido válido sin fila en Citas)',
    turnos: [
      {
        mensaje: 'el pedido 4500119 ya tiene cita?',
        verificar: (r) => r.intenciones.includes('consultar_cita') && incluye(r.respuesta.texto, 'todavía no hay una cita'),
      },
    ],
  },

  // ---------------------------------------------------------------------
  // Información insuficiente (dato faltante) + slot en espera
  // ---------------------------------------------------------------------
  {
    nombre: 'Información insuficiente: pregunta sin número de pedido, luego lo completa',
    turnos: [
      {
        mensaje: 'ya llego?',
        verificar: (r) => r.respuesta.tono === 'dato_faltante',
      },
      {
        mensaje: '4500104',
        verificar: (r) => r.intenciones.includes('consultar_llegada'),
      },
    ],
  },

  // ---------------------------------------------------------------------
  // Múltiples resultados: proveedor con más de un pedido
  // ---------------------------------------------------------------------
  {
    nombre: 'Múltiples resultados: proveedor con varios pedidos',
    turnos: [
      {
        mensaje: 'que pedidos tiene el proveedor p001',
        verificar: (r) =>
          r.intenciones.includes('buscar_pedidos_por_proveedor') &&
          incluye(r.respuesta.texto, '4500101') &&
          incluye(r.respuesta.texto, '4500117'),
      },
    ],
  },

  // ---------------------------------------------------------------------
  // Cambio de tema y regreso (independiente de la narrativa larga)
  // ---------------------------------------------------------------------
  {
    nombre: 'Cambio de contexto: pedido -> inventario -> proveedor -> vuelta al pedido',
    turnos: [
      { mensaje: 'como va el pedido 4500113', verificar: (r) => r.intenciones.includes('consultar_pedido') },
      {
        mensaje: 'cambiando de tema, inventario del material m006 en la tienda t004',
        verificar: (r) => r.intenciones.includes('consultar_inventario'),
      },
      {
        mensaje: 'cambio de tema, que pedidos tiene el proveedor distribuidora vega',
        verificar: (r) => r.intenciones.includes('buscar_pedidos_por_proveedor') && incluye(r.respuesta.texto, 'Vega'),
      },
      {
        mensaje: 'y el pedido de hace rato como va',
        verificar: (r, estado) => estado.contextoActivo.entidades.numero_pedido === '4500113',
      },
    ],
  },

  // ---------------------------------------------------------------------
  // Robustez: nunca exponer errores crudos
  // ---------------------------------------------------------------------
  {
    nombre: 'Robustez: mensaje vacío / sin sentido no debe romper el motor',
    turnos: [
      {
        mensaje: '????',
        verificar: (r) => r.respuesta.tono === 'fallback' && !/undefined|null|nan/i.test(r.respuesta.texto),
      },
      {
        mensaje: 'asdkjhasjkd qwerty',
        verificar: (r) => !/undefined|null|nan|\[object/i.test(r.respuesta.texto),
      },
    ],
  },

  // ---------------------------------------------------------------------
  // HITO 5 — escenario de memoria completo tal como lo especifica el hito
  // ---------------------------------------------------------------------
  {
    nombre: 'Hito5: memoria conversacional completa (pedido→llegó→proveedor→cita→inventario→cambio→regreso)',
    turnos: [
      { mensaje: 'muéstrame el pedido 4500105', verificar: (r) => r.intenciones.includes('consultar_pedido') },
      { mensaje: '¿ya llegó?', verificar: (r) => r.intenciones.includes('consultar_llegada') },
      {
        mensaje: '¿quién era el proveedor?',
        verificar: (r) => r.intenciones.includes('consultar_pedido') && incluye(r.respuesta.texto, 'Alimentos San Miguel'),
      },
      { mensaje: '¿tiene cita?', verificar: (r) => r.intenciones.includes('consultar_cita') },
      { mensaje: '¿y el inventario?', verificar: (r) => r.intenciones.includes('consultar_inventario') },
      {
        mensaje: 'cambiando de tema, ¿qué pedidos tiene la tienda satélite?',
        verificar: (r) => r.intenciones.includes('buscar_pedidos_por_tienda'),
      },
      {
        mensaje: 'y el pedido de hace rato, ¿cómo va?',
        verificar: (r, estado) => estado.contextoActivo.entidades.numero_pedido === '4500105',
      },
    ],
  },

  // ---------------------------------------------------------------------
  // HITO 5 — consultas múltiples: nada se descarta en silencio
  // ---------------------------------------------------------------------
  {
    nombre: 'Hito5: consulta múltiple llegada + inventario en un solo mensaje',
    turnos: [
      {
        mensaje: '¿ya llegó el pedido 4500105 y cuánto inventario hay disponible en la tienda?',
        verificar: (r) =>
          r.intenciones.includes('consultar_llegada') &&
          r.intenciones.includes('consultar_inventario') &&
          incluye(r.respuesta.texto, 'inventario'),
      },
    ],
  },
  {
    nombre: 'Hito5: "quién es el proveedor y cuándo tiene cita" en un solo mensaje',
    turnos: [
      { mensaje: 'muéstrame el pedido 4500108', verificar: (r) => r.intenciones.includes('consultar_pedido') },
      {
        mensaje: '¿quién es el proveedor y cuándo tiene cita?',
        verificar: (r) =>
          r.intenciones.includes('consultar_pedido') &&
          r.intenciones.includes('consultar_cita') &&
          incluye(r.respuesta.texto, 'Comercializadora Rivas'),
      },
    ],
  },
  {
    nombre: 'Hito5: comparar pedidos indica proactivamente cuál llegó primero',
    turnos: [
      {
        mensaje: 'compara el pedido 4500101 con el 4500117',
        verificar: (r) =>
          incluye(r.respuesta.texto, '4500101') &&
          incluye(r.respuesta.texto, '4500117') &&
          incluye(r.respuesta.texto, 'llegó primero'),
      },
    ],
  },

  // ---------------------------------------------------------------------
  // HITO 5 — errores con código explícito pero inexistente (antes daban
  // una respuesta confusa pidiendo un dato distinto al mencionado)
  // ---------------------------------------------------------------------
  {
    nombre: 'Hito5: proveedor con código explícito inexistente responde con honestidad',
    turnos: [
      {
        mensaje: '¿qué pedidos tiene el proveedor P999?',
        verificar: (r) => r.intenciones.includes('buscar_pedidos_por_proveedor') && incluye(r.respuesta.texto, 'no encontré'),
      },
    ],
  },
  {
    nombre: 'Hito5: material con código explícito inexistente responde con honestidad',
    turnos: [
      {
        mensaje: '¿cuánto inventario hay del material M999 en la tienda T001?',
        verificar: (r) => r.intenciones.includes('consultar_inventario') && incluye(r.respuesta.texto, 'no tengo registro'),
      },
    ],
  },
  {
    nombre: 'Hito5: pedido con formato válido pero código inexistente',
    turnos: [
      {
        mensaje: 'cómo va el pedido 1234567',
        verificar: (r) => r.intenciones.includes('consultar_pedido') && incluye(r.respuesta.texto, 'no encontré'),
      },
    ],
  },

  // ---------------------------------------------------------------------
  // HITO 5 — consultas sin ningún contexto previo (primera interacción)
  // ---------------------------------------------------------------------
  {
    nombre: 'Hito5: preguntas sin contexto piden el dato correcto, no un fallback genérico',
    turnos: [
      { mensaje: '¿ya llegó?', verificar: (r) => r.respuesta.tono === 'dato_faltante' && incluye(r.respuesta.texto, 'número de pedido') },
    ],
  },
  {
    nombre: 'Hito5: pregunta suelta sin contexto ("¿tiene cita?") pide el dato correcto',
    turnos: [
      { mensaje: '¿tiene cita?', verificar: (r) => r.respuesta.tono === 'dato_faltante' && incluye(r.respuesta.texto, 'número de pedido') },
    ],
  },

  // ---------------------------------------------------------------------
  // HITO 5 — ambigüedad: nunca listas extensas (validado a escala en
  // tests exploratorios; aquí se confirma el comportamiento con el
  // dataset real, donde el cap de 4 opciones no debería ni activarse)
  // ---------------------------------------------------------------------
  {
    nombre: 'Hito5: ambigüedad real sigue mostrando todas las opciones cuando son pocas',
    turnos: [
      {
        mensaje: 'cuanto stock hay de cola en la tienda reforma',
        verificar: (r) => r.respuesta.tono === 'aclaracion' && r.respuesta.opciones.length <= 4,
      },
    ],
  },
];

export { casosDePrueba };
