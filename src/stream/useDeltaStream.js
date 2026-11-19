// Hook de conexión: abre la fuente, pliega instantáneas y deltas, reconecta si
// se cae y cierra al desmontar ("un hook que nunca cierra no está terminado").
//
// Estrategia de reconexión: espera exponencial con jitter (1 s, 2 s, 4 s... hasta
// 15 s, ±20 %), que vuelve a 1 s en cuanto la conexión abre. Si el navegador
// avisa de que vuelve a haber red (evento `online`), se reintenta en el momento.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { STALE_AFTER_MS } from './contract.js';
import { applyFrame } from './reduce.js';
import { SOURCES } from './sources.js';

export const MAX_HISTORY = 240; // 2 minutos a un tick cada medio segundo
const MAX_LOG = 14;

/** Espera antes del intento número `attempt` (0, 1, 2...). `random` se inyecta en las pruebas. */
export function backoffDelay(attempt, random = Math.random) {
  const base = Math.min(15000, 1000 * 2 ** attempt);
  return Math.round(base * (0.8 + random() * 0.4));
}

export const initialState = {
  frame: null,
  history: [],
  log: [],
  changed: [],
  awaitingKeyframe: false,
  lastMessageAt: null,
  stats: { messages: 0, snapshots: 0, deltas: 0, gaps: 0, dropped: 0, reconnects: 0 },
};

export function streamReducer(state, action) {
  switch (action.type) {
    case 'reset':
      return initialState;
    case 'dropped':
      return {
        ...state,
        log: [{ ...summary(action.msg), status: 'perdido' }, ...state.log].slice(0, MAX_LOG),
        stats: { ...state.stats, dropped: state.stats.dropped + 1 },
      };
    case 'reconnecting':
      return { ...state, stats: { ...state.stats, reconnects: state.stats.reconnects + 1 } };
    case 'message': {
      const { msg, at } = action;
      const { frame, accepted, reason } = applyFrame(state.frame, msg);
      const stats = { ...state.stats, messages: state.stats.messages + 1 };
      if (msg.kind === 'delta') stats.deltas += 1;
      else stats.snapshots += 1;
      if (reason === 'gap') stats.gaps += 1;
      const status = accepted ? 'aplicado' : reason === 'gap' ? 'rechazado (hueco)' : 'rechazado';
      const log = [{ ...summary(msg), status }, ...state.log].slice(0, MAX_LOG);
      if (!accepted) {
        return { ...state, log, stats, lastMessageAt: at, awaitingKeyframe: state.awaitingKeyframe || reason === 'gap' };
      }
      const price = frame.readings?.price;
      const history =
        typeof price === 'number'
          ? [...state.history, { t: Date.parse(frame.timestamp) || at, price }].slice(-MAX_HISTORY)
          : state.history;
      const changed = msg.kind === 'delta' ? Object.keys(msg.patch ?? {}) : [];
      return { ...state, frame, history, log, stats, changed, lastMessageAt: at, awaitingKeyframe: false };
    }
    default:
      return state;
  }
}

function summary(msg) {
  return {
    kind: msg?.kind ?? 'snapshot',
    sequence: msg?.sequence,
    body: msg?.kind === 'delta' ? msg.patch : msg?.readings,
  };
}

/**
 * @param {{ source: keyof SOURCES, market: string }} options
 */
export function useDeltaStream({ source, market }) {
  const [state, dispatch] = useReducer(streamReducer, initialState);
  const [connection, setConnection] = useState({ status: 'connecting', retryAt: null, attempt: 0 });
  const [now, setNow] = useState(() => Date.now());
  const controller = useRef(null);
  const dropNext = useRef(false);
  const retryNow = useRef(() => {});

  useEffect(() => {
    dispatch({ type: 'reset' });
    let attempt = 0;
    let retryTimer = null;
    let disposed = false;

    const connect = () => {
      clearTimeout(retryTimer);
      if (disposed) return;
      setConnection((c) => ({ ...c, status: attempt === 0 ? 'connecting' : 'reconnecting', retryAt: null }));
      controller.current = SOURCES[source].open({
        market,
        onOpen: () => {
          if (disposed) return;
          attempt = 0;
          setConnection({ status: 'live', retryAt: null, attempt: 0 });
        },
        onMessage: (msg) => {
          if (disposed) return;
          if (dropNext.current && msg.kind === 'delta') {
            dropNext.current = false;
            dispatch({ type: 'dropped', msg });
            return;
          }
          dispatch({ type: 'message', msg, at: Date.now() });
        },
        onClose: () => {
          if (disposed) return;
          const wait = backoffDelay(attempt);
          attempt += 1;
          dispatch({ type: 'reconnecting' });
          setConnection({ status: 'reconnecting', retryAt: Date.now() + wait, attempt });
          retryTimer = setTimeout(connect, wait);
        },
      });
    };

    retryNow.current = () => {
      if (disposed) return;
      controller.current?.close();
      attempt = 0;
      connect();
    };
    const onOnline = () => retryNow.current();
    window.addEventListener('online', onOnline);
    connect();

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      window.removeEventListener('online', onOnline);
      controller.current?.close();
      controller.current = null;
    };
  }, [source, market]);

  // Reloj para la frescura de los datos y la cuenta atrás del reintento.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const age = state.lastMessageAt ? now - state.lastMessageAt : null;
  const stale = connection.status === 'live' && age !== null && age > STALE_AFTER_MS;

  return {
    ...state,
    status: stale ? 'stale' : connection.status,
    attempt: connection.attempt,
    retryIn: connection.retryAt ? Math.max(0, connection.retryAt - now) : null,
    age,
    /** Corta la conexión como si se cayera la red: el hook debe reconectar solo. */
    drop: useCallback(() => controller.current?.drop(), []),
    /** Tira el siguiente delta (como un paquete perdido): debe verse el hueco y curarse con la instantánea. */
    loseNextDelta: useCallback(() => {
      dropNext.current = true;
    }, []),
    retry: useCallback(() => retryNow.current(), []),
  };
}
