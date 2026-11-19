import { clock, seconds } from '../format.js';
import { COPY, LOCALES } from '../i18n.js';

export default function StatusBar({ stream, language = 'es' }) {
  const copy = COPY[language];
  const locale = LOCALES[language];
  const text = copy.status;
  const { status, frame, age, retryIn, attempt, awaitingKeyframe } = stream;
  let detail = '';
  if (status === 'live' && frame) detail = `${text.updated} ${clock(frame.timestamp, locale)}`;
  if (status === 'live' && age != null && age > 2000) detail = `${text.unchanged} ${seconds(age, locale)}`;
  if (status === 'stale' && age != null) detail = `${text.noChangeFor} ${seconds(age, locale)} · ${text.staleWarning}`;
  if (status === 'reconnecting')
    detail = retryIn != null ? `${text.attempt} ${attempt} ${text.in} ${seconds(retryIn, locale)} · ${text.reconnectingLastGood}` : text.opening;

  return (
    <div className={`status status--${status}`} role="status" aria-live="polite">
      <span className="status__dot" aria-hidden="true" />
      <strong>{text[status]}</strong>
      {detail && <span className="status__detail">{detail}</span>}
      {awaitingKeyframe && <span className="status__gap">{text.gap}</span>}
      {frame && <span className="status__seq">{text.sequence} #{frame.sequence}</span>}
    </div>
  );
}
