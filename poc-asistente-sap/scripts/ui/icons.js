/**
 * ui/icons.js
 * Set mínimo de iconos propios en SVG inline (sin librerías externas ni CDN), estilo lineal
 * Fluent-ish consistente (viewBox 24x24, trazo 1.8). Una sola fuente de verdad para que
 * header, tarjetas de sugerencias y avatar del asistente usen el mismo lenguaje visual.
 */

const ICONOS = {
  chispa: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5c.4 3.6 1.2 6 2.7 7.5 1.5 1.5 3.9 2.3 7.5 2.7-3.6.4-6 1.2-7.5 2.7-1.5 1.5-2.3 3.9-2.7 7.5-.4-3.6-1.2-6-2.7-7.5-1.5-1.5-3.9-2.3-7.5-2.7 3.6-.4 6-1.2 7.5-2.7 1.5-1.5 2.3-3.9 2.7-7.5Z"/></svg>`,
  papelera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/><path d="M6.5 7 7.2 19a2 2 0 0 0 2 1.9h5.6a2 2 0 0 0 2-1.9L17.5 7"/><path d="M10.3 11v6"/><path d="M13.7 11v6"/></svg>`,
  enviar: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 11.2 20.6 3.3c.9-.4 1.8.5 1.4 1.4l-7.9 17.2c-.4.9-1.7.8-2-.1l-2-6-6-2c-.9-.3-1-1.6-.1-2Z"/><path d="M11.2 13.9 20.6 3.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  caja: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8 12 3.5 20.5 8 12 12.5 3.5 8Z"/><path d="M3.5 8v8L12 20.5"/><path d="M20.5 8v8L12 20.5"/><path d="M12 12.5V20.5"/></svg>`,
  almacen: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="1.2"/><path d="M4 10 12 4l8 6"/><path d="M9 20v-5h6v5"/></svg>`,
  edificio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3.5" width="14" height="17" rx="1"/><path d="M8.5 7.5h1.2M14.3 7.5h1.2M8.5 11.5h1.2M14.3 11.5h1.2M8.5 15.5h1.2M14.3 15.5h1.2"/><path d="M10 20.5v-3h4v3"/></svg>`,
  calendario: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="1.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>`,
  reloj: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12.5" r="8.2"/><path d="M12 8v4.7l3.2 2"/></svg>`,
  camion: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="8" width="11" height="8.5" rx="1"/><path d="M13.5 11h4l3 3v2.5h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17.3" cy="18" r="1.6"/></svg>`,
  balanza: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v17M7 6.5h10"/><path d="M4 6.5 2 11a2.6 2.6 0 0 0 4.9 0Z"/><path d="M20 6.5 18 11a2.6 2.6 0 0 0 4.9 0Z"/><path d="M8.5 20.5h7"/></svg>`,
  cheque: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M8.2 12.3 10.7 15 15.8 9"/></svg>`,
  destino: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.8-6.2-6.8-11.2A6.8 6.8 0 0 1 12 3a6.8 6.8 0 0 1 6.8 6.8C18.8 14.8 12 21 12 21Z"/><circle cx="12" cy="9.8" r="2.3"/></svg>`,
};

function obtenerIcono(nombre) {
  return ICONOS[nombre] || ICONOS.chispa;
}

export { obtenerIcono };
