/**
 * ui/app.js
 * Punto de entrada de la interfaz: conecta el DOM con el motor conversacional del Hito 3.
 * No contiene lógica conversacional propia — solo orquesta cuándo pintar qué, apoyándose en
 * core/orchestrator.js para todo lo que implica "entender" al usuario.
 */

import { inicializarMotor, procesarMensaje, crearSessionState } from '../core/orchestrator.js';
import { obtenerIcono } from './icons.js';
import { crearBurbujaPensando } from './typing-indicator.js';
import { construirTarjetas } from './summary-card.js';
import * as chat from './chat-renderer.js';

const el = {
  chatScroll: document.getElementById('chat-scroll'),
  chatLog: document.getElementById('chat-log'),
  form: document.getElementById('input-form'),
  textarea: document.getElementById('chat-input'),
  sendButton: document.getElementById('send-button'),
  clearButton: document.getElementById('clear-button'),
  dataStatus: document.getElementById('data-status'),
  connectionStatus: document.getElementById('connection-status'),
  brandIcon: document.getElementById('brand-icon'),
};

let estadoSesion = crearSessionState();
let procesandoTurno = false;

function irAlFinal() {
  el.chatScroll.scrollTop = el.chatScroll.scrollHeight;
}

function fijarEstadoPill(pill, estado, etiqueta) {
  pill.dataset.state = estado;
  // En pantallas angostas el texto se oculta visualmente (ver connection-status.css); el
  // aria-label conserva el nombre accesible para lectores de pantalla en ese caso.
  pill.setAttribute('aria-label', etiqueta);
  pill.querySelector('.status-label-full').textContent = etiqueta;
}

function habilitarEntrada(habilitado) {
  el.textarea.disabled = !habilitado;
  el.sendButton.disabled = !habilitado;
}

function ajustarAlturaTextarea() {
  el.textarea.style.height = 'auto';
  el.textarea.style.height = `${Math.min(el.textarea.scrollHeight, 140)}px`;
}

async function enviarMensaje(textoCrudo) {
  const texto = (textoCrudo || '').trim();
  if (!texto || procesandoTurno) return;

  procesandoTurno = true;
  habilitarEntrada(false);

  chat.ocultarBienvenida(el.chatLog);
  chat.agregarMensajeUsuario(el.chatLog, texto);
  el.textarea.value = '';
  ajustarAlturaTextarea();
  irAlFinal();

  // El motor responde de forma síncrona (todo corre en memoria); la duración del "pensando"
  // es una pausa deliberada de UI para que la interacción se sienta natural, nunca instantánea
  // ni artificialmente lenta — ver response/thinking-simulator.js.
  const resultado = procesarMensaje(estadoSesion, texto);
  const { mensajes, duracionMs } = resultado.indicadorPensando;

  const burbujaPensando = crearBurbujaPensando(mensajes[0]);
  el.chatLog.appendChild(burbujaPensando.elemento);
  irAlFinal();

  if (mensajes.length > 1) {
    const porMensaje = duracionMs / mensajes.length;
    for (let i = 1; i < mensajes.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await esperar(porMensaje);
      burbujaPensando.actualizarMensaje(mensajes[i]);
      irAlFinal();
    }
    await esperar(duracionMs - porMensaje * (mensajes.length - 1));
  } else {
    await esperar(duracionMs);
  }

  burbujaPensando.remover();

  const tarjetas = construirTarjetas(resultado.intenciones, resultado.resultados);
  const chips = resultado.respuesta.opciones || null;

  await chat.agregarMensajeAsistente(el.chatLog, {
    texto: resultado.respuesta.texto,
    tarjetas,
    chips,
    onChipClick: enviarMensaje,
    alTick: irAlFinal,
  });

  irAlFinal();
  habilitarEntrada(true);
  el.textarea.focus();
  procesandoTurno = false;
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function limpiarConversacion() {
  estadoSesion = crearSessionState();
  el.chatLog.innerHTML = '';
  chat.renderizarBienvenida(el.chatLog, { onSeleccionar: enviarMensaje });
  el.textarea.focus();
}

function conectarEventos() {
  el.form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    enviarMensaje(el.textarea.value);
  });

  el.textarea.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault();
      if (typeof el.form.requestSubmit === 'function') {
        el.form.requestSubmit();
      } else {
        enviarMensaje(el.textarea.value);
      }
    }
  });

  el.textarea.addEventListener('input', ajustarAlturaTextarea);
  el.clearButton.addEventListener('click', limpiarConversacion);
}

function pintarIconosEstaticos() {
  el.brandIcon.innerHTML = obtenerIcono('chispa');
  el.clearButton.innerHTML = obtenerIcono('papelera');
  el.sendButton.innerHTML = obtenerIcono('enviar');
}

async function iniciar() {
  pintarIconosEstaticos();
  fijarEstadoPill(el.connectionStatus, 'online', 'En línea');
  chat.renderizarBienvenida(el.chatLog, { onSeleccionar: enviarMensaje });
  conectarEventos();

  try {
    await inicializarMotor('data/mock-sap.xlsx');
    fijarEstadoPill(el.dataStatus, 'online', 'Datos sincronizados');
    el.textarea.placeholder = 'Escribe tu pregunta sobre pedidos, inventario, citas…';
    habilitarEntrada(true);
    el.textarea.focus();
  } catch (error) {
    fijarEstadoPill(el.dataStatus, 'offline', 'Sin datos disponibles');
    chat.agregarMensajeSistema(
      el.chatLog,
      'No pude cargar la información en este momento. Intenta recargar la página en unos segundos.'
    );
  }
}

iniciar();
