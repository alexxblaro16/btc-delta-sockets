import asyncio
import time

from delta import DeltaEncoder, diff_readings
from main import MarketHub, Simulator, readings_from_coinbase


def r(price, **extra):
    return {"price": price, "bid": price - 1, "ask": price + 1, "open24h": 90, "high24h": 110, "low24h": 80, "volume24h": 5, **extra}


def test_first_message_is_a_full_snapshot_then_deltas():
    enc = DeltaEncoder("BTC-USD", "test", now=lambda: "t")
    first = enc.next(r(100))
    assert first["kind"] == "snapshot" and first["sequence"] == 1 and first["readings"]["price"] == 100
    second = enc.next(r(101))
    assert second["kind"] == "delta" and second["sequence"] == 2
    assert second["patch"] == {"price": 101, "bid": 100, "ask": 102}


def test_nothing_is_sent_while_the_price_does_not_change():
    enc = DeltaEncoder("BTC-USD", "test")
    enc.next(r(100))
    assert enc.next(r(100)) is None
    assert enc.next(r(100, volume24h=9)) is None
    assert enc.skipped == 2
    nxt = enc.next(r(101, volume24h=9))
    assert nxt["kind"] == "delta" and nxt["sequence"] == 2
    assert nxt["patch"] == {"price": 101, "bid": 100, "ask": 102, "volume24h": 9}


def test_keyframe_every_eighth_tick():
    enc = DeltaEncoder("BTC-USD", "test")
    kinds = [enc.next(r(100 + i))["kind"] for i in range(17)]
    assert [i + 1 for i, k in enumerate(kinds) if k == "snapshot"] == [1, 8, 16]


def test_folding_the_messages_rebuilds_the_reading():
    enc = DeltaEncoder("BTC-USD", "test")
    frame = None
    last = None
    for i in range(30):
        last = r(100 + i * 3 + (i % 2), volume24h=5 + i)
        msg = enc.next(last)
        if msg["kind"] == "snapshot":
            frame = dict(msg["readings"])
        else:
            frame.update(msg["patch"])
    assert frame == last


def test_snapshot_for_late_clients_does_not_advance_the_sequence():
    enc = DeltaEncoder("BTC-USD", "test")
    assert enc.snapshot() is None
    enc.next(r(100))
    enc.next(r(101))
    snap = enc.snapshot()
    assert snap["kind"] == "snapshot" and snap["sequence"] == 2 and snap["readings"]["price"] == 101
    assert enc.next(r(102))["sequence"] == 3


def test_diff_only_contract_fields():
    assert diff_readings(r(100), r(100, volume24h=6, extra=1)) == {"volume24h": 6}


def test_readings_from_coinbase_ticker():
    ticker = {"price": "96512.34", "best_bid": "96512.33", "best_ask": "96512.35", "open_24h": "95000", "high_24h": "97000.1", "low_24h": "94321", "volume_24h": "8123.456"}
    assert readings_from_coinbase(ticker) == {
        "price": 96512.34, "bid": 96512.33, "ask": 96512.35, "open24h": 95000.0, "high24h": 97000.1, "low24h": 94321.0, "volume24h": 8123.456,
    }


def test_simulator_keeps_bid_below_ask():
    sim = Simulator("BTC-USD", seed=1)
    for _ in range(50):
        step = sim.step()
        assert step["bid"] < step["price"] < step["ask"]
        assert step["low24h"] <= step["price"] <= step["high24h"]


def test_online_reflects_how_fresh_the_exchange_data_is():
    # Se consulta desde un endpoint síncrono (hilo sin bucle de eventos): no puede depender de asyncio.
    hub = MarketHub("BTC-USD", source="coinbase")
    assert hub.current() is None
    hub.upstream_at = time.monotonic()
    asyncio.run(hub.publish(r(100)))
    assert hub.current()["online"] is True
    hub.upstream_at = time.monotonic() - 60
    assert hub.current()["online"] is False
