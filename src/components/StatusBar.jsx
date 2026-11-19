import { clock, seconds } from '../format.js';

const TEXT = {
  connecting: 'Conectando…',
  live: 'En directo',
  stale: 'Datos atrasados',
  reconnecting: 'Reconectando',
  off: 'Desconectado',
};

export default function StatusBar({ stream }) {
  const { status, frame, age, retryIn, attempt, awaitingKeyframe } = stream;
  let detail = '';
  if (status === 'live' && frame) detail = `actualizado ${clock(frame.timestamp)}`;
  if (status === 'live' && age != null && age > 2000) detail = `cotización sin cambios desde hace ${seconds(age)}`;
  if (status === 'stale' && age != null) detail = `ningún cambio desde hace ${seconds(age)} · puede haber un problema; se muestra la última trama buena`;
  if (status === 'reconnecting')
    detail = retryIn != null ? `intento ${attempt} en ${seconds(retryIn)} · se muestra la última trama buena` : 'abriendo…';

  return (
    <div className={`status status--${status}`} role="status" aria-live="polite">
      <span className="status__dot" aria-hidden="true" />
      <strong>{TEXT[status]}</strong>
      {detail && <span className="status__detail">{detail}</span>}
      {awaitingKeyframe && <span className="status__gap">Hueco en la secuencia: esperando la próxima instantánea</span>}
      {frame && <span className="status__seq">secuencia #{frame.sequence}</span>}
    </div>
  );
}
