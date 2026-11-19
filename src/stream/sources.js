// Fuentes del flujo. Todas hablan el mismo contrato (contract.js) y tienen la
// misma forma, para que el hook no sepa de dónde vienen los datos:
//
//   open({ market, onOpen, onMessage, onClose }) -> { close() }
//
// - coinbase:  feed público de Coinbase Exchange (wss://, funciona en GitHub Pages).
//              El navegador recibe cada tick y emite un mensaje solo si cambió el precio.
// - local:     servidor FastAPI de backend/ (ws://127.0.0.1:8000). Ya envía el contrato.
// - simulated: paseo aleatorio en el propio navegador, para trabajar sin red.

import { COINBASE_WS_URL, MARKETS, localStreamUrl } from './contract.js';
import { createDeltaEncoder } from './deltaEncoder.js';

const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

/** Convierte un mensaje `ticker` de Coinbase en una lectura del contrato. */
export function readingsFromCoinbase(t) {
  return {
    price: num(t.price),
    bid: num(t.best_bid),
    ask: num(t.best_ask),
    open24h: num(t.open_24h),
    high24h: num(t.high_24h),
    low24h: num(t.low_24h),
    volume24h: num(t.volume_24h),
  };
}

function coinbase({ market, onOpen, onMessage, onClose }) {
  const ws = new WebSocket(COINBASE_WS_URL);
  const encoder = createDeltaEncoder({ market, source: 'coinbase' });
  let closed = false;

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'subscribe', product_ids: [market], channels: ['ticker'] }));
    onOpen();
  };
  ws.onmessage = (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }
    if (data.type !== 'ticker' || data.product_id !== market) return;
    // Solo sale un mensaje si la cotización cambió: sin ritmo fijo.
    const message = encoder.next(readingsFromCoinbase(data));
    if (message) onMessage(message);
  };
  ws.onclose = () => {
    if (!closed) onClose();
  };
  ws.onerror = () => ws.close();

  return {
    close() {
      closed = true;
      ws.close();
    },
    /** Corta la conexión como si se cayera la red (para la prueba de estudio). */
    drop() {
      ws.close();
    },
  };
}

function local({ market, onOpen, onMessage, onClose }) {
  const ws = new WebSocket(localStreamUrl(market));
  let closed = false;
  ws.onopen = onOpen;
  ws.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      // Una trama que no es JSON se ignora: no rompe el panel.
    }
  };
  ws.onclose = () => {
    if (!closed) onClose();
  };
  ws.onerror = () => ws.close();
  return {
    close() {
      closed = true;
      ws.close();
    },
    drop() {
      ws.close();
    },
  };
}

const START_PRICE = { 'BTC-USD': 96500, 'BTC-EUR': 89500 };

function simulated({ market, onOpen, onMessage, onClose }) {
  const encoder = createDeltaEncoder({ market, source: 'simulated' });
  const open24h = START_PRICE[market] ?? 90000;
  const r = { price: open24h, open24h, high24h: open24h * 1.012, low24h: open24h * 0.987, volume24h: 8123.4 };
  let closed = false;
  let timer = null;
  // Como un mercado de verdad: los cambios llegan a ratos (entre 0,2 y 2,5 s),
  // y algunos ticks repiten precio y no se envían.
  const tick = () => {
    if (Math.random() < 0.8) {
      r.price = Math.round((r.price + (Math.random() - 0.5) * r.price * 0.0009) * 100) / 100;
      r.high24h = Math.max(r.high24h, r.price);
      r.low24h = Math.min(r.low24h, r.price);
      r.volume24h = Math.round((r.volume24h + Math.random() * 0.8) * 1000) / 1000;
    }
    const spread = Math.round(r.price * 0.00002 * 100) / 100 || 0.01;
    const message = encoder.next({ ...r, bid: Math.round((r.price - spread) * 100) / 100, ask: Math.round((r.price + spread) * 100) / 100 });
    if (message) onMessage(message);
    timer = setTimeout(tick, 200 + Math.random() * 2300);
  };
  const start = setTimeout(() => {
    onOpen();
    tick();
  }, 250);
  const stop = () => {
    clearTimeout(start);
    clearTimeout(timer);
  };
  return {
    close() {
      closed = true;
      stop();
    },
    drop() {
      stop();
      if (!closed) onClose();
    },
  };
}

export const SOURCES = {
  coinbase: {
    id: 'coinbase',
    label: 'Coinbase en directo',
    hint: 'Feed público de Coinbase Exchange. Solo se emite un mensaje cuando cambia la cotización: instantánea al empezar y después deltas.',
    open: coinbase,
  },
  local: {
    id: 'local',
    label: 'Servidor FastAPI local',
    hint: 'backend/main.py en 127.0.0.1:8000. Solo desde http://localhost (Pages es HTTPS y el navegador bloquea ws://).',
    open: local,
  },
  simulated: {
    id: 'simulated',
    label: 'Simulado',
    hint: 'Datos simulados (mock) en el navegador: el precio cambia a ratos y solo entonces llega un mensaje.',
    open: simulated,
  },
};

/** ¿Se puede usar el servidor local desde esta página? (contenido mixto) */
export function localAllowed(location = globalThis.location) {
  return location?.protocol !== 'https:';
}

export { MARKETS };
