// Codificador de deltas: recibe la lectura completa en cada tick y decide qué
// enviar. Es el mismo algoritmo que backend/delta.py, para que el navegador
// (fuente Coinbase directa o simulada) hable exactamente el mismo contrato que
// el servidor FastAPI.

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

  return {
    /** Siguiente mensaje para la lectura completa `readings`. */
    next(readings, { online = true } = {}) {
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
  };
}

function pick(readings) {
  const out = {};
  for (const field of READING_FIELDS) out[field] = readings[field] ?? null;
  return out;
}
