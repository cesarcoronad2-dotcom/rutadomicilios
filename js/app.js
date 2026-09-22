/* app.js
 * Controlador principal. Coordina los módulos, gestiona la navegación
 * entre los 3 pasos y renderiza las tarjetas de pedidos.
 * GPS, parser de ubicaciones, OSRM y optimización llegan en fases
 * posteriores.
 */

import * as gps from './gps.js';
import * as pedidos from './pedidos.js';
import * as historial from './historial.js';
import * as ubicaciones from './ubicaciones.js';
import * as router from './router.js';
import * as optimizer from './optimizer.js';
import * as map from './map.js';
import * as storage from './storage.js';

// Posición actual del usuario como punto de partida de la ruta.
// Se guarda aquí (y también dentro de gps.js) para las siguientes fases.
let miUbicacion = null;
let gpsEnCurso = false;
let rutaActiva = null;
let calculoRutaEnCurso = null;

function mostrarPaso(nombrePaso) {
  document.querySelectorAll('.step').forEach((step) => {
    const activo = step.id === nombrePaso;
    step.classList.toggle('active', activo);
    step.classList.toggle('hidden', !activo);
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
  actualizarRuta();
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

  if (estaEntregado) {
    const btnVolver = document.createElement('button');
    btnVolver.type = 'button';
    btnVolver.className = 'btn btn-volver';
    btnVolver.textContent = '↩️ Volver a pendiente';
    btnVolver.dataset.accion = 'volver-pendiente';
    acciones.appendChild(btnVolver);

    const btnHistorial = document.createElement('button');
    btnHistorial.type = 'button';
    btnHistorial.className = 'btn btn-enviar-historial';
    btnHistorial.textContent = '📜 Enviar a historial';
    btnHistorial.dataset.accion = 'enviar-historial';
    acciones.appendChild(btnHistorial);
  } else {
    const btnEntregar = document.createElement('button');
    btnEntregar.type = 'button';
    btnEntregar.className = 'btn btn-entregar';
    btnEntregar.textContent = '✓ Marcar como entregado';
    btnEntregar.dataset.accion = 'completar';
    acciones.appendChild(btnEntregar);
  }

  const btnEliminar = document.createElement('button');
  btnEliminar.type = 'button';
  btnEliminar.className = 'btn btn-eliminar';
  btnEliminar.textContent = '🗑️';
  btnEliminar.title = 'Eliminar pedido';
  btnEliminar.dataset.accion = 'eliminar';
  acciones.appendChild(btnEliminar);

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
  if (!entrada.dataset || !entrada.dataset.campo) {
    return;
  }
  const tarjeta = entrada.closest('.pedido-card');
  if (!tarjeta) {
    return;
  }
  const id = tarjeta.dataset.id;
  const campo = entrada.dataset.campo;

  if (campo === 'ubicacionOriginal') {
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

    const actualizado = pedidos.actualizarPedido(id, cambios);
    if (actualizado) {
      storage.guardarPedidos(pedidos.obtenerPedidos());
      actualizarEstadoUbicacion(tarjeta, actualizado, texto ? resultado.mensaje : undefined);
      actualizarMapas();
      actualizarRuta();
    }
    return;
  }

  if (campo === 'latitud' || campo === 'longitud') {
    actualizarRuta();
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

  if (accion === 'completar') {
    pedidos.actualizarPedido(id, { estado: pedidos.ESTADO.ENTREGADO });
    guardarYRenderizar();
  }

  if (accion === 'volver-pendiente') {
    pedidos.actualizarPedido(id, { estado: pedidos.ESTADO.PENDIENTE });
    guardarYRenderizar();
  }

  if (accion === 'enviar-historial') {
    const pedidoObj = pedidos.obtenerPedidos().find((p) => p.id === id);
    if (!pedidoObj) {
      return;
    }
    if (!window.confirm(`¿Enviar el PEDIDO #${pedidoObj.numero} al historial?`)) {
      return;
    }
    historial.agregarDelPedido(pedidoObj);
    pedidos.eliminarPedido(id);
    storage.guardarPedidos(pedidos.obtenerPedidos());
    renderizarPedidos();
    actualizarMapas();
    actualizarRuta();
    renderizarHistorial();
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
    actualizarRuta();
  }
}

/* ------------------------------ Ruta ------------------------------ */

function formatearDistancia(metros) {
  if (typeof metros !== 'number' || !Number.isFinite(metros) || metros < 0) {
    return '—';
  }
  if (metros < 1000) {
    return `${Math.round(metros)} m`;
  }
  return `${(metros / 1000).toFixed(1)} km`;
}

function formatearTiempo(segundos) {
  if (typeof segundos !== 'number' || !Number.isFinite(segundos) || segundos < 0) {
    return '—';
  }
  if (segundos < 60) {
    return `${Math.round(segundos)} s`;
  }
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) {
    return `${minutos} min`;
  }
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto > 0 ? `${horas} h ${resto} min` : `${horas} h`;
}

function pedidosPendientesConUbicacion() {
  return pedidos
    .obtenerPedidos()
    .filter((p) => {
      const pendiente = !p.estado || p.estado === pedidos.ESTADO.PENDIENTE;
      return (
        pendiente &&
        typeof p.latitud === 'number' &&
        typeof p.longitud === 'number' &&
        Number.isFinite(p.latitud) &&
        Number.isFinite(p.longitud)
      );
    });
}

function estadoDeRuta(mensaje) {
  const elemento = document.getElementById('ruta-estado');
  if (elemento) {
    elemento.textContent = mensaje || '';
  }
}

function restablecerResumenRuta() {
  rutaActiva = null;
  ['ruta-distancia', 'ruta-tiempo', 'ruta-pedidos'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = '—';
    }
  });
  const navegacion = document.getElementById('btn-navegacion');
  if (navegacion) {
    navegacion.disabled = true;
  }
}

/**
 * Calcula y dibuja la ruta desde el GPS guardado pasando por los
 * pedidos pendientes. Cancela cualquier cálculo anterior en curso.
 */
async function actualizarRuta() {
  if (calculoRutaEnCurso) {
    calculoRutaEnCurso.abort();
  }
  const controlador = new AbortController();
  calculoRutaEnCurso = controlador;

  restablecerResumenRuta();

  const btnRecalcular = document.getElementById('btn-recalcular');
  if (btnRecalcular) {
    btnRecalcular.disabled = true;
  }

  try {
    const posicion = gps.obtenerPosicionGuardada();
    const pendientes = pedidosPendientesConUbicacion();

    if (!posicion) {
      estadoDeRuta('📍 Activa tu ubicación para calcular la ruta desde donde estás.');
      map.limpiarRutaEnMapa();
      return;
    }

    if (pendientes.length === 0) {
      estadoDeRuta('📦 Sin pedidos pendientes con ubicación. La ruta se calcula sola al agregarlos.');
      map.limpiarRutaEnMapa();
      return;
    }

    estadoDeRuta('🔄 Calculando la ruta más eficiente…');

    const matriz = await router.calcularMatriz({ posicion, pedidos: pendientes });
    if (controlador.signal.aborted) {
      return;
    }

    if (!matriz.ok) {
      estadoDeRuta(`⚠️ ${matriz.mensaje || 'No se pudo calcular la matriz de tiempos.'}`);
      return;
    }

    const orden = optimizer.calcularOrden({ puntos: matriz.puntos, matriz });
    const puntosOrdenados = orden.map((indice) => matriz.puntos[indice]);

    const ruta = await router.obtenerRuta(puntosOrdenados);
    if (controlador.signal.aborted) {
      return;
    }

    if (!ruta.ok) {
      estadoDeRuta(`⚠️ ${ruta.mensaje || ruta.error || 'No se pudo calcular la ruta.'}`);
      return;
    }

    if (ruta.geometria && ruta.geometria.length >= 2) {
      map.mostrarRutaEnMapa('map', ruta.geometria);
      map.mostrarRutaEnMapa('map-ruta', ruta.geometria);
    }

    rutaActiva = { posicion, puntosOrdenados };

    const elDistancia = document.getElementById('ruta-distancia');
    const elTiempo = document.getElementById('ruta-tiempo');
    const elPedidos = document.getElementById('ruta-pedidos');
    if (elDistancia) {
      elDistancia.textContent = formatearDistancia(ruta.distancia);
    }
    if (elTiempo) {
      elTiempo.textContent = formatearTiempo(ruta.duracion);
    }
    if (elPedidos) {
      elPedidos.textContent = String(pendientes.length);
    }

    const navegacion = document.getElementById('btn-navegacion');
    if (navegacion) {
      navegacion.disabled = false;
    }

    estadoDeRuta(
      ruta.esDistanciaPorCarretera
        ? '✅ Distancia por carretera.'
        : '⚠️ Sin datos de carretera: ruta en línea recta (usa Recalcular para reintentar).'
    );
  } catch (error) {
    if (!controlador.signal.aborted) {
      estadoDeRuta('⚠️ No se pudo calcular la ruta. Usa "Recalcular ruta" para reintentar.');
    }
  } finally {
    if (btnRecalcular) {
      btnRecalcular.disabled = false;
    }
  }
}

function abrirNavegacion() {
  if (!rutaActiva) {
    estadoDeRuta('📍 Establece tu ubicación y recalcula la ruta para poder abrir la navegación.');
    return;
  }
  const pendientes = rutaActiva.puntosOrdenados.filter((p) => p.tipo === 'pedido');
  if (pendientes.length === 0) {
    return;
  }
  const posicion = rutaActiva.posicion;
  const origin = `${posicion.latitude},${posicion.longitude}`;
  const destino = `${pendientes[pendientes.length - 1].lat},${pendientes[pendientes.length - 1].lon}`;
  const intermedios = pendientes
    .slice(0, -1)
    .map((p) => `${p.lat},${p.lon}`)
    .join('|');
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destino}`;
  if (intermedios) {
    url += `&waypoints=${intermedios}`;
  }
  window.open(url, '_blank', 'noopener');
}

/* ------------------------------ Historial ------------------------------ */

function crearElementoHistorial(entrada) {
  const tarjeta = document.createElement('article');
  tarjeta.className = 'historial-card';
  tarjeta.dataset.id = entrada.id;

  const header = document.createElement('header');
  header.className = 'historial-header';

  const titulo = document.createElement('span');
  titulo.className = 'historial-titulo';
  titulo.textContent = entrada.numero ? `📦 Domicilio #${entrada.numero}` : '📦 Domicilio realizado';
  header.appendChild(titulo);

  const badge = document.createElement('span');
  badge.className = 'badge badge-entregado';
  badge.textContent = 'ENTREGADO';
  header.appendChild(badge);

  tarjeta.appendChild(header);

  if (entrada.descripcion) {
    const descripcion = document.createElement('p');
    descripcion.className = 'historial-descripcion';
    descripcion.textContent = entrada.descripcion;
    tarjeta.appendChild(descripcion);
  }

  const meta = document.createElement('div');
  meta.className = 'historial-meta';

  const chipFecha = document.createElement('span');
  chipFecha.className = 'historial-chip';
  chipFecha.textContent = `📅 ${entrada.fecha}`;
  meta.appendChild(chipFecha);

  const chipHora = document.createElement('span');
  chipHora.className = 'historial-chip';
  chipHora.textContent = `🕒 ${entrada.hora}`;
  meta.appendChild(chipHora);

  tarjeta.appendChild(meta);

  if (entrada.ubicacionOriginal) {
    const ubicacion = document.createElement('p');
    ubicacion.className = 'historial-ubicacion';
    ubicacion.textContent = entrada.ubicacionOriginal;
    tarjeta.appendChild(ubicacion);
  }

  if (typeof entrada.latitud === 'number' && typeof entrada.longitud === 'number') {
    const coords = document.createElement('p');
    coords.className = 'historial-coords';
    coords.textContent = `🌐 ${ubicaciones.formatearCoordenadas(entrada.latitud, entrada.longitud)}`;
    tarjeta.appendChild(coords);
  }

  const acciones = document.createElement('div');
  acciones.className = 'historial-actions';

  const btnEliminar = document.createElement('button');
  btnEliminar.type = 'button';
  btnEliminar.className = 'btn btn-eliminar';
  btnEliminar.textContent = '🗑️ Eliminar del historial';
  btnEliminar.dataset.accion = 'eliminar-historial';
  acciones.appendChild(btnEliminar);

  tarjeta.appendChild(acciones);
  return tarjeta;
}

function actualizarEstadoHistorialVacio() {
  const entradaCount = historial.contarHistorial();
  const vacio = document.getElementById('historial-vacio');
  if (vacio) {
    vacio.classList.toggle('hidden', entradaCount > 0);
  }
  const limpiar = document.getElementById('btn-limpiar-historial');
  if (limpiar) {
    limpiar.disabled = entradaCount === 0;
  }
}

function renderizarHistorial() {
  const contenedor = document.getElementById('historialContainer');
  if (!contenedor) {
    return;
  }
  contenedor.replaceChildren();
  historial.obtenerHistorial().forEach((entrada) => {
    contenedor.appendChild(crearElementoHistorial(entrada));
  });
  actualizarEstadoHistorialVacio();
}

function manejarClicEnHistorial(evento) {
  const boton = evento.target.closest('[data-accion]');
  if (!boton) {
    return;
  }
  const tarjeta = boton.closest('.historial-card');
  if (!tarjeta) {
    return;
  }
  const accion = boton.dataset.accion;
  const id = tarjeta.dataset.id;

  if (accion === 'eliminar-historial') {
    if (window.confirm('¿Eliminar este domicilio del historial?')) {
      historial.eliminarEntrada(id);
      renderizarHistorial();
    }
  }
}

function limpiarHistorialCompleto() {
  if (historial.contarHistorial() === 0) {
    return;
  }
  if (window.confirm('¿Borrar todo el historial de domicilios? Esta acción no se puede deshacer.')) {
    historial.limpiarHistorial();
    renderizarHistorial();
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
    actualizarRuta();
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

  const contenedorHistorial = document.getElementById('historialContainer');
  if (contenedorHistorial) {
    contenedorHistorial.addEventListener('click', manejarClicEnHistorial);
  }

  document.getElementById('btn-restar').addEventListener('click', quitarUltimoPedido);
  document.getElementById('btn-sumar').addEventListener('click', agregarNuevoPedido);
  document.getElementById('btn-limpiar').addEventListener('click', limpiarTodosLosPedidos);
  document.getElementById('btn-limpiar-historial').addEventListener('click', limpiarHistorialCompleto);

  document.getElementById('btn-usar-ubicacion').addEventListener('click', solicitarUbicacion);
  document.getElementById('btn-recalcular').addEventListener('click', actualizarRuta);
  document.getElementById('btn-navegacion').addEventListener('click', abrirNavegacion);
}

function init() {
  const guardados = storage.cargarPedidos();
  pedidos.reemplazarPedidos(guardados);
  historial.reemplazarHistorial(storage.cargarHistorial());
  inicializarMapas();
  conectarControles();
  renderizarPedidos();
  renderizarHistorial();
  actualizarMapas();
  actualizarRuta();
}

init();