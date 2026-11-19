// Plegado de tramas: aplica cada mensaje del flujo sobre la última trama buena.
//
// - Una instantánea (o una trama antigua sin `kind`) sustituye a la anterior.
// - Un delta solo se acepta si su secuencia es exactamente la anterior + 1:
//   se mezcla su `patch` con las lecturas que ya había (lo que no cambia se queda).
// - Cualquier otro delta (hueco, repetido o desordenado) se rechaza y se queda
//   la última trama buena: no se inventan valores. La siguiente instantánea cura.

/**
 * @param {object|null} prev última trama buena (o null al empezar)
 * @param {object} msg mensaje recibido
 * @returns {{ frame: object|null, accepted: boolean, reason?: 'gap'|'no-base'|'invalid' }}
 */
export function applyFrame(prev, msg) {
  if (!msg || typeof msg !== 'object' || typeof msg.sequence !== 'number') {
    return { frame: prev, accepted: false, reason: 'invalid' };
  }
  if (msg.kind === 'snapshot' || msg.kind === undefined) {
    const { kind: _kind, patch: _patch, ...rest } = msg;
    return { frame: { ...rest, readings: { ...(msg.readings ?? {}) } }, accepted: true };
  }
  if (msg.kind === 'delta') {
    if (!prev) return { frame: prev, accepted: false, reason: 'no-base' };
    if (msg.sequence !== prev.sequence + 1) return { frame: prev, accepted: false, reason: 'gap' };
    return {
      frame: {
        ...prev,
        sequence: msg.sequence,
        timestamp: msg.timestamp ?? prev.timestamp,
        online: msg.online ?? prev.online,
        source: msg.source ?? prev.source,
        readings: { ...prev.readings, ...(msg.patch ?? {}) },
      },
      accepted: true,
    };
  }
  return { frame: prev, accepted: false, reason: 'invalid' };
}
