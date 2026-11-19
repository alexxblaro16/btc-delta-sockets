import { btc, money } from '../format.js';
import { COPY, LOCALES } from '../i18n.js';

const ROWS = [
  ['open24h', 'open', 'money'],
  ['high24h', 'high', 'money'],
  ['low24h', 'low', 'money'],
  ['volume24h', 'volume', 'btc'],
];

/** Datos del día. El campo que acaba de llegar en un delta se ilumina un momento. */
export default function MarketStats({ readings, currency, changed, sequence, language = 'es' }) {
  const copy = COPY[language];
  const locale = LOCALES[language];
  return (
    <dl className="stats">
      {ROWS.map(([field, label, format]) => (
        <div key={field} className="stats__item">
          <dt>{copy.stats[label]}</dt>
          <dd key={changed.includes(field) ? `${field}-${sequence}` : field} className={changed.includes(field) ? 'changed' : ''}>
            {format === 'btc' ? btc(readings?.[field], locale) : money(readings?.[field], currency, locale)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
