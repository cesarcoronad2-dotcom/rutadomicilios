/* map.js
 * Responsable de Leaflet: inicializar los mapas, mostrar la posición
 * del repartidor, los pedidos con marcadores numerados (con popup) y
 * ajustar la vista para que quepan todos los puntos.
 * La polilínea de la ruta llega en fases posteriores (Fase 7).
 *
 * Leaflet se carga con <script> clásico en index.html (build UMD),
 * por lo que aquí se usa el global window.L en lugar de un import.
 */

const mapas = {};
const capasUsuario = {};
const puntosUsuario = {};
const capasPedidos = {};
const PENDIENTE = 'pendiente';

if (typeof L !== 'undefined') {
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'lib/leaflet/images/marker-icon-2x.png',
    iconUrl: 'lib/leaflet/images/marker-icon.png',
    shadowUrl: 'lib/leaflet/images/marker-shadow.png',
  });
}

export function initMapa(contenedorId) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) {
    return null;
  }

  if (typeof L === 'undefined') {
    console.error('Leaflet no cargó correctamente.');
    return null;
  }

  if (mapas[contenedorId]) {
    return mapas[contenedorId];
  }

  const mapa = L.map(contenedor, {
    center: [4.6097, -74.0817],
    zoom: 13,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);

  mapas[contenedorId] = mapa;
  return mapa;
}

export function obtenerMapa(contenedorId) {
  if (contenedorId) {
    return mapas[contenedorId] || null;
  }
  const ids = Object.keys(mapas);
  return ids.length > 0 ? mapas[ids[0]] : null;
}

/* ---------------------- Posición del repartidor ---------------------- */

export function mostrarUbicacionUsuario(contenedorId, ubicacion) {
  const mapa = mapas[contenedorId];
  if (!mapa || !ubicacion) {
    return null;
  }

  if (capasUsuario[contenedorId]) {
    mapa.removeLayer(capasUsuario[contenedorId]);
  }

  const coordenadas = [ubicacion.latitude, ubicacion.longitude];

  const punto = L.circleMarker(coordenadas, {
    radius: 9,
    color: '#ffffff',
    weight: 3,
    fillColor: '#059669',
    fillOpacity: 1,
  });

  const capa = L.layerGroup([punto]);

  if (typeof ubicacion.accuracy === 'number' && ubicacion.accuracy > 0) {
    const circulo = L.circle(coordenadas, {
      radius: ubicacion.accuracy,
      color: '#059669',
      weight: 1,
      opacity: 0.4,
      fillColor: '#10b981',
      fillOpacity: 0.12,
    });
    circulo.addTo(capa);
  }

  punto.bindPopup('📍 Aquí estás');
  punto.addTo(capa);
  capa.addTo(mapa);

  capasUsuario[contenedorId] = capa;
  puntosUsuario[contenedorId] = punto;
  return punto;
}

/* ---------------------- Marcadores de pedidos ---------------------- */

function crearIconoPedido(numero, entregado) {
  return L.divIcon({
    className: 'pedido-marker-wrap',
    html: `<div class="pedido-marker${entregado ? ' entregado' : ''}"><span>${numero}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -22],
  });
}

function construirPopup(pedido) {
  const contenedor = document.createElement('div');
  contenedor.className = 'pedido-popup';

  const titulo = document.createElement('strong');
  titulo.textContent = `📦 PEDIDO #${pedido.numero}`;
  titulo.className = 'pedido-popup-titulo';
  contenedor.appendChild(titulo);

  const descripcion = document.createElement('p');
  descripcion.className = 'pedido-popup-descripcion';
  descripcion.textContent = pedido.descripcion.trim() || 'Sin descripción';
  contenedor.appendChild(descripcion);

  const estado = document.createElement('span');
  const entregado = pedido.estado !== PENDIENTE;
  estado.textContent = entregado ? 'ENTREGADO' : 'PENDIENTE';
  estado.className = `badge ${entregado ? 'badge-entregado' : 'badge-pendiente'}`;
  contenedor.appendChild(estado);

  const coords = document.createElement('p');
  coords.className = 'pedido-popup-coords';
  coords.textContent = `${Number(pedido.latitud).toFixed(6)}, ${Number(pedido.longitud).toFixed(6)}`;
  contenedor.appendChild(coords);

  return contenedor;
}

/**
 * Reemplaza los marcadores de pedidos de un mapa. Solo los pedidos con
 * latitud/longitud válidas generan marcador; el número mostrado es el
 * número actual del pedido y el estado "entregado" se marca en gris.
 * @param {string} contenedorId
 * @param {Array<object>} pedidos
 */
export function mostrarPedidosEnMapa(contenedorId, pedidos) {
  const mapa = mapas[contenedorId];
  if (!mapa) {
    return;
  }

  if (capasPedidos[contenedorId]) {
    mapa.removeLayer(capasPedidos[contenedorId]);
  }

  const capa = L.layerGroup();

  pedidos.forEach((pedido) => {
    const lat = pedido.latitud;
    const lon = pedido.longitud;
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return;
    }
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return;
    }

    const entregado = pedido.estado !== PENDIENTE;
    const marcador = L.marker([lat, lon], {
      icon: crearIconoPedido(pedido.numero, entregado),
      title: `Pedido #${pedido.numero}`,
    });
    marcador.bindPopup(construirPopup(pedido));
    marcador.addTo(capa);
  });

  capa.addTo(mapa);
  capasPedidos[contenedorId] = capa;
}

function recolectarPuntos(contenedorId) {
  const puntos = [];
  const capaPedidos = capasPedidos[contenedorId];
  if (capaPedidos) {
    capaPedidos.eachLayer((capa) => {
      if (typeof capa.getLatLng === 'function') {
        puntos.push(capa.getLatLng());
      }
    });
  }
  const puntoUsuario = puntosUsuario[contenedorId];
  if (puntoUsuario && typeof puntoUsuario.getLatLng === 'function') {
    puntos.push(puntoUsuario.getLatLng());
  }
  return puntos;
}

/**
 * Ajusta zoom/centro para que entren todos los puntos del mapa.
 * Con un solo punto se limita a centrar. Si no hay puntos válidos no
 * se toca la posición actual del mapa.
 */
export function ajustarVista(contenedorId) {
  const mapa = mapas[contenedorId];
  if (!mapa) {
    return;
  }
  const puntos = recolectarPuntos(contenedorId);
  if (puntos.length === 0) {
    return;
  }
  if (puntos.length === 1) {
    mapa.setView(puntos[0], Math.max(mapa.getZoom(), 15));
    return;
  }
  mapa.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 17 });
}