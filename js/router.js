/* router.js
 * Comunicación con OSRM: API Table (matriz tiempos/distancias)
 * Implementación Fase 6. API Route queda para Fase 7.
 */
import { coordenadasValidas } from './ubicaciones.js';
import { ESTADO } from './pedidos.js';

export const URL_BASE_OSRM = 'https://router.project-osrm.org';
export const RUTA_TABLE = '/table/v1/driving/';
export const TIMEOUT_MS = 5000; // ms

export const FUENTE = {
  OSRM: 'osrm',
  HAVERSINE: 'haversine'
};

const VELOCIDAD_REFERENCIA_KMH = 30; // velocidad estimada para fallback (no por carretera)

// Códigos de error OSRM comunes
export const CODIGO_OSRM_OK = 'Ok';
export const CODIGO_OSRM_INVALID_ARGUMENTS = 'InvalidQuery';
export const CODIGO_OSRM_TOO_MANY_COORDINATES = 'TooBig';

function toNumero(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : NaN;
}

function puntoValido(p) {
  if (!p) return false;
  const lat = toNumero(p.lat);
  const lon = toNumero(p.lon);
  return coordenadasValidas(lat, lon);
}

// Prepara lista de puntos: [origen, ...pedidos pendientes con coords válidas] (sin mutar)
export function prepararPuntos({ posicion, pedidos } = {}) {
  const lista = [];

  // Origen (GPS)
  if (posicion && puntoValido(posicion)) {
    lista.push({
      tipo: 'origen',
      lat: toNumero(posicion.lat),
      lon: toNumero(posicion.lon)
    });
  }

  // Pedidos pendientes
  if (Array.isArray(pedidos)) {
    for (let i = 0; i < pedidos.length; i++) {
      const p = pedidos[i];
      if (!p) continue;
      const estado = p.estado;
      if (estado && estado !== ESTADO.PENDIENTE) continue; // excluir entregados
      if (!puntoValido(p)) continue;
      lista.push({
        tipo: 'pedido',
        id: p.id,
        lat: toNumero(p.lat),
        lon: toNumero(p.lon),
        descripcion: p.descripcion || ''
      });
    }
  }

  return lista;
}

// Construye cadena lon,lat;lon,lat (OSRM usa lon,lat)
export function construirCoordenadasOsrm(puntos = []) {
  if (!Array.isArray(puntos) || puntos.length === 0) return '';
  return puntos
    .map((pt) => {
      const lon = toNumero(pt.lon);
      const lat = toNumero(pt.lat);
      return lon + ',' + lat;
    })
    .join(';');
}

// Distancia Haversine en metros
function haversineMetros(aLat, aLon, bLat, bLon) {
  const R = 6371000; // metros
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const sinDLat2 = Math.sin(dLat / 2);
  const sinDLon2 = Math.sin(dLon / 2);
  const h = sinDLat2 * sinDLat2 + Math.cos(lat1) * Math.cos(lat2) * sinDLon2 * sinDLon2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

// Duración estimada (segundos) para fallback
function duracionEstimadaSegundos(distanciaMetros) {
  const vm = VELOCIDAD_REFERENCIA_KMH / 3.6; // m/s
  if (vm <= 0) return 0;
  const t = (distanciaMetros / vm);
  return Math.max(0, Math.round(t * 1000) / 1000);
}

// Matriz N×N con Haversine
function matrizHaversine(puntos = []) {
  const n = puntos.length;
  const durations = Array(n).fill().map(() => Array(n).fill(0));
  const distances = Array(n).fill().map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    const pi = puntos[i];
    durations[i][i] = 0;
    distances[i][i] = 0;
    for (let j = i + 1; j < n; j++) {
      const pj = puntos[j];
      const d = haversineMetros(pi.lat, pi.lon, pj.lat, pj.lon);
      const t = duracionEstimadaSegundos(d);
      const dRed = Math.round(d * 1000) / 1000; // metros
      const tRed = t;
      distances[i][j] = dRed;
      distances[j][i] = dRed;
      durations[i][j] = tRed;
      durations[j][i] = tRed;
    }
  }
  return { durations, distances };
}

// Construye URL Table v1 (lon,lat)
function construirUrlTable(puntos = []) {
  const coords = construirCoordenadasOsrm(puntos);
  const base = URL_BASE_OSRM.replace(/\/$/, '');
  return base + RUTA_TABLE + coords + '?annotations=duration,distance';
}

// Calcular matriz: OSRM Table -> fallback Haversine si falla
export async function calcularMatriz({
  posicion,
  pedidos,
  fetchImpl
} = {}) {
  const fetchFn = typeof fetchImpl === 'function' ? fetchImpl : (typeof fetch !== 'undefined' ? fetch : null);

  const puntosPre = prepararPuntos({ posicion, pedidos });

  // Casos de error previos a llamada (requieren GPS)
  if (!posicion || !puntoValido(posicion)) {
    return {
      ok: false,
      error: 'POSICION_GPS_FALTANTE',
      mensaje: 'Se requiere posición GPS válida para calcular matriz',
      fuente: FUENTE.HAVERSINE,
      esDistanciaPorCarretera: false,
      puntos: [],
      dimensiones: 0,
      durations: [],
      distances: []
    };
  }

  const hayPedido = puntosPre.some((p) => p.tipo === 'pedido');
  if (!hayPedido) {
    // Solo GPS, sin pedidos pendientes
    return {
      ok: false,
      error: 'SIN_PEDIDOS_PENDIENTES',
      mensaje: 'No hay pedidos pendientes con ubicación para calcular matriz',
      fuente: FUENTE.HAVERSINE,
      esDistanciaPorCarretera: false,
      puntos: [],
      dimensiones: 0,
      durations: [],
      distances: []
    };
  }

  // Sin fetch disponible: usar fallback directo
  if (!fetchFn) {
    const m = matrizHaversine(puntosPre);
    return {
      ok: true,
      fuente: FUENTE.HAVERSINE,
      esDistanciaPorCarretera: false,
      puntos: puntosPre,
      dimensiones: puntosPre.length,
      ...m,
      origenIndex: 0
    };
  }

  const puntos = puntosPre;
  const n = puntos.length;

  // Intentar OSRM Table
  const url = construirUrlTable(puntos);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetchFn(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      const mH = matrizHaversine(puntos);
      return {
        ok: true,
        fuente: FUENTE.HAVERSINE,
        esDistanciaPorCarretera: false,
        puntos,
        dimensiones: n,
        ...mH,
        origenIndex: 0,
        warning: 'FALLBACK_HAVERSINE_HTTP_' + res.status
      };
    }

    let data;
    try {
      data = await res.json();
    } catch (e) {
      const mH = matrizHaversine(puntos);
      return {
        ok: true,
        fuente: FUENTE.HAVERSINE,
        esDistanciaPorCarretera: false,
        puntos,
        dimensiones: n,
        ...mH,
        origenIndex: 0,
        warning: 'FALLBACK_HAVERSINE_JSON_INVALIDO'
      };
    }

    const code = data && data.code ? data.code : null;
    if (code !== CODIGO_OSRM_OK) {
      const mH = matrizHaversine(puntos);
      return {
        ok: true,
        fuente: FUENTE.HAVERSINE,
        esDistanciaPorCarretera: false,
        puntos,
        dimensiones: n,
        ...mH,
        origenIndex: 0,
        warning: 'FALLBACK_HAVERSINE_OSRM_' + code
      };
    }

    const durations = Array.isArray(data.durations) ? data.durations : null;
    const distances = Array.isArray(data.distances) ? data.distances : null;
    if (!durations || !distances || durations.length !== n || distances.length !== n) {
      const mH = matrizHaversine(puntos);
      return {
        ok: true,
        fuente: FUENTE.HAVERSINE,
        esDistanciaPorCarretera: false,
        puntos,
        dimensiones: n,
        ...mH,
        origenIndex: 0,
        warning: 'FALLBACK_HAVERSINE_DIMENSIONES'
      };
    }

    let dimsOk = true;
    for (let i = 0; i < durations.length && dimsOk; i++) {
      if (!Array.isArray(durations[i]) || durations[i].length !== n) { dimsOk = false; }
      if (!Array.isArray(distances[i]) || distances[i].length !== n) { dimsOk = false; }
    }
    if (!dimsOk) {
      const mH = matrizHaversine(puntos);
      return {
        ok: true,
        fuente: FUENTE.HAVERSINE,
        esDistanciaPorCarretera: false,
        puntos,
        dimensiones: n,
        ...mH,
        origenIndex: 0,
        warning: 'FALLBACK_HAVERSINE_DIMENSIONES'
      };
    }

    return {
      ok: true,
      fuente: FUENTE.OSRM,
      esDistanciaPorCarretera: true,
      puntos,
      dimensiones: n,
      durations,
      distances,
      origenIndex: 0
    };

  } catch (err) {
    const mH = matrizHaversine(puntos);
    let warning = 'FALLBACK_HAVERSINE_ERROR';
    if (err && err.name === 'AbortError') {
      warning = 'FALLBACK_HAVERSINE_TIMEOUT';
    } else if (err && typeof err.message === 'string' && /network|fetch|failed/i.test(err.message)) {
      warning = 'FALLBACK_HAVERSINE_RED';
    }
    return {
      ok: true,
      fuente: FUENTE.HAVERSINE,
      esDistanciaPorCarretera: false,
      puntos,
      dimensiones: n,
      ...mH,
      origenIndex: 0,
      warning
    };
  } finally {
    clearTimeout(t);
  }
}

// obtenerRuta queda para Fase 7
export async function obtenerRuta(coordenadas) {
  const _ = coordenadas;
  return null;
}
