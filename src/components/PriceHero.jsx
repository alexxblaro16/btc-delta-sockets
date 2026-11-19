import { useEffect, useRef, useState } from 'react';
import { money, percent, signedMoney } from '../format.js';
import { COPY, LOCALES } from '../i18n.js';

function splitPrice(text, locale) {
  const separator = locale.startsWith('en') ? '.' : ',';
  const decimalIndex = text.lastIndexOf(separator);
  return decimalIndex < 0 ? [text, '', ''] : [text.slice(0, decimalIndex), text.slice(decimalIndex), ''];
}

/**
 * Precio grande. Al cambiar destella en verde o rojo (sin destello si se pide
 * menos movimiento) y enseña cuánto ha cambiado con el último mensaje.
 */
export default function PriceHero({ readings, currency, stale, language = 'es' }) {
  const copy = COPY[language];
  const locale = LOCALES[language];
  const price = readings?.price ?? null;
  const prev = useRef(price);
  const [tick, setTick] = useState({ dir: null, diff: null, key: 0 });

  useEffect(() => {
    if (price != null && prev.current != null && price !== prev.current) {
      const diff = price - prev.current;
      setTick((t) => ({ dir: diff > 0 ? 'up' : 'down', diff, key: t.key + 1 }));
    }
    prev.current = price;
  }, [price]);

  const open = readings?.open24h;
  const change = price != null && open ? price - open : null;
  const changePct = change != null ? (change / open) * 100 : null;
  const spread = readings?.ask != null && readings?.bid != null ? readings.ask - readings.bid : null;
  const trend = change == null ? '' : change >= 0 ? 'up' : 'down';
  const [whole, cents, unit] = price == null ? [] : splitPrice(money(price, currency, locale), locale);

  return (
    <section className={`hero card ${stale ? 'hero--stale' : ''}`} aria-labelledby="hero-title">
      <div className="hero__head">
        <h2 id="hero-title" className="hero__label">
          {copy.lastPrice}
        </h2>
        {tick.diff != null && (
          <span key={tick.key} className={`tick tick--${tick.dir}`} title={copy.lastChangeTitle}>
            <span aria-hidden="true">{tick.dir === 'up' ? '▲' : '▼'}</span> {signedMoney(tick.diff, currency, locale)}
            <span className="tick__label"> {copy.lastChange}</span>
          </span>
        )}
      </div>
      <p key={tick.key} className={`hero__price ${tick.dir ? `flash-${tick.dir}` : ''}`}>
        {price == null ? (
          <span className="hero__wait">{copy.waitingSnapshot}</span>
        ) : (
          <>
            {whole}
            <span className="hero__cents">
              {cents}
              {unit}
            </span>
          </>
        )}
      </p>
      <p className={`hero__change ${trend}`}>
        <span aria-hidden="true">{trend === 'up' ? '▲' : trend === 'down' ? '▼' : ''}</span> {signedMoney(change, currency, locale)} ({percent(changePct, locale)}){' '}
        <span className="muted">{copy.in24h}</span>
      </p>
      <dl className="hero__book">
        <div>
          <dt>{copy.bid}</dt>
          <dd>{money(readings?.bid, currency, locale)}</dd>
        </div>
        <div>
          <dt>{copy.ask}</dt>
          <dd>{money(readings?.ask, currency, locale)}</dd>
        </div>
        <div>
          <dt>{copy.spread}</dt>
          <dd>{money(spread, currency, locale)}</dd>
        </div>
      </dl>
    </section>
  );
}
