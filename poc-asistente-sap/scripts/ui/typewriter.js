/**
 * ui/typewriter.js
 * Revela texto progresivamente en vez de mostrarlo instantáneo (Hito 4: "experiencia humana").
 * Velocidad configurable; para textos largos revela varios caracteres por paso para que la
 * duración total se mantenga natural (nunca se siente instantáneo, pero tampoco eterno).
 */

const DURACION_OBJETIVO_MS = 1000;
const INTERVALO_PASO_MS = 18;

function escribirProgresivamente(elemento, texto, { alTick, alTerminar } = {}) {
  elemento.textContent = '';
  const caret = document.createElement('span');
  caret.className = 'message-caret';
  caret.setAttribute('aria-hidden', 'true');
  elemento.appendChild(caret);

  const totalPasos = Math.max(1, Math.round(DURACION_OBJETIVO_MS / INTERVALO_PASO_MS));
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
