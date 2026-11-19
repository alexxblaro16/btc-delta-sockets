// Fuentes del flujo. Todas hablan el mismo contrato (contract.js) y tienen la
// misma forma, para que el hook no sepa de dónde vienen los datos:
//
//   open({ market, onOpen, onMessage, onClose }) -> { close() }
//
// - coinbase:  feed público de Coinbase Exchange (wss://, funciona en GitHub Pages).
//              El navegador recibe ticks completos y los convierte en instantánea + deltas.
// - local:     servidor FastAPI de backend/ (ws://127.0.0.1:8000). Ya envía el contrato.
// - simulated: paseo aleatorio en el propio navegador, para trabajar sin red.

import { COINBASE_WS_URL, MARKETS, TICK_MS, localStreamUrl } from './contract.js';
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
  let latest = null;
  let timer = null;
  let closed = false;

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'subscribe', product_ids: [market], channels: ['ticker'] }));
    onOpen();
    // El ritmo lo marca el tick, no el exchange: así llega una trama cada medio
    // segundo aunque Coinbase mande veinte ticks seguidos o ninguno.
    timer = setInterval(() => {
      if (latest) onMessage(encoder.next(latest));
    }, TICK_MS);
  };
  ws.onmessage = (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }
    if (data.type === 'ticker' && data.product_id === market) latest = readingsFromCoinbase(data);
  };
  ws.onclose = () => {
    clearInterval(timer);
    if (!closed) onClose();
  };
  ws.onerror = () => ws.close();

  return {
    close() {
      closed = true;
      clearInterval(timer);
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
  const start = setTimeout(() => {
    onOpen();
    timer = setInterval(() => {
      // Algunos ticks no cambian nada (delta vacío): el canal sigue vivo.
      if (Math.random() < 0.75) {
        r.price = Math.round((r.price + (Math.random() - 0.5) * r.price * 0.0009) * 100) / 100;
        r.high24h = Math.max(r.high24h, r.price);
        r.low24h = Math.min(r.low24h, r.price);
        r.volume24h = Math.round((r.volume24h + Math.random() * 0.8) * 1000) / 1000;
      }
      const spread = Math.round(r.price * 0.00002 * 100) / 100 || 0.01;
      onMessage(encoder.next({ ...r, bid: Math.round((r.price - spread) * 100) / 100, ask: Math.round((r.price + spread) * 100) / 100 }));
    }, TICK_MS);
  }, 250);
  const stop = () => {
    clearTimeout(start);
    clearInterval(timer);
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
    hint: 'Feed público de Coinbase Exchange. El navegador lo convierte en instantánea + deltas.',
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
    hint: 'Paseo aleatorio en el navegador, para trabajar sin red.',
    open: simulated,
  },
};

/** ¿Se puede usar el servidor local desde esta página? (contenido mixto) */
export function localAllowed(location = globalThis.location) {
  return location?.protocol !== 'https:';
}

export { MARKETS };
