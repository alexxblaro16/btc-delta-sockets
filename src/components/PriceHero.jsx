import { useEffect, useRef, useState } from 'react';
import { money, percent, signedMoney } from '../format.js';

/** Precio grande. Al cambiar, destella en verde o rojo (sin destello si se pide menos movimiento). */
export default function PriceHero({ readings, currency, stale }) {
  const price = readings?.price ?? null;
  const prev = useRef(price);
  const [flash, setFlash] = useState({ dir: null, key: 0 });

  useEffect(() => {
    if (price != null && prev.current != null && price !== prev.current) {
      setFlash((f) => ({ dir: price > prev.current ? 'up' : 'down', key: f.key + 1 }));
    }
    prev.current = price;
  }, [price]);

  const open = readings?.open24h;
  const change = price != null && open ? price - open : null;
  const changePct = change != null ? (change / open) * 100 : null;
  const spread = readings?.ask != null && readings?.bid != null ? readings.ask - readings.bid : null;
  const trend = change == null ? '' : change >= 0 ? 'up' : 'down';

  return (
    <section className={`hero ${stale ? 'hero--stale' : ''}`} aria-labelledby="hero-title">
      <h2 id="hero-title" className="hero__label">
        Último precio
      </h2>
      <p key={flash.key} className={`hero__price ${flash.dir ? `flash-${flash.dir}` : ''}`}>
        {price == null ? <span className="hero__wait">Esperando la primera instantánea…</span> : money(price, currency)}
      </p>
      <p className={`hero__change ${trend}`}>
        <span aria-hidden="true">{trend === 'up' ? '▲' : trend === 'down' ? '▼' : ''}</span> {signedMoney(change, currency)} ({percent(changePct)}){' '}
        <span className="muted">en 24 h</span>
      </p>
      <dl className="hero__book">
        <div>
          <dt>Compra (bid)</dt>
          <dd>{money(readings?.bid, currency)}</dd>
        </div>
        <div>
          <dt>Venta (ask)</dt>
          <dd>{money(readings?.ask, currency)}</dd>
        </div>
        <div>
          <dt>Diferencial</dt>
          <dd>{money(spread, currency)}</dd>
        </div>
      </dl>
    </section>
  );
}
