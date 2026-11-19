"""Prueba de contrato (Unidad 5): la API devuelve exactamente los campos acordados.

Usa la fuente simulada para no depender de la red.
"""

import json

import pytest
from fastapi.testclient import TestClient

from main import create_app

FRAME_FIELDS = {"kind", "market", "source", "online", "sequence", "timestamp", "readings"}
READING_FIELDS = {"price", "bid", "ask", "open24h", "high24h", "low24h", "volume24h"}


@pytest.fixture()
def client():
    with TestClient(create_app(source="simulated")) as c:
        yield c


def wait_for_first_tick(client):
    with client.websocket_connect("/v1/markets/btc-usd/stream") as ws:
        return json.loads(ws.receive_text())


def test_markets_lists_both_pairs(client):
    assert [m["id"] for m in client.get("/v1/markets").json()["markets"]] == ["btc-usd", "btc-eur"]


def test_frame_keeps_the_contract(client):
    wait_for_first_tick(client)
    res = client.get("/v1/markets/btc-usd")
    assert res.status_code == 200
    frame = res.json()
    assert set(frame) == FRAME_FIELDS
    assert set(frame["readings"]) == READING_FIELDS
    assert frame["kind"] == "snapshot" and frame["market"] == "BTC-USD" and frame["source"] == "simulated"


def test_unknown_market_is_404(client):
    assert client.get("/v1/markets/doge-usd").status_code == 404


def test_stream_starts_with_a_snapshot_and_continues_in_order(client):
    with client.websocket_connect("/v1/markets/btc-eur/stream") as ws:
        messages = [json.loads(ws.receive_text()) for _ in range(10)]
    assert messages[0]["kind"] == "snapshot"
    assert messages[0]["market"] == "BTC-EUR"
    seqs = [m["sequence"] for m in messages]
    prices = [(m.get("readings") or m["patch"]).get("price") for m in messages]
    # El primero puede ser la instantánea del momento; después, uno a uno sin huecos.
    assert all(b == a + 1 for a, b in zip(seqs[1:], seqs[2:]))
    # Solo se envía cuando cambia la cotización: cada mensaje trae un precio distinto del anterior.
    assert all(p is not None for p in prices[1:])
    assert all(a != b for a, b in zip(prices[1:], prices[2:]))
    for m in messages:
        if m["kind"] == "delta":
            assert set(m["patch"]) <= READING_FIELDS
        if m["kind"] == "snapshot":
            assert set(m["readings"]) == READING_FIELDS
