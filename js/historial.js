/* historial.js
 * Domicilios ya realizados. Las entradas se crean a partir de pedidos
 * entregados que el usuario decide enviar aquí ("Enviar a historial"):
 * el pedido deja de estar pendiente y queda archivado con descripción,
 * ubicación original, coordenadas, fecha, hora y estado de la entrega.
 */

import * as storage from './storage.js';

const ESTADO_ENTREGA = {
  ENTREGADO: 'entregado',
};

let historial = [];

function generarId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `historial-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function formatearFecha(timestamp) {
  return new Date(timestamp).toLocaleDateString('es', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatearHora(timestamp) {
  return new Date(timestamp).toLocaleTimeString('es', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizarEntrada(datos) {
  const timestamp =
    typeof datos.timestamp === 'number' && Number.isFinite(datos.timestamp)
      ? datos.timestamp
      : Date.now();
  return {
    id: datos.id || generarId(),
    numero: typeof datos.numero === 'number' ? datos.numero : null,
    descripcion: datos.descripcion || '',
    ubicacionOriginal: datos.ubicacionOriginal || '',
    latitud:
      typeof datos.latitud === 'number' && Number.isFinite(datos.latitud) ? datos.latitud : null,
    longitud:
      typeof datos.longitud === 'number' && Number.isFinite(datos.longitud) ? datos.longitud : null,
    estado: datos.estado === ESTADO_ENTREGA.ENTREGADO ? ESTADO_ENTREGA.ENTREGADO : ESTADO_ENTREGA.ENTREGADO,
    fecha: datos.fecha || formatearFecha(timestamp),
    hora: datos.hora || formatearHora(timestamp),
    timestamp,
  };
}

/**
 * Archiva un pedido entregado en el historial.
 * @param {object} pedido Pedido con descripción, ubicación y coordenadas.
 * @param {object} [opciones] { timestamp }
 * @returns {object} Entrada de historial creada.
 */
export function agregarDelPedido(pedido, opciones = {}) {
  const timestamp =
    typeof opciones.timestamp === 'number' && Number.isFinite(opciones.timestamp)
      ? opciones.timestamp
      : Date.now();
  const entrada = normalizarEntrada({
    id: generarId(),
    numero: typeof pedido.numero === 'number' ? pedido.numero : null,
    descripcion: pedido.descripcion || '',
    ubicacionOriginal: pedido.ubicacionOriginal || '',
    latitud: typeof pedido.latitud === 'number' ? pedido.latitud : null,
    longitud: typeof pedido.longitud === 'number' ? pedido.longitud : null,
    estado: ESTADO_ENTREGA.ENTREGADO,
    timestamp,
  });
  historial.push(entrada);
  storage.guardarHistorial(historial);
  return entrada;
}

export function reemplazarHistorial(lista) {
  historial = Array.isArray(lista)
    ? lista.filter((p) => p && typeof p === 'object').map(normalizarEntrada)
    : [];
  return historial;
}

export function obtenerHistorial() {
  return historial;
}

export function contarHistorial() {
  return historial.length;
}

export function eliminarEntrada(id) {
  const indice = historial.findIndex((p) => p.id === id);
  if (indice === -1) {
    return false;
  }
  historial.splice(indice, 1);
  storage.guardarHistorial(historial);
  return true;
}

export function limpiarHistorial() {
  historial = [];
  storage.guardarHistorial(historial);
  return true;
}