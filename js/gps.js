/* gps.js
 * Manejo de la Geolocation API: solicitud de permiso, obtención de la
 * posición actual, manejo de errores y conservación de la última
 * posición guardada como punto de partida para las fases siguientes.
 *
 * IMPORTANTE: nunca se solicita la ubicación automáticamente al cargar
 * la página; solo cuando el usuario lo pide explícitamente.
 */

export const ESTADO_GPS = {
  INACTIVO: 'inactivo',
  SOLICITANDO: 'solicitando',
  OBTENIDO: 'obtenido',
  ERROR: 'error',
};

const CODIGO_PERMISO_DENEGADO = 1;
const CODIGO_POSICION_NO_DISPONIBLE = 2;
const CODIGO_TIMEOUT = 3;

let posicionGuardada = null;
let estado = ESTADO_GPS.INACTIVO;

export function tieneSoporte() {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

export function getEstado() {
  return estado;
}

export function obtenerPosicionGuardada() {
  return posicionGuardada;
}

export function limpiarPosicionGuardada() {
  posicionGuardada = null;
  estado = ESTADO_GPS.INACTIVO;
}

function crearErrorGps(codigo, mensaje) {
  const error = new Error(mensaje);
  error.codigo = codigo;
  return error;
}

function traducirError(error) {
  switch (error.code) {
    case CODIGO_PERMISO_DENEGADO:
      return crearErrorGps(
        'PERMISO_DENEGADO',
        'No autorizaste el acceso a tu ubicación. Permítelo en los ajustes del navegador y prueba de nuevo.'
      );
    case CODIGO_POSICION_NO_DISPONIBLE:
      return crearErrorGps(
        'POSICION_NO_DISPONIBLE',
        'No pudimos obtener tu ubicación. Revisa que el GPS esté activado y que tengas conexión.'
      );
    case CODIGO_TIMEOUT:
      return crearErrorGps(
        'TIMEOUT',
        'La ubicación tardó demasiado en responder. Prueba de nuevo en un lugar con mejor señal.'
      );
    default:
      return crearErrorGps(
        'ERROR_DESCONOCIDO',
        'No pudimos obtener tu ubicación. Intenta de nuevo.'
      );
  }
}

function normalizarPosicion(posicion) {
  const { latitude, longitude, accuracy } = posicion.coords;
  return {
    latitude,
    longitude,
    accuracy: typeof accuracy === 'number' ? accuracy : null,
    timestamp: typeof posicion.timestamp === 'number' ? posicion.timestamp : Date.now(),
  };
}

/**
 * Solicita la posición actual al navegador.
 * Si el usuario no ha dado permiso, el navegador abre el diálogo de
 * permisos en este momento.
 *
 * @param {object} [opciones] Ajustes de getCurrentPosition.
 * @returns {Promise<{latitude: number, longitude: number, accuracy: number|null, timestamp: number}>}
 */
export function obtenerPosicion(opciones = {}) {
  if (!tieneSoporte()) {
    estado = ESTADO_GPS.ERROR;
    return Promise.reject(
      crearErrorGps('NO_SOPORTADO', 'Tu navegador no soporta geolocalización.')
    );
  }

  estado = ESTADO_GPS.SOLICITANDO;

  const ajustes = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0,
    ...opciones,
  };

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        const datos = normalizarPosicion(posicion);
        posicionGuardada = datos;
        estado = ESTADO_GPS.OBTENIDO;
        resolve(datos);
      },
      (error) => {
        estado = ESTADO_GPS.ERROR;
        reject(traducirError(error));
      },
      ajustes
    );
  });
}