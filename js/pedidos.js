/* pedidos.js
 * Administración de pedidos: creación, edición, eliminación, estados
 * y numeración secuencial. La ubicación se asigna más adelante desde
 * ubicaciones.js (parser de WhatsApp/Google Maps).
 */

export const ESTADO = {
  PENDIENTE: 'pendiente',
  ENTREGADO: 'entregado',
};

let pedidos = [];
let contadorIds = 1;

function generarId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `pedido-${Date.now()}-${contadorIds++}`;
}

function normalizarPedido(datos) {
  return {
    id: datos.id || generarId(),
    numero: typeof datos.numero === 'number' ? datos.numero : 1,
    descripcion: datos.descripcion || '',
    estado: datos.estado === ESTADO.ENTREGADO ? ESTADO.ENTREGADO : ESTADO.PENDIENTE,
    latitud: typeof datos.latitud === 'number' && Number.isFinite(datos.latitud) ? datos.latitud : null,
    longitud: typeof datos.longitud === 'number' && Number.isFinite(datos.longitud) ? datos.longitud : null,
    ubicacionOriginal: datos.ubicacionOriginal || '',
  };
}

function sincronizarNumeros() {
  pedidos.forEach((pedido, indice) => {
    pedido.numero = indice + 1;
  });
}

export function crearPedido(datos = {}) {
  return normalizarPedido(datos);
}

export function reemplazarPedidos(lista) {
  pedidos = Array.isArray(lista)
    ? lista.filter((p) => p && typeof p === 'object').map(normalizarPedido)
    : [];
  sincronizarNumeros();
  return pedidos;
}

export function obtenerPedidos() {
  return pedidos;
}

export function contarPedidos() {
  return pedidos.length;
}

export function agregarPedido(datos = {}) {
  const pedido = normalizarPedido(datos);
  pedidos.push(pedido);
  sincronizarNumeros();
  return pedido;
}

export function actualizarPedido(id, cambios = {}) {
  const pedido = pedidos.find((p) => p.id === id);
  if (!pedido) {
    return null;
  }
  if (typeof cambios.descripcion === 'string') {
    pedido.descripcion = cambios.descripcion;
  }
  if (typeof cambios.ubicacionOriginal === 'string') {
    pedido.ubicacionOriginal = cambios.ubicacionOriginal;
  }
  if (cambios.latitud === null || typeof cambios.latitud === 'number') {
    pedido.latitud = cambios.latitud ?? null;
  }
  if (cambios.longitud === null || typeof cambios.longitud === 'number') {
    pedido.longitud = cambios.longitud ?? null;
  }
  if (cambios.estado === ESTADO.PENDIENTE || cambios.estado === ESTADO.ENTREGADO) {
    pedido.estado = cambios.estado;
  }
  return pedido;
}

export function eliminarPedido(id) {
  const indice = pedidos.findIndex((p) => p.id === id);
  if (indice === -1) {
    return false;
  }
  pedidos.splice(indice, 1);
  sincronizarNumeros();
  return true;
}

export function alternarEntregado(id) {
  const pedido = pedidos.find((p) => p.id === id);
  if (!pedido) {
    return null;
  }
  pedido.estado = pedido.estado === ESTADO.ENTREGADO ? ESTADO.PENDIENTE : ESTADO.ENTREGADO;
  return pedido;
}

export function limpiarPedidos() {
  pedidos = [];
  return true;
}