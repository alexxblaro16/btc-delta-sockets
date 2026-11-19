// Contrato v1 del flujo de mercado (mismo que backend/main.py).
//
//   { kind: 'snapshot', market, source, online, sequence, timestamp, readings: {...} }
//   { kind: 'delta',    market, source, online, sequence, timestamp, patch:    {...} }
//
// El socket NO manda nada de forma continua: solo envía un mensaje cuando
// cambia la cotización. El primero es una instantánea completa; después llegan
// deltas con solo los campos que han cambiado. Cada KEYFRAME_EVERY mensajes se
// repite una instantánea para curar a quien haya perdido un delta.

export const CONTRACT_VERSION = 'v1';
export const KEYFRAME_EVERY = 8;

/** Campos de una lectura del mercado. Todos son números (o null si aún no se sabe). */
export const READING_FIELDS = ['price', 'bid', 'ask', 'open24h', 'high24h', 'low24h', 'volume24h'];

export const MARKETS = {
  'BTC-USD': { label: 'BTC / USD', currency: 'USD' },
  'BTC-EUR': { label: 'BTC / EUR', currency: 'EUR' },
};

export const COINBASE_WS_URL = 'wss://ws-feed.exchange.coinbase.com';
export const COINBASE_REST_URL = 'https://api.exchange.coinbase.com';

/** Servidor FastAPI local (backend/main.py). */
export const LOCAL_HTTP_URL = 'http://127.0.0.1:8000';
export const localStreamUrl = (market) => `ws://127.0.0.1:8000/v1/markets/${market.toLowerCase()}/stream`;

/**
 * Como solo llega algo cuando el precio cambia, un rato sin mensajes puede ser
 * un mercado quieto. Bitcoin cambia varias veces por segundo, así que pasado
 * este tiempo sin ningún cambio se avisa de que los datos pueden estar atrasados.
 */
export const STALE_AFTER_MS = 15000;
