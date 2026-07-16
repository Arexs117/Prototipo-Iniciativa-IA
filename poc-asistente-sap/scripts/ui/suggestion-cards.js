/**
 * ui/suggestion-cards.js
 * Tarjetas de sugerencias iniciales (estilo Copilot) y chips de aclaración para ambigüedad.
 * Ambas son "atajos que inician/continúan la conversación" — nunca contienen lógica
 * conversacional propia, solo envían el texto correspondiente al mismo flujo del chat.
 */

import { obtenerIcono } from './icons.js';

/**
 * Cada tarjeta ahora envía una pregunta SIN el dato específico (número de pedido, tienda,
 * proveedor...) — el motor ya sabe pedir exactamente ese dato faltante (paso 7 del pipeline,
 * ver ambiguity-resolver.js), así que la tarjeta solo dispara la intención correcta y deja que
 * la conversación real ocurra: el asistente pregunta, el usuario responde con su dato, y recibe
 * la respuesta. Antes la tarjeta mandaba la pregunta YA resuelta con un ejemplo (p. ej. "el
 * pedido 4500102"), lo que respondía de una sola vez y nunca mostraba el flujo de pedir datos.
 */
const SUGERENCIAS_INICIALES = [
  { icono: 'caja', etiqueta: 'Consultar pedido', mensaje: '¿Cómo va mi pedido?' },
  { icono: 'almacen', etiqueta: 'Consultar inventario', mensaje: '¿Cuánto inventario hay?' },
  { icono: 'edificio', etiqueta: 'Buscar por proveedor', mensaje: '¿Qué pedidos tiene el proveedor?' },
  { icono: 'calendario', etiqueta: 'Validar cita', mensaje: '¿Ya tiene cita mi pedido?' },
  { icono: 'reloj', etiqueta: 'Pedidos pendientes', mensaje: '¿Qué pedidos tiene la tienda?' },
  { icono: 'camion', etiqueta: 'Recepciones', mensaje: '¿Ya llegó mi pedido?' },
  { icono: 'destino', etiqueta: 'Estado de entrega', mensaje: '¿Cómo va la entrega de mi pedido?' },
  { icono: 'balanza', etiqueta: 'Comparar pedidos', mensaje: 'Quiero comparar pedidos' },
];

function renderizarSugerenciasIniciales(onSeleccionar) {
  const grid = document.createElement('div');
  grid.className = 'suggestion-grid';

  for (const item of SUGERENCIAS_INICIALES) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'suggestion-card';
    boton.innerHTML = `
      <span class="suggestion-card__icon" aria-hidden="true">${obtenerIcono(item.icono)}</span>
      <span class="suggestion-card__label">${item.etiqueta}</span>
    `;
    boton.addEventListener('click', () => onSeleccionar(item.mensaje));
    grid.appendChild(boton);
  }

  return grid;
}

/** Chips de aclaración: candidatos devueltos por ambiguity-resolver.js (nunca se elige al azar). */
function renderizarChips(candidatos, onSeleccionar) {
  const grupo = document.createElement('div');
  grupo.className = 'chip-group';
  grupo.setAttribute('role', 'group');
  grupo.setAttribute('aria-label', 'Opciones para continuar');

  for (const candidato of candidatos) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = candidato.nombre;
    chip.addEventListener('click', () => onSeleccionar(candidato.nombre));
    grupo.appendChild(chip);
  }

  return grupo;
}

export { renderizarSugerenciasIniciales, renderizarChips };
