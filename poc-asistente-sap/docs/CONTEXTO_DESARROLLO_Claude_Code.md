# CONTEXTO DEL PROYECTO — PoC Asistente Conversacional IA + SAP
## Documento de handoff técnico para desarrollo (Claude Code)

**Propósito de este archivo:** dar a Claude Code todo el contexto necesario para iniciar la implementación (HTML/CSS/JS) sin tener que releer los documentos completos de arquitectura. Este archivo es la fuente única de verdad operativa para el desarrollo. Los documentos `Hito1_Arquitectura_PoC_Asistente_SAP.md` y `Hito2_Modelo_Datos_PoC.md` quedan como referencia profunda para justificaciones y alternativas evaluadas, pero **no hace falta leerlos para programar** — este archivo resume lo accionable.

**Estado del proyecto al momento de este handoff:** Hito 1 (arquitectura) y Hito 2 (modelo de datos) completados y validados. Se procede al desarrollo (Hito 3 en adelante: motor conversacional + interfaz).

---

## 1. Qué se está construyendo

Una **Proof of Concept de alta fidelidad**, no un producto productivo. Un asistente conversacional que corre 100% en el navegador, con apariencia de Microsoft Teams (modo oscuro, Fluent Design), que responde preguntas en lenguaje natural sobre pedidos, llegadas, citas e inventario, leyendo datos desde un Excel local que simula servicios SAP. El usuario final nunca debe saber que es un Excel — la experiencia debe sentirse como una integración real con SAP.

**Objetivo de la demo:** convencer a Dirección de invertir en una integración real. Prioridad: experiencia de usuario, fidelidad visual e inteligencia conversacional aparente, por encima de cualquier atajo técnico.

## 2. Restricciones técnicas obligatorias (no negociables)

- **Sin backend, sin servidor, sin base de datos.**
- **Sin Node.js, sin frameworks** (nada de React/Vue/Angular, nada de bundlers).
- Únicamente **HTML + CSS moderno + JavaScript ES6+ vanilla**.
- Lectura del Excel **100% local, en el navegador** (librería tipo SheetJS/xlsx.js cargada localmente, no desde CDN externo, para cumplir "offline total" — si se usa un CDN en desarrollo, debe documentarse como pendiente de vendorizar antes de la demo final).
- Sin llamadas de red de ningún tipo en tiempo de ejecución (nada de APIs externas, nada de LLMs en la nube). Toda la "inteligencia" es un motor de reglas/heurísticas propio, corriendo en el cliente.
- Arquitectura modular: un archivo por responsabilidad, evitar archivos gigantes.

## 3. Estructura de carpetas a implementar

```
poc-asistente-sap/
├── index.html
├── assets/
│   ├── icons/
│   └── fonts/
├── styles/
│   ├── base/          (tokens/variables CSS, reset)
│   ├── components/    (chat bubble, input bar, header, typing-indicator, sugerencias)
│   └── themes/         (Teams Dark)
├── data/
│   └── mock-sap.xlsx   (ya generado — ver sección 5)
├── scripts/
│   ├── core/            (orchestrator.js, session-state.js)
│   ├── nlu/              (normalizer.js, spelling-tolerance.js, abbreviations.js, intent-classifier.js, entity-extractor.js, ambiguity-resolver.js)
│   ├── data-connector/   (excel-reader.js, sap-connector.js, queries por caso de uso)
│   ├── response/         (response-generator.js, templates.js)
│   ├── ui/               (chat-renderer.js, input-handler.js, typing-indicator.js)
│   └── config/           (synonyms.js, intents.js — diccionarios de dominio, ver sección 8)
└── docs/
    (Hito1_Arquitectura_PoC_Asistente_SAP.md, Hito2_Modelo_Datos_PoC.md, este archivo)
```

**Regla de aislamiento crítica:** `data-connector/` es la ÚNICA capa que puede leer `mock-sap.xlsx`. Ningún otro módulo debe tocar el archivo directamente. Esto es lo que permite, en el futuro, sustituir el Excel por un endpoint SAP real tocando solo esta carpeta.

## 4. Componentes y responsabilidad única

| Archivo/módulo | Responsabilidad |
|---|---|
| `ui/chat-renderer.js` | Dibuja mensajes, scroll, estados visuales |
| `ui/input-handler.js` | Captura texto del usuario, validaciones básicas |
| `ui/typing-indicator.js` | Indicador de "escribiendo…" (600–1500 ms variable) |
| `nlu/normalizer.js` | Minúsculas, limpieza de acentos/puntuación |
| `nlu/spelling-tolerance.js` | Coincidencia aproximada (Levenshtein) contra vocabulario clave |
| `nlu/abbreviations.js` | Expande abreviaciones/jerga a forma canónica usando `config/synonyms.js` |
| `nlu/intent-classifier.js` | Determina intención(es) del mensaje |
| `nlu/entity-extractor.js` | Extrae entidades (numero_pedido, tienda, proveedor, material, fecha) |
| `core/session-state.js` | Objeto en memoria: historial, contexto activo, contextos archivados, preferencias de sesión |
| `nlu/ambiguity-resolver.js` | Decide: responder directo / pedir aclaración / pedir dato faltante |
| `data-connector/excel-reader.js` | Carga y parsea `mock-sap.xlsx` una sola vez al iniciar, cachea en memoria |
| `data-connector/sap-connector.js` | Expone funciones con firma "SAP-ready" (ver sección 5.3) que consultan los datos cacheados |
| `response/response-generator.js` | Convierte resultados de datos en lenguaje natural, integra respuestas combinadas |
| `core/orchestrator.js` | Coordina el ciclo completo por turno, invocando los módulos anteriores en orden |
| `config/synonyms.js` | Diccionario de jerga/abreviaciones (sección 8) |
| `config/intents.js` | Definición de intenciones y sus slots obligatorios (sección 9) |

## 5. Modelo de datos (`mock-sap.xlsx`)

Archivo ya generado y validado (0 huérfanos, 0 inconsistencias). 9 hojas, claves y relaciones abajo. **No modificar la estructura sin actualizar este documento.**

### 5.1 Hojas y campos

**Proveedores** (PK `codigo_proveedor`): nombre, categoria_principal, ubicacion — 8 filas.

**CEDIS** (PK `codigo_cedis`): nombre, ubicacion — 4 filas.

**Tiendas** (PK `codigo_tienda`): nombre, codigo_cedis_asociado (FK→CEDIS), ubicacion — 6 filas.

**Materiales** (PK `codigo_material`): descripcion, categoria, unidad_medida — 12 filas.

**Pedidos** (PK `numero_pedido`): codigo_proveedor (FK), codigo_tienda (FK), codigo_cedis (FK), fecha_creacion, estado_general (`Abierto`/`Parcial`/`Cerrado`) — 20 filas.

**PedidoPosiciones** (PK `numero_pedido`+`posicion`): codigo_material (FK), cantidad_solicitada — 34 filas.

**Recepciones** (PK `numero_pedido`+`posicion`): codigo_material, cantidad_solicitada, cantidad_recibida, fecha_recepcion (nullable), estado_posicion (`Pendiente`/`Parcial`/`Completa`/`En tránsito a tienda`) — 34 filas.

**Llegadas** (PK `numero_pedido`, 1:1 con Pedidos): recibo_cedis (bool), fecha_recibo_cedis, recibo_tienda (bool), fecha_recibo_tienda, cedis_entrega_tienda (bool), fecha_entrega_tienda, pendiente_cita (bool) — 20 filas.

**Citas** (PK `id_cita`, 0..1 por pedido — **no todo pedido tiene fila aquí, y eso es válido**): numero_pedido (FK), codigo_proveedor (FK), codigo_cedis (FK), fecha, hora, estado (`Programada`/`Confirmada`/`Cumplida`/`Vencida`), entrega_realizada (bool) — 16 filas.

**Inventario** (PK `codigo_tienda`+`codigo_material`): inventario_disponible, inventario_transito, faltante — 29 filas.

### 5.2 Reglas de negocio a replicar en el conector (NO recalcular distinto a como ya vienen en el Excel)

- `estado_general` de Pedidos YA viene calculado en el Excel (Cerrado si todas las posiciones Completa; Parcial si alguna tiene recepción; Abierto si ninguna). El conector debe leerlo tal cual, no recalcularlo.
- Ausencia de fila en `Citas` para un `numero_pedido` = "no hay cita registrada todavía" (respuesta válida, no error).
- `pendiente_cita=true` en `Llegadas` solo aplica a pedidos sin cita y sin entregar aún.

### 5.3 Funciones esperadas del `sap-connector.js` (firma "SAP-ready")

Diseñar como si ya llamaran a un servicio real (para facilitar sustitución futura):

```
obtenerPedido(numeroPedido)
buscarPedidosPorTienda(codigoTienda)
buscarPedidosPorProveedor(codigoProveedor)
obtenerRecepcionesPorPedido(numeroPedido)
obtenerLlegadaPorPedido(numeroPedido)
obtenerCitaPorPedido(numeroPedido)          // puede devolver null
obtenerInventarioPorTiendaYMaterial(codigoTienda, codigoMaterial)
buscarTiendaPorNombreAproximado(texto)       // para resolver "cumbres" → candidatos T001/T002
buscarMaterialPorNombreAproximado(texto)     // para resolver "leche" → candidatos M001/M002
```

Las dos últimas son clave para el `ambiguity-resolver.js`: cuando un texto aproximado matchea más de un registro, la intención NO se resuelve sola — se dispara pregunta de aclaración.

## 6. Motor conversacional — pipeline por turno

Cada mensaje del usuario pasa, en orden, por:

1. **Normalización** (`normalizer.js`)
2. **Tolerancia ortográfica** (`spelling-tolerance.js`) — Levenshtein contra vocabulario clave
3. **Expansión de abreviaciones/jerga** (`abbreviations.js`, usando `config/synonyms.js`)
4. **Clasificación de intención** (`intent-classifier.js`) — puede detectar más de una intención en el mismo mensaje
5. **Extracción de entidades** (`entity-extractor.js`)
6. **Resolución de contexto** (`session-state.js`) — si faltan entidades, buscar en contexto activo o archivado antes de preguntar
7. **Evaluación de ambigüedad/confianza** (`ambiguity-resolver.js`) — decide: responder / pedir aclaración / pedir dato faltante
8. **Consulta de datos** (`sap-connector.js`)
9. **Generación de respuesta natural** (`response-generator.js`) — si hay múltiples intenciones, integrarlas en una sola respuesta narrativa
10. **Actualización de memoria de sesión** (`session-state.js`)

**Enfoque de NLU (decisión adoptada por defecto para avanzar):** motor de reglas/diccionarios propio, sin librerías NLP externas ni servicios en la nube. Esta fue mi recomendación en el Hito 1 (sección 14) por control total, previsibilidad en la demo y porque el dominio es pequeño y muy específico de negocio. **Queda documentado como decisión adoptada para proceder al desarrollo; si prefieres otro enfoque, es ajustable antes de invertir más tiempo en el motor.**

## 7. Memoria conversacional — modelo de "frames" activos/archivados

Estructura conceptual de `session-state.js`:

```
sessionState = {
  contextoActivo: {
    intencion: "consultar_pedido",
    entidades: { numero_pedido: "4500105" },
    turno: 4
  },
  contextosArchivados: [ /* pila de contextos anteriores, no se borran */ ],
  preferenciasSesion: { tienda_default: "T045" },  // "aprendizaje" de sesión, no ML real
  historial: [ /* log de turnos para trazabilidad, no para búsqueda de contexto */ ]
}
```

**Regla de cambio de tema:** si la intención/entidades del turno actual no comparten relación con el contexto activo, este se mueve a `contextosArchivados` (no se borra) y se crea uno nuevo. Si el usuario dice algo como "el de hace rato" / "lo anterior", buscar primero en `contextosArchivados` antes de pedir el dato de nuevo.

## 8. Diccionario de sinónimos/jerga (`config/synonyms.js`)

Convertir esta tabla en estructura de datos (JSON/objeto JS), agrupada por concepto canónico:

| Concepto canónico | Variantes |
|---|---|
| pedido | OC, orden, orden de compra, compra, pedido, ped |
| proveedor | prov, proveedor, distribuidor |
| cedis | cedis, centro de distribución, almacén, bodega central |
| tienda | tda, sucursal, punto de venta, tienda |
| recepcion | recibo, entrega, llegó, descarga, ya llegó, ya entró, ya surtió |
| recepcion_parcial | llegó incompleto, llegó a medias, faltó, no llegó todo |
| recepcion_total | llegó completo, ya está todo, se cerró |
| inventario | stock, existencia, inventario, lo que hay, lo que tenemos |
| faltante | falta, no alcanzó, quedó corto, se quedó corto |
| en_transito | viene en camino, va para acá, está en ruta, todavía no llega |
| cita | cita, cita de entrega, hora de entrega |
| cita_vencida | se pasó la cita, ya se venció, no llegaron a la cita |
| cita_futura | cita programada, va a llegar, tiene fecha |
| material | material, producto, artículo, SKU |
| estado_pedido | cómo va, en qué va, cómo está, qué status tiene |
| numero_pedido | número de OC, folio, número de orden |

**Nota:** este diccionario es una hipótesis educada de dominio retail, no validada aún con usuarios reales de tienda. Es el riesgo funcional #1 del proyecto (ver Observaciones del Hito 2). Está diseñado para crecer sin tocar el motor — agregar términos es solo editar este archivo de configuración.

## 9. Intenciones y slots obligatorios (`config/intents.js`)

| Intención | Slots obligatorios | Slot alternativo |
|---|---|---|
| `consultar_pedido` | numero_pedido | tienda + proveedor (búsqueda) |
| `consultar_llegada` | numero_pedido | — |
| `consultar_cita` | numero_pedido | — |
| `consultar_inventario` | tienda + material | tienda (lista general) |
| `buscar_pedidos_por_tienda` | tienda | — |
| `buscar_pedidos_por_proveedor` | proveedor | — |

Si falta un slot obligatorio y no se resuelve por contexto, `response-generator.js` debe preguntar puntualmente por ese dato y **mantener la intención en espera** hasta la respuesta del usuario (no perder el hilo).

## 10. Resolución de ambigüedad — casos de prueba obligatorios

Estos casos están sembrados deliberadamente en el dataset y deben probarse explícitamente en el `ambiguity-resolver.js` antes de dar el motor por terminado:

- "Cumbres" → coincide con `T001 Tienda Cumbres` y `T002 Tienda Cumbres Sur`.
- "leche" → coincide con `M001 Leche Entera` y `M002 Leche Deslactosada`.
- "cola" / "refresco" → coincide con `M003 Refresco de Cola` y `M004 Refresco de Cola Zero`.
- Proveedor `P001` tiene 2 pedidos (4500101, 4500117) — útil para probar comparación, no ambigüedad de resolución pero sí de "cuál pedido".

Regla: ante coincidencia múltiple, el asistente pregunta de forma natural cuál de las opciones aplica, nunca falla en silencio ni elige una al azar.

## 11. Generación de respuestas — tono y formato

- Lenguaje natural, narrativo, nunca tablas crudas de sistema.
- Nunca exponer mecanismos internos (reglas, keywords, nombre del archivo Excel).
- Reconocer explícitamente cuando falta información, en vez de fallar en silencio.
- Respuestas breves por defecto, con detalle disponible bajo demanda ("¿quieres el detalle completo de materiales?").
- Ningún mensaje de error técnico (stack trace, "undefined", "null") debe llegar a la UI en ningún escenario — todo error interno debe convertirse en una respuesta conversacional de fallback.

## 12. Identidad visual (UI)

- Inspiración: **Microsoft Teams Dark**, **Fluent Design**, tipografía **Segoe UI** (fallback: system-ui/-apple-system).
- **Glassmorphism ligero** (blur sutil, transparencias controladas, no abusar).
- Animaciones discretas (transiciones de 150–300ms, sin rebotes exagerados).
- Responsive.
- Indicador de "escribiendo…" con timing variable (600–1500ms) para que no se sienta mecánico.
- Tokens de diseño centralizados en `styles/base/` (colores, tipografía, espaciado) — nunca valores sueltos por componente.
- Antes de escribir CSS/componentes de UI, **consultar la skill `frontend-design`** disponible en el entorno para lineamientos de estilo, tipografía y tokens.

## 13. Decisiones de arquitectura que NO deben cambiar durante el desarrollo

1. `data-connector/` es la única capa que lee el Excel.
2. El motor NLU no depende de librerías externas ni de red.
3. La memoria conversacional vive en memoria de sesión (objeto JS), nunca en localStorage/sessionStorage con fines de persistencia real.
4. Diccionarios de dominio (`config/`) separados del motor genérico — crecer vocabulario no debe tocar el orquestador.
5. UI con tokens de diseño centralizados, no valores sueltos por componente.

## 14. Supuestos adoptados para poder avanzar (ajustables si el usuario indica lo contrario)

- **Formato de demo:** mixto — un recorrido narrado principal más preguntas sueltas de respaldo (ver `Hito2_Modelo_Datos_PoC.md` sección 9 para los 12 escenarios completos).
- **Enfoque NLU:** reglas/diccionarios propios (sección 6 de este documento).
- **Vocabulario de jerga:** hipótesis de dominio retail, no validada con usuarios reales — ampliable en `config/synonyms.js` sin tocar el motor.
- **Volumen de datos:** 20 pedidos son suficientes para demo guiada; si se prevé exploración libre extensa, considerar ampliar a 30–40 antes del hito de pulido final (no ahora).

## 15. Orden de desarrollo recomendado

1. `data-connector/excel-reader.js` + `sap-connector.js` — validar que se pueden leer y consultar los datos correctamente antes de tocar NLU o UI.
2. `nlu/` completo (normalizer → spelling → abbreviations → intent-classifier → entity-extractor → ambiguity-resolver), probado con los 12 escenarios del Hito 2 sección 9.
3. `core/session-state.js` + `core/orchestrator.js` — integrar el pipeline completo de punta a punta, aún sin UI final (se puede probar por consola).
4. `response/response-generator.js`.
5. `ui/` — layout base tipo Teams, chat, input, indicador de escritura.
6. Identidad visual definitiva (Fluent Design, glassmorphism, tema oscuro) — consultar skill `frontend-design`.
7. Guion de demo + validación de los 12 escenarios sobre la UI ya integrada.
8. Pulido final.

## 16. Criterios de éxito (recordatorio para validar antes de dar por terminado el desarrollo)

1. Conversación completa sin que un facilitador tenga que "traducir" respuestas.
2. Al menos un caso de combinación de intenciones demostrado sin fricción (escenario #12 del catálogo).
3. Al menos un caso de cambio de tema y regreso exitoso (escenarios #6 y #7).
4. La interfaz se percibe, a primera vista, como Teams real.
5. Cero errores de sistema crudos visibles en cualquier momento de la demo.

## 17. Archivos de referencia disponibles

- `Hito1_Arquitectura_PoC_Asistente_SAP.md` — arquitectura completa, alternativas evaluadas, riesgos, backlog original.
- `Hito2_Modelo_Datos_PoC.md` — diseño de datos completo, diccionario de datos, 12 escenarios de demo con detalle, catálogo de sinónimos completo.
- `mock-sap.xlsx` — dataset ya generado y validado (0 inconsistencias). Debe copiarse a `data/mock-sap.xlsx` dentro del proyecto.

---

**Nota final para Claude Code:** el requisito no funcional más importante de todo el proyecto es que el usuario nunca perciba que los datos vienen de un Excel ni que el "razonamiento" es un motor de reglas. Cualquier decisión de implementación debe evaluarse primero contra ese criterio de inmersión, antes que contra elegancia técnica pura.
