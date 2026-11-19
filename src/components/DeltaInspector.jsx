/** Las últimas tramas tal como llegan: qué tipo son, su secuencia, qué traen y qué se hizo con ellas. */
export default function DeltaInspector({ log }) {
  return (
    <section className="panel" aria-labelledby="inspector-title">
      <h2 id="inspector-title">Tramas recibidas</h2>
      <p className="muted small">
        Una <b>instantánea</b> trae todos los campos; un <b>delta</b>, solo los que cambian. Un delta vacío también avanza la secuencia: demuestra que el canal sigue vivo.
      </p>
      {log.length === 0 ? (
        <p className="muted">Todavía no ha llegado ninguna.</p>
      ) : (
        <ol className="log">
          {log.map((m, i) => (
            <li key={`${m.sequence}-${m.status}-${i}`} className={`log__row log__row--${m.status.startsWith('aplicado') ? 'ok' : 'bad'}`}>
              <span className={`badge badge--${m.kind}`}>{m.kind === 'delta' ? 'delta' : 'instantánea'}</span>
              <span className="log__seq">#{m.sequence}</span>
              <code className="log__body">{m.body && Object.keys(m.body).length ? compact(m.body) : '{ }  sin cambios'}</code>
              <span className="log__status">{m.status}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function compact(body) {
  return Object.entries(body)
    .map(([k, v]) => `${k}: ${typeof v === 'number' ? +v.toFixed(2) : v}`)
    .join('  ·  ');
}
