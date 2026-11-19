/** Prueba de estudio de la lección: cortar la fuente y perder un delta a propósito. */
export default function StudioTest({ stream }) {
  const { stats, drop, loseNextDelta, retry, status } = stream;
  const counters = [
    ['Tramas', stats.messages],
    ['Instantáneas', stats.snapshots],
    ['Deltas', stats.deltas],
    ['Deltas vacíos', stats.emptyDeltas],
    ['Perdidos a propósito', stats.dropped],
    ['Huecos detectados', stats.gaps],
    ['Reconexiones', stats.reconnects],
  ];
  return (
    <section className="panel" aria-labelledby="studio-title">
      <h2 id="studio-title">Prueba de estudio</h2>
      <p className="muted small">
        Corta la conexión: el panel pasa a «Reconectando», la frescura envejece y la última trama buena sigue en pantalla. Pierde un delta: el siguiente se rechaza por hueco y la próxima instantánea lo cura.
      </p>
      <div className="actions">
        <button type="button" onClick={drop} disabled={status !== 'live' && status !== 'stale'}>
          Cortar la conexión
        </button>
        <button type="button" onClick={loseNextDelta} disabled={status !== 'live'}>
          Perder el siguiente delta
        </button>
        <button type="button" className="ghost" onClick={retry}>
          Reconectar ya
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
