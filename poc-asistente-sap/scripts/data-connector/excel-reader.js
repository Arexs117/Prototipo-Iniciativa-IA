/**
 * excel-reader.js
 * Responsabilidad única: cargar mock-sap.xlsx UNA sola vez y cachear su contenido en memoria.
 * Ningún otro módulo debe leer el archivo directamente — solo sap-connector.js consume esta caché.
 */

const RUTA_POR_DEFECTO = 'data/mock-sap.xlsx';

const HOJAS = {
  proveedores: 'Proveedores',
  cedis: 'CEDIS',
  tiendas: 'Tiendas',
  materiales: 'Materiales',
  pedidos: 'Pedidos',
  pedidoPosiciones: 'PedidoPosiciones',
  recepciones: 'Recepciones',
  llegadas: 'Llegadas',
  citas: 'Citas',
  inventario: 'Inventario',
};

let datosCacheados = null;
let promesaCarga = null;

function leerHoja(workbook, nombreHoja) {
  const hoja = workbook.Sheets[nombreHoja];
  if (!hoja) {
    throw new Error(`No se encontró la hoja "${nombreHoja}" en el archivo de datos.`);
  }
  return XLSX.utils.sheet_to_json(hoja, { defval: null });
}

/**
 * Carga el workbook desde disco/red (fetch) y lo parsea a memoria.
 * Idempotente: si ya se cargó (o se está cargando), reutiliza la misma promesa/caché.
 */
async function cargarDatos(rutaArchivo = RUTA_POR_DEFECTO) {
  if (datosCacheados) return datosCacheados;
  if (promesaCarga) return promesaCarga;

  promesaCarga = (async () => {
    if (typeof XLSX === 'undefined') {
      throw new Error('La librería XLSX (SheetJS) no está cargada. Verifica que assets/vendor/xlsx.full.min.js se incluya antes de este módulo.');
    }

    const respuesta = await fetch(rutaArchivo);
    if (!respuesta.ok) {
      throw new Error(`No fue posible cargar el archivo de datos (${respuesta.status} ${respuesta.statusText}).`);
    }
    const buffer = await respuesta.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

    const datos = {};
    for (const [clave, nombreHoja] of Object.entries(HOJAS)) {
      datos[clave] = leerHoja(workbook, nombreHoja);
    }

    datosCacheados = Object.freeze(datos);
    return datosCacheados;
  })();

  return promesaCarga;
}

/**
 * Devuelve los datos ya cacheados. Lanza si aún no se ha llamado a cargarDatos().
 */
function obtenerDatosCacheados() {
  if (!datosCacheados) {
    throw new Error('Los datos aún no han sido cargados. Debes invocar cargarDatos() antes de consultar.');
  }
  return datosCacheados;
}

function datosListos() {
  return datosCacheados !== null;
}

/** Solo para pruebas: fuerza una recarga completa descartando la caché. */
function _reiniciarCacheParaPruebas() {
  datosCacheados = null;
  promesaCarga = null;
}

export { cargarDatos, obtenerDatosCacheados, datosListos, _reiniciarCacheParaPruebas };
