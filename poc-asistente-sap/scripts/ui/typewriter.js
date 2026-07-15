/**
 * ui/typewriter.js
 * Revela texto progresivamente en vez de mostrarlo instantáneo (Hito 4: "experiencia humana").
 * Velocidad configurable; para textos largos revela varios caracteres por paso para que la
 * duración total se mantenga natural (nunca se siente instantáneo, pero tampoco eterno).
 */

// Duración proporcional al largo del texto (respuestas cortas se sienten ágiles en vez de
// forzar el mismo segundo completo para todo), acotada para que una respuesta combinada muy
// larga tampoco se sienta eterna en una demo con muchos turnos seguidos.
const DURACION_MIN_MS = 280;
const DURACION_MAX_MS = 900;
const MS_POR_CARACTER = 5.5;
const INTERVALO_PASO_MS = 18;

function escribirProgresivamente(elemento, texto, { alTick, alTerminar } = {}) {
  elemento.textContent = '';
  const caret = document.createElement('span');
  caret.className = 'message-caret';
  caret.setAttribute('aria-hidden', 'true');
  elemento.appendChild(caret);

  const duracionObjetivoMs = Math.min(DURACION_MAX_MS, Math.max(DURACION_MIN_MS, texto.length * MS_POR_CARACTER));
  const totalPasos = Math.max(1, Math.round(duracionObjetivoMs / INTERVALO_PASO_MS));
  const caracteresPorPaso = Math.max(1, Math.ceil(texto.length / totalPasos));

  let indice = 0;
  let cancelado = false;
  let temporizador = null;

  function paso() {
    if (cancelado) return;
    const siguienteIndice = Math.min(texto.length, indice + caracteresPorPaso);
    caret.insertAdjacentText('beforebegin', texto.slice(indice, siguienteIndice));
    indice = siguienteIndice;
    if (alTick) alTick();

    if (indice >= texto.length) {
      caret.remove();
      if (alTerminar) alTerminar();
      return;
    }
    temporizador = setTimeout(paso, INTERVALO_PASO_MS);
  }

  paso();

  return function cancelar() {
    cancelado = true;
    if (temporizador) clearTimeout(temporizador);
    caret.remove();
    elemento.textContent = texto;
  };
}

export { escribirProgresivamente };
