/* storage.js
 * Persistencia con localStorage: pedidos y opción de limpiar todo.
 * La ruta calculada se guardará cuando exista (Fase 7+).
 */

const CLAVE_PEDIDOS = 'rutadomicilios:pedidos';
const CLAVE_HISTORIAL = 'rutadomicilios:historial';

function disponible() {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function leerLista(clave) {
  if (!disponible()) {
    return [];
  }
  try {
    const texto = localStorage.getItem(clave);
    if (!texto) {
      return [];
    }
    const datos = JSON.parse(texto);
    return Array.isArray(datos) ? datos : [];
  } catch (error) {
    console.error(`No se pudo leer de localStorage (${clave}):`, error);
    return [];
  }
}

export function guardarPedidos(pedidos) {
  if (!disponible()) {
    return false;
  }
  try {
    localStorage.setItem(CLAVE_PEDIDOS, JSON.stringify(pedidos));
    return true;
  } catch (error) {
    console.error('No se pudo guardar en localStorage:', error);
    return false;
  }
}

export function cargarPedidos() {
  return leerLista(CLAVE_PEDIDOS);
}

export function guardarHistorial(entradas) {
  if (!disponible()) {
    return false;
  }
  try {
    localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(entradas));
    return true;
  } catch (error) {
    console.error('No se pudo guardar el historial en localStorage:', error);
    return false;
  }
}

export function cargarHistorial() {
  return leerLista(CLAVE_HISTORIAL);
}

export function limpiarTodo() {
  if (!disponible()) {
    return false;
  }
  try {
    localStorage.removeItem(CLAVE_PEDIDOS);
    return true;
  } catch (error) {
    console.error('No se pudo limpiar localStorage:', error);
    return false;
  }
}