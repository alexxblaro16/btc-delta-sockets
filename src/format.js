const cache = new Map();

function formatter(key, options) {
  if (!cache.has(key)) cache.set(key, new Intl.NumberFormat('es-ES', options));
  return cache.get(key);
}

export const money = (value, currency) =>
  value == null ? '—' : formatter(`m-${currency}`, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

export const signedMoney = (value, currency) =>
  value == null ? '—' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${money(Math.abs(value), currency)}`;

export const percent = (value) =>
  value == null ? '—' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatter('p', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(value))} %`;

export const btc = (value) =>
  value == null ? '—' : `${formatter('b', { maximumFractionDigits: 2 }).format(value)} BTC`;

export const clock = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString('es-ES', { hour12: false }) : '—';
};

export const seconds = (ms) => `${(ms / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1, minimumFractionDigits: ms < 10000 ? 1 : 0 })} s`;
