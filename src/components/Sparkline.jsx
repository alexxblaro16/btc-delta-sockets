import { useId, useMemo } from 'react';
import { clock, money } from '../format.js';

const W = 720;
const H = 220;
const PAD = { top: 16, right: 12, bottom: 22, left: 12 };

/** Gráfica de los últimos minutos: una línea con relleno y el último punto marcado. */
export default function Sparkline({ points, currency, label }) {
  const gradient = useId();
  const shape = useMemo(() => build(points), [points]);

  if (!shape) {
    return (
      <figure className="chart chart--empty">
        <p className="muted">La gráfica aparece en cuanto llegan las primeras tramas.</p>
      </figure>
    );
  }

  const { line, area, last, min, max, first, end, up } = shape;
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: de ${money(first.price, currency)} a ${money(end.price, currency)}, mínimo ${money(min, currency)} y máximo ${money(max, currency)}.`}>
        <defs>
          <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--chart)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--chart)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line className="chart__grid" x1={PAD.left} x2={W - PAD.right} y1={PAD.top} y2={PAD.top} />
        <line className="chart__grid" x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} />
        <path d={area} fill={`url(#${gradient})`} />
        <path d={line} className={`chart__line ${up ? 'up' : 'down'}`} />
        <circle cx={last.x} cy={last.y} r="4.5" className="chart__dot" />
        <text x={W - PAD.right} y={PAD.top - 4} textAnchor="end" className="chart__label">
          máx {money(max, currency)}
        </text>
        <text x={W - PAD.right} y={H - 6} textAnchor="end" className="chart__label">
          mín {money(min, currency)}
        </text>
        <text x={PAD.left} y={H - 6} className="chart__label">
          {clock(new Date(first.t).toISOString())}
        </text>
      </svg>
      <figcaption className="muted">{label}</figcaption>
    </figure>
  );
}

function build(points) {
  if (!points || points.length < 2) return null;
  const prices = points.map((p) => p.price);
  let min = Math.min(...prices);
  let max = Math.max(...prices);
  if (max - min < 1e-9) {
    min -= 1;
    max += 1;
  }
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t || t0 + 1;
  const sx = (t) => PAD.left + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD.left - PAD.right);
  const sy = (p) => PAD.top + (1 - (p - min) / (max - min)) * (H - PAD.top - PAD.bottom);
  const xy = points.map((p) => ({ x: sx(p.t), y: sy(p.price) }));
  const line = xy.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
  const area = `${line}L${xy[xy.length - 1].x.toFixed(1)},${H - PAD.bottom}L${xy[0].x.toFixed(1)},${H - PAD.bottom}Z`;
  return {
    line,
    area,
    last: xy[xy.length - 1],
    min: Math.min(...prices),
    max: Math.max(...prices),
    first: points[0],
    end: points[points.length - 1],
    up: points[points.length - 1].price >= points[0].price,
  };
}
