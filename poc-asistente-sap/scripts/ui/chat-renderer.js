/**
 * ui/chat-renderer.js
 * Dibuja mensajes, estados visuales y gestiona el DOM del historial de chat. No decide nada
 * de negocio ni de conversación — solo recibe texto/datos ya resueltos y los pinta.
 */

import { obtenerIcono } from './icons.js';
import { escribirProgresivamente } from './typewriter.js';
import { renderizarTarjeta } from './summary-card.js';
import { renderizarSugerenciasIniciales, renderizarChips } from './suggestion-cards.js';

function formatearHora(fecha = new Date()) {
  return fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function renderizarBienvenida(contenedor, { onSeleccionar }) {
  const welcome = document.createElement('div');
  welcome.className = 'welcome';
  welcome.id = 'welcome-panel';
  welcome.innerHTML = `
    <div class="welcome__icon" aria-hidden="true">${obtenerIcono('chispa')}</div>
    <div>
      <h1 class="welcome__title">Hola, soy el Asistente Inteligente Retail.</h1>
      <p class="welcome__text">Puedo ayudarte a consultar pedidos, recepciones, citas e inventario utilizando lenguaje natural. ¿En qué puedo ayudarte hoy?</p>
    </div>
  `;
  welcome.appendChild(renderizarSugerenciasIniciales(onSeleccionar));
  contenedor.appendChild(welcome);
}

function ocultarBienvenida(contenedor) {
  const welcome = contenedor.querySelector('#welcome-panel');
  if (welcome) welcome.remove();
}

function agregarMensajeUsuario(contenedor, texto) {
  const fila = document.createElement('div');
  fila.className = 'message-row message-row--user';
  fila.innerHTML = `
    <div class="message-stack">
      <div class="message-bubble"></div>
      <span class="message-meta">${formatearHora()}</span>
    </div>
  `;
  fila.querySelector('.message-bubble').textContent = texto;
  contenedor.appendChild(fila);
  return fila;
}

function agregarMensajeSistema(contenedor, texto) {
  const fila = document.createElement('div');
  fila.className = 'message-row message-row--assistant';
  fila.innerHTML = `
    <div class="message-avatar" aria-hidden="true">${obtenerIcono('chispa')}</div>
    <div class="message-stack">
      <div class="message-bubble">${texto}</div>
    </div>
  `;
  contenedor.appendChild(fila);
  return fila;
}

/**
 * Agrega la respuesta del asistente con efecto de escritura progresiva, y al terminar
 * añade tarjetas-resumen y/o chips de aclaración si corresponde.
 * @returns {Promise<void>} se resuelve cuando termina de escribir.
 */
function agregarMensajeAsistente(contenedor, { texto, tarjetas = [], chips = null, onChipClick, alTick }) {
  const fila = document.createElement('div');
  fila.className = 'message-row message-row--assistant';
  fila.innerHTML = `
    <div class="message-avatar" aria-hidden="true">${obtenerIcono('chispa')}</div>
    <div class="message-stack"></div>
  `;
  const stack = fila.querySelector('.message-stack');
  const burbuja = document.createElement('div');
  burbuja.className = 'message-bubble';
  stack.appendChild(burbuja);
  contenedor.appendChild(fila);

  return new Promise((resolve) => {
    escribirProgresivamente(burbuja, texto, {
      alTick,
      alTerminar: () => {
        for (const spec of tarjetas) {
          stack.appendChild(renderizarTarjeta(spec));
        }
        if (chips && chips.length > 0) {
          stack.appendChild(renderizarChips(chips, (valor) => onChipClick(valor)));
        }
        const meta = document.createElement('span');
        meta.className = 'message-meta';
        meta.textContent = formatearHora();
        stack.appendChild(meta);
        if (alTick) alTick();
        resolve();
      },
    });
  });
}

export {
  renderizarBienvenida,
  ocultarBienvenida,
  agregarMensajeUsuario,
  agregarMensajeSistema,
  agregarMensajeAsistente,
};
