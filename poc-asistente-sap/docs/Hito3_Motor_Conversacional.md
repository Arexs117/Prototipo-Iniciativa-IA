# Documento de cierre — Hito 3
## Diseño e Implementación del Motor Conversacional

**Continuación de:** Hito 1 (arquitectura) e Hito 2 (modelo de datos), ambos completados y congelados.
**Entregable de código:** `scripts/` completo (core, nlu, data-connector, response, config, shared) + `tests/`.
**Alcance de este documento:** qué se construyó, cómo se validó, y una revisión crítica del motor antes de pasar al Hito 4 (interfaz visual). **No se construyó interfaz visual en este hito**, tal como se indicó explícitamente.

---

## 1. Qué se construyó

Un motor conversacional modular, 100% JavaScript ES6+ vanilla, sin dependencias de red en tiempo de ejecución (SheetJS vendorizado localmente en `assets/vendor/`). Expone un único punto de entrada agnóstico de UI:

```js
import { inicializarMotor, procesarMensaje, crearSessionState } from './scripts/core/orchestrator.js';

await inicializarMotor('data/mock-sap.xlsx');
const estado = crearSessionState();
const resultado = procesarMensaje(estado, 'cómo va el pedido 4500102');
// resultado.respuesta.texto, resultado.intenciones, resultado.entidadesResueltas...
```

Cualquier interfaz futura (Teams, web, chat) solo necesita llamar `procesarMensaje` por turno y renderizar `resultado.respuesta.texto` (más el indicador "pensando" y las sugerencias que ya vienen incluidos).

### 1.1 Módulos entregados (13 archivos + 1 utilidad compartida)

| Capa | Archivo | Responsabilidad única |
|---|---|---|
| Datos | `data-connector/excel-reader.js` | Cargar y cachear `mock-sap.xlsx` una sola vez |
| Datos | `data-connector/sap-connector.js` | Funciones "SAP-ready" (única capa que toca el Excel) |
| Config | `config/synonyms.js` | Diccionario de jerga/sinónimos (fuente única de verdad) |
| Config | `config/intents.js` | Catálogo de intenciones + slots obligatorios/alternativos |
| NLU | `nlu/normalizer.js` | Minúsculas, sin acentos, sin puntuación |
| NLU | `nlu/spelling-tolerance.js` | Tolerancia ortográfica (Levenshtein) |
| NLU | `nlu/abbreviations.js` | Expansión de jerga a concepto canónico |
| NLU | `nlu/intent-classifier.js` | Intención(es) candidata(s) |
| NLU | `nlu/entity-extractor.js` | Extracción de entidades (exactas y aproximadas) |
| NLU | `nlu/ambiguity-resolver.js` | Responder / aclarar / pedir dato faltante |
| Core | `core/session-state.js` | Memoria conversacional (frames activos/archivados) |
| Core | `core/orchestrator.js` | Coordina el pipeline de 10 pasos |
| Respuesta | `response/response-generator.js` | Texto natural, integra múltiples intenciones |
| Respuesta | `response/suggestion-engine.js` | Sugerencia proactiva (máx. 1 por turno) |
| Respuesta | `response/thinking-simulator.js` | Indicador "pensando" (600–1500 ms) |
| Compartido | `shared/text-utils.js` | Normalización y Levenshtein genéricos (reutilizado por NLU y data-connector) |

**Nota de arquitectura no prevista originalmente:** se agregó `scripts/shared/text-utils.js` para no duplicar la lógica de normalización/Levenshtein entre `nlu/spelling-tolerance.js` y la búsqueda aproximada de `sap-connector.js`. Es la única desviación de la estructura de carpetas propuesta en el contexto de desarrollo, y es puramente por reutilización (alta cohesión, bajo acoplamiento).

---

## 2. Pipeline por turno (implementado tal como se especificó)

1. Normalización → 2. Tolerancia ortográfica → 3. Expansión de jerga → 4. Clasificación de intención(es) → 5. Extracción de entidades → 6. Resolución de contexto → 7. Ambigüedad/confianza → 8. Consulta de datos → 9. Generación de respuesta → 10. Actualización de memoria.

`core/orchestrator.js` es el único módulo que conoce el pipeline completo; todos los demás módulos ignoran su posición dentro de él.

---

## 3. Decisiones de diseño relevantes (más allá de lo obvio)

- **Intención "familia pedido" (`consultar_pedido` / `buscar_pedidos_por_tienda` / `buscar_pedidos_por_proveedor`)**: las tres comparten el concepto disparador "pedido", así que `intent-classifier.js` las propone siempre juntas y `ambiguity-resolver.js` decide cuál ejecutar según qué slot fue mencionado explícitamente este turno, o si el mensaje trae marcas de "listado" (plural, "cuáles otros...").
- **Aprendizaje de sesión desde los datos, no solo del texto**: al consultar un pedido, `orchestrator.js` deriva tienda/proveedor/CEDIS del resultado y los guarda en memoria — así "¿y el proveedor de ese pedido, qué otros tiene?" no requiere que el usuario haya escrito el proveedor antes.
- **Intención "en espera"**: si falta un slot o hay ambigüedad, el estado de sesión guarda `pendiente = { intención, slot, entidadesParciales }`; el siguiente turno se interpreta primero como respuesta a esa pregunta, no como un mensaje nuevo — así no se pierde el hilo.
- **Comparación de pedidos**: dos números de pedido explícitos en el mismo mensaje no se tratan como ambigüedad (a diferencia de dos nombres aproximados que coinciden), sino como una comparación explícita — cubre el escenario "cómo van los pedidos X y Y".
- **Corrección ortográfica conservadora**: se limitó a distancia de edición 1 (más un diccionario explícito de typos conocidos) después de detectar, durante las pruebas, que una tolerancia más laxa corrompía palabras válidas y nombres propios de proveedores/tiendas (ver sección 5).

---

## 4. Batería de pruebas y validación funcional

`tests/casos-prueba.js` + `tests/test-runner.html` — se ejecuta en un navegador real (Chromium vía Playwright en este entorno de desarrollo) porque el motor depende de `fetch()` + SheetJS, igual que lo hará la interfaz final. No hay mocks: cada prueba corre contra `orchestrator.js` real y el Excel real.

**Resultado final: 37/37 pruebas OK.**

Cobertura:

| Categoría exigida | Cubierta con |
|---|---|
| Consultas correctas | Hito2 #1 |
| Errores ortográficos | Hito2 #4 ("pedico", "yego") |
| Ambigüedad | Hito2 #3 (doble: tienda + material), ambigüedad simple de tienda |
| Cambio de contexto | Hito2 #6, grupo dedicado "pedido → inventario → proveedor → vuelta" |
| Conversaciones largas | Narrativa continua Hito2 #4→#5→#6→#7→#12 (5 turnos), cadena de memoria (5 turnos) |
| Consultas múltiples | Hito2 #12 (combinada), Hito2 #8 (comparación de 2 pedidos) |
| Recuperación de contexto | Hito2 #7 ("el pedido de hace rato"), grupo de cambio de contexto |
| Sinónimos | "stock"/"faltante" para inventario |
| Abreviaciones | "ped", "oc" |
| Jerga de negocio | Los 10 ejemplos explícitos del Hito 3 ("¿ya cayó?", "¿ya descargaron?", "¿dónde viene mi pedido?", "busca la compra", etc.) |
| Casos sin resultados | Pedido inexistente, pedido sin cita registrada |
| Casos con múltiples resultados | Hito2 #10 (tienda Satélite), proveedor P001 |
| Información insuficiente | Pregunta sin número de pedido → el motor pregunta → el usuario responde solo el número → se resuelve sin perder la intención |
| Robustez / sin errores crudos | Mensajes sin sentido, nunca exponen `undefined`/`null`/stack traces |

### 4.1 Bugs reales encontrados y corregidos durante la validación

Documentados porque son la evidencia de que la batería de pruebas cumplió su propósito (no fue un ejercicio cosmético):

1. **Desalineación de nombres de claves** entre `entity-extractor.js` (devolvía `numerosPedido`, `tiendas`, `proveedores`...) y `session-state.js`/`orchestrator.js` (esperaban las claves singulares de `TIPOS_ENTIDAD`). Sin la prueba automatizada, esto habría hecho que el contexto NUNCA se resolviera correctamente.
2. **Sobre-corrección ortográfica**: con tolerancia de Levenshtein 2, palabras válidas como "cambio" y "vega" (nombre de proveedor) se corrompían a "camino" y "venta" por casualidad de vocabulario. Se redujo a tolerancia 1 + diccionario explícito de typos conocidos.
3. **Coincidencia aproximada sin anclaje de palabra**: "tal" (de "¿qué tal...?") coincidía por subcadena dentro de "vege**tal**", disparando falsos positivos de material. Se corrigió anclando la coincidencia por subcadena al inicio de palabra.
4. **Conflicto entre el fallback genérico del clasificador de intención y la "intención en espera"**: un mensaje de un solo número (respondiendo a "¿de qué pedido hablas?") activaba el fallback genérico de `intent-classifier.js` antes de que `orchestrator.js` pudiera interpretarlo como continuación del slot pendiente.

Los tres primeros son exactamente el tipo de error que una demo en vivo sin batería de pruebas habría expuesto frente a Dirección.

---

## 5. Revisión crítica del motor conversacional

### 5.1 Escalabilidad
El vocabulario (`config/synonyms.js`), las intenciones (`config/intents.js`) y los casos de prueba están desacoplados del motor: agregar un término de jerga, una intención nueva o un caso de prueba no toca `core/`, `nlu/` (salvo si la intención nueva requiere una consulta de datos nueva) ni `response/`. El cuello de botella real de escalabilidad no es el código sino el **vocabulario de jerga**, que sigue siendo una hipótesis de dominio no validada con usuarios reales de tienda (riesgo heredado del Hito 1 y 2, aún abierto).

### 5.2 Claridad de responsabilidades
Cada módulo tiene una sola razón para cambiar. La única dependencia "cruzada" es `entity-extractor.js` → `sap-connector.js` (necesaria para resolver nombres aproximados a códigos reales) y `sap-connector.js` → `shared/text-utils.js` (reutilización de Levenshtein). Ninguna otra capa conoce el formato del Excel.

### 5.3 Facilidad de integrar APIs reales de SAP
Alta, por diseño: `sap-connector.js` ya expone funciones con firma "de servicio" (`obtenerPedido`, `obtenerCitaPorPedido`, etc.). Sustituir el Excel por SAP real implica reescribir **solo** `excel-reader.js` y el cuerpo de las funciones de `sap-connector.js` (de síncronas a asíncronas — ver riesgo técnico 5.4.1); el resto del motor (NLU, contexto, respuesta) no debería tocarse.

### 5.4 Riesgos técnicos
1. **Todas las consultas de datos son síncronas** (leen de un objeto cacheado en memoria). Un backend SAP real sería asíncrono (llamadas HTTP/OData). `orchestrator.js` tendría que volverse `async` en `ejecutarConsulta`/`ejecutarConsultas` — cambio mecánico pero no trivial, y hoy `procesarMensaje` es síncrona por completo.
2. **La búsqueda aproximada es fuerza bruta** (recorre todo el catálogo por cada mensaje). Con 6–30 registros por catálogo es instantáneo; con un catálogo SAP real de miles de materiales/tiendas necesitaría un índice o un servicio de búsqueda dedicado.
3. **`response-generator.js` concatena texto con plantillas de string**, no con un motor de plantillas real. Es legible y suficiente para el alcance actual, pero crecerá en complejidad si se agregan muchas más variaciones de tono.

### 5.5 Riesgos funcionales
1. **Vocabulario de jerga no validado** (heredado, ver Hito 1/2) — sigue siendo el riesgo #1 del proyecto.
2. **Cobertura de intenciones vs. catálogo de demo del Hito 2**: el Hito 2 (sección 9) incluye dos escenarios que exceden el catálogo de 6 intenciones definido en el Hito 3 (`config/intents.js`, tal como se especificó):
   - Escenario #9 ("¿hay algo pendiente de cita en la tienda cumbres?") es una agregación **por tienda** sobre `Llegadas.pendiente_cita`, y ninguna intención actual tiene `tienda` como slot de `consultar_cita`.
   - Escenario #11 ("¿cuántas cajas de agua vienen en camino?") es una agregación **por material, todas las tiendas**, y `consultar_inventario` exige tienda (sola o con material), nunca material solo.

   Comportamiento actual ante estos dos casos: el motor **no falla ni expone errores** — responde pidiendo el dato que le falta (p. ej. el número de pedido), un fallback seguro pero no tan "inteligente" como el resto de la demo. **Recomendación explícita:** decidir en el Hito 4 si se agregan dos intenciones nuevas (`consultar_pendientes_cita_por_tienda`, `consultar_transito_por_material`) o si esos dos escenarios se retiran del guion de demo. No se implementaron por iniciativa propia en este hito porque el catálogo de 6 intenciones fue especificado explícitamente en el contexto de desarrollo — es una decisión que corresponde confirmar antes de tocar `config/intents.js`.
3. **La "familia pedido" (consultar_pedido / buscar por tienda / buscar por proveedor) se desambigua con heurísticas** (origen explícito del turno > marca de listado > default a consultar_pedido). Cubre todos los casos de prueba actuales, pero es la parte más "artesanal" del motor — el candidato más probable a necesitar ajuste si aparecen frases nuevas no anticipadas en la demo en vivo.

### 5.6 Oportunidades de mejora (no bloqueantes para el Hito 4)
- Añadir un mecanismo explícito de "corrección del usuario" (hoy el aprendizaje de sesión es memoria de entidades recientes + intención en espera, pero no hay un patrón para detectar "no, me refería a...").
- Extraer `response-generator.js`'s frases de apertura/cierre a `templates.js` de forma más sistemática (hoy solo los conectores y el formato de fecha están centralizados ahí).
- Considerar un índice simple (mapa por palabra clave) si el catálogo de materiales/tiendas crece más allá de unas pocas decenas, para no depender de recorrido lineal en la búsqueda aproximada.

---

## 6. Estado actualizado del proyecto

**Completado en este hito:**
- Motor conversacional completo, modular, corriendo 100% en cliente sin red.
- Los 6 intents del catálogo del Hito 3 implementados con memoria conversacional (frames activos/archivados + memoria de entidades recientes + intención en espera).
- Integración conceptual con el modelo de datos del Hito 2 vía `sap-connector.js`.
- Batería de 37 pruebas automatizadas, ejecutadas contra el motor real (no mocks), **37/37 OK**.
- SheetJS vendorizado localmente (`assets/vendor/xlsx.full.min.js`) — cumple el requisito de "offline total" sin dejarlo pendiente.

**Pendiente / decisiones que requieren confirmación antes del Hito 4:**
1. Si se amplía `config/intents.js` para cubrir los escenarios #9 y #11 del catálogo del Hito 2 (ver 5.5.2), o se ajusta el guion de demo para omitirlos.
2. Validación del vocabulario de jerga con usuarios reales (riesgo heredado, sigue abierto).
3. Todo lo de identidad visual (Fluent Design, glassmorphism, Teams Dark) — explícitamente fuera de alcance de este hito, queda íntegro para el Hito 4.

**No se tocó:** `styles/`, `ui/`, `index.html` — tal como se indicó, este hito fue exclusivamente el "cerebro" del asistente.
