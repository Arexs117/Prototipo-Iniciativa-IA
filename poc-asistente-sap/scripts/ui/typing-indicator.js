/**
 * ui/typing-indicator.js
 * Construye y anima la burbuja de "Pensando" en el DOM. Qué decir y cuánto durar lo decide
 * el motor (response/thinking-simulator.js); este módulo solo sabe dibujarlo y animarlo.
 */

import { obtenerIcono } from './icons.js';

function crearBurbujaPensando(mensajeInicial) {
  const fila = document.createElement('div');
  fila.className = 'message-row message-row--assistant';
  fila.innerHTML = `
    <div class="message-avatar" aria-hidden="true">${obtenerIcono('chispa')}</div>
    <div class="message-stack">
      <div class="typing-bubble" role="status">
        <span class="typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>
        <span class="typing-label"></span>
      </div>
    </div>
  `;

  const etiqueta = fila.querySelector('.typing-label');

  function actualizarMensaje(texto) {
    etiqueta.style.animation = 'none';
    // Forzar reflow para reiniciar la animación de aparición al cambiar de mensaje.
    void etiqueta.offsetWidth;
    etiqueta.style.animation = '';
    etiqueta.textContent = texto;
  }

  actualizarMensaje(mensajeInicial);

  return {
    elemento: fila,
    actualizarMensaje,
    remover: () => fila.remove(),
  };
}

export { crearBurbujaPensando };
