# Documento de cierre — Hito 5
## Orquestación de la Experiencia Inteligente

**Continuación de:** Hito 3 (motor, 37/37 pruebas) e Hito 4 (interfaz), ambos completados.
**Alcance de este documento:** validación de extremo a extremo, incidencias reales encontradas y corregidas, batería de pruebas ampliada (54/54), pruebas de robustez a escala, y revisión crítica final del proyecto completo.

Este hito **no introdujo funcionalidades nuevas**. Todos los cambios descritos abajo son correcciones a comportamientos ya existentes que la validación de extremo a extremo dejó en evidencia — cada uno se reporta con su causa raíz e impacto antes de la corrección, tal como se pidió.

---

## 1. Metodología de validación

En lugar de asumir que el sistema integrado funcionaba porque cada pieza había pasado sus pruebas por separado (Hito 3: motor; Hito 4: interfaz), se ejecutaron conversaciones reales de varios turnos contra el motor real — sin mocks — replicando exactamente los escenarios que este hito pide validar: la cadena de memoria completa, consultas múltiples, cambios de contexto, y casos de error. Cada incidencia encontrada se corrigió y se volvió a validar contra **toda** la batería existente antes de continuar, para no arreglar un caso a costa de romper otro.

Adicionalmente se construyó una prueba de robustez con un dataset sintético cargado en memoria (66 tiendas, 88 proveedores, 162 materiales, 3,020 pedidos) — sin modificar `mock-sap.xlsx`, que sigue congelado desde el Hito 2 — para validar comportamiento a una escala mayor a la del dataset de demo.

---

## 2. Incidencias encontradas y correcciones aplicadas

### 2.1 "¿Quién era el proveedor?" no se reconocía como pregunta suelta
**Síntoma:** dentro de la cadena de memoria exacta que pide este hito (pedido → ¿ya llegó? → ¿quién era el proveedor? → ¿tiene cita? → ¿y el inventario?), la tercera pregunta caía en el fallback genérico ("no logré entender tu solicitud") en vez de responder con el proveedor del pedido en contexto.
**Causa:** `proveedor` es un concepto de jerga válido (`config/synonyms.js`), pero ninguna intención lo usaba como disparador — solo se detectaba como entidad, nunca como señal de intención.
**Corrección:** se agregó `proveedor` como concepto disparador de `consultar_pedido` (`config/intents.js`). Como el pedido ya está en contexto, esto también hace que "¿quién es el proveedor y cuándo tiene cita?" combine `consultar_pedido` + `consultar_cita` en una sola respuesta coherente — el segundo escenario de consulta múltiple que pide este hito.
**Impacto:** bajo riesgo — se verificó que no interfiere con la familia `buscar_pedidos_por_tienda/proveedor` (que sigue priorizándose correctamente vía la heurística de "listado" ya existente).

### 2.2 Consultas múltiples perdían partes en silencio
**Síntoma:** "¿ya llegó el pedido 4500105 y cuánto inventario hay disponible en la tienda?" solo respondía sobre el pedido — la parte de inventario desaparecía sin explicación, sin error visible.
**Causa raíz:** dentro de un mismo turno, cada intención candidata resuelve sus propios slots de forma independiente. `consultar_inventario` necesita `tienda`, pero el usuario nunca la nombró explícitamente (la dio por sobreentendida al decir "el pedido X... en la tienda") — y el enriquecimiento que aprende tienda/proveedor de un pedido consultado solo se aplicaba **después** de ejecutar las consultas del turno, no a tiempo para que las intenciones hermanas del mismo mensaje lo usaran.
**Corrección:** se adelantó ese enriquecimiento (`enriquecerConPedidoDelTurno`, `core/orchestrator.js`) a **antes** de evaluar ambigüedad, para que un número de pedido explícito resuelva también tienda/proveedor/cedis a tiempo para el resto de intenciones del mismo turno.
**Impacto:** este es el fix más importante del hito — sin él, cualquier consulta combinada que dependiera de un dato derivado (no mencionado literalmente) se degradaba en silencio. Verificado contra los 4 patrones de consulta múltiple que pide el hito.

### 2.3 Código explícito pero inexistente producía una respuesta que ignoraba lo que el usuario dijo
**Síntoma:** "¿qué pedidos tiene el proveedor P999?" (código con formato válido, pero que no existe) respondía "necesito que me compartas la tienda" — un dato completamente distinto al que el usuario mencionó.
**Causa raíz doble:**
1. `entity-extractor.js` descartaba en silencio cualquier código con formato válido (`P999`, `M999`...) si no existía en el catálogo, como si el usuario nunca lo hubiera mencionado.
2. Al no quedar ningún dato resuelto, `ambiguity-resolver.js` elegía qué preguntar por **orden interno** de las intenciones candidatas, no por lo que el usuario realmente mencionó.
**Corrección:**
1. `entity-extractor.js` ya no descarta códigos con formato válido aunque no existan — dejar que la capa de datos (que ya sabe responder "no encontré X" con gracia) sea quien decida, en vez de que el NLU borre la mención del usuario antes de llegar ahí.
2. `ambiguity-resolver.js` ahora prioriza preguntar por el dato cuyo concepto el usuario sí mencionó este turno, sobre el orden interno de las intenciones.
**Impacto:** corrige toda la familia de casos "código explícito inexistente" (proveedor, material, pedido) — verificado que ahora responden con honestidad ("No encontré pedidos para el proveedor P999") en vez de pedir un dato no relacionado.

### 2.4 Un slot alternativo tapaba una ambigüedad real
**Síntoma (encontrado en la prueba de robustez a escala):** "¿cuánto stock hay de cola en la tienda reforma?" — con "cola" ambiguo entre dos materiales — respondía con el inventario **completo** de la tienda en vez de preguntar a cuál de los dos "cola" se refería.
**Causa raíz:** `consultar_inventario` tiene un slot alternativo ("solo tienda" → lista general). Si la tienda se resolvía sin problema, ese camino alternativo se daba por "listo" sin importar que el material sí tuviera una ambigüedad real sin resolver.
**Corrección:** un slot alternativo ya no puede considerarse "listo" si algún slot obligatorio tiene una ambigüedad genuina pendiente (`nlu/ambiguity-resolver.js`) — se prioriza siempre preguntar antes que asumir, tal como pide este hito explícitamente.
**Impacto:** este bug no aparecía con el dataset de demo (los 3 pares ambiguos del Hito 2 no coinciden con este patrón exacto), pero sí con un catálogo más realista — es exactamente el tipo de hallazgo que la prueba de robustez a escala estaba buscando.

### 2.5 "Ambigüedad a escala": listas de más de 4 opciones
**Síntoma (prueba de robustez):** con 66 tiendas sintéticas, una ambigüedad de nombre llegó a ofrecer 8 opciones como chips — una "lista extensa", justo lo que este hito pide evitar.
**Corrección:** por encima de 4 coincidencias, `response-generator.js` ya no lista todas — reconoce la cantidad honestamente y pide precisar, mostrando solo las 3 más probables como atajo.
**Impacto:** no se activa con el dataset de demo actual (máximo 2 coincidencias en cualquier caso de ambigüedad deliberada del Hito 2) — es una salvaguarda para cuando el catálogo real de SAP sea más grande.

### 2.6 "Cuál llegó primero" no se respondía de forma confiable como pregunta de seguimiento
**Síntoma:** tras "compara el pedido X con el Y", la pregunta de seguimiento "muéstrame cuál llegó primero" no comparaba nada — el contexto solo recuerda un número de pedido a la vez, así que solo repetía datos de logística de uno de los dos.
**Decisión (evaluada y documentada, no solo corregida):** en vez de construir reconocimiento de intención nuevo para esa frase de seguimiento específica (lo cual el alcance de este hito pide evitar salvo que sea estrictamente necesario), se resolvió en la raíz: la respuesta de "comparar" ahora **responde esa pregunta de una vez**, indicando proactivamente cuál pedido llegó primero a tienda (usando datos de `Llegadas` que ya existían). Así el usuario recibe la respuesta sin tener que volver a preguntar.
**Limitación conocida y aceptada:** si el usuario igual pregunta "¿cuál llegó primero?" como turno separado, la respuesta usa el pedido más reciente en contexto (no reconstruye la comparación completa) — un caso de bajo impacto ya que la información ya se entregó en el primer mensaje. Se documenta aquí en vez de ampliar el esquema de memoria para recordar grupos de comparación, que hubiera sido una funcionalidad nueva no solicitada explícitamente.

### 2.7 Tiempos de escritura progresiva no escalaban con el largo del mensaje
**Síntoma:** con las consultas múltiples ahora devolviendo respuestas más completas y largas (ver 2.2), el efecto de escritura progresiva tardaba lo mismo (~1 segundo) sin importar si el mensaje era una frase corta o un párrafo largo — no se sentía "natural" en ninguno de los dos extremos.
**Corrección:** la duración de la escritura progresiva (`ui/typewriter.js`) ahora es proporcional al largo del texto, acotada entre 280ms y 900ms — respuestas cortas se sienten ágiles, respuestas largas no se sienten eternas, y ninguna demora una conversación de demo con muchos turnos.

---

## 3. Flujo de extremo a extremo — validado

Se confirmó, con casos reales, que los 15 pasos del flujo (Usuario → Interfaz → Normalización → Corrección ortográfica → Expansión de abreviaciones → Interpretación semántica → Clasificación de intención → Extracción de entidades → Memoria conversacional → Resolución de ambigüedades → Consulta del Excel → Construcción de la respuesta → Simulación "Pensando" → Respuesta conversacional → Actualización del contexto) participan correctamente en cada turno — incluyendo los casos donde varios pasos deben cooperar dentro del mismo turno (memoria + resolución de ambigüedad + consulta múltiple), que es exactamente donde aparecieron las incidencias 2.2 y 2.4.

## 4. Memoria conversacional — validada contra el escenario exacto del hito

La cadena "consulta un pedido → ¿ya llegó? → ¿quién era el proveedor? → ¿tiene cita? → ¿y el inventario? → cambia de tema → regresa al pedido inicial" se ejecutó de punta a punta y cada turno resuelve correctamente contra el contexto, sin que el usuario repita el número de pedido en ningún momento intermedio. El contexto original se recupera intacto (`numero_pedido`, `tienda`, `proveedor`, `cedis`) después del cambio de tema y el regreso.

## 5. Batería de pruebas — resultado final

`tests/casos-prueba.js` ampliado con 9 grupos nuevos específicos del Hito 5 (cadena de memoria completa, 2 patrones de consulta múltiple, comparación con "llegó primero", 3 casos de código explícito inexistente, 2 casos de consulta sin contexto previo, y confirmación de que la ambigüedad real sigue funcionando con pocas opciones). Total acumulado (Hito 3 + Hito 5): **54/54 pruebas OK**, ejecutadas contra el motor real en Chromium, sin mocks.

## 6. Rendimiento y robustez — resultado de la prueba a escala

Con el dataset ampliado en memoria (3,020 pedidos, 66 tiendas, 88 proveedores, 162 materiales):

| Escenario | Resultado |
|---|---|
| Ambigüedad de nombre entre 8 tiendas parecidas | 24ms, respuesta acotada (no lista extensa) |
| Pedido puntual entre 3,000+ pedidos | 7ms |
| Proveedor con 34 pedidos asociados | 13ms |
| Conversación de 160 turnos seguidos | 457ms total (2.9ms/turno promedio), 0 errores |
| Misma consulta repetida 200 veces | 5.4ms/consulta promedio |

No se observó degradación relevante ni fugas evidentes de memoria/estado a lo largo de conversaciones largas (`historial` y `contextosArchivados` crecen de forma acotada y predecible). La arquitectura actual (búsqueda lineal sobre arreglos en memoria) es más que suficiente para el volumen de un catálogo de demo o incluso de una tienda mediana; si el catálogo real de SAP llegara a decenas de miles de registros, un índice por nombre sería la siguiente optimización natural — no se implementó porque no hace falta a esta escala.

## 7. Calidad conversacional — homogeneidad

Se revisó el corpus completo de respuestas generadas durante la validación: tono consistente (profesional, natural, nunca robótico ni excesivamente técnico), estructura similar entre formateadores (estado → contexto → detalle → sugerencia proactiva), y ningún mensaje de error crudo en ningún escenario probado (incluyendo entradas sin sentido, campos vacíos, y códigos inexistentes). Se identificó una redundancia menor y aceptada: cuando `consultar_pedido` y `consultar_cita` responden juntos, el nombre del proveedor puede mencionarse dos veces (una por cada formateador, que no se conocen entre sí por diseño modular) — no se corrigió por ser una mejora cosmética menor frente al riesgo de acoplar los formateadores entre sí.

## 8. Revisión crítica final

### 8.1 Coherencia funcional
Alta. Los 6 casos de uso originales, sus combinaciones, la memoria conversacional y la resolución de ambigüedad ahora cooperan de forma consistente dentro de un mismo turno — que era exactamente el hueco que este hito debía cerrar.

### 8.2 Consistencia visual
Sin cambios respecto al Hito 4 (ya validado), salvo el ajuste de timing de escritura progresiva (sección 2.7), que se revalidó visualmente sin regresiones.

### 8.3 Calidad de código / modularidad
Cada corrección de este hito se aplicó en el módulo con la responsabilidad correspondiente (extracción de entidades, resolución de ambigüedad, generación de respuesta, orquestación) sin mezclar responsabilidades entre capas. `core/orchestrator.js` sigue siendo el único módulo que conoce el pipeline completo.

### 8.4 Escalabilidad
Validada hasta ~3,000 pedidos y ~90 proveedores sin degradación perceptible (sección 6). El diseño de búsqueda lineal es una decisión consciente y documentada, no un descuido — es la opción correcta para el volumen actual y tiene un camino de mejora claro si el volumen creciera en serio.

### 8.5 Facilidad para sustituir el Excel por APIs reales de SAP
Sigue intacta: `data-connector/sap-connector.js` es la única capa que las correcciones de este hito tocaron en el límite de datos (para dejar de descartar códigos inexistentes), y sigue exponiendo funciones con firma de servicio. Ningún cambio de este hito acopló el motor al formato del Excel — todas las correcciones viven en NLU, resolución de ambigüedad o generación de respuesta, capas que no cambiarían al sustituir el origen de datos.

---

## 9. Estado actualizado del proyecto

**Completado en este hito:**
- Integración validada de punta a punta entre interfaz, motor, memoria y modelo de datos.
- 6 incidencias reales encontradas, corregidas y verificadas contra la batería completa después de cada una.
- Batería de pruebas ampliada a 54 casos (Hito 3 + Hito 5), 54/54 OK.
- Prueba de robustez a escala (dataset sintético 150× más grande que el de demo) sin degradación de rendimiento ni errores.
- Homogeneización de tiempos de respuesta simulados (escritura progresiva proporcional al largo del mensaje).

**Pendiente / decisiones heredadas que siguen abiertas (no de este hito):**
1. Validación del vocabulario de jerga con usuarios reales (riesgo abierto desde el Hito 1).
2. Los 2 escenarios del catálogo del Hito 2 que exceden el catálogo de 6 intenciones (`#9` y `#11`, ver `Hito3_Motor_Conversacional.md`).
3. Redundancia menor cuando se combinan `consultar_pedido` + `consultar_cita` (sección 7) — cosmética, no bloqueante.

**Conclusión:** el prototipo, en este punto, se comporta como un asistente único y cohesionado — un usuario en una demostración no debería percibir los módulos independientes que lo componen. El único paso pendiente para convertir esta Proof of Concept en una solución empresarial real sigue siendo, tal como se buscaba, sustituir `data-connector/excel-reader.js` por llamadas a servicios reales de SAP — el resto del sistema no requeriría cambios.
