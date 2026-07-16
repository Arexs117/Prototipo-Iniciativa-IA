/**
 * text-utils.js
 * Utilidades genéricas de texto (normalización, distancia de edición, similitud).
 * Sin conocimiento de dominio de negocio ni de las fuentes de datos: es reutilizada tanto
 * por el NLU (tolerancia ortográfica) como por el data-connector (búsqueda aproximada de nombres).
 */

/** Minúsculas, sin acentos, sin puntuación sobrante, espacios colapsados. */
function normalizar(texto) {
  if (texto === null || texto === undefined) return '';
  return texto
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[¿?¡!.,;:"'`]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Distancia de Levenshtein clásica (número mínimo de ediciones para pasar de a a b). */
function distanciaLevenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let filaAnterior = new Array(n + 1);
  let filaActual = new Array(n + 1);
  for (let j = 0; j <= n; j++) filaAnterior[j] = j;

  for (let i = 1; i <= m; i++) {
    filaActual[0] = i;
    for (let j = 1; j <= n; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      filaActual[j] = Math.min(
        filaAnterior[j] + 1,
        filaActual[j - 1] + 1,
        filaAnterior[j - 1] + costo
      );
    }
    [filaAnterior, filaActual] = [filaActual, filaAnterior];
  }
  return filaAnterior[n];
}

/** 1 = idénticos, 0 = completamente distintos. Ya normaliza longitudes distintas. */
function similitudNormalizada(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - distanciaLevenshtein(a, b) / maxLen;
}

/**
 * Evalúa si `textoBusqueda` "coincide aproximadamente" con `textoCandidato`.
 * Combina coincidencia por subcadena (rápida, para palabras completas dentro de un nombre)
 * con similitud por edición (para tolerar errores ortográficos), tomando el mejor puntaje.
 */
function escaparRegExp(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function coincidenciaAproximada(textoBusqueda, textoCandidato, umbralSimilitud = 0.72) {
  const busqueda = normalizar(textoBusqueda);
  const candidato = normalizar(textoCandidato);

  if (!busqueda || !candidato) return { coincide: false, score: 0 };

  // Subcadena, pero anclada a inicio de palabra: evita que "tal" (de "qué tal") coincida
  // dentro de "vegeTAL" — solo cuenta si arranca donde arranca una palabra del candidato.
  if (new RegExp(`(^|\\s)${escaparRegExp(busqueda)}`).test(candidato)) {
    const score = Math.min(1, 0.9 + 0.1 * (busqueda.length / candidato.length));
    return { coincide: true, score };
  }

  let mejorScore = similitudNormalizada(busqueda, candidato);
  for (const palabra of candidato.split(' ')) {
    const scorePalabra = similitudNormalizada(busqueda, palabra);
    if (scorePalabra > mejorScore) mejorScore = scorePalabra;
  }

  return { coincide: mejorScore >= umbralSimilitud, score: mejorScore };
}

export { normalizar, distanciaLevenshtein, similitudNormalizada, coincidenciaAproximada };
