// Codificador de deltas: recibe cada lectura completa del exchange y decide si
// hay que enviar algo. Solo se envía cuando CAMBIA LA COTIZACIÓN (el precio):
// si llega un tick con el mismo precio, no sale nada por el socket.
//
// El primer mensaje es una instantánea completa; después, deltas con solo los
// campos que han cambiado desde el último envío. Cada KEYFRAME_EVERY mensajes
// va otra instantánea para curar a quien haya perdido un delta.
//
// Es el mismo algoritmo que backend/delta.py, para que el navegador (fuente
// Coinbase directa o simulada) hable el mismo contrato que el servidor FastAPI.

import { KEYFRAME_EVERY, READING_FIELDS } from './contract.js';

/** Lo que ha cambiado de `prev` a `next` (solo campos del contrato). */
export function diffReadings(prev, next) {
  const patch = {};
  for (const field of READING_FIELDS) {
    if (next[field] === undefined) continue;
    if (!prev || !Object.is(prev[field], next[field])) patch[field] = next[field];
  }
  return patch;
}

/**
 * @param {{ market: string, source: string, keyframeEvery?: number, now?: () => number }} options
 */
export function createDeltaEncoder({ market, source, keyframeEvery = KEYFRAME_EVERY, now = Date.now }) {
  let sequence = 0;
  let last = null;
  let skipped = 0;

  return {
    /** Mensaje para la lectura `readings`, o null si la cotización no ha cambiado. */
    next(readings, { online = true } = {}) {
      if (last !== null && Object.is(last.price, readings.price ?? null)) {
        skipped += 1;
        return null;
      }
      sequence += 1;
      const base = { market, source, online, sequence, timestamp: new Date(now()).toISOString() };
      const keyframe = last === null || sequence % keyframeEvery === 0;
      const message = keyframe
        ? { kind: 'snapshot', ...base, readings: pick(readings) }
        : { kind: 'delta', ...base, patch: diffReadings(last, readings) };
      last = pick(readings);
      return message;
    },
    get sequence() {
      return sequence;
    },
    /** Ticks que llegaron sin cambio de precio y no se enviaron. */
    get skipped() {
      return skipped;
    },
  };
}

function pick(readings) {
  const out = {};
  for (const field of READING_FIELDS) out[field] = readings[field] ?? null;
  return out;
}
