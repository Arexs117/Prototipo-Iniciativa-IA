# Documento de cierre — Hito 4
## Diseño e Implementación de la Experiencia de Usuario (UX/UI)

**Continuación de:** Hito 3 (motor conversacional), completado y validado (37/37 pruebas).
**Entregable de código:** `index.html`, `styles/`, `scripts/ui/`.
**Alcance de este documento:** qué se construyó, cómo se validó visualmente, los dos ajustes al motor que se detectaron y justificaron durante la construcción de la UI, y una revisión crítica de la experiencia final.

---

## 1. Qué se construyó

Una interfaz de una sola página (`index.html`), tema oscuro tipo Fluent/Teams/Copilot con identidad propia (acento índigo→cian en degradado, no el púrpura de Teams), que consume el motor del Hito 3 sin contener lógica conversacional propia.

### 1.1 Sistema de diseño

| Archivo | Contenido |
|---|---|
| `styles/base/tokens.css` | Única fuente de verdad: color, tipografía (Segoe UI), espaciado, radios, sombras, movimiento |
| `styles/base/reset.css` | Reset mínimo |
| `styles/themes/teams-dark.css` | Utilidades de tema (vidrio, scrollbar, selección) |
| `styles/components/*.css` | Un archivo por componente: header, chat-bubble, typing-indicator, input-bar, suggestion-cards, summary-card, clarification-chips, connection-status |
| `styles/main.css` | Ensambla todo + layout del shell |

Ningún componente usa valores sueltos — todo pasa por los tokens, tal como pide la decisión de arquitectura heredada del Hito 3.

### 1.2 Scripts de interfaz (`scripts/ui/`)

| Archivo | Responsabilidad única |
|---|---|
| `icons.js` | Set propio de iconos SVG inline (sin librerías externas) |
| `typewriter.js` | Escritura progresiva de texto, velocidad configurable |
| `typing-indicator.js` | Dibuja y anima la burbuja "Pensando" |
| `summary-card.js` | Construye tarjetas-resumen estructuradas a partir de los datos del motor |
| `suggestion-cards.js` | Tarjetas iniciales + chips de aclaración (ambos "atajos que envían un mensaje") |
| `chat-renderer.js` | Pinta el DOM del historial — no decide nada de negocio |
| `app.js` | Único punto que conoce tanto el DOM como `core/orchestrator.js`; los conecta |

**Ningún archivo de `ui/` importa de `nlu/`, `response/` ni `config/` directamente** — todo pasa por `core/orchestrator.js` (`inicializarMotor`, `procesarMensaje`, `crearSessionState`), tal como exige "la interfaz debe consumir el motor... no incorporar lógica conversacional dentro de la interfaz".

---

## 2. Ajustes al motor conversacional (reportados y justificados)

Se detectaron y corrigieron **tres** problemas durante la construcción/validación de la UI. Los tres se probaron con la batería completa del Hito 3 (37/37 sigue en verde después de cada uno) antes de darlos por buenos.

### 2.1 Exposición de datos estructurados (aditivo, sin riesgo)
`orchestrator.procesarMensaje()` ya calculaba internamente los datos de cada consulta (`resultados`) pero solo devolvía el texto ya redactado. Las "tarjetas resumen" que pide este hito (Pedido/Proveedor/Estado/...) necesitan esos datos estructurados. Se agregó `resultados` al objeto de retorno — no se tocó ninguna lógica existente, solo se expuso algo que ya se calculaba.

### 2.2 Bug crítico: la aclaración de ambigüedad no se resolvía al elegir una opción
**Síntoma encontrado en la validación visual:** al preguntar "¿cuánto stock hay de leche en la tienda cumbres?", el asistente pedía aclarar cuál tienda (correcto). Pero al hacer clic en el chip **"Tienda Cumbres"** (el nombre exacto, completo, que el propio asistente ofreció), el asistente volvía a preguntar exactamente lo mismo — un bucle de conversación roto, inaceptable en una demo ejecutiva.

**Causa raíz:** "Tienda Cumbres" es, literalmente, un prefijo de texto de "Tienda Cumbres Sur". La búsqueda aproximada (`sap-connector.js` + `entity-extractor.js`) seguía encontrando ambas tiendas como candidatas aunque el usuario hubiera escrito el nombre completo y exacto de una de ellas.

**Corrección aplicada (quirúrgica, sin tocar el comportamiento general de búsqueda difusa):**
1. `sap-connector.js`: dentro de una misma búsqueda, una coincidencia exacta (score 1) descarta a las coincidencias parciales de esa misma búsqueda.
2. `core/orchestrator.js`: cuando el sistema ya ofreció opciones concretas (chips) y el siguiente mensaje del usuario coincide **exacto** con el nombre de una de ellas, se resuelve directo a esa opción — sin volver a pasar por la extracción difusa de entidades.

Se probó explícitamente que esto **no** afecta la detección de ambigüedad genuina (un primer mensaje que solo dice "cumbres" sigue preguntando cuál tienda, como debe ser) — la corrección solo actúa sobre la respuesta a una aclaración ya ofrecida.

### 2.3 Bug de layout (no es del motor, es CSS) — mencionado por completitud
Dentro de un contenedor flex en columna, un `margin: auto` lateral en un hijo desactiva el `stretch` por defecto y ese hijo se encoge a su contenido en vez de ocupar el ancho completo. El panel de bienvenida (con la cuadrícula de tarjetas sugeridas) se veía angosto y descentrado por esto. Se corrigió usando `width: 100%` en vez de la técnica de centrado por margen (que ya la aporta el contenedor padre). No es un cambio al motor — se documenta aquí porque también se detectó durante la validación visual automatizada.

---

## 3. Elementos entregados vs. lo solicitado

| Requisito | Estado |
|---|---|
| Encabezado | ✅ Marca, estado de datos, estado de conexión, botón limpiar |
| Área principal de conversación | ✅ Scroll automático, ancho máximo legible (920px) |
| Caja de entrada | ✅ Autoexpandible, Enter para enviar, Shift+Enter salto de línea |
| Historial de mensajes | ✅ Burbujas diferenciadas usuario/asistente, hora en cada mensaje |
| Indicador de "Pensando" | ✅ Puntos animados + mensajes rotativos del motor (nunca revela razonamiento) |
| Botón limpiar conversación | ✅ Reinicia sesión y vuelve a la bienvenida |
| Tarjetas de sugerencias iniciales | ✅ 8 tarjetas estilo Copilot, cada una dispara una consulta real y probada |
| Estado de conexión (simulado) | ✅ Pill "En línea" con pulso sutil |
| Indicador de lectura del modelo de datos | ✅ "Sincronizando datos…" → "Datos sincronizados", nunca menciona Excel |
| Mensaje de bienvenida | ✅ Texto exacto solicitado |
| Tarjetas sugeridas que inician conversación | ✅ Clic envía el mensaje automáticamente |
| Mensajes diferenciados + animación suave | ✅ Fade + translateY al aparecer |
| Scroll automático sin saltos | ✅ `scroll-behavior: smooth` + reposición en cada paso de escritura |
| Modo Pensando con mensajes del motor | ✅ Reutiliza `response/thinking-simulator.js` tal cual |
| Escritura progresiva, velocidad configurable | ✅ `typewriter.js`, constante ajustable |
| Tarjetas-resumen (Pedido/Proveedor/Estado/...) | ✅ Complementan el texto, nunca lo reemplazan |
| Ambigüedad con opciones claras | ✅ Chips clicables, nunca listas largas |
| Errores sin mensajes técnicos | ✅ Siempre lenguaje natural, con fix del bucle de aclaración (sección 2.2) |
| Accesibilidad | ✅ Ver sección 4 |
| Responsive (Full HD / laptop / tablet, no roto en móvil) | ✅ Validado en 1440, 1024, 834 y 390px |
| Animaciones con propósito, sin exceso | ✅ Solo aparición, escritura, hover, scroll |

---

## 4. Accesibilidad

- Contraste: texto primario `#f3f4fb` sobre fondo `#14151f` (>13:1), textos secundarios verificados por encima de 4.5:1 para su tamaño.
- `:focus-visible` con anillo visible en todos los elementos interactivos (nunca se suprime el outline).
- `role="log"` + `aria-live="polite"` en el historial de chat — los mensajes nuevos se anuncian a lectores de pantalla.
- Todos los botones de solo-ícono tienen `aria-label` (limpiar, enviar).
- Los "pills" de estado usan `aria-label` explícito además del texto visible, para que el estado se siga anunciando cuando la etiqueta se oculta visualmente en pantallas angostas (se corrigió durante la validación — ver hallazgos).
- Navegación 100% por teclado: tarjetas de sugerencias y chips son `<button>` reales, orden de tabulación natural del documento.
- `prefers-reduced-motion: reduce` anula las duraciones de animación a 0ms.

---

## 5. Validación realizada

Se usó Chromium real (Playwright) para recorrer, con capturas de pantalla en cada paso: bienvenida → clic en tarjeta sugerida → "pensando" → respuesta con tarjeta-resumen → mensaje ambiguo → chips de aclaración → clic en chip (resuelve correcto) → caso sin resultados → limpiar conversación → 4 anchos de viewport (1440, 1024, 834, 390). Sin errores de consola ni de página en ningún paso. La batería completa de 37 pruebas del motor (Hito 3) se volvió a correr después de cada ajuste al motor — se mantuvo en 37/37 en todo momento.

### Evaluación crítica final

- **Fluidez:** alta — nada se siente instantáneo ni artificialmente lento; el "pensando" y la escritura progresiva dan ritmo natural.
- **Claridad:** alta — cada respuesta narrativa va acompañada, cuando aplica, de una tarjeta estructurada que resume lo mismo de un vistazo.
- **Consistencia:** alta — un solo sistema de tokens, un solo lenguaje de iconos, mismas animaciones en todos los componentes.
- **Profesionalismo / calidad visual:** la interfaz no se parece a un dashboard académico; el uso de vidrio sutil, degradado de acento y tipografía Segoe UI la acercan deliberadamente a Teams/Copilot sin copiarlos.
- **Facilidad de uso:** las tarjetas iniciales garantizan que, incluso sin saber qué preguntar, un usuario nuevo tenga un camino claro en los primeros 3 segundos.

**Oportunidad de mejora identificada (no bloqueante):** las tarjetas-resumen de inventario truncan a 5 filas cuando una tienda tiene más materiales — es una decisión consciente para no romper el layout de la tarjeta, pero si Dirección pide ver el detalle completo en la demo, hoy solo está disponible en el texto narrativo (que sí lo incluye completo). No se resolvió en este hito para no introducir paginación/scroll dentro de una tarjeta, lo cual iría contra "diseño limpio, espaciado amplio".

---

## 6. Estado actualizado del proyecto

**Completado en este hito:**
- Interfaz completa, integrada al motor y al modelo de datos del Hito 3, sin duplicar lógica conversacional.
- Los 13 entregables solicitados (sección "Entregables" del Hito 4) están implementados y validados visualmente.
- Dos correcciones al motor, reportadas, justificadas y verificadas contra la batería de pruebas existente antes de aplicarse.

**Pendiente / decisiones abiertas heredadas (no de este hito):**
- Validación del vocabulario de jerga con usuarios reales (riesgo abierto desde el Hito 1).
- Los dos escenarios del catálogo del Hito 2 que exceden el catálogo de 6 intenciones (`#9` y `#11`, ver `Hito3_Motor_Conversacional.md` sección 5.5) — la UI los maneja con gracia (pregunta el dato faltante, nunca falla), pero no con la inteligencia completa del guion original.

**El proyecto, en este punto, cumple el criterio de éxito planteado:** un usuario sin contexto previo que abre la aplicación ve de inmediato un asistente conversacional de aspecto empresarial moderno, con datos reales y respuestas coherentes — listo para una demostración ante Dirección.
