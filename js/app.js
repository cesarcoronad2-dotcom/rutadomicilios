/* app.js
 * Controlador principal. Coordina los módulos, gestiona la navegación
 * entre los 3 pasos y renderiza las tarjetas de pedidos.
 * GPS, parser de ubicaciones, OSRM y optimización llegan en fases
 * posteriores.
 */

import * as gps from './gps.js';
import * as pedidos from './pedidos.js';
import * as ubicaciones from './ubicaciones.js';
import * as router from './router.js';
import * as optimizer from './optimizer.js';
import * as map from './map.js';
import * as storage from './storage.js';

// Posición actual del usuario como punto de partida de la ruta.
// Se guarda aquí (y también dentro de gps.js) para las siguientes fases.
let miUbicacion = null;
let gpsEnCurso = false;

function mostrarPaso(nombrePaso) {
  document.querySelectorAll('.step').forEach((step) => {
    step.classList.toggle('active', step.id === nombrePaso);
  });
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.paso === nombrePaso);
  });

  const mapaRuta = map.obtenerMapa('map-ruta');
  if (nombrePaso === 'paso-ruta' && mapaRuta) {
    mapaRuta.invalidateSize();
    map.ajustarVista('map-ruta');
  }
}

function guardarYRenderizar() {
  storage.guardarPedidos(pedidos.obtenerPedidos());
  renderizarPedidos();
  actualizarMapas();
}

function contarConUbicacion(lista) {
  return lista.filter((p) => {
    return (
      typeof p.latitud === 'number' &&
      typeof p.longitud === 'number' &&
      Number.isFinite(p.latitud) &&
      Number.isFinite(p.longitud)
    );
  }).length;
}

function textoEstadoMapa() {
  const lista = pedidos.obtenerPedidos();
  const conUbicacion = contarConUbicacion(lista);
  const elemento = document.getElementById('mapa-estado');
  if (!elemento) {
    return;
  }
  if (lista.length === 0) {
    elemento.textContent = 'Sin pedidos aún. Agrégalos en la pestaña Pedidos.';
  } else if (conUbicacion === 0) {
    elemento.textContent = 'Ninguno de tus pedidos tiene ubicación válida todavía.';
  } else if (conUbicacion < lista.length) {
    elemento.textContent = `📦 ${conUbicacion} pedido(s) con ubicación · ${lista.length - conUbicacion} sin ubicación.`;
  } else {
    elemento.textContent = `📦 ${conUbicacion} pedido(s) con ubicación.`;
  }
}

/**
 * Sincroniza marcadores y vista de ambos mapas con el estado actual:
 * posición GPS guardada + pedidos con coordenadas válidas.
 * @param {{conVista?: boolean}} opciones
 */
function actualizarMapas(opciones = {}) {
  const lista = pedidos.obtenerPedidos();
  const posicion = gps.obtenerPosicionGuardada();

  if (posicion) {
    map.mostrarUbicacionUsuario('map', posicion);
    map.mostrarUbicacionUsuario('map-ruta', posicion);
  }

  map.mostrarPedidosEnMapa('map', lista);
  map.mostrarPedidosEnMapa('map-ruta', lista);

  if (opciones.conVista !== false) {
    map.ajustarVista('map');
    map.ajustarVista('map-ruta');
  }

  textoEstadoMapa();
}

function crearElementoTarjeta(pedidoObj) {
  const tarjeta = document.createElement('article');
  tarjeta.className = 'pedido-card';
  tarjeta.dataset.id = pedidoObj.id;
  const estaEntregado = pedidoObj.estado === pedidos.ESTADO.ENTREGADO;
  tarjeta.classList.toggle('entregado', estaEntregado);

  const header = document.createElement('header');
  header.className = 'pedido-header';

  const numero = document.createElement('span');
  numero.className = 'pedido-numero';
  numero.textContent = `📦 PEDIDO #${pedidoObj.numero}`;

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = estaEntregado ? 'ENTREGADO' : 'PENDIENTE';
  badge.classList.add(estaEntregado ? 'badge-entregado' : 'badge-pendiente');

  header.append(numero, badge);

  const campoDescripcion = document.createElement('div');
  campoDescripcion.className = 'pedido-campo';

  const labelDescripcion = document.createElement('label');
  labelDescripcion.textContent = '📝 Descripción del pedido';

  const descripcion = document.createElement('textarea');
  descripcion.placeholder = 'Escribe aquí qué debes entregar';
  descripcion.value = pedidoObj.descripcion;
  descripcion.dataset.campo = 'descripcion';

  campoDescripcion.append(labelDescripcion, descripcion);

  const campoUbicacion = document.createElement('div');
  campoUbicacion.className = 'pedido-campo';

  const labelUbicacion = document.createElement('label');
  labelUbicacion.textContent = '📍 Ubicación (enlace o coordenadas del cliente)';

  const ubicacion = document.createElement('input');
  ubicacion.type = 'text';
  ubicacion.placeholder = 'Pega aquí la ubicación de WhatsApp';
  ubicacion.value = pedidoObj.ubicacionOriginal;
  ubicacion.dataset.campo = 'ubicacionOriginal';

  const notaUbicacion = document.createElement('p');
  notaUbicacion.className = 'pedido-nota';
  notaUbicacion.textContent = 'Pega el enlace o las coordenadas que te envió el cliente; se detectan automáticamente.';

  const estadoUbicacion = document.createElement('p');
  estadoUbicacion.className = 'ubicacion-estado';
  estadoUbicacion.dataset.estadoUbicacion = '';

  campoUbicacion.append(labelUbicacion, ubicacion, notaUbicacion, estadoUbicacion);

  const campoCoords = document.createElement('div');
  campoCoords.className = 'pedido-campo';

  const labelCoords = document.createElement('label');
  labelCoords.textContent = '🌐 Coordenadas (opcional)';

  const gridCoords = document.createElement('div');
  gridCoords.className = 'pedido-coords';

  const latitud = document.createElement('input');
  latitud.type = 'number';
  latitud.step = 'any';
  latitud.placeholder = 'Latitud';
  latitud.value = pedidoObj.latitud === null ? '' : String(pedidoObj.latitud);
  latitud.dataset.campo = 'latitud';

  const longitud = document.createElement('input');
  longitud.type = 'number';
  longitud.step = 'any';
  longitud.placeholder = 'Longitud';
  longitud.value = pedidoObj.longitud === null ? '' : String(pedidoObj.longitud);
  longitud.dataset.campo = 'longitud';

  gridCoords.append(latitud, longitud);
  campoCoords.append(labelCoords, gridCoords);

  const acciones = document.createElement('div');
  acciones.className = 'pedido-actions';

  const btnEntregar = document.createElement('button');
  btnEntregar.type = 'button';
  btnEntregar.className = 'btn btn-entregar';
  btnEntregar.classList.toggle('esta-entregado', estaEntregado);
  btnEntregar.textContent = estaEntregado ? '↩️ Volver a pendiente' : '✓ Marcar como entregado';
  btnEntregar.dataset.accion = 'entregar';

  const btnEliminar = document.createElement('button');
  btnEliminar.type = 'button';
  btnEliminar.className = 'btn btn-eliminar';
  btnEliminar.textContent = '🗑️';
  btnEliminar.title = 'Eliminar pedido';
  btnEliminar.dataset.accion = 'eliminar';

  acciones.append(btnEntregar, btnEliminar);

  tarjeta.append(header, campoDescripcion, campoUbicacion, campoCoords, acciones);

  actualizarEstadoUbicacion(tarjeta, pedidoObj);

  return tarjeta;
}

function actualizarEstadoUbicacion(tarjeta, pedidoObj, mensajeError) {
  const estado = tarjeta.querySelector('[data-estado-ubicacion]');
  if (!estado) {
    return;
  }
  const campoLatitud = tarjeta.querySelector('[data-campo="latitud"]');
  const campoLongitud = tarjeta.querySelector('[data-campo="longitud"]');
  if (campoLatitud) {
    campoLatitud.value = pedidoObj.latitud === null ? '' : String(pedidoObj.latitud);
  }
  if (campoLongitud) {
    campoLongitud.value = pedidoObj.longitud === null ? '' : String(pedidoObj.longitud);
  }

  estado.classList.remove('ok', 'error', 'vacio');
  const tieneCoords = pedidoObj.latitud !== null && pedidoObj.longitud !== null;

  if (tieneCoords) {
    estado.textContent = `✓ Ubicación validada: ${ubicaciones.formatearCoordenadas(pedidoObj.latitud, pedidoObj.longitud)}`;
    estado.classList.add('ok');
  } else if (pedidoObj.ubicacionOriginal.trim() !== '') {
    estado.textContent = mensajeError || '⚠️ No pudimos interpretar la ubicación. Revisa el enlace pegado.';
    estado.classList.add('error');
  } else {
    estado.textContent = 'Sin ubicación todavía.';
    estado.classList.add('vacio');
  }
}

function manejarCambioUbicacion(contenedor, evento) {
  const entrada = evento.target;
  if (!entrada.dataset || entrada.dataset.campo !== 'ubicacionOriginal') {
    return;
  }
  const tarjeta = entrada.closest('.pedido-card');
  if (!tarjeta) {
    return;
  }
  const texto = entrada.value.trim();
  const resultado = ubicaciones.parsearUbicacion(texto);

  const cambios = { ubicacionOriginal: entrada.value };
  if (resultado.ok) {
    cambios.latitud = resultado.latitud;
    cambios.longitud = resultado.longitud;
  } else {
    cambios.latitud = null;
    cambios.longitud = null;
  }

  const actualizado = pedidos.actualizarPedido(tarjeta.dataset.id, cambios);
  if (actualizado) {
    storage.guardarPedidos(pedidos.obtenerPedidos());
    actualizarEstadoUbicacion(tarjeta, actualizado, texto ? resultado.mensaje : undefined);
    actualizarMapas();
  }
}

function actualizarEstadoVacio() {
  const lista = pedidos.obtenerPedidos();
  const vacio = document.getElementById('pedidos-vacio');
  if (vacio) {
    vacio.classList.toggle('hidden', lista.length > 0);
  }
  const limpiar = document.getElementById('btn-limpiar');
  if (limpiar) {
    limpiar.disabled = lista.length === 0;
  }
  const contador = document.getElementById('n-pedidos-display');
  if (contador) {
    contador.textContent = String(lista.length);
  }
}

function renderizarPedidos() {
  const contenedor = document.getElementById('pedidosContainer');
  if (!contenedor) {
    return;
  }
  contenedor.replaceChildren();
  pedidos.obtenerPedidos().forEach((pedidoObj) => {
    contenedor.appendChild(crearElementoTarjeta(pedidoObj));
  });
  actualizarEstadoVacio();
}

function parsearCoordenada(valor) {
  if (valor.trim() === '') {
    return null;
  }
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : NaN;
}

function manejarEntradaDeMapa(contenedor, evento) {
  const tarjeta = evento.target.closest('.pedido-card');
  if (!tarjeta) {
    return;
  }
  const campo = evento.target.dataset.campo;
  if (!campo) {
    return;
  }
  const id = tarjeta.dataset.id;
  const cambios = {};

  if (campo === 'latitud' || campo === 'longitud') {
    const valor = parsearCoordenada(evento.target.value);
    evento.target.classList.toggle('invalido', Number.isNaN(valor));
    if (!Number.isNaN(valor)) {
      cambios[campo] = valor;
    } else if (valor === null) {
      cambios[campo] = null;
    }
    if (changesExisten(cambios)) {
      pedidos.actualizarPedido(id, cambios);
    }
  } else {
    cambios[campo] = evento.target.value;
    pedidos.actualizarPedido(id, cambios);
  }
  storage.guardarPedidos(pedidos.obtenerPedidos());
  actualizarMapas({ conVista: false });
}

function changesExisten(cambios) {
  return Object.keys(cambios).length > 0;
}

function manejarClicEnTarjeta(contenedor, evento) {
  const boton = evento.target.closest('[data-accion]');
  if (!boton) {
    return;
  }
  const tarjeta = boton.closest('.pedido-card');
  if (!tarjeta) {
    return;
  }
  const id = tarjeta.dataset.id;
  const accion = boton.dataset.accion;

  if (accion === 'entregar') {
    pedidos.alternarEntregado(id);
    guardarYRenderizar();
  }

  if (accion === 'eliminar') {
    const pedidoObj = pedidos.obtenerPedidos().find((p) => p.id === id);
    if (!pedidoObj) {
      return;
    }
    if (window.confirm(`¿Eliminar el PEDIDO #${pedidoObj.numero}?`)) {
      pedidos.eliminarPedido(id);
      guardarYRenderizar();
    }
  }
}

function agregarNuevoPedido() {
  pedidos.agregarPedido();
  guardarYRenderizar();
}

function quitarUltimoPedido() {
  const lista = pedidos.obtenerPedidos();
  if (lista.length === 0) {
    return;
  }
  const ultimo = lista[lista.length - 1];
  const mensaje =
    lista.length === 1
      ? '¿Eliminar el único pedido?'
      : `¿Eliminar el PEDIDO #${ultimo.numero}?`;
  if (window.confirm(mensaje)) {
    pedidos.eliminarPedido(ultimo.id);
    guardarYRenderizar();
  }
}

function limpiarTodosLosPedidos() {
  if (pedidos.contarPedidos() === 0) {
    return;
  }
  if (window.confirm('¿Eliminar todos los pedidos? Esta acción no se puede deshacer.')) {
    pedidos.limpiarPedidos();
    storage.limpiarTodo();
    renderizarPedidos();
    actualizarMapas();
  }
}

function inicializarMapas() {
  const mapaInicio = map.initMapa('map');
  const mapaRuta = map.initMapa('map-ruta');

  if (mapaInicio) {
    setTimeout(() => mapaInicio.invalidateSize(), 0);
  }
  if (mapaRuta) {
    setTimeout(() => mapaRuta.invalidateSize(), 0);
  }
}

function mostrarEstadoGps(texto, clase) {
  const elemento = document.getElementById('gps-estado');
  if (!elemento) {
    return;
  }
  elemento.textContent = texto;
  elemento.className = `gps-estado${clase ? ` ${clase}` : ''}`;
}

async function solicitarUbicacion() {
  if (gpsEnCurso) {
    return;
  }

  const boton = document.getElementById('btn-usar-ubicacion');
  gpsEnCurso = true;
  if (boton) {
    boton.disabled = true;
  }
  mostrarEstadoGps('🔄 Solicitando permiso de ubicación…', 'cargando');

  try {
    const posicion = await gps.obtenerPosicion();
    miUbicacion = posicion;

    const precision =
      typeof posicion.accuracy === 'number'
        ? ` · precisión ${Math.round(posicion.accuracy)} m`
        : '';
    mostrarEstadoGps(
      `✅ Ubicación obtenida: ${posicion.latitude.toFixed(5)}, ${posicion.longitude.toFixed(5)}${precision}`,
      'ok'
    );

    map.mostrarUbicacionUsuario('map', posicion);
    map.mostrarUbicacionUsuario('map-ruta', posicion);
    actualizarMapas({ conVista: false });
  } catch (error) {
    mostrarEstadoGps(`⚠️ ${error.message}`, 'error');
  } finally {
    gpsEnCurso = false;
    if (boton) {
      boton.disabled = false;
    }
  }
}

function conectarControles() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => mostrarPaso(btn.dataset.paso));
  });

  const contenedor = document.getElementById('pedidosContainer');
  if (contenedor) {
    contenedor.addEventListener('click', (evento) => manejarClicEnTarjeta(contenedor, evento));
    contenedor.addEventListener('input', (evento) => manejarEntradaDeMapa(contenedor, evento));
    contenedor.addEventListener('change', (evento) => manejarCambioUbicacion(contenedor, evento));
  }

  document.getElementById('btn-restar').addEventListener('click', quitarUltimoPedido);
  document.getElementById('btn-sumar').addEventListener('click', agregarNuevoPedido);
  document.getElementById('btn-limpiar').addEventListener('click', limpiarTodosLosPedidos);

  document.getElementById('btn-usar-ubicacion').addEventListener('click', solicitarUbicacion);
}

function init() {
  const guardados = storage.cargarPedidos();
  pedidos.reemplazarPedidos(guardados);
  inicializarMapas();
  conectarControles();
  renderizarPedidos();
  actualizarMapas();
}

init();