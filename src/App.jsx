import { useEffect, useState } from 'react';
import DeltaInspector from './components/DeltaInspector.jsx';
import MarketStats from './components/MarketStats.jsx';
import PriceHero from './components/PriceHero.jsx';
import Sparkline from './components/Sparkline.jsx';
import StatusBar from './components/StatusBar.jsx';
import StudioTest from './components/StudioTest.jsx';
import { COINBASE_REST_URL, MARKETS } from './stream/contract.js';
import { SOURCES, localAllowed } from './stream/sources.js';
import { useDeltaStream } from './stream/useDeltaStream.js';

const REPO = 'https://github.com/alexxblaro16/btc-delta-sockets';
const LESSON = 'https://ruvebal.github.io/web-atelier-udit/lessons/en/feii/unit-10-iot-python-backend/';

export default function App() {
  const [market, setMarket] = useState('BTC-USD');
  const [source, setSource] = useState('coinbase');
  const stream = useDeltaStream({ source, market });
  const { currency, label } = MARKETS[market];
  const canLocal = localAllowed();
  const seed = useCandles(market);
  // Última hora en velas + lo que llega en directo, sin solaparse.
  const firstLive = stream.history[0]?.t ?? Infinity;
  const points = [...seed.filter((p) => p.t < firstLive), ...stream.history];

  useEffect(() => {
    const price = stream.frame?.readings?.price;
    document.title = price ? `${Math.round(price).toLocaleString('es-ES')} ${currency === 'EUR' ? '€' : '$'} · Bitcoin en directo` : 'Bitcoin en directo';
  }, [stream.frame?.readings?.price, currency]);

  return (
    <div className="page">
      <header className="top">
        <div className="brand">
          <span className="brand__coin" aria-hidden="true">
            ₿
          </span>
          <div>
            <h1>Bitcoin en directo</h1>
            <p className="muted">Cotización por WebSocket: una instantánea y después solo deltas.</p>
          </div>
        </div>
        <div className="controls">
          <fieldset className="segmented" aria-label="Mercado">
            <legend className="sr-only">Mercado</legend>
            {Object.entries(MARKETS).map(([id, m]) => (
              <label key={id} className={market === id ? 'on' : ''}>
                <input type="radio" name="market" value={id} checked={market === id} onChange={() => setMarket(id)} />
                {m.label}
              </label>
            ))}
          </fieldset>
          <label className="select">
            <span>Fuente</span>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              {Object.values(SOURCES).map((s) => (
                <option key={s.id} value={s.id} disabled={s.id === 'local' && !canLocal}>
                  {s.label}
                  {s.id === 'local' && !canLocal ? ' (solo en local)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <p className="source-hint muted small">{SOURCES[source].hint}</p>

      <StatusBar stream={stream} />

      <main className="grid">
        <div className="col-main">
          <PriceHero readings={stream.frame?.readings} currency={currency} stale={stream.status !== 'live'} />
          <Sparkline
            points={points}
            currency={currency}
            label={chartLabel(label, seed.length, stream.history)}
          />
          <MarketStats readings={stream.frame?.readings} currency={currency} changed={stream.changed} sequence={stream.frame?.sequence} />
        </div>
        <div className="col-side">
          <StudioTest stream={stream} />
          <DeltaInspector log={stream.log} />
        </div>
      </main>

      <footer className="foot muted small">
        <p>
          Datos del feed público de Coinbase Exchange; no es asesoramiento financiero. Proyecto de la Unidad 10 de Front End II (UDIT), a partir de{' '}
          <a href={LESSON}>la lección de IoT y backend en Python</a>. Código en <a href={REPO}>GitHub</a>.
        </p>
      </footer>
    </div>
  );
}

function chartLabel(label, seedCount, live) {
  const span = live.length > 1 ? Math.round((live[live.length - 1].t - live[0].t) / 1000) : 0;
  const liveText = span < 90 ? `${span} s` : `${Math.round(span / 60)} min`;
  if (!seedCount) return `${label}: últimos ${liveText} en directo`;
  return `${label}: última hora en velas de 1 minuto de Coinbase y, al final, ${liveText} en directo`;
}

/** Última hora en velas de 1 minuto, para que la gráfica no empiece vacía. Si falla, no pasa nada. */
function useCandles(market) {
  const [loaded, setLoaded] = useState({ market: null, points: [] });
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`${COINBASE_REST_URL}/products/${market}/candles?granularity=60`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) =>
        // [tiempo, mínimo, máximo, apertura, cierre, volumen], del más nuevo al más viejo.
        setLoaded({ market, points: rows.slice(0, 60).reverse().map((r) => ({ t: r[0] * 1000, price: r[4] })) }),
      )
      .catch(() => {});
    return () => ctrl.abort();
  }, [market]);
  // Solo las velas del mercado elegido (al cambiar, las anteriores dejan de valer).
  return loaded.market === market ? loaded.points : [];
}
