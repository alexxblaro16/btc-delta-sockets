"""Servidor de la cotización de Bitcoin con instantáneas y deltas (contrato v1).

Sigue el patrón de la Unidad 10 (FastAPI + WebSocket):

    GET /v1/markets                       mercados disponibles
    GET /v1/markets/{market}              una trama (instantánea) del momento
    WS  /v1/markets/{market}/stream       instantánea al conectar y después deltas

Un solo proceso escucha el feed público de Coinbase y comparte una secuencia
para todos los clientes: el que llega a mitad recibe la instantánea actual y
después los mismos ticks que los demás. Cada KEYFRAME_EVERY ticks va una
instantánea completa para curar a quien perdió un delta.

Si no hay red (o con BTC_SOURCE=simulated) usa un paseo aleatorio, y el campo
`online` dice si los datos del exchange están llegando.

Arranque:  uvicorn main:app --reload --port 8000   (desde backend/)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from delta import DeltaEncoder, Readings

log = logging.getLogger("btc")

COINBASE_WS = "wss://ws-feed.exchange.coinbase.com"
MARKETS = {"btc-usd": "BTC-USD", "btc-eur": "BTC-EUR"}
TICK_SECONDS = float(os.getenv("BTC_TICK_SECONDS", "0.5"))
SOURCE = os.getenv("BTC_SOURCE", "coinbase")  # "coinbase" o "simulated"
UPSTREAM_STALE_SECONDS = 10


def readings_from_coinbase(ticker: dict[str, Any]) -> Readings:
    def num(value: Any) -> float | None:
        return None if value in (None, "") else float(value)

    return {
        "price": num(ticker.get("price")),
        "bid": num(ticker.get("best_bid")),
        "ask": num(ticker.get("best_ask")),
        "open24h": num(ticker.get("open_24h")),
        "high24h": num(ticker.get("high_24h")),
        "low24h": num(ticker.get("low_24h")),
        "volume24h": num(ticker.get("volume_24h")),
    }


class Simulator:
    """Paseo aleatorio para trabajar sin red (y para las pruebas)."""

    START = {"BTC-USD": 96500.0, "BTC-EUR": 89500.0}

    def __init__(self, product: str, seed: int | None = None) -> None:
        self.rng = random.Random(seed)
        open24h = self.START.get(product, 90000.0)
        self.r: Readings = {
            "price": open24h,
            "open24h": open24h,
            "high24h": round(open24h * 1.012, 2),
            "low24h": round(open24h * 0.987, 2),
            "volume24h": 8123.4,
        }

    def step(self) -> Readings:
        r = self.r
        if self.rng.random() < 0.75:  # algunos ticks no cambian nada: delta vacío
            r["price"] = round(r["price"] + (self.rng.random() - 0.5) * r["price"] * 0.0009, 2)
            r["high24h"] = max(r["high24h"], r["price"])
            r["low24h"] = min(r["low24h"], r["price"])
            r["volume24h"] = round(r["volume24h"] + self.rng.random() * 0.8, 3)
        spread = max(0.01, round(r["price"] * 0.00002, 2))
        return {**r, "bid": round(r["price"] - spread, 2), "ask": round(r["price"] + spread, 2)}


class MarketHub:
    """Estado compartido de un mercado: última lectura, codificador y clientes conectados."""

    def __init__(self, product: str, source: str = SOURCE) -> None:
        self.product = product
        self.source = source
        self.encoder = DeltaEncoder(product, source)
        self.latest: Readings | None = None
        self.upstream_at = 0.0  # cuándo llegó el último tick del exchange
        self.clients: set[WebSocket] = set()
        self.simulator = Simulator(product)

    @property
    def online(self) -> bool:
        if self.source == "simulated":
            return True
        return time.monotonic() - self.upstream_at < UPSTREAM_STALE_SECONDS

    def tick(self) -> dict[str, Any] | None:
        if self.source == "simulated":
            self.latest = self.simulator.step()
        if self.latest is None:
            return None
        return self.encoder.next(self.latest, online=self.online)

    def current(self) -> dict[str, Any] | None:
        return self.encoder.snapshot(online=self.online) if self.latest is not None else None

    async def broadcast(self, message: dict[str, Any]) -> None:
        text = json.dumps(message)
        gone = []
        for ws in list(self.clients):
            try:
                await ws.send_text(text)
            except Exception:  # cliente que se fue sin despedirse
                gone.append(ws)
        for ws in gone:
            self.clients.discard(ws)


async def follow_coinbase(hubs: dict[str, MarketHub]) -> None:
    """Escucha el ticker de Coinbase y guarda la última lectura de cada mercado. Reconecta con espera creciente."""
    import websockets  # importado aquí para que las pruebas simuladas no lo necesiten

    delay = 1.0
    by_product = {hub.product: hub for hub in hubs.values()}
    while True:
        try:
            async with websockets.connect(COINBASE_WS, ping_interval=20) as ws:
                await ws.send(json.dumps({"type": "subscribe", "product_ids": list(by_product), "channels": ["ticker"]}))
                delay = 1.0
                async for raw in ws:
                    data = json.loads(raw)
                    hub = by_product.get(data.get("product_id"))
                    if data.get("type") == "ticker" and hub:
                        hub.latest = readings_from_coinbase(data)
                        hub.upstream_at = time.monotonic()
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # sin red, corte del exchange...
            log.warning("Coinbase no responde (%s); reintento en %.0f s", exc, delay)
            await asyncio.sleep(delay)
            delay = min(delay * 2, 15.0)


async def ticker_loop(hubs: dict[str, MarketHub]) -> None:
    while True:
        for hub in hubs.values():
            message = hub.tick()
            if message:
                await hub.broadcast(message)
        await asyncio.sleep(TICK_SECONDS)


def create_app(source: str = SOURCE) -> FastAPI:
    hubs = {slug: MarketHub(product, source) for slug, product in MARKETS.items()}

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        tasks = [asyncio.create_task(ticker_loop(hubs))]
        if source == "coinbase":
            tasks.append(asyncio.create_task(follow_coinbase(hubs)))
        yield
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    app = FastAPI(title="BTC delta sockets", version="1.0.0", lifespan=lifespan)
    app.state.hubs = hubs
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "https://alexxblaro16.github.io",
        ],
        allow_methods=["GET"],
        allow_headers=["*"],
    )

    def hub_for(market: str) -> MarketHub:
        hub = hubs.get(market.lower())
        if hub is None:
            raise HTTPException(status_code=404, detail=f"Mercado desconocido: {market}. Prueba con {', '.join(hubs)}.")
        return hub

    @app.get("/v1/markets")
    def markets() -> dict[str, Any]:
        return {"markets": [{"id": slug, "product": hub.product, "source": hub.source} for slug, hub in hubs.items()]}

    @app.get("/v1/markets/{market}")
    def frame(market: str) -> dict[str, Any]:
        snapshot = hub_for(market).current()
        if snapshot is None:
            raise HTTPException(status_code=503, detail="Todavía no ha llegado ningún dato del exchange.")
        return snapshot

    @app.websocket("/v1/markets/{market}/stream")
    async def stream(ws: WebSocket, market: str) -> None:
        hub = hubs.get(market.lower())
        if hub is None:
            await ws.close(code=4404)
            return
        await ws.accept()
        snapshot = hub.current()
        if snapshot:  # el que llega a mitad empieza por la instantánea actual
            await ws.send_text(json.dumps(snapshot))
        hub.clients.add(ws)
        try:
            while True:  # no esperamos nada del cliente; solo detectar que se va
                await ws.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            hub.clients.discard(ws)

    return app


app = create_app()
