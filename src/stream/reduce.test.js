import { describe, expect, it } from 'vitest';
import { applyFrame } from './reduce.js';

const snap = (sequence, readings) => ({ kind: 'snapshot', market: 'BTC-USD', source: 'test', online: true, sequence, timestamp: 't', readings });
const delta = (sequence, patch) => ({ kind: 'delta', market: 'BTC-USD', source: 'test', online: true, sequence, timestamp: 't', patch });

describe('applyFrame', () => {
  it('una instantánea sustituye la trama entera', () => {
    const { frame, accepted } = applyFrame(null, snap(1, { price: 100, bid: 99 }));
    expect(accepted).toBe(true);
    expect(frame).toMatchObject({ sequence: 1, readings: { price: 100, bid: 99 } });
    expect(frame.kind).toBeUndefined();
  });

  it('un delta consecutivo mezcla solo lo que cambia', () => {
    const base = applyFrame(null, snap(1, { price: 100, bid: 99 })).frame;
    const { frame, accepted } = applyFrame(base, delta(2, { price: 101 }));
    expect(accepted).toBe(true);
    expect(frame.readings).toEqual({ price: 101, bid: 99 });
    expect(frame.sequence).toBe(2);
  });

  it('un delta vacío avanza la secuencia sin tocar los datos', () => {
    const base = applyFrame(null, snap(1, { price: 100 })).frame;
    const { frame } = applyFrame(base, delta(2, {}));
    expect(frame.sequence).toBe(2);
    expect(frame.readings).toEqual({ price: 100 });
  });

  it('con un hueco en la secuencia se rechaza y se queda la última trama buena', () => {
    const base = applyFrame(null, snap(1, { price: 100 })).frame;
    const { frame, accepted, reason } = applyFrame(base, delta(3, { price: 999 }));
    expect(accepted).toBe(false);
    expect(reason).toBe('gap');
    expect(frame).toBe(base);
  });

  it('un delta repetido o antiguo también se rechaza', () => {
    const base = applyFrame(applyFrame(null, snap(1, { price: 100 })).frame, delta(2, { price: 101 })).frame;
    expect(applyFrame(base, delta(2, { price: 50 })).accepted).toBe(false);
    expect(applyFrame(base, delta(1, { price: 50 })).accepted).toBe(false);
  });

  it('un delta sin instantánea previa no se puede aplicar', () => {
    expect(applyFrame(null, delta(1, { price: 1 }))).toEqual({ frame: null, accepted: false, reason: 'no-base' });
  });

  it('la siguiente instantánea cura el hueco', () => {
    const base = applyFrame(null, snap(1, { price: 100 })).frame;
    const after = applyFrame(base, snap(8, { price: 105, bid: 104 }));
    expect(after.accepted).toBe(true);
    expect(after.frame).toMatchObject({ sequence: 8, readings: { price: 105, bid: 104 } });
  });

  it('una trama antigua sin kind se trata como instantánea', () => {
    const { frame, accepted } = applyFrame(null, { sequence: 4, readings: { price: 7 } });
    expect(accepted).toBe(true);
    expect(frame.readings.price).toBe(7);
  });

  it('lo que no es una trama se ignora', () => {
    expect(applyFrame(null, null).accepted).toBe(false);
    expect(applyFrame(null, { kind: 'delta' }).reason).toBe('invalid');
    expect(applyFrame(null, { kind: 'otro', sequence: 1 }).reason).toBe('invalid');
  });
});
