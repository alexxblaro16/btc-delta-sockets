import { useEffect, useState } from 'react';
import Aura from './components/Aura.jsx';
import DeltaInspector from './components/DeltaInspector.jsx';
import MarketStats from './components/MarketStats.jsx';
import PriceHero from './components/PriceHero.jsx';
import Sparkline from './components/Sparkline.jsx';
import StatusBar from './components/StatusBar.jsx';
import StudioTest from './components/StudioTest.jsx';
import { COPY, LOCALES } from './i18n.js';
import { COINBASE_REST_URL, MARKETS } from './stream/contract.js';
import { SOURCES, localAllowed } from './stream/sources.js';
import { useDeltaStream } from './stream/useDeltaStream.js';

const REPO = 'https://github.com/alexxblaro16/btc-delta-sockets';
const LESSON = 'https://ruvebal.github.io/web-atelier-udit/lessons/en/feii/unit-10-iot-python-backend/';
const THEMES = [
  { id: 'orange' },
  { id: 'blue' },
  { id: 'violet' },
  { id: 'noir' },
  { id: 'comic' },
  { id: 'fireworks' },
  { id: 'casino' },
];

export default function App() {
  const [market, setMarket] = useState('BTC-USD');
  const [source, setSource] = useState('coinbase');
  const [theme, setTheme] = useState('orange');
  const [language, setLanguage] = useState('es');
  const stream = useDeltaStream({ source, market });
  const copy = COPY[language];
  const locale = LOCALES[language];
  const { currency, label } = MARKETS[market];
  const canLocal = localAllowed();
  const seed = useCandles(market);
  // Última hora en velas + lo que llega en directo, sin solaparse.
  const firstLive = stream.history[0]?.t ?? Infinity;
  const points = [...seed.filter((p) => p.t < firstLive), ...stream.history];

  useEffect(() => {
    const price = stream.frame?.readings?.price;
    document.title = price ? `${Math.round(price).toLocaleString(locale)} ${currency === 'EUR' ? '€' : '$'} · ${copy.appTitle}` : copy.appTitle;
  }, [stream.frame?.readings?.price, currency, locale, copy.appTitle]);

  useEffect(() => {
    document.documentElement.lang = language;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = copy.metaDescription;
  }, [language, copy.metaDescription]);

  useEffect(() => {
    if (theme !== 'cycle') {
      document.documentElement.dataset.theme = theme;
      return undefined;
    }
    let activeTheme = 0;
    const applyTheme = () => {
      document.documentElement.dataset.theme = THEMES[activeTheme].id;
    };
    applyTheme();
    const interval = window.setInterval(() => {
      activeTheme = (activeTheme + 1) % THEMES.length;
      applyTheme();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [theme]);

  return (
    <div className="page">
      <Aura price={stream.frame?.readings?.price} status={stream.status} />
      <header className="top">
        <div className="brand">
          <span className="brand__coin" aria-hidden="true">
            ₿
          </span>
          <div>
            <h1>{copy.appTitle}</h1>
            <p className="muted">{copy.subtitle}</p>
          </div>
        </div>
        <div className="controls">
          <fieldset className="segmented" aria-label={copy.market}>
            <legend className="sr-only">{copy.market}</legend>
            {Object.entries(MARKETS).map(([id, m]) => (
              <label key={id} className={market === id ? 'on' : ''}>
                <input type="radio" name="market" value={id} checked={market === id} onChange={() => setMarket(id)} />
                {m.label}
              </label>
            ))}
          </fieldset>
          <label className="select">
            <span>{copy.source}</span>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              {Object.values(SOURCES).map((s) => (
                <option key={s.id} value={s.id} disabled={s.id === 'local' && !canLocal}>
                  {copy.sources[s.id]}
                  {s.id === 'local' && !canLocal ? ` ${copy.localOnly}` : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="theme-picker" role="group" aria-label={copy.theme}>
            <span className="theme-picker__label">{copy.theme}</span>
            {THEMES.map(({ id }) => (
              <button
                key={id}
                type="button"
                className={`theme-button theme-button--${id}`}
                aria-label={copy.themes[id]}
                title={copy.themes[id]}
                aria-pressed={theme === id}
                onClick={() => setTheme(id)}
              >
                <span className="theme-swatch" aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              className="theme-button theme-button--cycle"
              aria-label={copy.cycleTheme}
              title={copy.cycleTheme}
              aria-pressed={theme === 'cycle'}
              onClick={() => setTheme((current) => (current === 'cycle' ? 'orange' : 'cycle'))}
            >
              <span className="theme-swatch" aria-hidden="true" />
            </button>
          </div>
          <div className="language-toggle" role="group" aria-label={copy.language}>
            <button type="button" aria-label="Español" aria-pressed={language === 'es'} onClick={() => setLanguage('es')}>
              ES
            </button>
            <button type="button" aria-label="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>
              EN
            </button>
          </div>
        </div>
      </header>
      <p className="source-hint muted small">{copy.sourceHints[source]}</p>

      <StatusBar stream={stream} language={language} />

      <main className="grid">
        <div className="col-main">
          <PriceHero readings={stream.frame?.readings} currency={currency} stale={stream.status !== 'live'} language={language} />
          <Sparkline
            points={points}
            currency={currency}
            label={chartLabel(label, seed.length, stream.history, language)}
            language={language}
          />
          <MarketStats readings={stream.frame?.readings} currency={currency} changed={stream.changed} sequence={stream.frame?.sequence} language={language} />
        </div>
        <div className="col-side">
          <StudioTest stream={stream} language={language} />
          <DeltaInspector log={stream.log} language={language} />
        </div>
      </main>

      <footer className="foot muted small">
        <p>
          {copy.footerIntro}{' '}
          <a href={LESSON}>{copy.lessonLink}</a>. {copy.repositoryLead} <a href={REPO}>GitHub</a>.
        </p>
      </footer>
      <a className="signature" href="https://github.com/alexxblaro16" aria-label={copy.madeBy}>
        {copy.madeBy}
      </a>
    </div>
  );
}

function chartLabel(label, seedCount, live, language) {
  const copy = COPY[language];
  const span = live.length > 1 ? Math.round((live[live.length - 1].t - live[0].t) / 1000) : 0;
  const liveText = span < 90 ? `${span} s` : `${Math.round(span / 60)} min`;
  if (!seedCount) return copy.chartLastLive(label, liveText);
  return copy.chartLastHour(label, liveText);
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
