# Asistente Inteligente Retail — PoC

Asistente conversacional que corre 100% en el navegador (sin backend, sin base de datos,
sin Node.js en producción) para consultar pedidos, recepciones, citas e inventario en
lenguaje natural, simulando una integración con SAP.

## Cómo ejecutarlo

**Importante:** no abras `index.html` con doble clic. El navegador bloquea por seguridad
tanto los módulos de JavaScript como la lectura del archivo de datos cuando se abre
directamente desde el disco (protocolo `file://`). Es una restricción de seguridad de todos
los navegadores modernos, no un error del proyecto — cualquier app sin backend que use
módulos ES6 necesita servirse por `http://`, aunque sea localmente. Si de todas formas abres
el archivo así, la propia página te lo explica con las mismas instrucciones de abajo.

Desde una terminal, dentro de esta carpeta (`poc-asistente-sap/`):

```bash
# Opción 1 — Python (ya viene instalado en Mac y Linux)
python3 -m http.server 8000

# Opción 2 — Node.js
npx serve .
```

Luego abre **http://localhost:8000/index.html** en tu navegador.

También funciona con la extensión **Live Server** de Visual Studio Code: clic derecho sobre
`index.html` → "Open with Live Server".

## Estructura del proyecto

```
poc-asistente-sap/
├── index.html              Interfaz (Hito 4)
├── styles/                 Sistema de diseño (tokens, componentes, tema)
├── scripts/
│   ├── ui/                 Capa de interfaz — consume core/orchestrator.js
│   ├── core/                orchestrator.js (pipeline) + session-state.js (memoria)
│   ├── nlu/                 Normalización, ortografía, jerga, intención, entidades, ambigüedad
│   ├── data-connector/      Única capa que lee data/mock-sap.xlsx
│   ├── response/            Generación de lenguaje natural, sugerencias, "pensando"
│   ├── config/               Diccionario de jerga e intenciones
│   └── shared/                Utilidades de texto reutilizadas
├── data/mock-sap.xlsx      Dataset simulado (Hito 2)
├── assets/vendor/           SheetJS vendorizado localmente (sin CDN)
├── tests/                   Batería de pruebas automatizadas del motor
└── docs/                    Documentos de cierre de cada hito
```

## Pruebas del motor

`tests/test-runner.html` corre la batería de pruebas del motor conversacional en el
navegador (necesita el mismo servidor local de arriba). Abre
`http://localhost:8000/tests/test-runner.html`.
