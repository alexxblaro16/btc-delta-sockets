import { useEffect, useRef } from 'react';

// Aura: luz de fondo que reacciona al flujo, como el «aura» del ejemplo
// Streamfield de la lección. Cada cambio de precio lanza una onda desde el
// precio (verde si sube, roja si baja) con una intensidad que depende de lo
// grande que sea el cambio. En directo, unas manchas de color respiran
// despacio; si los datos se atrasan o se cae la conexión, el aura se apaga y
// se vuelve gris. Con «menos movimiento» se queda quieta.

const COLORS = {
  up: [34, 197, 94],
  down: [242, 84, 91],
  accent: [247, 147, 26],
  violet: [109, 94, 252],
  idle: [120, 128, 145],
};

const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;

export default function Aura({ price, status, anchor = '.hero__price' }) {
  const canvas = useRef(null);
  const live = useRef({ status, pulses: [], last: null });

  // Lo que cambia con cada mensaje se guarda en una ref: el dibujo no necesita re-renderizar React.
  useEffect(() => {
    live.current.status = status;
  }, [status]);

  useEffect(() => {
    const state = live.current;
    if (price == null) return;
    if (state.last != null && price !== state.last) {
      const rel = Math.abs(price - state.last) / state.last; // 0,0001 = 1 punto básico
      state.pulses.push({
        color: price > state.last ? COLORS.up : COLORS.down,
        born: performance.now(),
        strength: Math.min(1, 0.35 + rel * 4000),
      });
      if (state.pulses.length > 12) state.pulses.shift();
    }
    state.last = price;
  }, [price]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!ctx) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const light = window.matchMedia?.('(prefers-color-scheme: light)');
    const SCALE = 0.5; // se pinta a media resolución: es luz difusa, no hace falta más
    let raf = 0;
    let w = 0;
    let h = 0;
    let energy = 1; // 1 en directo, baja hacia 0,25 si se atrasa o se cae

    const resize = () => {
      w = Math.ceil(window.innerWidth * SCALE);
      h = Math.ceil(window.innerHeight * SCALE);
      el.width = w;
      el.height = h;
    };
    resize();
    window.addEventListener('resize', resize);

    const origin = () => {
      const target = document.querySelector(anchor);
      if (!target) return { x: w * 0.3, y: h * 0.35 };
      const r = target.getBoundingClientRect();
      return { x: (r.left + Math.min(r.width, 420) / 2) * SCALE, y: (r.top + r.height / 2) * SCALE };
    };

    const draw = (now) => {
      const state = live.current;
      const ok = state.status === 'live';
      energy += ((ok ? 1 : 0.25) - energy) * 0.04;
      const still = reduce?.matches;
      const t = still ? 0 : now / 1000;
      const k = (light?.matches ? 0.55 : 1) * energy;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = light?.matches ? 'source-over' : 'lighter';

      // Manchas que respiran: naranja Bitcoin y violeta, grises si no hay datos frescos.
      const blobs = [
        { c: ok ? COLORS.accent : COLORS.idle, x: 0.18 + Math.sin(t * 0.13) * 0.08, y: 0.12 + Math.cos(t * 0.11) * 0.06, r: 0.55, a: 0.22 },
        { c: ok ? COLORS.violet : COLORS.idle, x: 0.86 + Math.cos(t * 0.09) * 0.07, y: 0.25 + Math.sin(t * 0.12) * 0.08, r: 0.5, a: 0.16 },
        { c: ok ? COLORS.accent : COLORS.idle, x: 0.6 + Math.sin(t * 0.07) * 0.1, y: 0.95 + Math.cos(t * 0.1) * 0.05, r: 0.6, a: 0.1 },
      ];
      const size = Math.max(w, h);
      for (const b of blobs) {
        const g = ctx.createRadialGradient(b.x * w, b.y * h, 0, b.x * w, b.y * h, b.r * size);
        g.addColorStop(0, rgba(b.c, b.a * k));
        g.addColorStop(1, rgba(b.c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      // Ondas de cada cambio de precio, desde el propio precio.
      if (!still && state.pulses.length) {
        const o = origin();
        state.pulses = state.pulses.filter((p) => now - p.born < 2200);
        for (const p of state.pulses) {
          const life = (now - p.born) / 2200; // 0 → 1
          const radius = (40 + life * 0.9 * size) * (0.6 + p.strength * 0.6);
          const alpha = (1 - life) ** 2 * 0.32 * p.strength * k;
          const g = ctx.createRadialGradient(o.x, o.y, radius * 0.55, o.x, o.y, radius);
          g.addColorStop(0, rgba(p.color, 0));
          g.addColorStop(0.75, rgba(p.color, alpha));
          g.addColorStop(1, rgba(p.color, 0));
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        }
      }
      raf = still ? 0 : requestAnimationFrame(draw);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    // Con la pestaña oculta no se pinta nada (ahorra batería).
    const onVisibility = () => (document.hidden ? cancelAnimationFrame(raf) : start());
    document.addEventListener('visibilitychange', onVisibility);
    reduce?.addEventListener?.('change', start);
    start();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      reduce?.removeEventListener?.('change', start);
    };
  }, [anchor]);

  return <canvas ref={canvas} className="aura" aria-hidden="true" />;
}
