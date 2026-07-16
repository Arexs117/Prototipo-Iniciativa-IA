/**
 * ui/suggestion-cards.js
 * Tarjetas de sugerencias iniciales (estilo Copilot) y chips de aclaración para ambigüedad.
 * Ambas son "atajos que inician/continúan la conversación" — nunca contienen lógica
 * conversacional propia, solo envían el texto correspondiente al mismo flujo del chat.
 */

import { obtenerIcono } from './icons.js';

const SUGERENCIAS_INICIALES = [
  { icono: 'caja', etiqueta: 'Consultar pedido', mensaje: '¿Cómo va el pedido 4500102?' },
  { icono: 'almacen', etiqueta: 'Consultar inventario', mensaje: '¿Cuánto inventario hay del material M001 en la tienda T002?' },
  { icono: 'edificio', etiqueta: 'Buscar por proveedor', mensaje: '¿Qué pedidos tiene el proveedor P001?' },
  { icono: 'calendario', etiqueta: 'Validar cita', mensaje: '¿El pedido 4500108 ya tiene cita?' },
  { icono: 'reloj', etiqueta: 'Pedidos pendientes', mensaje: '¿Qué pedidos tiene la tienda Satélite?' },
  { icono: 'camion', etiqueta: 'Recepciones', mensaje: '¿Ya llegó el pedido 4500105?' },
  { icono: 'destino', etiqueta: 'Estado de entrega', mensaje: '¿Cómo va la entrega del pedido 4500101?' },
  { icono: 'balanza', etiqueta: 'Comparar pedidos', mensaje: 'Compara los pedidos 4500101 y 4500117' },
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
