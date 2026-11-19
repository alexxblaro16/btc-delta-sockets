import { COPY } from '../i18n.js';

/** Prueba de estudio de la lección: cortar la fuente y perder un delta a propósito. */
export default function StudioTest({ stream, language = 'es' }) {
  const copy = COPY[language];
  const { stats, drop, loseNextDelta, retry, status } = stream;
  const counters = [
    [copy.counters.messages, stats.messages],
    [copy.counters.snapshots, stats.snapshots],
    [copy.counters.deltas, stats.deltas],
    [copy.counters.dropped, stats.dropped],
    [copy.counters.gaps, stats.gaps],
    [copy.counters.reconnects, stats.reconnects],
  ];
  return (
    <section className="panel" aria-labelledby="studio-title">
      <h2 id="studio-title">{copy.studioTitle}</h2>
      <p className="muted small">{copy.studioDescription}</p>
      <div className="actions">
        <button type="button" onClick={drop} disabled={status !== 'live' && status !== 'stale'}>
          {copy.cutConnection}
        </button>
        <button type="button" onClick={loseNextDelta} disabled={status !== 'live'}>
          {copy.loseDelta}
        </button>
        <button type="button" className="ghost" onClick={retry}>
          {copy.reconnectNow}
        </button>
      </div>
      <dl className="counters">
        {counters.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
