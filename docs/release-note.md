# Nota de versión — v1.0.0 (19/11/2026)

Panel de React que muestra la cotización de Bitcoin en directo por WebSocket con el patrón de la Unidad 10: **una instantánea y después solo deltas**, con número de secuencia.

## Qué hay

- **Tres fuentes con el mismo contrato** ([docs/contract.md](contract.md)):
  - *Coinbase en directo*: el navegador abre el feed público `wss://ws-feed.exchange.coinbase.com` y convierte cada tick en instantánea + deltas (`src/stream/deltaEncoder.js`). Es la que funciona en GitHub Pages.
  - *Servidor FastAPI local*: `backend/main.py` escucha Coinbase y reparte instantánea + deltas con una secuencia compartida por todos los clientes. Solo desde `http://localhost`, porque una página HTTPS no puede abrir `ws://`.
  - *Simulado*: paseo aleatorio en el navegador, para trabajar sin red.
- **Plegado** (`src/stream/reduce.js`): la instantánea sustituye; el delta se mezcla solo si la secuencia es la anterior + 1. Un hueco se rechaza y se queda la última trama buena.
- **Ciclo de vida completo** (`src/stream/useDeltaStream.js`): conectar, reconectar si se cae y `close()` al desmontar o al cambiar de mercado o fuente.
- **Estados visibles**: *En directo*, *Datos atrasados* (más de 3 s sin tramas), *Reconectando* (con el intento y la cuenta atrás) y aviso de *hueco en la secuencia*.
- **Prueba de estudio en la propia página**: «Cortar la conexión» y «Perder el siguiente delta», con contadores de tramas, instantáneas, deltas, deltas vacíos, huecos y reconexiones, y un inspector con las últimas tramas.

## Estrategia de reconexión

**Espera exponencial con jitter**: 1 s, 2 s, 4 s, 8 s y como mucho 15 s, ±20 %. Vuelve a 1 s en cuanto la conexión abre, y si el navegador avisa de que vuelve la red (evento `online`) se reintenta al momento.

Por qué no una espera fija de 2 s como en el ejemplo de la lección:
- Si el corte es largo (sin red, el exchange caído), una espera fija martillea el servidor cada 2 s desde cada pestaña abierta; la exponencial lo deja en uno cada 15 s.
- El jitter evita que todas las pestañas que se cayeron a la vez reconecten en el mismo milisegundo.
- Para un corte corto (lo normal) el primer intento es en 1 s, más rápido que la espera fija.

El servidor hace lo mismo con su conexión a Coinbase (1 s, doblando, hasta 15 s).

## Mock usado antes del socket real

No se usó MSW: la fuente **Simulado** genera el mismo contrato en el navegador y las pruebas usan una fuente falsa (`useDeltaStream.test.jsx`) que decide cuándo abre, qué llega y cuándo se cae, con temporizadores falsos de Vitest. El backend se prueba con `BTC_SOURCE=simulated` y el `TestClient` de FastAPI.

## Una trama real

Copiada de `GET http://127.0.0.1:8000/v1/markets/btc-usd` el 19/11/2026 a las 17:11 UTC:

```json
{"kind":"snapshot","market":"BTC-USD","source":"coinbase","online":true,"sequence":2,"timestamp":"2026-11-19T17:11:41.938Z","readings":{"price":62362.72,"bid":62362.71,"ask":62362.72,"open24h":63037.29,"high24h":64023.69,"low24h":62000.0,"volume24h":12756.14399871}}
```

## Comprobado

- 23 pruebas del front (Vitest) y 13 del backend (pytest), linter y build.
- En el navegador con Coinbase real: precio, gráfica, deltas aplicados, «Perder el siguiente delta» (hueco detectado y curado con la instantánea) y «Cortar la conexión» (pasa a *Reconectando*, mantiene la última trama y vuelve sola).
- Fuente del servidor FastAPI local contra Coinbase real.

## Límites conocidos

- En GitHub Pages la fuente del servidor local aparece deshabilitada (contenido mixto: HTTPS no puede abrir `ws://`).
- El servidor no persiste nada: si se reinicia, la secuencia vuelve a empezar (el cliente lo encaja porque la primera trama es una instantánea).
- Los datos son del feed público de Coinbase Exchange: no es asesoramiento financiero.
