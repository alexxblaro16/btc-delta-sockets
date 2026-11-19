# Registro de uso de IA

Flujo de la Unidad 6: cada diff hecho con ayuda de IA se apunta como ACCEPT o REJECT, con lo que se comprobó.

**Herramienta:** Claude Code (asistente de programación). Generó el código, las pruebas y la documentación a partir de la lección de la Unidad 10 y de mis indicaciones; las comprobaciones de la columna «Verificación» las ejecutó el asistente y yo revisé el resultado en el navegador.

| # | Fecha | Diff / archivo | Qué hizo la IA | Decisión | Verificación |
|---|---|---|---|---|---|
| 1 | 19/11/2026 | `src/stream/contract.js`, `docs/contract.md` | Propuso el contrato v1 (snapshot/delta con `sequence`, `online`, `readings`/`patch`) siguiendo la lección | ACCEPT | Coincide con los nombres del ejemplo de la Unidad 10 |
| 2 | 19/11/2026 | `src/stream/reduce.js` | Plegado de tramas: delta solo si `sequence === anterior + 1` | ACCEPT | 9 pruebas en `reduce.test.js` (hueco, repetido, sin base, instantánea que cura) |
| 3 | 19/11/2026 | `src/stream/deltaEncoder.js`, `backend/delta.py` | Mismo codificador en JS y Python; instantánea cada 8 ticks | ACCEPT | Pruebas de ida y vuelta en los dos lados: plegar los mensajes reconstruye la lectura |
| 4 | 19/11/2026 | `src/stream/useDeltaStream.js` | Hook con reconexión, `close()` al desmontar y estado atrasado | ACCEPT con cambios | 6 pruebas con fuente falsa y temporizadores falsos. Se quitó la opción `enabled` porque hacía un `setState` dentro del efecto (lo marcó el linter) |
| 5 | 19/11/2026 | `useDeltaStream.js` | La lección usa espera fija de 2 s | REJECT (de la espera fija) | Se eligió exponencial con jitter; motivo en la nota de versión |
| 6 | 19/11/2026 | `useDeltaStream.test.jsx` | Primera versión de la prueba del hueco con la cuenta de secuencias mal | REJECT | La prueba falló: la instantánea llegaba en la secuencia 8 y no en la 9; se corrigió la prueba, no el código |
| 7 | 19/11/2026 | `src/App.jsx` | Gráfica sembrada con velas de 1 minuto de Coinbase | ACCEPT con cambios | La primera versión borraba las velas en cuanto llegaban 2 ticks; ahora se juntan velas + directo sin solaparse |
| 8 | 19/11/2026 | `backend/main.py` | Servidor FastAPI con hub por mercado y secuencia compartida | ACCEPT con cambios | `GET` daba 500: usaba el reloj de asyncio en un endpoint síncrono. Se cambió a `time.monotonic()` y se añadió una prueba |
| 9 | 19/11/2026 | `backend/tests/test_api.py` | Prueba de contrato de los campos de la trama | ACCEPT | 13 pruebas de pytest en verde |
| 10 | 19/11/2026 | `src/components/*`, `styles.css` | Interfaz: precio con destello, gráfica SVG, inspector de tramas, prueba de estudio, tema claro y oscuro | ACCEPT | Revisado en el navegador con datos reales; `prefers-reduced-motion` quita animaciones |
| 11 | 19/11/2026 | `deltaEncoder.js`, `delta.py`, `sources.js`, `main.py` | La primera versión seguía la lección al pie de la letra: un tick fijo cada 0,5 s con deltas vacíos | REJECT (del tick fijo) | El enunciado del workshop pide enviar solo cuando cambie la cotización. Se cambió a envío por cambio de precio, sin temporizador; pruebas nuevas en los dos lados |

Revisión humana tras la revisión de la IA: pendiente de la PR / entrega.
