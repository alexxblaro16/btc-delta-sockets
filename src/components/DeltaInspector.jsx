import { COPY } from '../i18n.js';

/** Las últimas tramas tal como llegan: qué tipo son, su secuencia, qué traen y qué se hizo con ellas. */
export default function DeltaInspector({ log, language = 'es' }) {
  const copy = COPY[language];
  return (
    <section className="panel" aria-labelledby="inspector-title">
      <h2 id="inspector-title">{copy.framesTitle}</h2>
      <p className="muted small">
        {copy.framesDescription}
      </p>
      {log.length === 0 ? (
        <p className="muted">{copy.noFrames}</p>
      ) : (
        <ol className="log">
          {log.map((m, i) => (
            <li key={`${m.sequence}-${m.status}-${i}`} className={`log__row log__row--${m.status.startsWith('aplicado') ? 'ok' : 'bad'}`}>
              <span className={`badge badge--${m.kind}`}>{m.kind === 'delta' ? copy.delta : copy.snapshot}</span>
              <span className="log__seq">#{m.sequence}</span>
              <code className="log__body">{m.body && Object.keys(m.body).length ? compact(m.body) : `{ }  ${copy.noChanges}`}</code>
              <span className="log__status">{translateStatus(m.status, copy)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function translateStatus(status, copy) {
  if (status === 'aplicado') return copy.applied;
  if (status === 'perdido') return copy.dropped;
  if (status === 'rechazado (hueco)') return copy.rejectedGap;
  return copy.rejected;
}

function compact(body) {
  return Object.entries(body)
    .map(([k, v]) => `${k}: ${typeof v === 'number' ? +v.toFixed(2) : v}`)
    .join('  ·  ');
}
