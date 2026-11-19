# Contrato v1 — flujo de mercado

Mismo contrato en las tres fuentes (Coinbase en el navegador, servidor FastAPI y simulador).

## Endpoints del servidor (`backend/main.py`)

| Método | Ruta | Qué devuelve |
|---|---|---|
| `GET` | `/v1/markets` | Mercados disponibles (`btc-usd`, `btc-eur`) |
| `GET` | `/v1/markets/{market}` | Una trama: la instantánea del momento (503 si aún no hay datos, 404 si el mercado no existe) |
| `WS` | `/v1/markets/{market}/stream` | Instantánea al conectar y después un mensaje **solo cuando cambia la cotización** |

## Mensajes

**Instantánea** (la primera de cada conexión y cada 8 mensajes):

```json
{
  "kind": "snapshot",
  "market": "BTC-USD",
  "source": "coinbase",
  "online": true,
  "sequence": 2,
  "timestamp": "2026-11-19T17:11:41.938Z",
  "readings": {
    "price": 62362.72, "bid": 62362.71, "ask": 62362.72,
    "open24h": 63037.29, "high24h": 64023.69, "low24h": 62000.0,
    "volume24h": 12756.14399871
  }
}
```

**Delta** (solo los campos que han cambiado desde el último envío):

```json
{ "kind": "delta", "market": "BTC-USD", "source": "coinbase", "online": true,
  "sequence": 3, "timestamp": "2026-11-19T17:11:42.438Z",
  "patch": { "price": 62364.1, "bid": 62364.09 } }
```

## Reglas

- **El socket no envía de forma continua: solo manda un mensaje cuando cambia la cotización (el precio).** Si llega un tick del exchange con el mismo precio, no se envía nada; los demás datos que hayan cambiado (volumen, bid...) viajan en el siguiente delta.
- `sequence` sube de uno en uno con cada mensaje enviado.
- El cliente solo acepta un delta si `sequence === anterior + 1`. Si hay un hueco, lo rechaza, **mantiene la última trama buena** y espera a la siguiente instantánea.
- `online: false` significa que el servidor sigue vivo pero el exchange lleva más de 10 s sin mandar datos.
- Los números van como números (no como texto, que es como los manda Coinbase).
