const cache = new Map();

function formatter(key, locale, options) {
  const cacheKey = `${locale}-${key}`;
  if (!cache.has(cacheKey)) cache.set(cacheKey, new Intl.NumberFormat(locale, options));
  return cache.get(cacheKey);
}

export const money = (value, currency, locale = 'es-ES') =>
  value == null ? '—' : formatter(`m-${currency}`, locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

export const signedMoney = (value, currency, locale = 'es-ES') =>
  value == null ? '—' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${money(Math.abs(value), currency, locale)}`;

export const percent = (value, locale = 'es-ES') =>
  value == null ? '—' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatter('p', locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(value))} %`;

export const btc = (value, locale = 'es-ES') =>
  value == null ? '—' : `${formatter('b', locale, { maximumFractionDigits: 2 }).format(value)} BTC`;

export const clock = (iso, locale = 'es-ES') => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString(locale, { hour12: locale.startsWith('en') }) : '—';
};

export const seconds = (ms, locale = 'es-ES') =>
  `${(ms / 1000).toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: ms < 10000 ? 1 : 0 })} s`;
