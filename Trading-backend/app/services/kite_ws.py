import asyncio
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

from fastapi import WebSocket
from kiteconnect import KiteTicker


class KiteWsManager:
    def __init__(self, controller: Any) -> None:
        self._controller = controller
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._clients: Set[WebSocket] = set()
        self._clients_lock = threading.Lock()
        self._ticker: Optional[KiteTicker] = None
        self._subscribed_tokens: List[int] = []
        self._token_symbol: Dict[int, str] = {}
        self._connecting = False

    def _ensure_stream(self) -> int:
        if self._ticker or self._connecting:
            return len(self._subscribed_tokens)
        self._connecting = True
        self._controller._require_kite()
        tokens, token_symbol = self._controller.get_ws_subscription()
        if not tokens:
            self._connecting = False
            return 0
        self._token_symbol = token_symbol
        self._subscribed_tokens = tokens
        self._ticker = KiteTicker(self._controller.api_key, self._controller.access_token)
        self._ticker.on_connect = self._on_connect
        self._ticker.on_ticks = self._on_ticks
        self._ticker.on_close = self._on_close
        self._ticker.on_error = self._on_error
        self._ticker.on_noreconnect = self._on_noreconnect
        self._ticker.on_reconnect = self._on_reconnect
        self._ticker.connect(threaded=True)
        self._connecting = False
        return len(self._subscribed_tokens)

    async def register(self, websocket: WebSocket) -> int:
        if self._loop is None:
            self._loop = asyncio.get_running_loop()
        count = self._ensure_stream()
        with self._clients_lock:
            self._clients.add(websocket)
        return count

    async def unregister(self, websocket: WebSocket) -> None:
        with self._clients_lock:
            self._clients.discard(websocket)
            has_clients = bool(self._clients)
        if not has_clients:
            self._stop_stream()

    def _stop_stream(self) -> None:
        if not self._ticker:
            return
        try:
            self._ticker.close()
        finally:
            self._ticker = None
            self._subscribed_tokens = []
            self._token_symbol = {}

    def _on_connect(self, ws: KiteTicker, response: Dict[str, Any]) -> None:
        if not self._subscribed_tokens:
            return
        ws.subscribe(self._subscribed_tokens)
        ws.set_mode(ws.MODE_FULL, self._subscribed_tokens)

    def _on_ticks(self, ws: KiteTicker, ticks: List[Dict[str, Any]]) -> None:
        normalized = [self._normalize_tick(tick) for tick in ticks]
        payload = [item for item in normalized if item]
        if not payload or not self._loop:
            return
        asyncio.run_coroutine_threadsafe(self._broadcast(payload), self._loop)

    def _on_close(self, ws: KiteTicker, code: int, reason: str) -> None:
        self._ticker = None

    def _on_error(self, ws: KiteTicker, code: int, reason: str) -> None:
        self._ticker = None

    def _on_reconnect(self, ws: KiteTicker, attempts_count: int) -> None:
        return

    def _on_noreconnect(self, ws: KiteTicker) -> None:
        self._ticker = None

    async def _broadcast(self, ticks: List[Dict[str, Any]]) -> None:
        with self._clients_lock:
            clients = list(self._clients)
        if not clients:
            return
        message = {"type": "ticks", "data": ticks}
        stale: List[WebSocket] = []
        for client in clients:
            try:
                await client.send_json(message)
            except Exception:
                stale.append(client)
        if stale:
            with self._clients_lock:
                for client in stale:
                    self._clients.discard(client)

    def _normalize_tick(self, tick: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        token = tick.get("instrument_token")
        if token is None:
            return None
        symbol = self._token_symbol.get(token, str(token))
        ohlc = tick.get("ohlc") or {}
        close = ohlc.get("close")
        ltp = tick.get("last_price")
        change_pct = None
        if isinstance(ltp, (int, float)) and isinstance(close, (int, float)) and close:
            change_pct = ((ltp - close) / close) * 100
        ts = tick.get("exchange_timestamp") or tick.get("last_trade_time")
        if isinstance(ts, datetime):
            ts_value = ts.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        else:
            ts_value = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        return {
            "symbol": symbol,
            "token": token,
            "ltp": ltp,
            "open": ohlc.get("open"),
            "high": ohlc.get("high"),
            "low": ohlc.get("low"),
            "close": close,
            "volume": tick.get("volume_traded") or tick.get("volume"),
            "change_pct": change_pct,
            "timestamp": ts_value,
        }


def build_kite_ws_manager(controller: Any) -> KiteWsManager:
    return KiteWsManager(controller)
