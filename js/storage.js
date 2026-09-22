/* storage.js
 * Persistencia con localStorage: pedidos y opción de limpiar todo.
 * La ruta calculada se guardará cuando exista (Fase 7+).
 */

const CLAVE_PEDIDOS = 'rutadomicilios:pedidos';

function disponible() {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
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
  if (!disponible()) {
    return [];
  }
  try {
    const texto = localStorage.getItem(CLAVE_PEDIDOS);
    if (!texto) {
      return [];
    }
    const datos = JSON.parse(texto);
    return Array.isArray(datos) ? datos : [];
  } catch (error) {
    console.error('No se pudieron leer los pedidos guardados:', error);
    return [];
  }
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