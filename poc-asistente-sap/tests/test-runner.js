/**
 * tests/test-runner.js
 * Arnés de pruebas para el motor conversacional. Se ejecuta dentro de un navegador real
 * (ver test-runner.html) porque el motor depende de fetch() + SheetJS para leer el Excel;
 * no hay backend ni Node en el proyecto, así que las pruebas corren igual que lo haría
 * cualquier UI futura: contra el mismo orchestrator.js, sin mocks.
 */

import { inicializarMotor, procesarMensaje, crearSessionState } from '../scripts/core/orchestrator.js';
import { casosDePrueba } from './casos-prueba.js';

const salida = document.getElementById('salida');

function log(linea) {
  salida.textContent += `${linea}\n`;
}

async function ejecutarTodo() {
  await inicializarMotor('../data/mock-sap.xlsx');
  log('Datos cargados correctamente desde mock-sap.xlsx.\n');

  let total = 0;
  let fallidos = 0;
  const detalleFallos = [];

  for (const grupo of casosDePrueba) {
    const estado = crearSessionState();
    log(`=== ${grupo.nombre} ===`);

    for (const turno of grupo.turnos) {
      total += 1;
      let resultado = null;
      let error = null;

      try {
        resultado = procesarMensaje(estado, turno.mensaje);
      } catch (e) {
        error = e;
      }

      const smokeOk = !error && !/\b(undefined|null|nan)\b|\[object/i.test(resultado.respuesta.texto);

      let verificarOk = true;
      let detalleVerificacion = '';
      if (!error && turno.verificar) {
        try {
          const r = turno.verificar(resultado, estado);
          verificarOk = r === true || r?.ok === true;
          if (typeof r === 'object' && r?.detalle) detalleVerificacion = r.detalle;
        } catch (e2) {
          verificarOk = false;
          detalleVerificacion = `el verificador lanzó una excepción: ${e2.message}`;
        }
      }

      const ok = !error && smokeOk && verificarOk;
      if (!ok) {
        fallidos += 1;
        detalleFallos.push({
          grupo: grupo.nombre,
          mensaje: turno.mensaje,
          error: error ? `${error.message}\n${error.stack}` : null,
          textoRespuesta: resultado?.respuesta?.texto,
          detalleVerificacion,
        });
      }

      log(`  [${ok ? 'PASS' : 'FAIL'}] "${turno.mensaje}"`);
      log(`      -> ${error ? `ERROR: ${error.message}` : resultado.respuesta.texto}`);
      if (!ok && detalleVerificacion) log(`      (motivo: ${detalleVerificacion})`);
    }
    log('');
  }

  log(`=== RESUMEN: ${total - fallidos}/${total} pruebas OK ===`);
  if (fallidos > 0) {
    log('\nDetalle de fallos:');
    for (const f of detalleFallos) log(JSON.stringify(f, null, 2));
  }

  window.__RESULTADO_PRUEBAS__ = { total, fallidos, detalleFallos };
  log('__FIN__');
}

ejecutarTodo().catch((e) => {
  log(`ERROR FATAL AL EJECUTAR LA BATERÍA: ${e.message}\n${e.stack}`);
  window.__RESULTADO_PRUEBAS__ = { total: 0, fallidos: 1, detalleFallos: [{ error: e.message }] };
  log('__FIN__');
});
