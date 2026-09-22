/* ubicaciones.js
 * Procesa texto que el usuario pega desde WhatsApp y extrae coordenadas
 * (latitud, longitud). Parser por capas, sin scraping de WhatsApp:
 *
 *  1. Enlaces geo:
 *  2. URLs de Google Maps (@lat,lng | ?q= | línea de búsqueda | !3d/!4d)
 *  3. URLs de OpenStreetMap
 *  4. Coordenadas DMS (grados/min/seg)
 *  5. Pares decimales sueltos en texto libre
 *
 * Los enlaces cortos (maps.app.goo.gl) se detectan pero NO se abren:
 * no es posible leer su destino de forma fiable desde JavaScript,
 * así que se devuelve un mensaje claro sin inventar coordenadas.
 */

export const FORMATO = {
  DECIMAL: 'DECIMAL',
  URL_GOOGLE_MAPS_AT: 'URL_GOOGLE_MAPS_AT',
  URL_GOOGLE_MAPS_Q: 'URL_GOOGLE_MAPS_Q',
  URL_GOOGLE_MAPS_BUSQUEDA: 'URL_GOOGLE_MAPS_BUSQUEDA',
  URL_GOOGLE_MAPS_3D4D: 'URL_GOOGLE_MAPS_3D4D',
  GEO_URI: 'GEO_URI',
  URL_OSM: 'URL_OSM',
  DMS: 'DMS',
  ENLACE_CORTO: 'ENLACE_CORTO',
  FUERA_DE_RANGO: 'FUERA_DE_RANGO',
  SIN_TEXTO: 'SIN_TEXTO',
  NO_DETECTADO: 'NO_DETECTADO',
};

const LAT_MIN = -90;
const LAT_MAX = 90;
const LON_MIN = -180;
const LON_MAX = 180;

export function coordenadasValidas(latitud, longitud) {
  return (
    typeof latitud === 'number' &&
    Number.isFinite(latitud) &&
    typeof longitud === 'number' &&
    Number.isFinite(longitud) &&
    latitud >= LAT_MIN &&
    latitud <= LAT_MAX &&
    longitud >= LON_MIN &&
    longitud <= LON_MAX
  );
}

export function formatearCoordenadas(latitud, longitud) {
  return `${Number(latitud).toFixed(6)}, ${Number(longitud).toFixed(6)}`;
}

function error(formato, mensaje) {
  return { ok: false, latitud: null, longitud: null, formatoDetectado: formato, mensaje };
}

function acierto(formato, latitud, longitud, ambiguo = false) {
  return {
    ok: true,
    latitud,
    longitud,
    formatoDetectado: formato,
    ambiguo,
    mensaje: ambiguo
      ? 'No pudimos confirmar el orden de las coordenadas; se asumió latitud, longitud.'
      : '',
  };
}

/* --------------------------------------------------------------------------
 * Resolución de un par {a, b} a latitud/longitud.
 *  - Si uno de los valores supera |90|, es inequívocamente la longitud.
 *  - Si ambos están dentro de |90| el orden es ambiguo por contenido.
 *    Se usa heurística de signos (patrón "+,−" es el estándar de Google
 *    Maps/WhatsApp) y se marca para que la interfaz lo confirme.
 * -------------------------------------------------------------------------- */
function resolverPar(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return null;
  }
  const magA = Math.abs(a);
  const magB = Math.abs(b);
  if (magA > LON_MAX || magB > LON_MAX) {
    return null;
  }

  if (magA > LAT_MAX) {
    return { latitud: b, longitud: a, ambiguo: false };
  }
  if (magB > LAT_MAX) {
    return { latitud: a, longitud: b, ambiguo: false };
  }

  const patronEstandar = a > 0 && b < 0;
  return { latitud: a, longitud: b, ambiguo: !patronEstandar };
}

/* ------------------------------ 1. geo: ------------------------------ */

function extraerGeoUri(texto) {
  const m = texto.match(/geo:\s*([-+]?\d{1,3}(?:\.\d{1,18})?)\s*,\s*([-+]?\d{1,3}(?:\.\d{1,18})?)/i);
  if (!m) {
    return null;
  }
  return resolverPar(Number(m[1]), Number(m[2]));
}

/* ------------------------------ 2. Google Maps ------------------------------ */

function extraerGoogleMaps(texto) {
  const at = texto.match(
    /(?:@|%40)\s*([-+]?\d{1,3}(?:\.\d{1,18})?)\s*,\s*([-+]?\d{1,3}(?:\.\d{1,18})?)/i
  );
  if (at) {
    const par = resolverPar(Number(at[1]), Number(at[2]));
    if (par) {
      return { formato: FORMATO.URL_GOOGLE_MAPS_AT, ...par };
    }
  }

  const parametros = texto.match(/[?&](?:q|query|destination|ll)=([^&#]+)/i);
  if (parametros) {
    let valor;
    try {
      valor = decodeURIComponent(parametros[1]).replace(/\+/g, ' ');
    } catch {
      valor = parametros[1];
    }
    const par = extraerParDecimal(valor, valor);
    if (par) {
      const resuelto = resolverPar(par.a, par.b);
      if (resuelto) {
        return { formato: FORMATO.URL_GOOGLE_MAPS_Q, ...resuelto };
      }
    }
  }

  const busqueda = texto.match(
    /maps\/search\/([-+]?\d{1,3}(?:\.\d{1,18})?)\s*,\s*([-+]?\d{1,3}(?:\.\d{1,18})?)/i
  );
  if (busqueda) {
    const par = resolverPar(Number(busqueda[1]), Number(busqueda[2]));
    if (par) {
      return { formato: FORMATO.URL_GOOGLE_MAPS_BUSQUEDA, ...par };
    }
  }

  const coord3d4d = texto.match(
    /!3d([-+]?\d{1,3}(?:\.\d{1,18})?)(?:[^!]{0,80})!4d([-+]?\d{1,3}(?:\.\d{1,18})?)/i
  );
  if (coord3d4d) {
    const par = resolverPar(Number(coord3d4d[1]), Number(coord3d4d[2]));
    if (par) {
      return { formato: FORMATO.URL_GOOGLE_MAPS_3D4D, ...par };
    }
  }

  return null;
}

/* ------------------------------ 3. OpenStreetMap ------------------------------ */

function extraerOsm(texto) {
  const hash = texto.match(
    /#map=\d+\/([-+]?\d{1,3}(?:\.\d{1,18})?)\/([-+]?\d{1,3}(?:\.\d{1,18})?)/i
  );
  if (hash) {
    const par = resolverPar(Number(hash[1]), Number(hash[2]));
    if (par) {
      return par;
    }
  }

  const mlat = texto.match(/[?&]mlat=([-+]?\d{1,3}(?:\.\d{1,18})?)[^&]*&mlon=([-+]?\d{1,3}(?:\.\d{1,18})?)/i);
  if (mlat) {
    const par = resolverPar(Number(mlat[1]), Number(mlat[2]));
    if (par) {
      return par;
    }
  }

  const latlon = texto.match(/[?&]lat=([-+]?\d{1,3}(?:\.\d{1,18})?)[^&]*&lon=([-+]?\d{1,3}(?:\.\d{1,18})?)/i);
  if (latlon) {
    const par = resolverPar(Number(latlon[1]), Number(latlon[2]));
    if (par) {
      return par;
    }
  }

  return null;
}

/* ------------------------------ 4. DMS ------------------------------ */

function extraerDms(texto) {
  // Grupos: 1 signo, 2 letra inicial, 3 grados, 4 minutos, 5 segundos, 6 letra final
  const re =
    /\s*([-+])?\s*([NSEW])?\s*(\d{1,3})\s*[°ºo]\s*(\d{1,2}(?:\.\d{1,6})?)\s*(?:['′’`]\s*(\d{1,2}(?:\.\d{1,6})?)\s*(?:["″”]\s*)?)?\s*([NSEW])?/gi;
  let latitud = null;
  let longitud = null;
  let usoLetras = false;
  let m;

  while ((m = re.exec(texto)) !== null) {
    const prefijo = (m[2] || '').toUpperCase();
    const sufijo = (m[6] || '').toUpperCase();
    const grados = Math.abs(Number(m[3]));
    const minutos = Number(m[4] || 0);
    const segundos = Number(m[5] || 0);
    const direccion = prefijo || sufijo;

    if (direccion) {
      usoLetras = true;
    }

    let valor = grados + minutos / 60 + segundos / 3600;
    if (m[1] === '-' || direccion === 'S' || direccion === 'W') {
      valor = -valor;
    }

    if (direccion === 'N' || direccion === 'S') {
      if (latitud === null && Math.abs(valor) <= LAT_MAX) {
        latitud = valor;
      }
    } else if (direccion === 'E' || direccion === 'W') {
      if (longitud === null && Math.abs(valor) <= LON_MAX) {
        longitud = valor;
      }
    } else if (latitud === null && Math.abs(valor) <= LAT_MAX) {
      latitud = valor;
    } else if (longitud === null && Math.abs(valor) <= LON_MAX) {
      longitud = valor;
    }
  }

  if (latitud !== null && longitud !== null) {
    return { latitud, longitud, ambiguo: !usoLetras };
  }
  return null;
}

/* ------------------------------ 5. Pares decimales ------------------------------ */

function obtenerTokensNumericos(texto) {
  const tokens = [];
  const re = /[-+]?\d{1,3}(?:\.\d{1,18})?/g;
  let m;
  while ((m = re.exec(texto)) !== null) {
    const anterior = texto[m.index - 1];
    const siguiente = texto[m.index + m[0].length];
    if (anterior && /[\d.]/.test(anterior)) {
      continue;
    }
    if (siguiente && /[\d.]/.test(siguiente)) {
      continue;
    }
    tokens.push({
      inicio: m.index,
      fin: m.index + m[0].length,
      valor: Number(m[0]),
      esDecimal: m[0].includes('.'),
    });
  }
  return tokens;
}

function extraerParDecimal(soporte, texto) {
  const tokens = obtenerTokensNumericos(texto);
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const a = tokens[i];
    const b = tokens[i + 1];
    const entre = soporte.slice(a.fin, b.inicio);
    if (!/^[\s,;|/]*$/.test(entre) || entre.length > 6) {
      continue;
    }
    if (!(a.esDecimal || b.esDecimal)) {
      continue;
    }
    return { a: a.valor, b: b.valor };
  }
  return null;
}

/* ------------------------------ Enlace corto ------------------------------ */

function detectarEnlaceCorto(texto) {
  const m = texto.match(/(?:https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl|\bg\.co\/[A-Za-z0-9_-]+)/i);
  return m ? m[0] : null;
}

export function parsearUbicacion(texto) {
  if (typeof texto !== 'string') {
    return error(FORMATO.SIN_TEXTO, 'No se recibió ningún texto.');
  }
  const contenido = texto.trim().replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ');
  if (contenido === '') {
    return error(FORMATO.SIN_TEXTO, 'Pega la ubicación que te envió el cliente.');
  }

  // 1. geo:
  const geo = extraerGeoUri(contenido);
  if (geo) {
    if (coordenadasValidas(geo.latitud, geo.longitud)) {
      return acierto(FORMATO.GEO_URI, geo.latitud, geo.longitud, geo.ambiguo);
    }
    return error(FORMATO.FUERA_DE_RANGO, 'Las coordenadas del enlace están fuera de rango.');
  }

  // 2. Google Maps
  const gmaps = extraerGoogleMaps(contenido);
  if (gmaps) {
    if (coordenadasValidas(gmaps.latitud, gmaps.longitud)) {
      return acierto(gmaps.formato, gmaps.latitud, gmaps.longitud, gmaps.ambiguo);
    }
    return error(FORMATO.FUERA_DE_RANGO, 'Las coordenadas del enlace están fuera de rango.');
  }

  // 3. OpenStreetMap
  const osm = extraerOsm(contenido);
  if (osm) {
    if (coordenadasValidas(osm.latitud, osm.longitud)) {
      return acierto(FORMATO.URL_OSM, osm.latitud, osm.longitud, osm.ambiguo);
    }
    return error(FORMATO.FUERA_DE_RANGO, 'Las coordenadas del enlace están fuera de rango.');
  }

  // 4. DMS
  const dms = extraerDms(contenido);
  if (dms) {
    if (coordenadasValidas(dms.latitud, dms.longitud)) {
      return acierto(FORMATO.DMS, dms.latitud, dms.longitud, dms.ambiguo);
    }
    return error(FORMATO.FUERA_DE_RANGO, 'Las coordenadas DMS están fuera de rango.');
  }

  // 5. Pares decimales en texto libre
  const par = extraerParDecimal(contenido, contenido);
  if (par) {
    const resuelto = resolverPar(par.a, par.b);
    if (resuelto) {
      if (coordenadasValidas(resuelto.latitud, resuelto.longitud)) {
        return acierto(FORMATO.DECIMAL, resuelto.latitud, resuelto.longitud, resuelto.ambiguo);
      }
      return error(FORMATO.FUERA_DE_RANGO, 'Los números parecen coordenadas pero están fuera de rango.');
    }
  }

  // Enlace corto presente pero sin coordenadas extras: no resolvemos.
  if (detectarEnlaceCorto(contenido)) {
    return error(
      FORMATO.ENLACE_CORTO,
      'Este es un enlace corto de Google Maps y no podemos leer su destino desde aquí. Ábrelo en Google Maps, pulsa "Compartir" y copia el enlace o las coordenadas.'
    );
  }

  return error(
    FORMATO.NO_DETECTADO,
    'No pudimos detectar las coordenadas. Revisa que hayas copiado el enlace o la ubicación correctamente.'
  );
}