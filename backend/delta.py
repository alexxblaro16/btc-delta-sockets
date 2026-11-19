"""Codificador de deltas: el mismo algoritmo que src/stream/deltaEncoder.js.

Recibe cada lectura completa del exchange y solo genera un mensaje si ha
cambiado la cotización (el precio): nada de envíos continuos. El primer mensaje
y cada KEYFRAME_EVERY mensajes van como instantánea completa; el resto, como
delta con los campos que han cambiado desde el último envío.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable

KEYFRAME_EVERY = 8
READING_FIELDS = ("price", "bid", "ask", "open24h", "high24h", "low24h", "volume24h")

Readings = dict[str, float | None]


def pick(readings: Readings) -> Readings:
    return {field: readings.get(field) for field in READING_FIELDS}


def diff_readings(prev: Readings | None, nxt: Readings) -> Readings:
    """Campos del contrato que cambian de `prev` a `nxt`."""
    return {
        field: nxt[field]
        for field in READING_FIELDS
        if field in nxt and (prev is None or prev.get(field) != nxt[field])
    }


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class DeltaEncoder:
    def __init__(
        self,
        market: str,
        source: str,
        keyframe_every: int = KEYFRAME_EVERY,
        now: Callable[[], str] = iso_now,
    ) -> None:
        self.market = market
        self.source = source
        self.keyframe_every = keyframe_every
        self.now = now
        self.sequence = 0
        self.last: Readings | None = None
        self.skipped = 0  # ticks con el mismo precio que no se enviaron

    def _base(self, online: bool) -> dict[str, Any]:
        return {
            "market": self.market,
            "source": self.source,
            "online": online,
            "sequence": self.sequence,
            "timestamp": self.now(),
        }

    def next(self, readings: Readings, online: bool = True) -> dict[str, Any] | None:
        """Mensaje (instantánea o delta) para la lectura, o None si la cotización no ha cambiado."""
        if self.last is not None and self.last.get("price") == readings.get("price"):
            self.skipped += 1
            return None
        self.sequence += 1
        keyframe = self.last is None or self.sequence % self.keyframe_every == 0
        if keyframe:
            message = {"kind": "snapshot", **self._base(online), "readings": pick(readings)}
        else:
            message = {"kind": "delta", **self._base(online), "patch": diff_readings(self.last, readings)}
        self.last = pick(readings)
        return message

    def snapshot(self, online: bool = True) -> dict[str, Any] | None:
        """Instantánea del último estado, sin avanzar la secuencia (para quien se conecta a mitad)."""
        if self.last is None:
            return None
        return {"kind": "snapshot", **self._base(online), "readings": dict(self.last)}
