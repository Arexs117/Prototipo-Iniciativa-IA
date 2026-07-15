# Documento de Diseño — Hito 2
## Modelo de Datos y Simulación de Servicios SAP

**Continuación de:** Hito 1 — Arquitectura conceptual (documento aprobado en su versión de decisiones marcadas)
**Entregable de código:** `mock-sap.xlsx` (adjunto)
**Alcance de este documento:** Modelo de datos, diccionario, integridad, catálogo de jerga y escenarios de demo. No se generó HTML/CSS/JS en este hito.

---

## Nota de continuidad respecto al Hito 1

Antes de avanzar, dejo constancia de cómo se resolvieron los pendientes que quedaron abiertos al cierre del Hito 1, a partir de las instrucciones de este Hito 2:

| Pendiente del Hito 1 | Estado |
|---|---|
| Magnitud del mock de datos | **Resuelto**: este hito especificó ~20 pedidos; se implementaron exactamente 20, con 34 posiciones de material en total — consistente con lo que yo había propuesto (15–25) |
| Vocabulario real de jerga de tienda | **Parcialmente resuelto**: este hito entregó una lista base de sinónimos/jerga; la amplié con criterio de dominio (sección 8). Sigue siendo una lista construida por supuestos razonables, no validada con usuarios reales de tienda — mantengo esto como riesgo abierto (ver Observaciones) |
| Enfoque de NLU (reglas propias vs. librería) | **Aún no formalmente aprobado por ti** — no bloquea este hito porque el modelo de datos es independiente del motor conversacional, pero sigue pendiente antes de iniciar el diseño del motor NLU (Hito 3) |
| Formato de demo (guiada vs. libre) | Aún abierto — no bloquea este hito, pero condiciona cómo diseño el catálogo de escenarios (sección 9); asumí un formato mixto (ver sección 9) |
| Selección de funcionalidades opcionales | Aún abierto — no aplica a este hito |

No detuve el hito por estos puntos porque ninguno impide diseñar y poblar el modelo de datos correctamente. Sí los dejo explícitos porque **si el enfoque de NLU cambiara**, el catálogo de sinónimos (sección 8) podría necesitar ajuste de formato (no de contenido).

---

## 1. Diseño definitivo del modelo de datos

Se optó por un **modelo relacional de 9 hojas**, una por entidad de negocio, en lugar de una sola hoja plana o de una estructura desnormalizada por caso de uso. Estructura final:

| Hoja | Entidad de negocio | Filas generadas |
|---|---|---|
| `Proveedores` | Catálogo maestro de proveedores | 8 |
| `CEDIS` | Catálogo maestro de centros de distribución | 4 |
| `Tiendas` | Catálogo maestro de tiendas | 6 |
| `Materiales` | Catálogo maestro de materiales | 12 |
| `Pedidos` | Encabezado de cada orden de compra | 20 |
| `PedidoPosiciones` | Detalle de materiales/cantidades por pedido | 34 |
| `Recepciones` | Eventos de recepción por posición de pedido | 34 |
| `Llegadas` | Estado de tránsito CEDIS → Tienda por pedido | 20 |
| `Citas` | Citas de entrega asociadas a pedidos | 16 |
| `Inventario` | Existencias por combinación tienda–material | 29 |

**Justificación de la estructura elegida:**

Se descartó deliberadamente una alternativa de "una hoja por caso de uso" (una hoja para responder Caso 1, otra para Caso 2, etc., con datos repetidos entre ellas) porque:

1. **Duplicaría información** (el mismo pedido aparecería con distintos campos en 4 hojas distintas), generando el riesgo explícito que el propio hito pidió evitar: "no debe existir información huérfana, no debe haber inconsistencias". Duplicar datos es la fuente más común de inconsistencia en un dataset mantenido a mano.
2. **No permitiría demostrar la combinación de casos de uso** (requisito central de la experiencia conversacional) de forma natural, porque no habría una clave común confiable para cruzar, por ejemplo, un pedido con su cita.
3. Un modelo de **una hoja por entidad, con claves consistentes**, es exactamente lo que en el futuro sería un conjunto de tablas/vistas SAP (o de endpoints OData independientes), por lo que **facilita literalmente la sustitución futura**: cada hoja de este Excel es, conceptualmente, "un servicio" que en producción se reemplazaría por una llamada real, sin cambiar la forma en que el resto del sistema consume los datos.

`PedidoPosiciones` se separó de `Pedidos` (en vez de meter los materiales como columnas del pedido) porque un pedido puede tener 1 a N materiales — modelarlo como columnas fijas (material_1, cantidad_1, material_2...) habría limitado artificialmente cuántos materiales puede tener un pedido y habría sido, además, la forma menos parecida a como SAP realmente modela posiciones de pedido (EKPO).

`Recepciones` se separó de `Llegadas` porque responden preguntas distintas: `Recepciones` es a nivel **material** (¿cuánto llegó de qué?, Caso de Uso 1), mientras que `Llegadas` es a nivel **pedido/logística** (¿en qué punto del trayecto CEDIS→Tienda está?, Caso de Uso 2). Mezclarlas habría obligado a repetir la fila por cada material aunque el estado logístico sea el mismo para todo el pedido.

## 2. Diccionario de datos

### `Proveedores`
| Campo | Tipo | Descripción |
|---|---|---|
| codigo_proveedor | Texto (PK) | Identificador único, formato `P0##` |
| nombre | Texto | Razón social o nombre comercial |
| categoria_principal | Texto | Giro principal (Lácteos, Bebidas, Abarrotes, Limpieza) |
| ubicacion | Texto | Ciudad/estado de origen |

### `CEDIS`
| Campo | Tipo | Descripción |
|---|---|---|
| codigo_cedis | Texto (PK) | Identificador único, formato `C0#` |
| nombre | Texto | Nombre del centro de distribución |
| ubicacion | Texto | Ciudad/estado |

### `Tiendas`
| Campo | Tipo | Descripción |
|---|---|---|
| codigo_tienda | Texto (PK) | Identificador único, formato `T0##` |
| nombre | Texto | Nombre de la tienda |
| codigo_cedis_asociado | Texto (FK → CEDIS) | CEDIS que habitualmente surte a esta tienda |
| ubicacion | Texto | Ciudad/estado |

### `Materiales`
| Campo | Tipo | Descripción |
|---|---|---|
| codigo_material | Texto (PK) | Identificador único, formato `M0##` |
| descripcion | Texto | Nombre comercial del material |
| categoria | Texto | Categoría de producto |
| unidad_medida | Texto | Unidad de conteo (pza, paq) |

### `Pedidos`
| Campo | Tipo | Descripción |
|---|---|---|
| numero_pedido | Texto (PK) | Identificador único, formato `45001##` (convención tipo orden de compra SAP) |
| codigo_proveedor | Texto (FK → Proveedores) | Proveedor emisor |
| codigo_tienda | Texto (FK → Tiendas) | Tienda destino |
| codigo_cedis | Texto (FK → CEDIS) | CEDIS de tránsito |
| fecha_creacion | Fecha | Fecha de alta del pedido |
| estado_general | Texto (derivado) | `Abierto` / `Parcial` / `Cerrado` — calculado a partir de `Recepciones` |

### `PedidoPosiciones`
| Campo | Tipo | Descripción |
|---|---|---|
| numero_pedido | Texto (FK → Pedidos) | Pedido al que pertenece |
| posicion | Número | Número de posición dentro del pedido (10, 20, 30…) |
| codigo_material | Texto (FK → Materiales) | Material solicitado |
| cantidad_solicitada | Número | Cantidad pedida de ese material |

### `Recepciones`
| Campo | Tipo | Descripción |
|---|---|---|
| numero_pedido | Texto (FK → Pedidos/PedidoPosiciones) | Pedido asociado |
| posicion | Número (FK → PedidoPosiciones) | Posición asociada |
| codigo_material | Texto (FK → Materiales) | Material recibido |
| cantidad_solicitada | Número | Duplicado de control (facilita cálculo de faltante sin cruzar hojas) |
| cantidad_recibida | Número | Cantidad efectivamente recibida a la fecha |
| fecha_recepcion | Fecha (nullable) | Fecha del último evento de recepción; nulo si aún no hay recepción |
| estado_posicion | Texto | `Pendiente` / `Parcial` / `Completa` / `En tránsito a tienda` |

### `Llegadas`
| Campo | Tipo | Descripción |
|---|---|---|
| numero_pedido | Texto (PK, FK → Pedidos) | Pedido asociado (1 registro por pedido) |
| recibo_cedis | Booleano | ¿El CEDIS ya recibió mercancía del proveedor? |
| fecha_recibo_cedis | Fecha (nullable) | Fecha de recepción en CEDIS |
| recibo_tienda | Booleano | ¿La tienda ya recibió mercancía? |
| fecha_recibo_tienda | Fecha (nullable) | Fecha de recepción en tienda |
| cedis_entrega_tienda | Booleano | ¿El CEDIS ya despachó hacia la tienda? |
| fecha_entrega_tienda | Fecha (nullable) | Fecha de despacho CEDIS → tienda |
| pendiente_cita | Booleano | ¿Falta agendar cita de entrega? |

### `Citas`
| Campo | Tipo | Descripción |
|---|---|---|
| id_cita | Texto (PK) | Identificador único, formato `CIT####` |
| numero_pedido | Texto (FK → Pedidos) | Pedido para el que se agenda la cita |
| codigo_proveedor | Texto (FK → Proveedores) | Proveedor que entrega |
| codigo_cedis | Texto (FK → CEDIS) | CEDIS donde ocurre la cita |
| fecha | Fecha | Fecha programada |
| hora | Texto | Hora programada |
| estado | Texto | `Programada` / `Confirmada` / `Cumplida` / `Vencida` |
| entrega_realizada | Booleano | ¿Se completó la entrega en esa cita? |

**Nota de diseño:** no todo pedido tiene una fila en `Citas` — un pedido recién creado y sin cita agendada, deliberadamente, no aparece en esta hoja. Esto es intencional (no es un dato faltante por error) y así debe interpretarlo el motor conversacional: "sin fila en Citas" significa "aún no hay cita registrada", una respuesta válida y distinta de un error.

### `Inventario`
| Campo | Tipo | Descripción |
|---|---|---|
| codigo_tienda | Texto (FK → Tiendas) | Tienda |
| codigo_material | Texto (FK → Materiales) | Material |
| inventario_disponible | Número | Unidades disponibles en tienda hoy |
| inventario_transito | Número | Unidades en camino hacia la tienda |
| faltante | Número | Unidades pendientes de surtir respecto a lo solicitado |

Clave compuesta `(codigo_tienda, codigo_material)`, sin duplicados — se acumula por pedido cuando dos pedidos distintos afectan la misma combinación tienda-material.

## 3. Relaciones entre entidades

```
Proveedores (1) ──< (N) Pedidos
CEDIS       (1) ──< (N) Pedidos
Tiendas     (1) ──< (N) Pedidos
Pedidos     (1) ──< (N) PedidoPosiciones
Materiales  (1) ──< (N) PedidoPosiciones
PedidoPosiciones (1) ──< (1) Recepciones   [1 recepción vigente por posición]
Pedidos     (1) ──< (1) Llegadas           [1 registro logístico por pedido]
Pedidos     (1) ──< (0..1) Citas           [0 o 1 cita activa por pedido]
Proveedores (1) ──< (N) Citas
CEDIS       (1) ──< (N) Citas
Tiendas     (1) ──< (N) Inventario
Materiales  (1) ──< (N) Inventario
```

Esta estructura reproduce exactamente el recorrido solicitado en el Hito 2 (Proveedor → Pedido → Materiales → Recepciones → Citas → Inventario → Tienda → CEDIS), con la única precisión de que `Citas` es opcional (0..1) por diseño, no huérfana.

## 4. Definición de claves

| Hoja | Clave primaria | Claves foráneas |
|---|---|---|
| Proveedores | codigo_proveedor | — |
| CEDIS | codigo_cedis | — |
| Tiendas | codigo_tienda | codigo_cedis_asociado → CEDIS |
| Materiales | codigo_material | — |
| Pedidos | numero_pedido | codigo_proveedor → Proveedores; codigo_tienda → Tiendas; codigo_cedis → CEDIS |
| PedidoPosiciones | (numero_pedido, posicion) | numero_pedido → Pedidos; codigo_material → Materiales |
| Recepciones | (numero_pedido, posicion) | (numero_pedido, posicion) → PedidoPosiciones |
| Llegadas | numero_pedido | numero_pedido → Pedidos |
| Citas | id_cita | numero_pedido → Pedidos; codigo_proveedor → Proveedores; codigo_cedis → CEDIS |
| Inventario | (codigo_tienda, codigo_material) | codigo_tienda → Tiendas; codigo_material → Materiales |

## 5. Reglas de integridad

1. Toda clave foránea debe existir en su catálogo maestro correspondiente (sin excepciones) — **validado, 0 huérfanos**.
2. `cantidad_recibida` nunca puede exceder `cantidad_solicitada` en `Recepciones` — **validado**.
3. Si `cantidad_recibida > 0`, entonces `fecha_recepcion` no puede ser nulo — **validado**.
4. `fecha_recepcion` nunca puede ser anterior a `fecha_creacion` del pedido — **validado**.
5. Cada pedido tiene exactamente un registro en `Llegadas` (ni cero ni más de uno) — **validado**.
6. Cada pedido tiene, como máximo, un registro activo en `Citas` — **validado**.
7. `Inventario` no tiene combinaciones duplicadas de `(codigo_tienda, codigo_material)` — **validado**.
8. Ningún valor numérico de `Inventario` es negativo — **validado**.
9. `estado_general` de `Pedidos` es siempre consistente con el conjunto de `estado_posicion` de sus posiciones en `Recepciones` (recalculado y verificado, no solo asumido) — **validado**.

## 6. Reglas de negocio utilizadas

1. **Estado general del pedido** se deriva así: si todas las posiciones están `Completa` → `Cerrado`; si al menos una posición tiene alguna recepción (`Parcial` o `Completa`) → `Parcial`; si ninguna posición tiene recepción → `Abierto`. El estado nunca se captura manualmente de forma independiente, precisamente para que no pueda desincronizarse de la realidad de las recepciones.
2. **Faltante** se calcula como la diferencia entre lo solicitado y lo recibido cuando el pedido está parcialmente recibido y no se espera ya más recepción en el corto plazo (se modela como faltante "real", no como una simple resta automática de todo pedido abierto — un pedido recién creado *no* tiene faltante, tiene *pendiente de recibir*, que es un concepto distinto).
3. **Pendiente de cita** (`Llegadas`) es verdadero únicamente cuando el pedido aún no tiene ninguna cita registrada en `Citas` y todavía no ha sido entregado — evita el caso ambiguo de "pendiente de cita" en un pedido que ya se entregó.
4. **Cita vencida** se modela como una cita cuya fecha ya pasó respecto a la fecha ancla de "hoy" del dataset (`2026-07-10`) y cuya entrega no se realizó — deliberadamente incluida para poner a prueba al asistente en un escenario "negativo" que Dirección probablemente intentará provocar en la demo.
5. **Convención de numeración tipo SAP**: pedidos `45001##` (rango típico de órdenes de compra), posiciones en múltiplos de 10 — refuerza la sensación de realismo frente a un ejecutivo familiarizado con SAP.

## 7. Validación del dataset (resultado)

Se ejecutó un script de validación automatizada (no visual, sobre los datos cargados del Excel) que verificó las 9 reglas de la sección 5. Resultado:

```
✅ Validación completa: sin registros huérfanos, sin inconsistencias detectadas.

Estados generales de pedidos: Cerrado=7, Abierto=7, Parcial=6
Estados de citas: Cumplida=11, Confirmada=2, Programada=2, Vencida=1
```

La distribución de estados es intencionalmente balanceada (ni todos cerrados, ni todos problemáticos) para que la demo pueda mostrar tanto el "camino feliz" como los casos que exigen más inteligencia conversacional (faltantes, citas vencidas, en tránsito).

## 8. Catálogo de sinónimos, abreviaciones y jerga del negocio

Este catálogo alimentará el `Abbreviation & Slang Resolver` y el `Intent Classifier` en el Hito 3. Se organiza por concepto canónico (el que usará el modelo de datos) y sus variantes coloquiales:

| Concepto canónico | Variantes / jerga / abreviaciones |
|---|---|
| Pedido | OC, orden, orden de compra, compra, pedido |
| Proveedor | prov, proveedor, distribuidor |
| CEDIS | cedis, centro de distribución, almacén, bodega central |
| Tienda | tda, sucursal, punto de venta, tienda |
| Recepción | recibo, entrega, llegó, descarga, ya llegó, ya entró, ya surtió |
| Recepción parcial | llegó incompleto, llegó a medias, faltó, no llegó todo |
| Recepción total | llegó completo, ya está todo, se cerró |
| Inventario | stock, existencia, inventario, lo que hay, lo que tenemos |
| Faltante | falta, no alcanzó, quedó corto, se quedó corto |
| En tránsito | viene en camino, va para acá, está en ruta, todavía no llega |
| Cita | cita, cita de entrega, hora de entrega |
| Cita vencida | se pasó la cita, ya se venció, no llegaron a la cita |
| Cita futura | cita programada, va a llegar, tiene fecha |
| Material | material, producto, artículo, SKU |
| Estado del pedido | cómo va, en qué va, cómo está, qué status tiene |
| Número de pedido | número de OC, folio, número de orden |

**Nota de expansión:** el hito original entregó una base menor (OC/orden/pedido, CEDIS/centro de distribución/almacén, recepción/recibo/entrega/llegó/descarga, inventario/stock/existencia); la amplié con criterio de dominio retail para cubrir mejor los 4 casos de uso, pero **sin validación con usuarios reales**, tal como quedó señalado como riesgo abierto desde el Hito 1.

## 9. Catálogo de escenarios de demostración

Formato de cada entrada: **Consulta del usuario → Información que debe localizar el sistema → Resultado esperado → Comportamiento inteligente demostrado.**

| # | Consulta del usuario | Debe localizar | Resultado esperado | Comportamiento demostrado |
|---|---|---|---|---|
| 1 | "cómo va el pedido 4500102" | Pedidos + PedidoPosiciones + Recepciones (4500102) | Estado Parcial, detalle de materiales, cuánto llegó y cuánto falta | Búsqueda simple directa |
| 2 | "ped 4500108, ya tiene cita?" | Abreviación "ped" → pedido; Citas (4500108) | Cita vencida (2026-07-04), no cumplida — alerta implícita | Abreviación + detección de caso "problemático" |
| 3 | "cuanto stock hay de leche en la tienda cumbres" | Ambigüedad: "leche" coincide con M001 y M002; "cumbres" coincide con T001 y T002 | El asistente debe pedir aclaración de cuál tienda y, si corresponde, cuál "leche" | Resolución de ambigüedad (doble, deliberada) |
| 4 | "el pedico 4500105 ya yego completo?" | Tolerancia ortográfica: "pedico"→"pedido", "yego"→"llegó"; Recepciones (4500105) | Recepción parcial, con faltante en M010 | Corrección ortográfica tolerante |
| 5 | "y el proveedor de ese pedido, cuáles otros pedidos tiene abiertos?" (como seguimiento del #4) | Contexto activo (4500105 → proveedor P003); Pedidos filtrados por P003 y estado Abierto | Lista de pedidos abiertos de Alimentos San Miguel | Memoria conversacional + consulta derivada del contexto |
| 6 | "cambio de tema, qué tal el inventario de la tienda león centro" | Cambio de tema explícito; Inventario (T005) | Disponible/tránsito/faltante de T005 | Detección de cambio de contexto (archiva el anterior) |
| 7 | "oye y el pedido de hace rato, ya tuvo su cita?" | Recuperación de contexto archivado (4500105 no tenía cita en este caso — debe decir explícitamente que no hay cita registrada) | Respuesta clara de "no hay cita registrada", no un error | Recuperación de contexto anterior + manejo correcto de ausencia de dato |
| 8 | "cómo van los pedidos 4500101 y 4500117 del mismo proveedor" | Proveedor P001 aparece en ambos; comparación de estados (Cerrado vs. En tránsito) | Comparación lado a lado de dos pedidos del mismo proveedor | Combinación de múltiples consultas + comparación |
| 9 | "hay algo pendiente de cita en la tienda cumbres" | Ambigüedad de tienda (T001 vs T002) + Llegadas con pendiente_cita=True | Pedir aclaración de tienda antes de responder | Ambigüedad + slot filling |
| 10 | "que pedidos tiene la tienda satelite" | Tiendas (T006) + Pedidos filtrados | Lista de pedidos de T006 (4500107, 4500113, 4500119) con distintos estados | Búsqueda por entidad con múltiples resultados |
| 11 | "cuantas cajas de agua vienen en camino" | "agua" → M012; Inventario con inventario_transito > 0 | Unidades en tránsito de Agua Embotellada por tienda | Jerga ("cajas" como unidad coloquial) + síntesis |
| 12 | "necesito saber si ya llegó todo lo del pedido 4500101 y si el cedis ya se lo entregó a la tienda" | Combinación explícita: Recepciones + Llegadas (4500101) | Respuesta única que integra ambos casos de uso (1 y 2) | Combinación de casos de uso en una sola respuesta narrativa |

**Supuesto de formato de demo:** diseñé este catálogo asumiendo un **formato mixto**: un recorrido narrado (escenarios 1, 2, 4, 6, 7, 8, 12 forman una secuencia continua que cuenta una historia) más preguntas sueltas de respaldo (3, 5, 9, 10, 11) por si Dirección quiere probar libremente. Si prefieres un formato 100% guiado o 100% libre, este catálogo se ajusta fácilmente — quedo atento a tu confirmación (pendiente heredado del Hito 1, sección "Nota de continuidad").

## 10. Recomendaciones para el Hito 3

1. El motor NLU del Hito 3 debe construirse **directamente sobre este diccionario de sinónimos** (sección 8) como fuente única de verdad — evitar que el motor tenga su propia lista paralela.
2. Los escenarios de ambigüedad deliberada (Cumbres/Cumbres Sur, Leche/Leche Deslactosada, Cola/Cola Zero) deben usarse como **casos de prueba obligatorios** del `Ambiguity Resolver`, no solo como demo — si el motor no los maneja bien en pruebas internas, tampoco lo hará en vivo.
3. Recomiendo que el Hito 3 incluya, además del motor, una **capa delgada de acceso a datos** (`data-connector`) con funciones ya nombradas como si fueran servicios SAP reales (ej. `obtenerEstadoPedido()`, `obtenerCitaPorPedido()`, `obtenerInventarioPorTiendaYMaterial()`), leyendo de este Excel — esto es exactamente lo que permite, en el futuro, sustituir el Excel por llamadas reales sin tocar el motor conversacional.
4. Antes de iniciar el Hito 3, sigue pendiente tu aprobación del enfoque de NLU (reglas propias, Hito 1 sección 14) — recomiendo confirmarlo ahora, ya que el Hito 3 lo implementará directamente.

## 11. Estado actualizado del proyecto

**Completado en este hito:**
- Modelo relacional de 9 hojas diseñado, justificado y poblado con 20 pedidos (34 posiciones), con escenarios deliberados de negocio (cerrados, parciales, en tránsito, citas futuras/vencidas, faltantes reales).
- Diccionario de datos completo, claves primarias/foráneas definidas, reglas de integridad verificadas automáticamente (0 errores).
- Reglas de negocio documentadas y aplicadas de forma consistente (estado derivado, no capturado a mano).
- Catálogo de sinónimos/jerga ampliado con criterio de dominio.
- Catálogo de 12 escenarios de demostración, con formato consulta → dato a localizar → resultado esperado → comportamiento demostrado.
- Archivo `mock-sap.xlsx` generado, validado y listo para ser consumido por el motor conversacional del Hito 3.

**Pendiente (heredado + nuevo):**
1. Aprobación formal del enfoque de NLU (reglas propias) — bloqueante para iniciar Hito 3 con confianza.
2. Confirmación del formato de demo (guiado / libre / mixto) — afecta el diseño final del guion, no el motor.
3. Validación del catálogo de jerga con al menos una fuente real de negocio, si es que existe disponibilidad — de lo contrario, se documenta como supuesto razonable y se avanza.
4. Selección de funcionalidades opcionales de la sección 30 del Hito 1, si se desea incluirlas en el alcance del Hito 3 o 4.

**Dependencias hacia el Hito 3:** este modelo de datos es la única fuente de verdad que consumirá el motor conversacional; cualquier cambio de estructura después del Hito 3 tendría costo de retrabajo, por lo que se recomienda **congelar este modelo** salvo hallazgos críticos.

---

# Observaciones del Arquitecto

**Fortalezas del modelo entregado:**
- Cero inconsistencias detectadas en la validación automatizada — no es una afirmación de cortesía, se verificó programáticamente contra las 9 reglas de integridad.
- Los escenarios "negativos" (cita vencida, faltante real, en tránsito) no fueron un añadido posterior: se diseñaron desde el inicio como parte de la distribución de 20 pedidos, lo cual da a la demo mucho más profundidad que un dataset "todo perfecto".
- La ambigüedad deliberada (nombres de tienda y materiales similares) está bien distribuida entre distintos pedidos, lo que permite probarla en más de un escenario sin que se sienta forzada.

**Debilidades que identifico:**
1. **El catálogo de jerga sigue siendo, en el fondo, una hipótesis educada.** Lo dije en el Hito 1 y se mantiene: es el riesgo #1 del proyecto. Este hito lo amplió con criterio de dominio, pero no lo resolvió de raíz. Si hay cualquier forma de conseguir, aunque sea de manera informal, 15–20 frases reales de un usuario de tienda antes del Hito 3, el retorno en credibilidad de la demo sería alto.
2. **20 pedidos es suficiente para una demo de 3–5 minutos, pero es un dataset pequeño si Dirección empieza a "probar límites"** (ej. pedir un reporte de "todos los pedidos del proveedor X" con 15 resultados). Si se prevé una sesión de exploración libre más larga, recomendaría ampliar a 30–40 pedidos antes del Hito 4 — no antes, para no invertir tiempo en volumen si el enfoque de la demo termina siendo guiado.
3. **El modelo no contempla explícitamente "pedidos cancelados" ni "pedidos con proveedor incumplido de forma total"** (0% recibido, sin cita, ya muy vencidos). Es un hueco funcional menor pero real: hoy el escenario más "negativo" es una cita vencida, no un pedido completamente varado. Si Dirección pregunta por un caso así, no habría un ejemplo perfecto para mostrarlo. Lo dejo como mejora sugerida, no implementada, a la espera de tu decisión.

**Qué cambiaría antes del Hito 3, si dependiera de mí:**
- Obtener aprobación explícita tuya de las 4 decisiones pendientes de la sección 11 antes de comenzar el motor conversacional, para no construir sobre un supuesto que luego cambie.
- Considerar agregar 2–3 pedidos con escenario "incumplimiento total" (mencionado arriba) si el tiempo lo permite, ya que es barato de agregar sobre la estructura ya construida y cierra un hueco de cobertura.

**Conclusión del arquitecto:** el modelo de datos es sólido, verificado y ya está listo para ser consumido por el motor conversacional. El mayor riesgo del proyecto sigue siendo de contenido (jerga real), no de estructura de datos — la estructura no debería requerir cambios de fondo hasta el final del proyecto.
