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

  // ---------------------------------------------------------------------
  // Robustez de inventario: tienda y material VÁLIDOS pero sin fila para esa
  // combinación puntual (T001/M002 no aparece en el dataset de demo) — antes
  // se respondía con un genérico "no existe esa relación" indistinguible del
  // caso de tienda/material inexistentes, lo cual desinformaba cuando ambos sí
  // existían en el catálogo. Ahora se explica con precisión y se ofrece el
  // listado completo de la tienda para comparar.
  // ---------------------------------------------------------------------
  {
    nombre: 'Robustez: combinación tienda+material válida sin fila de inventario',
    turnos: [
      {
        mensaje: 'cuánto inventario hay del material m002 en la tienda t001',
        verificar: (r) =>
          r.intenciones.includes('consultar_inventario') &&
          incluye(r.respuesta.texto, 'no tengo registro de inventario') &&
          !incluye(r.respuesta.texto, 'esa combinación de tienda y material'),
      },
    ],
  },
  {
    nombre: 'Robustez: material inexistente en catálogo distingue el motivo (no "sin registro" genérico)',
    turnos: [
      {
        mensaje: 'cuánto inventario hay del material m999 en la tienda t001',
        verificar: (r) => incluye(r.respuesta.texto, 'no tengo registro de ese material'),
      },
    ],
  },
  {
    nombre: 'Robustez: tienda inexistente en catálogo distingue el motivo',
    turnos: [
      {
        mensaje: 'cuánto inventario hay del material m001 en la tienda t999',
        verificar: (r) => incluye(r.respuesta.texto, 'no tengo registro de esa tienda'),
      },
    ],
  },

  // ---------------------------------------------------------------------
  // Confirmación de sugerencias proactivas: antes un "sí"/"no" a la propia
  // pregunta del asistente ("¿quieres que revise si ya tiene cita?") llegaba
  // como mensaje nuevo, sin entidades reconocibles, y el motor respondía con
  // el fallback genérico de "no entendí" — justo cuando el usuario aceptaba
  // lo que se le ofrecía.
  // ---------------------------------------------------------------------
  {
    nombre: 'Confirmación: aceptar sugerencia de revisar cita ejecuta consultar_cita',
    turnos: [
      {
        mensaje: 'muestrame el pedido 4500109',
        verificar: (r) => incluye(r.respuesta.texto, 'cita de entrega agendada'),
      },
      {
        mensaje: 'sí',
        verificar: (r) => r.intenciones.includes('consultar_cita') && !incluye(r.respuesta.texto, 'no logré entender'),
      },
    ],
  },
  {
    nombre: 'Confirmación: declinar una sugerencia responde con cierre breve, no con fallback',
    turnos: [
      {
        mensaje: 'muestrame el pedido 4500110',
        verificar: (r) => incluye(r.respuesta.texto, 'cita de entrega agendada'),
      },
      {
        mensaje: 'no',
        verificar: (r) => r.respuesta.tono === 'confirmacion' && !incluye(r.respuesta.texto, 'no logré entender'),
      },
      {
        mensaje: 'y el pedido 4500111 como va',
        verificar: (r) => r.intenciones.includes('consultar_pedido') && incluye(r.respuesta.texto, '4500111'),
      },
    ],
  },
  {
    nombre: 'Confirmación: un "sí" suelto sin sugerencia pendiente no rompe el motor',
    turnos: [
      {
        mensaje: 'sí',
        verificar: (r) => !/undefined|null|nan|\[object/i.test(r.respuesta.texto),
      },
    ],
  },

  // ---------------------------------------------------------------------
  // Falso positivo por memoria: una segunda consulta sobre un pedido/tienda/
  // material/proveedor que NO existe (o que el motor no logra reconocer)
  // repetía en silencio el detalle del turno anterior, en vez de decir que no
  // existe. Causa raíz: cuando el turno actual no aportaba un candidato para
  // ese tipo de entidad, se veía IDÉNTICO a "el usuario no mencionó ninguno" y
  // se rellenaba con la memoria de un turno anterior no relacionado.
  // ---------------------------------------------------------------------
  {
    nombre: 'Falso positivo: pedido con número mal formado (9 dígitos) no repite el pedido anterior',
    turnos: [
      { mensaje: 'como va el pedido 4500105', verificar: (r) => r.intenciones.includes('consultar_pedido') },
      {
        mensaje: 'y el pedido 999999999?',
        verificar: (r) => incluye(r.respuesta.texto, 'no encontré') && !incluye(r.respuesta.texto, '4500105'),
      },
    ],
  },
  {
    nombre: 'Falso positivo: pedido con número mal formado (partido por un espacio) no repite el anterior',
    turnos: [
      { mensaje: 'como va el pedido 4500105', verificar: (r) => r.intenciones.includes('consultar_pedido') },
      {
        mensaje: 'y el pedido 4500 199?',
        verificar: (r) => incluye(r.respuesta.texto, 'no encontré') && !incluye(r.respuesta.texto, '4500105'),
      },
    ],
  },
  {
    nombre: 'Falso positivo: tienda inexistente no repite el inventario de la tienda anterior',
    turnos: [
      {
        mensaje: 'cuánto inventario hay en la tienda reforma',
        verificar: (r) => r.intenciones.includes('consultar_inventario'),
      },
      {
        mensaje: 'y cuánto inventario hay en la tienda monterrey norte?',
        verificar: (r) => !incluye(r.respuesta.texto, 'Aceite Vegetal') && !incluye(r.respuesta.texto, 'Arroz Blanco'),
      },
    ],
  },
  {
    nombre: 'Falso positivo: material inexistente no repite el material de la consulta anterior',
    turnos: [
      {
        mensaje: 'cuánto inventario hay del material aceite vegetal en la tienda t001',
        verificar: (r) => incluye(r.respuesta.texto, 'Aceite Vegetal'),
      },
      {
        mensaje: 'y cuánto inventario hay del material yogurt griego en la tienda t001?',
        verificar: (r) => incluye(r.respuesta.texto, 'no tengo registro de ese material') && !incluye(r.respuesta.texto, '35 disponibles'),
      },
    ],
  },
  {
    nombre: 'Falso positivo: proveedor inexistente no repite los pedidos del proveedor anterior',
    turnos: [
      {
        mensaje: 'que pedidos tiene el proveedor alimentos san miguel',
        verificar: (r) => incluye(r.respuesta.texto, 'Alimentos San Miguel'),
      },
      {
        mensaje: 'y qué pedidos tiene el proveedor importadora zeta?',
        verificar: (r) => incluye(r.respuesta.texto, 'no encontré') && !incluye(r.respuesta.texto, 'Alimentos San Miguel'),
      },
    ],
  },
  {
    nombre: 'Falso positivo: la memoria conversacional legítima sigue funcionando (sin nombre nuevo)',
    turnos: [
      { mensaje: 'como va el pedido 4500105', verificar: (r) => r.intenciones.includes('consultar_pedido') },
      {
        mensaje: 'y el proveedor de ese pedido, cuales otros pedidos tiene?',
        verificar: (r) => r.intenciones.includes('buscar_pedidos_por_proveedor') && incluye(r.respuesta.texto, 'Alimentos San Miguel'),
      },
    ],
  },

  // ---------------------------------------------------------------------
  // Tarjetas de sugerencias iniciales: cada una envía la pregunta SIN el dato
  // (ver suggestion-cards.js) para que el motor lo pida y el usuario lo
  // complete. Expuso tres bugs reales de priorización que antes quedaban
  // ocultos porque las tarjetas siempre mandaban el dato ya resuelto:
  //  1) el ratio señales/total-de-disparadores favorecía en falso a una
  //     intención de un solo disparador compartido sobre otra con evidencia
  //     más fuerte pero de un catálogo de conceptos más grande;
  //  2) al no haber nada "listo", siempre se anteponía la familia "pedido" a
  //     cualquier otra intención sin importar cuál era más relevante;
  //  3) el turno pendiente se guardaba con la intención de mayor confianza
  //     general, no con la intención cuyo dato realmente se preguntó.
  // ---------------------------------------------------------------------
  {
    nombre: 'Tarjeta "Consultar pedido": pregunta el número y responde al recibirlo',
    turnos: [
      { mensaje: '¿Cómo va mi pedido?', verificar: (r) => r.respuesta.tono === 'dato_faltante' && incluye(r.respuesta.texto, 'número de pedido') },
      { mensaje: '4500102', verificar: (r) => r.intenciones.includes('consultar_pedido') && incluye(r.respuesta.texto, '4500102') },
    ],
  },
  {
    nombre: 'Tarjeta "Validar cita": prioriza el número de pedido sobre la tienda (concepto "cita" es más específico que "pedido")',
    turnos: [
      { mensaje: '¿Ya tiene cita mi pedido?', verificar: (r) => r.respuesta.tono === 'dato_faltante' && incluye(r.respuesta.texto, 'número de pedido') },
      { mensaje: '4500108', verificar: (r) => r.intenciones.includes('consultar_cita') },
    ],
  },
  {
    nombre: 'Tarjeta "Buscar por proveedor": pregunta por el proveedor y completa correctamente esa intención (no otra)',
    turnos: [
      { mensaje: '¿Qué pedidos tiene el proveedor?', verificar: (r) => r.respuesta.tono === 'dato_faltante' && incluye(r.respuesta.texto, 'proveedor') },
      { mensaje: 'P001', verificar: (r) => r.intenciones.includes('buscar_pedidos_por_proveedor') && incluye(r.respuesta.texto, 'Grupo Lácteos del Norte') },
    ],
  },
  {
    nombre: 'Tarjeta "Pedidos pendientes": pregunta por la tienda (no por el número de pedido)',
    turnos: [
      { mensaje: '¿Qué pedidos tiene la tienda?', verificar: (r) => r.respuesta.tono === 'dato_faltante' && incluye(r.respuesta.texto, 'tienda') },
      { mensaje: 'Satélite', verificar: (r) => r.intenciones.includes('buscar_pedidos_por_tienda') && incluye(r.respuesta.texto, 'Satélite') },
    ],
  },
  {
    nombre: 'Tarjeta "Comparar pedidos": responder con dos números compara, en vez de mostrar una aclaración rota',
    turnos: [
      { mensaje: 'Quiero comparar pedidos', verificar: (r) => r.respuesta.tono === 'dato_faltante' },
      {
        mensaje: '4500101 y 4500117',
        verificar: (r) => incluye(r.respuesta.texto, '4500101') && incluye(r.respuesta.texto, '4500117') && !incluye(r.respuesta.texto, 'undefined'),
      },
    ],
  },
];

export { casosDePrueba };
