import { describe, expect, it } from 'vitest';
import { createDeltaEncoder, diffReadings } from './deltaEncoder.js';
import { applyFrame } from './reduce.js';
import { readingsFromCoinbase } from './sources.js';

const r = (price, extra = {}) => ({ price, bid: price - 1, ask: price + 1, open24h: 90, high24h: 110, low24h: 80, volume24h: 5, ...extra });

describe('createDeltaEncoder', () => {
  it('empieza con una instantánea completa y sigue con deltas', () => {
    const enc = createDeltaEncoder({ market: 'BTC-USD', source: 'test', now: () => 0 });
    const first = enc.next(r(100));
    expect(first).toMatchObject({ kind: 'snapshot', sequence: 1, market: 'BTC-USD', source: 'test', online: true });
    expect(first.readings.price).toBe(100);
    const second = enc.next(r(101));
    expect(second).toMatchObject({ kind: 'delta', sequence: 2, patch: { price: 101, bid: 100, ask: 102 } });
  });

  it('si nada cambia, el delta va vacío pero la secuencia avanza', () => {
    const enc = createDeltaEncoder({ market: 'BTC-USD', source: 'test' });
    enc.next(r(100));
    const same = enc.next(r(100));
    expect(same.kind).toBe('delta');
    expect(same.patch).toEqual({});
    expect(same.sequence).toBe(2);
  });

  it('cada 8 ticks manda una instantánea de nuevo', () => {
    const enc = createDeltaEncoder({ market: 'BTC-USD', source: 'test' });
    const kinds = Array.from({ length: 17 }, (_, i) => enc.next(r(100 + i)).kind);
    expect(kinds[0]).toBe('snapshot');
    expect(kinds[7]).toBe('snapshot'); // secuencia 8
    expect(kinds[15]).toBe('snapshot'); // secuencia 16
    expect(kinds.filter((k) => k === 'snapshot')).toHaveLength(3);
  });

  it('plegando sus mensajes se reconstruye exactamente la lectura', () => {
    const enc = createDeltaEncoder({ market: 'BTC-USD', source: 'test' });
    let frame = null;
    let last;
    for (let i = 0; i < 30; i += 1) {
      last = r(100 + Math.round(Math.sin(i) * 10), { volume24h: 5 + i * 0.1 });
      frame = applyFrame(frame, enc.next(last)).frame;
    }
    expect(frame.readings).toEqual(last);
    expect(frame.sequence).toBe(30);
  });
});

describe('diffReadings', () => {
  it('solo devuelve los campos del contrato que cambian', () => {
    expect(diffReadings(r(100), r(100, { volume24h: 6, extra: 1 }))).toEqual({ volume24h: 6 });
  });
});

describe('readingsFromCoinbase', () => {
  it('convierte un ticker de Coinbase en una lectura del contrato', () => {
    const ticker = {
      type: 'ticker',
      product_id: 'BTC-USD',
      price: '96512.34',
      best_bid: '96512.33',
      best_ask: '96512.35',
      open_24h: '95000.00',
      high_24h: '97000.10',
      low_24h: '94321.00',
      volume_24h: '8123.456',
    };
    expect(readingsFromCoinbase(ticker)).toEqual({
      price: 96512.34,
      bid: 96512.33,
      ask: 96512.35,
      open24h: 95000,
      high24h: 97000.1,
      low24h: 94321,
      volume24h: 8123.456,
    });
  });
});
