/* optimizer.js
 * Calcula el orden de visita eficiente a partir de la matriz de
 * tiempos/distancias. Heurística del vecino más cercano sobre las
 * duraciones, comenzando en el origen (punto 0). Suficiente para
 * decenas de pedidos; mejorable con 2-opt en fases posteriores.
 */

import { prepararPuntos, haversineMetros } from './router.js';

const VELOCIDAD_REFERENCIA_KMH = 40;

function costoHaversineSegundos(a, b) {
  if (!a || !b) return Infinity;
  const d = haversineMetros(a.lat, a.lon, b.lat, b.lon);
  const vm = VELOCIDAD_REFERENCIA_KMH / 3.6;
  return vm > 0 ? d / vm : d;
}

function matrizValida(matriz) {
  return (
    matriz &&
    Array.isArray(matriz.durations) &&
    matriz.durations.length > 0
  );
}

/**
 * Devuelve el orden óptimo (heurístico) de visita: índices sobre
 * `matriz.puntos`, arrancando siempre por el origen (índice 0).
 * @param {{puntos: Array<object>, durations: Array<Array<number>>}} matriz
 * @returns {Array<number>} Orden de índices partiendo de 0.
 */
export function calcularOrden({ puntos, matriz }) {
  if (!Array.isArray(puntos) || !matrizValida(matriz)) {
    return [0];
  }

  const n = puntos.length;
  if (n <= 1) {
    return [0];
  }

  const duracion = matriz.durations;
  const visitados = new Uint8Array(n);
  const orden = [0];
  visitados[0] = 1;

  while (orden.length < n) {
    const actual = orden[orden.length - 1];
    let mejor = -1;
    let menorCosto = Infinity;
    const fila = duracion[actual];

    for (let i = 0; i < n; i++) {
      if (visitados[i]) {
        continue;
      }
      const filaValor = Array.isArray(fila) ? fila[i] : undefined;
      const costo =
        typeof filaValor === 'number' && filaValor >= 0
          ? filaValor
          : costoHaversineSegundos(puntos[actual], puntos[i]);
      if (costo < menorCosto) {
        menorCosto = costo;
        mejor = i;
      }
    }

    if (mejor === -1) {
      break;
    }
    visitados[mejor] = 1;
    orden.push(mejor);
  }

  return orden;
}

/**
 * Conveniencia: puntos ordenados ya resueltos a partir de pedidos y GPS.
 * @param {{posicion: object, pedidos: Array<object>, matriz: object}} params
 * @returns {{puntos: Array<object>, orden: Array<number>}}
 */
export function ordenarPuntos({ posicion, pedidos, matriz }) {
  const puntos = prepararPuntos({ posicion, pedidos });
  const orden = calcularOrden({ puntos, matriz });
  return { puntos, orden };
}