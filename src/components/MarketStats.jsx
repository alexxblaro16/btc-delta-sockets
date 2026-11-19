import { btc, money } from '../format.js';

const ROWS = [
  ['open24h', 'Apertura 24 h', money],
  ['high24h', 'Máximo 24 h', money],
  ['low24h', 'Mínimo 24 h', money],
  ['volume24h', 'Volumen 24 h', (v) => btc(v)],
];

/** Datos del día. El campo que acaba de llegar en un delta se ilumina un momento. */
export default function MarketStats({ readings, currency, changed, sequence }) {
  return (
    <dl className="stats">
      {ROWS.map(([field, label, fmt]) => (
        <div key={field} className="stats__item">
          <dt>{label}</dt>
          <dd key={changed.includes(field) ? `${field}-${sequence}` : field} className={changed.includes(field) ? 'changed' : ''}>
            {fmt(readings?.[field], currency)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
