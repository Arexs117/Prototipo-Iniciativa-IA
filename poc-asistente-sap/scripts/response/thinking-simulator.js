/**
 * response/thinking-simulator.js
 * Simula un breve proceso de "análisis" antes de responder, con mensajes amigables y
 * duración variable (600–1500 ms por defecto, configurable) para que no se sienta mecánico.
 * Nunca revela el razonamiento interno real (reglas, intents, entidades) — solo mensajes
 * genéricos de progreso. Agnóstico de UI: cualquier interfaz decide cómo mostrarlos.
 */

const MENSAJES_PENSANDO = [
  'Interpretando tu solicitud...',
  'Analizando contexto...',
  'Consultando información...',
  'Preparando respuesta...',
];

function crearIndicadorPensando({ duracionMinMs = 600, duracionMaxMs = 1500 } = {}) {
  const duracionMs = Math.round(duracionMinMs + Math.random() * (duracionMaxMs - duracionMinMs));
  const cantidadMensajes = duracionMs > 1100 ? 2 : 1;

  const disponibles = [...MENSAJES_PENSANDO];
  const mensajes = [];
  for (let i = 0; i < cantidadMensajes && disponibles.length > 0; i++) {
    const indice = Math.floor(Math.random() * disponibles.length);
    mensajes.push(disponibles.splice(indice, 1)[0]);
  }

  return { mensajes, duracionMs };
}

/** Para consumo directo por una UI real: espera la duración simulada y devuelve el indicador usado. */
async function simularPensando(opciones) {
  const indicador = crearIndicadorPensando(opciones);
  await new Promise((resolve) => setTimeout(resolve, indicador.duracionMs));
  return indicador;
}

export { crearIndicadorPensando, simularPensando, MENSAJES_PENSANDO };
