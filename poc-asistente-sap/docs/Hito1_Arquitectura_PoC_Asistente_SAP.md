# Documento de Arquitectura — Hito 1
## Proof of Concept: Asistente Conversacional de IA para consultas tipo SAP en Microsoft Teams

**Versión:** 1.0
**Estado:** Borrador para aprobación de Dirección / Product Owner
**Hito:** 1 — Descubrimiento, Análisis y Arquitectura
**Alcance de este documento:** Análisis y diseño conceptual. No incluye código ni artefactos ejecutables.

---

## 1. Resumen ejecutivo

Se propone construir una Proof of Concept (PoC) de alta fidelidad que demuestre, ante Dirección, el potencial de sustituir consultas manuales en SAP —hoy realizadas por usuarios de tienda a través de pantallas transaccionales o reportes— por una experiencia conversacional en lenguaje natural, visualmente integrada en Microsoft Teams.

El usuario final nunca interactúa con SAP directamente ni sabe que, en esta etapa, las respuestas provienen de un archivo Excel local que simula la información que en el futuro entregarían los servicios reales de SAP (vía OData, BAPI/RFC expuestos como API, o un middleware tipo SAP BTP / API Management). La PoC debe sentirse indistinguible, en experiencia, de una integración real.

El énfasis del Hito 1 no es la velocidad de entrega sino la **solidez conceptual**: definir con precisión qué se va a construir, por qué, con qué arquitectura, qué alternativas se evaluaron y qué se dejará explícitamente fuera de alcance para no generar expectativas que la PoC no pueda sostener frente a Dirección.

---

## 2. Objetivos de negocio

1. Demostrar, con evidencia tangible, que la IA conversacional puede reducir la fricción y el tiempo que los usuarios de tienda invierten hoy en consultar información operativa (pedidos, recepciones, citas, inventario).
2. Generar respaldo ejecutivo (buy-in) para financiar una iniciativa real de integración IA + SAP.
3. Posicionar al área responsable como impulsora de innovación con capacidad de ejecución, no solo de propuesta.
4. Reducir el riesgo de una inversión mayor, validando primero la experiencia de usuario y la percepción de valor antes de comprometer presupuesto de integración real.

## 3. Objetivos del MVP (PoC)

1. Simular de forma creíble una conversación en lenguaje natural que resuelva los 4 casos de uso definidos.
2. Mostrar comprensión de lenguaje natural imperfecto (errores ortográficos, abreviaciones, jerga).
3. Demostrar manejo de contexto conversacional (memoria de sesión, cambio y regreso de tema, combinación de consultas).
4. Ofrecer una interfaz visualmente equivalente a Microsoft Teams (Fluent Design, modo oscuro) que reduzca la distancia imaginativa entre "esto que veo" y "esto que tendríamos en producción".
5. Mantener una arquitectura de código que pueda evolucionar hacia una integración real sin reescritura total (reemplazar el "conector Excel" por un conector SAP real debe ser un cambio localizado, no estructural).

## 4. Alcance

- Un asistente conversacional funcionando 100% en el navegador (HTML + CSS + JS, sin backend).
- Resolución de los 4 casos de uso: Seguimiento de Pedido, Confirmación de Llegada, Gestión de Citas, Inventario.
- Motor de interpretación de lenguaje natural basado en reglas/heurísticas (NLU ligero, sin dependencias de servicios en la nube).
- Simulación de "pensamiento" del asistente antes de responder.
- Manejo de datos mock a través de un archivo Excel leído localmente en el navegador.
- Memoria conversacional de sesión (se pierde al recargar la página, ver sección 26 sobre este trade-off).
- Interfaz con identidad visual tipo Microsoft Teams Dark / Fluent Design.
- Documentación de arquitectura y decisiones (este documento y los siguientes hitos).

## 5. Fuera de alcance

Es crítico dejar esto explícito para gestionar expectativas de Dirección desde el día uno:

- Integración real con SAP (OData, RFC, BAPI, IDoc, etc.).
- Integración real con Microsoft Teams (Teams Toolkit, Bot Framework, Graph API, Adaptive Cards nativas).
- Autenticación / autorización real de usuarios (SSO, Azure AD).
- Persistencia de datos entre sesiones (base de datos, localStorage con fines productivos).
- Modelo de lenguaje entrenado o conectado a un servicio de IA generativa en la nube (no hay llamadas a APIs externas; ver sección 14 para justificación y alternativa evaluada).
- Multiidioma (se asume español de negocio como único idioma).
- Escenarios de error de datos reales (SAP caído, timeouts, datos inconsistentes) — se simulan de forma controlada solo si aporta valor demostrativo (ver sección 30).
- Seguridad, cumplimiento normativo y gobierno de datos (fuera del ámbito de una PoC offline).
- Multiusuario concurrente / colaboración en tiempo real.

## 6. Perfil de usuarios

| Perfil | Rol en el proyecto | Necesidad |
|---|---|---|
| **Usuario de tienda** (persona real que hoy consulta SAP) | Usuario final simulado en la demo | Resolver dudas operativas rápido, sin navegar transacciones SAP, sin conocer códigos técnicos |
| **Dirección / Comité ejecutivo** | Audiencia de la presentación | Visualizar el retorno de una inversión en IA; necesita "verlo funcionar", no leer especificaciones técnicas |
| **Equipo técnico / TI** | Audiencia secundaria, evalúa viabilidad | Necesita confiar en que la arquitectura es escalable y no es "humo" |

**Supuesto a validar contigo:** asumo que la demo la presenta un facilitador (no Dirección tecleando en vivo sin guía). Esto cambia el diseño del flujo conversacional inicial (ver sección 30, "modo demo guiado"). Si Dirección va a interactuar libremente y sin guion, se debe reforzar aún más la tolerancia a preguntas fuera de guion.

## 7. Casos de uso

### 7.1 Caso de uso 1 — Seguimiento de Pedido

| Campo | Descripción |
|---|---|
| Número de pedido | Identificador único |
| Proveedor | Entidad que provee el material |
| Fecha de creación | Fecha de alta del pedido |
| Centro / Tienda | Ubicación destino |
| Materiales | Lista de materiales del pedido |
| Cantidades | Cantidad pedida por material |
| Estado general | Abierto / Parcial / Cerrado |
| Recepciones parciales | Cantidad recibida a la fecha |
| Recepción total | Booleano derivado (cantidad recibida = cantidad pedida) |

### 7.2 Caso de uso 2 — Confirmación de llegada

| Campo | Descripción |
|---|---|
| Recibo en Tienda | Booleano / fecha |
| Recibo en CEDIS | Booleano / fecha |
| CEDIS entrega en Tienda | Booleano / fecha |
| Pendiente de cita | Booleano |

### 7.3 Caso de uso 3 — Gestión de citas

| Campo | Descripción |
|---|---|
| Existe cita | Booleano |
| Fecha | Fecha de cita |
| Hora | Hora de cita |
| Estado | Programada / Confirmada / Cumplida / Cancelada |
| Proveedor | Proveedor asociado |
| CEDIS | Centro de distribución asociado |
| Entrega realizada | Booleano |

### 7.4 Caso de uso 4 — Inventario

| Campo | Descripción |
|---|---|
| Inventario disponible | Cantidad disponible en tienda |
| Inventario en tránsito | Cantidad en camino |
| Faltantes | Cantidad pendiente de surtir |

### 7.5 Relación entre casos de uso

Los 4 casos de uso no son independientes: comparten entidades (Pedido, Tienda, Proveedor, Material) y esto es, precisamente, lo que permite demostrar el mayor "efecto WOW" de la PoC: **preguntas que combinan más de un caso de uso en una sola respuesta** (ej. "¿cómo va el pedido 4500123 y ya tiene cita de entrega?" cruza Caso 1 y Caso 3). Este cruce debe diseñarse desde el modelo de datos (sección 25), no improvisarse en el motor conversacional.

## 8. Experiencia de usuario esperada

El asistente debe comportarse como un colega experto en logística/abasto, no como un buscador con caja de texto. Esto implica:

- Respuestas en lenguaje natural, nunca "tablas crudas de sistema" sin narrativa.
- Tono profesional pero cercano, propio de un asistente corporativo (no informal, no robótico).
- Reconocimiento explícito cuando falta información ("¿de qué tienda me hablas?") en vez de fallar en silencio o devolver un genérico "no encontrado".
- Transiciones fluidas entre temas, sin obligar al usuario a "reiniciar" la conversación.
- Una fase visible de "procesamiento" (indicador de escritura, tipo Teams) que refuerza la sensación de razonamiento, sin exponer nunca el mecanismo interno (reglas, keywords, Excel).
- Consistencia: mismo dato, misma forma de responder, sin importar cómo se formuló la pregunta.

## 9. Flujo completo de una conversación (ejemplo ilustrativo)

El siguiente es un guion de referencia para diseño (no es transcripción final ni código):

1. **Usuario:** "hola, como va el pedido 4500123"
2. **Sistema (interno):** normaliza texto → detecta intención `consultar_pedido` → extrae entidad `numero_pedido = 4500123` → confianza alta → no requiere clarificación.
3. **Asistente (UI):** muestra indicador "escribiendo…" (600–1200 ms simulados) → responde con estado del pedido, proveedor, tienda, materiales, y si tiene recepciones parciales, lo destaca.
4. **Usuario:** "y ya tiene cita?"
5. **Sistema (interno):** detecta intención `consultar_cita`, **sin número de pedido explícito** → resuelve la referencia usando el contexto de la conversación (pedido 4500123 sigue "activo" en memoria de sesión) → cruza con Caso de Uso 3.
6. **Asistente:** responde con datos de la cita ligada a ese pedido/proveedor/CEDIS.
7. **Usuario:** "cambio de tema, cuanto inventario hay de la tienda 045"
8. **Sistema (interno):** detecta cambio de tema (`consultar_inventario`, nueva entidad `tienda=045`) → **archiva** (no borra) el contexto anterior del pedido 4500123.
9. **Asistente:** responde inventario disponible / tránsito / faltantes de tienda 045.
10. **Usuario:** "oye y del pedido de hace rato, ya llegó completo?"
11. **Sistema (interno):** detecta referencia a contexto anterior ("de hace rato") → recupera pedido 4500123 desde el historial archivado → responde sobre recepción total.

Este flujo es el que valida, en una sola demo de 2–3 minutos, prácticamente todos los requisitos de experiencia solicitados: comprensión, memoria, cambio de tema, retorno de tema, combinación de casos de uso.

## 10. Arquitectura conceptual del sistema

La PoC se organiza en 4 capas lógicas, todas ejecutándose en el cliente (navegador):

| Capa | Responsabilidad | Analogía con arquitectura futura real |
|---|---|---|
| **Presentación (UI)** | Renderiza la conversación, inputs, indicadores de estado, identidad visual Teams | Se mantendría casi igual en producción (Teams App / Adaptive Cards) |
| **Orquestación conversacional** | Coordina turno de conversación: recibe texto, invoca NLU, gestiona memoria, decide respuesta | Equivalente a un "Bot Orchestrator" (ej. Bot Framework, o un orquestador propio sobre Azure) |
| **Motor de interpretación (NLU)** | Normaliza texto, detecta intención, extrae entidades, calcula confianza | Reemplazable por un servicio de NLU real (Azure Language Understanding, LLM vía API, etc.) sin tocar capas superiores |
| **Conector de datos ("SAP simulado")** | Expone una interfaz de consulta (ej. `obtenerPedido(numero)`) que hoy lee Excel y mañana llamaría un endpoint SAP | Esta capa es la pieza clave de escalabilidad: su contrato (inputs/outputs) se diseña **como si ya llamara a SAP** |

**Decisión de arquitectura clave:** el "Conector de datos" se diseña con una interfaz idéntica a la que tendría un futuro conector SAP real (mismos nombres de función, misma forma de respuesta). Esto es lo que permite decir honestamente en la presentación: *"el día que haya un endpoint SAP real, se reemplaza esta capa sin tocar el resto del sistema"*. Es, probablemente, el argumento técnico más persuasivo para Dirección, porque convierte la promesa de escalabilidad en algo verificable en el código, no solo en una afirmación de venta.

## 11. Arquitectura conceptual del motor conversacional

El motor conversacional se divide en etapas secuenciales por cada turno del usuario:

1. **Normalización de texto**: minúsculas, remoción de acentos si aporta tolerancia, limpieza de espacios/puntuación.
2. **Corrección tolerante**: aproximación a palabras clave conocidas pese a errores ortográficos (ver sección 16).
3. **Expansión de abreviaciones y jerga**: traducción a forma canónica antes de interpretar (ver secciones 15 y 17).
4. **Detección de intención**: qué quiere el usuario (consultar pedido, consultar cita, consultar inventario, consultar llegada, combinaciones).
5. **Extracción de entidades**: qué datos concretos menciona (número de pedido, tienda, proveedor, fecha).
6. **Resolución de contexto**: si faltan entidades, ¿se pueden inferir de la conversación reciente? (ver sección 20).
7. **Evaluación de confianza / ambigüedad**: ¿hay suficiente certeza para responder, o se debe preguntar? (ver sección 18).
8. **Consulta al conector de datos**: se invoca la capa de datos con las entidades resueltas.
9. **Generación de respuesta en lenguaje natural**: se arma una respuesta narrativa, no un volcado de datos.
10. **Actualización de memoria de sesión**: se registra el turno, la intención, las entidades y qué quedó "activo" como contexto.

## 12. Componentes principales del proyecto

| Componente | Responsabilidad única |
|---|---|
| `UI / Chat Renderer` | Dibuja mensajes, indicador de escritura, scroll, estados visuales |
| `Input Handler` | Captura texto del usuario, validaciones básicas de entrada |
| `Text Normalizer` | Limpieza y normalización de texto crudo |
| `Spelling Tolerance` | Corrección aproximada de términos clave |
| `Abbreviation & Slang Resolver` | Traduce abreviaciones/jerga a forma canónica |
| `Intent Classifier` | Determina la(s) intención(es) del mensaje |
| `Entity Extractor` | Extrae entidades relevantes (número de pedido, tienda, proveedor, fecha) |
| `Context Manager` (memoria conversacional) | Mantiene y resuelve contexto activo/archivado |
| `Ambiguity Resolver` | Decide si se pregunta al usuario antes de responder |
| `Data Connector (mock SAP)` | Interfaz de consulta contra el Excel, con forma de futuro conector real |
| `Excel Reader` | Carga y parsea el archivo Excel en memoria al iniciar la app |
| `Response Generator` | Convierte resultados de datos en lenguaje natural |
| `Conversation Orchestrator` | Coordina el ciclo completo por turno (llama a los componentes anteriores en orden) |
| `Session State Store` | Objeto en memoria (no persistente) con historial y preferencias de sesión |

Cada componente tiene una única responsabilidad y una interfaz de entrada/salida bien definida, lo que permite reemplazar cualquiera de ellos (por ejemplo, `Data Connector` o `Intent Classifier`) sin romper los demás.

## 13. Organización recomendada del proyecto

Estructura de carpetas conceptual (se implementará en el Hito de desarrollo correspondiente, no en este):

```
poc-asistente-sap/
├── index.html
├── assets/
│   ├── icons/
│   └── fonts/
├── styles/
│   ├── base/          (tokens, variables, reset)
│   ├── components/    (chat bubble, input bar, header, indicadores)
│   └── themes/        (tema Teams Dark)
├── data/
│   └── mock-sap.xlsx
├── scripts/
│   ├── core/           (orchestrator, session-state)
│   ├── nlu/             (normalizer, spelling, abbreviations, intent, entities, ambiguity)
│   ├── data-connector/  (excel-reader, sap-connector-interface, queries por caso de uso)
│   ├── response/        (generador de lenguaje natural, plantillas)
│   ├── ui/              (renderer, input-handler, typing-indicator)
│   └── config/          (diccionarios: sinónimos, jerga, abreviaciones, intents)
└── docs/
    └── (este documento y los siguientes hitos)
```

Esta organización refleja las capas de la sección 10 y los componentes de la sección 12: cada carpeta tiene una responsabilidad, y `data-connector/` queda aislado deliberadamente para que sea el único punto de contacto con el archivo Excel — el reemplazo futuro por SAP real toca únicamente esa carpeta.

## 14. Estrategia de interpretación de lenguaje natural (NLU)

Este es el tema técnico más sensible del proyecto porque **no hay backend ni llamadas a servicios externos**, así que no se puede usar un LLM real ni un servicio de NLU en la nube. Se evaluaron dos alternativas:

| | **Alternativa A — Motor basado en reglas/heurísticas propio** | **Alternativa B — Librería NLP ligera offline (ej. compromise.js, natural.js)** |
|---|---|---|
| **Descripción** | Diccionarios de intención/entidad + scoring por coincidencia de patrones, sinónimos y distancia de edición, hecho a la medida del dominio (pedidos, citas, inventario) | Usar una librería JS de procesamiento de lenguaje (tokenización, POS tagging, etc.) como base y construir la lógica de dominio encima |
| **Ventajas** | Control total, cero dependencias externas, 100% predecible, fácil de ajustar en vivo si algo falla en la demo, footprint mínimo | Aporta tokenización y utilidades lingüísticas ya resueltas; puede generalizar mejor a frases no anticipadas |
| **Desventajas** | Requiere curar bien los diccionarios de dominio; puede sentirse "rígido" si no se diseña con suficientes sinónimos | Estas librerías están entrenadas mayormente para **inglés**; el soporte de español es limitado o inexistente en las más ligeras; agregan peso y una curva de aprendizaje sin garantizar mejor resultado en este dominio tan acotado (4 casos de uso) |
| **Riesgo para offline** | Ninguno — no requiere red tras la carga inicial | Debe empaquetarse localmente (no CDN) para cumplir "offline total"; viable pero añade una dependencia más a mantener |

**Recomendación del arquitecto:** Alternativa A (motor propio basado en reglas y diccionarios de dominio). Justificación: el universo de intenciones es pequeño y cerrado (4 casos de uso), el idioma es español de negocio con jerga muy específica de la empresa (no cubierta por ninguna librería genérica), y la demo exige **control total y previsibilidad** — no queremos que una librería genérica "adivine mal" delante de Dirección. Un motor propio, bien diseñado con diccionarios de sinónimos/jerga curados, da mejor experiencia percibida con menor riesgo.

**Pendiente de tu aprobación:** confirmar que este enfoque (reglas + diccionarios, sin librerías NLP externas) es aceptable, entendiendo que "comprensión de lenguaje natural" en esta PoC significa *cobertura amplia y bien curada del dominio*, no comprensión general del idioma como lo haría un LLM.

## 15. Estrategia para comprender abreviaciones

Diccionario de equivalencias mantenido en configuración (`config/abbreviations.js` conceptual), que traduce formas abreviadas a su forma canónica antes de la clasificación de intención. Ejemplos de patrón (no exhaustivo): "ped." → "pedido", "cli" → "cliente", "prov" → "proveedor", "cd" / "cedis" → "CEDIS", "tda" → "tienda". El diccionario se organiza por caso de uso para facilitar su mantenimiento y crecimiento.

## 16. Estrategia para comprender errores ortográficos

Se aplicará una técnica de **coincidencia aproximada** (distancia de Levenshtein o similar) entre los tokens del mensaje del usuario y el vocabulario clave del dominio (nombres de intención, palabras ancla como "pedido", "cita", "inventario", "recepción"). Si la distancia está dentro de un umbral tolerable, se considera coincidencia válida. Esto cubre errores comunes ("pedico", "invetario", "recepcion" sin acento) sin necesidad de un corrector ortográfico completo del idioma español.

## 17. Estrategia para comprender jerga del negocio

Se construye un **glosario de dominio** (curado junto con el especialista SAP/negocio) que traduce términos coloquiales de tienda a conceptos del modelo de datos. Ejemplo de estructura conceptual: términos como "ya llegó", "ya surtió", "ya está en tienda" se mapean a la intención `consultar_llegada` / campo `Recibo en Tienda`. Este glosario es, junto con el de abreviaciones, el activo que más debe cuidarse: la calidad percibida de "la IA entiende cómo hablamos en tienda" depende directamente de qué tan bien curado esté.

**Nota de riesgo:** este glosario requiere insumo real del negocio (frases que efectivamente usan los usuarios de tienda). Sin ese insumo, se construirá con supuestos razonables pero con riesgo de no cubrir el vocabulario real. Se marca como dependencia hacia el Hito 2 (sección 32).

## 18. Estrategia para resolver ambigüedades

Cada intención detectada lleva un **nivel de confianza**. Reglas propuestas:

- **Confianza alta + entidades completas** → responde directo.
- **Confianza alta + entidades incompletas** → solicita el dato faltante (sección 19).
- **Confianza media / intención múltiple posible** → el asistente ofrece una pregunta de desambiguación breve (ej. "¿te refieres al pedido o a la cita de entrega?"), nunca un error técnico.
- **Confianza baja** → respuesta de "no te entendí del todo" con sugerencia de reformulación, manteniendo tono humano, nunca un mensaje de sistema.

## 19. Estrategia para solicitar información faltante

Se implementa un patrón de **slot filling**: cada intención define sus "slots" obligatorios (ej. `consultar_pedido` requiere `numero_pedido` o, alternativamente, `tienda + proveedor` como búsqueda). Si falta un slot obligatorio y no puede resolverse por contexto, el asistente pregunta puntualmente por ese dato, y **retiene la intención en espera** hasta que el usuario responda, en vez de perder el hilo de la conversación.

## 20. Estrategia de memoria conversacional

Se evaluaron dos alternativas:

| | **Alternativa A — Historial lineal simple (log de turnos)** | **Alternativa B — Memoria basada en "frames" de contexto activos/archivados** |
|---|---|---|
| **Descripción** | Se guarda la secuencia de mensajes y se busca hacia atrás cuando falta un dato | Se mantiene un objeto de "contexto activo" por tema (pedido actual, tienda actual, etc.) más una pila de contextos archivados al cambiar de tema |
| **Ventajas** | Simple de implementar | Permite exactamente lo pedido: cambiar de tema y **regresar** al anterior de forma natural, combinar consultas, resolver referencias tipo "el pedido de hace rato" |
| **Desventajas** | Regresar a un tema anterior requiere reprocesar todo el log cada vez, es frágil y menos preciso | Requiere diseño más cuidadoso de cuándo "archivar" vs "mantener activo" un contexto |

**Recomendación:** Alternativa B (frames de contexto activos/archivados). Es la única que soporta con solidez los requisitos explícitos de "cambiar de tema" y "regresar al tema anterior" sin lógica frágil de búsqueda en texto libre.

## 21. Estrategia para cambios de contexto

El `Context Manager` detecta cambio de tema cuando la intención detectada en el turno actual no comparte entidades relevantes con el contexto activo (ej. pasar de hablar de un pedido a hablar de inventario de otra tienda). Al detectarlo:

1. El contexto activo se mueve a una pila de "contextos archivados" (no se borra).
2. Se crea un nuevo contexto activo con la nueva intención/entidades.
3. Si el usuario hace referencia explícita o implícita a "lo anterior", se busca primero en la pila archivada antes de pedir el dato de nuevo.

## 22. Estrategia para combinar múltiples consultas

Cuando el `Intent Classifier` detecta más de una intención en un mismo mensaje (ej. "¿cómo va el pedido y ya tiene cita?"), el `Conversation Orchestrator` las resuelve en secuencia contra el `Data Connector` y el `Response Generator` las integra en **una sola respuesta narrativa coherente**, no como dos respuestas pegadas. Este es uno de los puntos de mayor impacto demostrativo (sección 30) porque es lo que más distancia a la PoC de un simple buscador de formularios.

## 23. Estrategia de aprendizaje durante la sesión

Es importante ser preciso con Dirección sobre qué significa "aprender" aquí: **no hay entrenamiento de modelo ni aprendizaje real**. Lo que se implementa es retención de preferencias de sesión, por ejemplo: si el usuario ya mencionó que trabaja con la tienda 045, el asistente puede asumirla como default en preguntas ambiguas posteriores ("¿y el inventario?" → asume tienda 045 si no se dice lo contrario), hasta que el usuario la cambie explícitamente. Esto se debe comunicar internamente como "memoria de preferencias de sesión", no como "machine learning", para evitar expectativas incorrectas en la propia área técnica.

## 24. Diseño conceptual del flujo de datos

```
Usuario escribe mensaje
        ↓
Text Normalizer → Spelling Tolerance → Abbreviation/Slang Resolver
        ↓
Intent Classifier + Entity Extractor
        ↓
Context Manager (resuelve entidades faltantes con contexto activo/archivado)
        ↓
Ambiguity Resolver (¿se puede responder? / ¿hay que preguntar?)
        ↓
   ¿Falta info? → Sí → Response Generator pide el dato → (fin de turno, espera respuesta)
        ↓ No
Data Connector (mock SAP) consulta el Excel según intención(es) y entidades
        ↓
Response Generator arma respuesta en lenguaje natural (incluye combinación si hay múltiples intenciones)
        ↓
Session State Store actualiza historial + contexto activo
        ↓
UI muestra indicador "escribiendo…" y luego la respuesta
```

## 25. Diseño conceptual del archivo Excel y sus relaciones

Se propone un archivo Excel con múltiples hojas relacionadas por claves comunes, simulando lo que en SAP serían distintas tablas/vistas:

| Hoja | Contenido | Clave(s) |
|---|---|---|
| `Pedidos` | Número de pedido, proveedor, fecha creación, tienda, estado general | `numero_pedido` (PK) |
| `PedidoMateriales` | Detalle de materiales y cantidades por pedido | `numero_pedido` (FK) + `material` |
| `Recepciones` | Recepciones parciales/totales por pedido y material | `numero_pedido` (FK) |
| `Llegadas` | Recibo en tienda, recibo en CEDIS, entrega CEDIS→Tienda, pendiente de cita | `numero_pedido` (FK) |
| `Citas` | Fecha, hora, estado, proveedor, CEDIS, entrega realizada | `numero_pedido` o `id_cita` (FK/PK) |
| `Inventario` | Disponible, en tránsito, faltantes | `tienda` + `material` (PK compuesta) |
| `Tiendas` | Catálogo de tiendas (nombre, código, región) | `codigo_tienda` (PK) |
| `Proveedores` | Catálogo de proveedores | `codigo_proveedor` (PK) |

**Decisión pendiente de tu aprobación (magnitud del mock):** propongo, como punto de partida razonable para una demo de alto impacto sin sobrecargar el mantenimiento del Excel: **entre 15 y 25 pedidos**, **4 a 6 tiendas**, **5 a 8 proveedores**, **10 a 15 materiales**, con **al menos 3–4 "historias completas"** diseñadas deliberadamente para que la demo luzca bien (un pedido con recepción parcial, uno con cita pendiente, uno con inventario en faltante crítico, uno "perfecto" de punta a punta). El resto de los registros pueden ser variaciones automáticas para dar sensación de volumen real. Quedo atento a tu confirmación o ajuste de estas cantidades.

## 26. Riesgos técnicos

| Riesgo | Impacto | Mitigación propuesta |
|---|---|---|
| Un motor de reglas propio puede fallar ante frases no anticipadas durante la demo en vivo | Alto (visible ante Dirección) | Diseñar un "modo demo guiado" con preguntas validadas de antemano (sección 30) + fallback conversacional elegante ante lo no reconocido |
| Parseo de Excel en navegador puede ser lento si el archivo crece sin control | Medio | Mantener el mock dentro de los volúmenes recomendados en la sección 25; cachear en memoria tras la primera carga |
| Pérdida de contexto al recargar la página (no hay persistencia) | Medio | Aceptado como limitación conocida de la PoC; comunicarlo proactivamente, no ocultarlo |
| Complejidad de mantener diccionarios (jerga/abreviaciones) creciendo sin estructura | Medio-largo plazo | Organización modular por caso de uso desde el día uno (sección 13) |

## 27. Riesgos funcionales

| Riesgo | Impacto | Mitigación propuesta |
|---|---|---|
| El glosario de jerga se construye sin insumo real de usuarios de tienda | Alto (afecta credibilidad del "entiende cómo hablamos") | Solicitar al especialista de negocio/SAP una lista real de frases usadas en tienda antes del Hito 2 (dependencia formal, sección 32) |
| Los 4 casos de uso pueden no cubrir la pregunta específica que haga un ejecutivo curioso en la demo | Medio | Diseñar respuestas de "no tengo esa información todavía, pero en producción se conectaría a X" en vez de fallar en seco |
| Confusión entre qué es simulado y qué sería real en producción | Alto (puede generar expectativas erróneas) | Slide/mensaje explícito de "qué es real hoy vs. qué se simula" como parte de la presentación (sección 29) |

## 28. Riesgos de experiencia de usuario

| Riesgo | Impacto | Mitigación propuesta |
|---|---|---|
| Indicador de "pensando" demasiado largo o demasiado corto rompe la ilusión de naturalidad | Medio | Calibrar tiempos (600 ms–1.5 s) y variarlos ligeramente para que no se sienta mecánico |
| Respuestas demasiado largas o "tipo reporte" | Medio | Priorizar respuestas conversacionales breves, con detalle disponible bajo demanda ("¿quieres el detalle completo de materiales?") |
| Interfaz que se vea "genérica" y no como Teams real | Alto (compromete la percepción de calidad) | Inversión deliberada en Fluent Design, tipografía Segoe UI, glassmorphism ligero, micro-animaciones (Hito de UI) |

## 29. Recomendaciones para la presentación ejecutiva

1. Abrir con el problema real (tiempo/fricción actual en tienda) antes de mostrar la solución.
2. Ejecutar el flujo de la sección 9 (o uno equivalente) como guion principal, validado previamente sin improvisar en vivo.
3. Incluir explícitamente un momento donde se muestre la combinación de casos de uso (sección 22) — es el mayor diferenciador frente a "un buscador con IA".
4. Cerrar con una diapositiva clara de "qué es simulado hoy / qué sería real en producción" (transparencia que genera más confianza que ocultar la naturaleza de la PoC).
5. Tener preparado un set de preguntas "seguras" adicionales por si Dirección quiere probar libremente (modo demo guiado, sección 30).

## 30. Funcionalidades opcionales que incrementarían el impacto sin gran costo adicional

Propuestas para tu valoración (no implementadas todavía):

1. **Modo "demo guiada" con sugerencias de preguntas** (chips/botones tipo Teams con preguntas frecuentes) — reduce el riesgo de que Dirección pregunte algo no cubierto, sin quitarle naturalidad a la conversación.
2. **Resumen proactivo tipo "tarjeta" (Adaptive Card visual)** para pedidos/citas, además del texto — refuerza la sensación de integración real con Teams.
3. **Indicador visual de "fuente de datos"** discreto (ej. un pequeño sello "SAP" en la respuesta) que refuerza la narrativa sin romper la inmersión, ya que el usuario real nunca sabría que es Excel.
4. **Panel lateral de "conversaciones recientes"** (solo visual, tipo Teams), aunque no sea funcional, añade fidelidad de producto real.
5. **Modo oscuro/claro conmutable** — bajo costo, alto valor percibido de producto terminado.
6. **Simulación de notificación proactiva** (ej. "tu pedido 4500123 tuvo una actualización") disparada por temporizador durante la demo — muestra visión de producto más allá del modo reactivo pregunta-respuesta, altamente persuasivo para Dirección sin requerir arquitectura adicional real.

Costo de desarrollo estimado de estas 6 propuestas: bajo-medio, dado que reutilizan componentes ya planeados. Se recomienda priorizarlas en el backlog (sección 33) pero decidir cuáles entran al alcance del Hito 2 en conjunto contigo.

## 31. Decisiones de arquitectura que deben mantenerse durante todo el proyecto

1. El `Data Connector` es la única capa que conoce la existencia del Excel; ninguna otra capa debe leer el archivo directamente.
2. El motor de NLU no depende de librerías externas ni de red.
3. La memoria conversacional vive en memoria de sesión (objeto JS), nunca en localStorage/sessionStorage con fines de persistencia real, para respetar la restricción de "sin base de datos" y evitar falsas expectativas de persistencia.
4. Toda la lógica de negocio de dominio (diccionarios, reglas) vive en `config/`, separada del motor genérico, para que crecer el vocabulario no implique tocar el código del orquestador.
5. La interfaz visual sigue tokens de diseño (colores, tipografía, espaciado) centralizados, no valores sueltos por componente, para permitir theming consistente.

## 32. Dependencias para el Hito 2

1. **Aprobación de las decisiones marcadas como "pendientes de aprobación"** en este documento (secciones 14, 25, y elección de funcionalidades opcionales de la sección 30).
2. **Insumo de negocio real**: frases/jerga que efectivamente usan los usuarios de tienda (para curar los diccionarios de las secciones 15 y 17) — idealmente aportado por el especialista SAP/negocio del equipo.
3. Confirmación de la audiencia/formato de la demo (sección 6) para calibrar el "modo demo guiado".
4. Confirmación de si se desea iniciar el Hito 2 con **diseño conversacional detallado y modelo de datos (Excel)** antes de tocar la interfaz visual, o en paralelo.

## 33. Backlog priorizado de desarrollo (visión preliminar, sujeta a Hito 2)

| Prioridad | Elemento |
|---|---|
| 1 | Modelo de datos y archivo Excel (estructura + datos mock curados) |
| 2 | Motor NLU base: normalización, intención, entidades para los 4 casos de uso |
| 3 | Context Manager (memoria conversacional, cambio/regreso de tema) |
| 4 | Data Connector (conexión al Excel con interfaz "SAP-ready") |
| 5 | Response Generator (respuestas naturales, combinación de intenciones) |
| 6 | UI base tipo Teams (layout, chat, input, indicador de escritura) |
| 7 | Identidad visual definitiva (Fluent Design, glassmorphism, tema oscuro) |
| 8 | Funcionalidades opcionales seleccionadas (sección 30) |
| 9 | Guion de demo + modo guiado |
| 10 | Pulido final y ensayo de presentación |

## 34. Criterios de éxito del proyecto

1. Dirección puede seguir una conversación completa sin que el facilitador tenga que "traducir" o justificar respuestas del asistente.
2. Se demuestra al menos un caso de combinación de intenciones (sección 22) sin fricción.
3. Se demuestra al menos un caso de cambio de tema y regreso exitoso al tema anterior.
4. La interfaz es percibida, a primera vista, como "esto ya parece Teams", sin que se tenga que explicar que es una maqueta.
5. Ningún error de sistema crudo (stack trace, "undefined", mensajes técnicos) es visible en ningún momento de la demo.
6. Dirección articula, al final de la demo, una visión propia de dónde más podría aplicarse esto — señal cualitativa de que el objetivo de negocio (sección 2) se cumplió.

## 35. Estado del proyecto al finalizar el Hito 1

**Completado:**
- Visión, objetivos de negocio y del MVP definidos.
- Alcance y fuera de alcance delimitados explícitamente.
- Los 4 casos de uso modelados a nivel de campos y relaciones.
- Arquitectura conceptual de 4 capas definida, con foco explícito en escalabilidad hacia SAP real.
- Motor conversacional diseñado por etapas (normalización → intención → entidades → contexto → ambigüedad → datos → respuesta).
- Estrategias definidas para: abreviaciones, errores ortográficos, jerga, ambigüedad, slot filling, memoria conversacional, cambio de contexto, combinación de consultas, "aprendizaje" de sesión.
- Diseño conceptual del modelo de datos Excel (hojas, claves, relaciones).
- Riesgos técnicos, funcionales y de UX identificados con mitigación propuesta.
- Backlog preliminar y criterios de éxito definidos.

**Pendiente (requiere tu decisión antes de iniciar Hito 2):**
1. Aprobar el enfoque de NLU (motor de reglas propio, sección 14).
2. Aprobar o ajustar la magnitud de datos mock (sección 25).
3. Confirmar audiencia/formato de la demo (interacción libre vs. guiada, sección 6).
4. Priorizar cuáles funcionalidades opcionales (sección 30) entran al alcance formal.
5. Definir si hay disponibilidad de un especialista de negocio/SAP para aportar jerga real de tienda (dependencia sección 32), o si se procede con supuestos razonables documentados como tales.

**Dependencias abiertas:** ver sección 32.

**Riesgos abiertos de mayor atención:** riesgo funcional de glosario de jerga sin insumo real (sección 27) y riesgo de UX de que la interfaz no alcance el nivel de fidelidad visual esperado (sección 28) — este último se resolverá en el hito de diseño de interfaz, pero se señala desde ahora porque es determinante para el "efecto WOW" ante Dirección.

---

# Observaciones del Arquitecto

Esta sección es una evaluación crítica, no una validación de cortesía.

**Fortalezas del planteamiento original:**
- Los 4 casos de uso están bien acotados y comparten un modelo de datos coherente, lo cual habilita de forma natural el requisito más ambicioso (combinar consultas) sin necesidad de trucos.
- La restricción de "sin backend" está bien alineada con el objetivo real del proyecto (demo, no producción); no se está sobre-construyendo.
- La exigencia de que el usuario "nunca sepa" que es un Excel es una decisión de producto correcta: fuerza a diseñar la capa de datos con disciplina, como si ya fuera SAP real.

**Debilidades y puntos ciegos que identifico:**
1. **El mayor riesgo del proyecto no es técnico, es de contenido**: la calidad percibida de "esta IA entiende cómo hablamos" depende casi enteramente de qué tan bien curados estén los diccionarios de jerga y abreviaciones (secciones 15 y 17), y hoy no existe ese insumo real. Sin él, se corre el riesgo de construir un glosario "de laboratorio" que no resiste una pregunta espontánea de un ejecutivo. **Recomiendo tratar esto como el riesgo #1 del proyecto**, por encima de cualquier riesgo técnico.
2. **"Comprender lenguaje natural" es una expectativa que puede sobre-prometerse.** Un motor de reglas, por bien diseñado que esté, no es un LLM. Si la demo se presenta como "esto entiende cualquier cosa que le digas", el riesgo de quedar mal ante Dirección es alto. Recomiendo posicionar la demo internamente (y en el guion de presentación) como *"comprensión profunda del dominio específico de la operación"*, no como *"inteligencia artificial general"* — es más honesto y, contra-intuitivamente, más persuasivo, porque es creíble.
3. **No hay, en el planteamiento original, un plan explícito para cuando el asistente "no sabe"**. Un fallback pobre (mensaje de error genérico) puede arruinar una demo entera. Ya lo incorporé como riesgo funcional (sección 27) y como parte del diseño de respuesta (sección 18), pero quiero remarcarlo: **el diseño del fallback merece tanto cuidado como el diseño del camino feliz.**
4. **El requisito de "aprender durante la conversación" es ambiguo y, mal comunicado internamente, puede generar expectativas incorrectas incluso dentro del propio equipo técnico.** Lo resolví como "memoria de preferencias de sesión" (sección 23), pero recomiendo que este documento, o una nota aparte, se comparta explícitamente con cualquier stakeholder técnico adicional para evitar que alguien asuma que hay aprendizaje automático real.
5. **La combinación con Microsoft Teams es puramente visual en esta PoC**, y eso está bien para una demo, pero es también el punto donde Dirección más fácilmente puede sobreestimar qué tan cerca está la solución de ser desplegable. Sugiero que la sección "qué es real / qué se simula" (recomendación 4 de la sección 29) sea obligatoria, no opcional, en la presentación.

**Qué cambiaría antes de iniciar el Hito 2, si dependiera de mí:**
- Conseguir, aunque sea una lista breve (10–20 frases), de vocabulario real de tienda antes de curar los diccionarios finales. Es la inversión de menor costo con mayor impacto en la credibilidad de la demo.
- Definir el guion exacto de la demo (sección 9 es un borrador razonable, pero debería validarse con quien conozca mejor a la audiencia de Dirección) antes de diseñar la interfaz, para que el diseño visual se optimice para *ese* recorrido específico, no para un recorrido genérico.
- Decidir explícitamente, y por escrito, cuáles de las funcionalidades opcionales (sección 30) entran al alcance, para evitar scope creep silencioso durante el desarrollo — son de bajo costo individualmente, pero se acumulan.

**Conclusión del arquitecto:** el planteamiento es sólido y está bien pensado para un objetivo de demo ejecutiva. El principal riesgo no está en la tecnología elegida (la restricción offline es perfectamente viable con el enfoque propuesto), sino en la **calidad del contenido de dominio** (jerga, vocabulario, guion de demo) y en la **gestión honesta de expectativas** sobre qué es simulado. Ambos son resolubles, pero requieren decisiones tuyas antes de avanzar al Hito 2.
