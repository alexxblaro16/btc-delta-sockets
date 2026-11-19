import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeltaEncoder } from './deltaEncoder.js';
import { SOURCES } from './sources.js';
import { backoffDelay, useDeltaStream } from './useDeltaStream.js';

// Fuente de prueba: el test decide cuándo abre, qué llega y cuándo se cae.
function fakeSource() {
  const fake = { opened: 0, closed: 0, current: null };
  SOURCES.fake = {
    id: 'fake',
    open(handlers) {
      fake.opened += 1;
      fake.current = handlers;
      return {
        close() {
          fake.closed += 1;
        },
        drop() {
          handlers.onClose();
        },
      };
    },
  };
  return fake;
}

const reading = (price) => ({ price, bid: price - 1, ask: price + 1, open24h: 100, high24h: 120, low24h: 90, volume24h: 1 });

describe('backoffDelay', () => {
  it('dobla la espera en cada intento con un tope de 15 s', () => {
    const mid = () => 0.5; // sin jitter
    expect([0, 1, 2, 3, 4, 5, 9].map((a) => backoffDelay(a, mid))).toEqual([1000, 2000, 4000, 8000, 15000, 15000, 15000]);
  });
  it('el jitter mueve la espera como mucho un 20 %', () => {
    expect(backoffDelay(1, () => 0)).toBe(1600);
    expect(backoffDelay(1, () => 1)).toBe(2400);
  });
});

describe('useDeltaStream', () => {
  let fake;
  beforeEach(() => {
    vi.useFakeTimers();
    fake = fakeSource();
  });
  afterEach(() => {
    delete SOURCES.fake;
    vi.useRealTimers();
  });

  it('pliega instantánea y deltas y queda en directo', () => {
    const { result } = renderHook(() => useDeltaStream({ source: 'fake', market: 'BTC-USD' }));
    const enc = createDeltaEncoder({ market: 'BTC-USD', source: 'fake' });
    act(() => {
      fake.current.onOpen();
      fake.current.onMessage(enc.next(reading(100)));
      fake.current.onMessage(enc.next(reading(101)));
    });
    expect(result.current.status).toBe('live');
    expect(result.current.frame.readings.price).toBe(101);
    expect(result.current.stats).toMatchObject({ messages: 2, snapshots: 1, deltas: 1 });
    expect(result.current.changed).toEqual(expect.arrayContaining(['price', 'bid', 'ask']));
  });

  it('avisa si la cotización lleva demasiado sin cambiar (15 s), pero no antes', () => {
    const { result } = renderHook(() => useDeltaStream({ source: 'fake', market: 'BTC-USD' }));
    const enc = createDeltaEncoder({ market: 'BTC-USD', source: 'fake' });
    act(() => {
      fake.current.onOpen();
      fake.current.onMessage(enc.next(reading(100)));
    });
    act(() => vi.advanceTimersByTime(10000));
    expect(result.current.status).toBe('live'); // un mercado quieto unos segundos no es un fallo
    act(() => vi.advanceTimersByTime(6000));
    expect(result.current.status).toBe('stale');
    expect(result.current.frame.readings.price).toBe(100); // la última trama buena sigue
  });

  it('si se cae, reconecta solo con espera creciente y conserva la última trama', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { result } = renderHook(() => useDeltaStream({ source: 'fake', market: 'BTC-USD' }));
    const enc = createDeltaEncoder({ market: 'BTC-USD', source: 'fake' });
    act(() => {
      fake.current.onOpen();
      fake.current.onMessage(enc.next(reading(100)));
    });
    act(() => fake.current.onClose());
    expect(result.current.status).toBe('reconnecting');
    expect(result.current.frame.readings.price).toBe(100);
    expect(fake.opened).toBe(1);
    act(() => vi.advanceTimersByTime(999));
    expect(fake.opened).toBe(1);
    act(() => vi.advanceTimersByTime(1));
    expect(fake.opened).toBe(2);
    // Sigue caída: la segunda espera es el doble.
    act(() => fake.current.onClose());
    act(() => vi.advanceTimersByTime(1999));
    expect(fake.opened).toBe(2);
    act(() => vi.advanceTimersByTime(1));
    expect(fake.opened).toBe(3);
    act(() => fake.current.onOpen());
    expect(result.current.status).toBe('live');
    expect(result.current.stats.reconnects).toBe(2);
  });

  it('un delta perdido deja un hueco que la siguiente instantánea cura', () => {
    const { result } = renderHook(() => useDeltaStream({ source: 'fake', market: 'BTC-USD' }));
    const enc = createDeltaEncoder({ market: 'BTC-USD', source: 'fake' });
    act(() => {
      fake.current.onOpen();
      fake.current.onMessage(enc.next(reading(100))); // 1 instantánea
    });
    act(() => result.current.loseNextDelta());
    act(() => {
      fake.current.onMessage(enc.next(reading(101))); // 2 se pierde
      fake.current.onMessage(enc.next(reading(102))); // 3 hueco: se rechaza
    });
    expect(result.current.stats).toMatchObject({ dropped: 1, gaps: 1 });
    expect(result.current.awaitingKeyframe).toBe(true);
    expect(result.current.frame.readings.price).toBe(100);
    act(() => {
      for (let p = 103; p <= 106; p += 1) fake.current.onMessage(enc.next(reading(p))); // 4..7 siguen rechazados
      fake.current.onMessage(enc.next(reading(107))); // 8 instantánea
    });
    expect(result.current.awaitingKeyframe).toBe(false);
    expect(result.current.stats.gaps).toBe(5);
    expect(result.current.frame).toMatchObject({ sequence: 8, readings: { price: 107 } });
  });

  it('cierra la conexión y no reconecta al desmontar', () => {
    const { unmount } = renderHook(() => useDeltaStream({ source: 'fake', market: 'BTC-USD' }));
    act(() => fake.current.onOpen());
    unmount();
    expect(fake.closed).toBe(1);
    act(() => vi.advanceTimersByTime(60000));
    expect(fake.opened).toBe(1);
  });

  it('al cambiar de mercado cierra la conexión anterior y abre otra', () => {
    const { rerender } = renderHook((props) => useDeltaStream(props), { initialProps: { source: 'fake', market: 'BTC-USD' } });
    rerender({ source: 'fake', market: 'BTC-EUR' });
    expect(fake.closed).toBe(1);
    expect(fake.opened).toBe(2);
  });
});
