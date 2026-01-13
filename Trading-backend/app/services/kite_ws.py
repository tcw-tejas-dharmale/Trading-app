import asyncio
import json
import logging
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Set

from fastapi import WebSocket
from kiteconnect import KiteTicker


class _KiteTicker403Filter(logging.Filter):
    """Filter out the known 403 upgrade errors that Kite logs during retries."""

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        if record.levelno == logging.ERROR and "Connection error" in message and "403" in message:
            return False
        return True


_KITE_TICKER_LOGGER = logging.getLogger("kiteconnect.ticker")
if not getattr(_KITE_TICKER_LOGGER, "_suppress_403_upgrade", False):
    _KITE_TICKER_LOGGER.addFilter(_KiteTicker403Filter())
    _KITE_TICKER_LOGGER._suppress_403_upgrade = True


class KiteWsManager:
    def __init__(self, controller: Any) -> None:
        self._controller = controller
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._clients: Set[WebSocket] = set()
        self._clients_lock = threading.Lock()
        self._ticker: Optional[KiteTicker] = None
        self._last_error: Optional[Dict[str, Any]] = None
        self._token_symbol: Dict[int, str] = {}
        self._default_tokens: Set[int] = set()
        self._dynamic_refcounts: Dict[int, int] = {}
        self._client_subscriptions: Dict[int, Set[int]] = {}
        self._subscription_lock = threading.Lock()
        self._connecting = False

    def _ensure_stream(self) -> int:
        if self._ticker or self._connecting:
            return len(self._get_all_tokens())
        self._connecting = True
        try:
            self._controller._require_kite()
            tokens, token_symbol = self._controller.get_ws_subscription()
            normalized_tokens: List[int] = []
            for token in tokens:
                try:
                    normalized_tokens.append(int(token))
                except (TypeError, ValueError):
                    continue
            if not normalized_tokens:
                return 0
            normalized_symbol: Dict[int, str] = {}
            for key, value in token_symbol.items():
                try:
                    normalized_symbol[int(key)] = value
                except (TypeError, ValueError):
                    continue
            self._token_symbol.update(normalized_symbol)
            with self._subscription_lock:
                self._default_tokens = set(normalized_tokens)
            ticker = KiteTicker(self._controller.api_key, self._controller.access_token)
            ticker.on_connect = self._on_connect
            ticker.on_ticks = self._on_ticks
            ticker.on_close = self._on_close
            ticker.on_error = self._on_error
            ticker.on_noreconnect = self._on_noreconnect
            ticker.on_reconnect = self._on_reconnect
            ticker.connect(threaded=True)
            self._ticker = ticker
            return len(self._get_all_tokens())
        except Exception as exc:
            self._ticker = None
            payload = {
                "type": "error",
                "detail": "Failed to start Zerodha websocket stream.",
                "reason": str(exc),
            }
            self._last_error = payload
            self._emit_status(payload)
            return 0
        finally:
            self._connecting = False

    async def register(self, websocket: WebSocket) -> int:
        if self._loop is None:
            self._loop = asyncio.get_running_loop()
        count = self._ensure_stream()
        with self._clients_lock:
            self._clients.add(websocket)
        with self._subscription_lock:
            self._client_subscriptions.setdefault(id(websocket), set())
        if self._last_error:
            try:
                await websocket.send_json(self._last_error)
            except Exception:
                pass
        return count

    async def unregister(self, websocket: WebSocket) -> None:
        self._cleanup_client_subscriptions(websocket)
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
            self._default_tokens = set()
            self._dynamic_refcounts.clear()
            self._client_subscriptions.clear()
            self._token_symbol = {}

    def _emit_status(self, payload: Dict[str, Any]) -> None:
        if not self._loop:
            return
        asyncio.run_coroutine_threadsafe(self._broadcast_status(payload), self._loop)

    def _on_connect(self, ws: KiteTicker, response: Dict[str, Any]) -> None:
        self._last_error = None
        self._emit_status({"type": "status", "state": "kite_connected"})
        tokens = self._get_all_tokens()
        if not tokens:
            return
        ws.subscribe(tokens)
        ws.set_mode(ws.MODE_FULL, tokens)

    def _on_ticks(self, ws: KiteTicker, ticks: List[Dict[str, Any]]) -> None:
        normalized = [self._normalize_tick(tick) for tick in ticks]
        payload = [item for item in normalized if item]
        if not payload or not self._loop:
            return
        asyncio.run_coroutine_threadsafe(self._broadcast(payload), self._loop)

    def _on_close(self, ws: KiteTicker, code: int, reason: str) -> None:
        self._ticker = None
        payload = {"type": "status", "state": "kite_closed", "code": code, "reason": reason}
        self._last_error = payload
        self._emit_status(payload)

    def _on_error(self, ws: KiteTicker, code: int, reason: str) -> None:
        self._ticker = None
        reason_text = str(reason)
        if "403" in reason_text or "Forbidden" in reason_text:
            payload = {
                "type": "error",
                "detail": "Zerodha websocket authorization failed. Reconnect Zerodha to refresh the session.",
                "code": code,
                "reason": reason_text,
            }
        else:
            payload = {"type": "error", "detail": "Zerodha websocket error.", "code": code, "reason": reason_text}
        self._last_error = payload
        self._emit_status(payload)

    def _on_reconnect(self, ws: KiteTicker, attempts_count: int) -> None:
        return

    def _on_noreconnect(self, ws: KiteTicker) -> None:
        self._ticker = None
        payload = {"type": "error", "detail": "Zerodha websocket stopped reconnecting."}
        self._last_error = payload
        self._emit_status(payload)

    def _get_all_tokens(self) -> List[int]:
        with self._subscription_lock:
            return list(self._default_tokens | set(self._dynamic_refcounts.keys()))

    def _ensure_token_symbols(self, tokens: Iterable[int]) -> None:
        for token in tokens:
            if token in self._token_symbol:
                continue
            symbol = self._controller.get_symbol_for_token(token)
            if symbol:
                self._token_symbol[token] = symbol
            else:
                self._token_symbol[token] = str(token)

    def _activate_tokens(self, tokens: Iterable[int]) -> None:
        if not tokens or not self._ticker:
            return
        try:
            token_list = list(tokens)
            self._ticker.subscribe(token_list)
            self._ticker.set_mode(self._ticker.MODE_FULL, token_list)
        except Exception:
            pass

    def _parse_token_list(self, value: Any) -> List[int]:
        items: List[Any] = []
        if isinstance(value, list):
            items = value
        elif value is not None:
            items = [value]
        normalized: List[int] = []
        seen: Set[int] = set()
        for item in items:
            try:
                token = int(item)
            except (TypeError, ValueError):
                continue
            if token in seen:
                continue
            seen.add(token)
            normalized.append(token)
        return normalized

    def _parse_mode_payload(self, value: Any) -> tuple[Optional[str], Optional[List[int]]]:
        if not isinstance(value, list) or not value:
            return None, None
        mode_value = str(value[0]).strip()
        tokens: Optional[List[int]] = None
        if len(value) > 1:
            tokens = self._parse_token_list(value[1])
        return mode_value, tokens

    def _subscribe_tokens_for_client(self, websocket: WebSocket, tokens: List[int]) -> List[int]:
        if not tokens:
            return []
        added_dynamic: List[int] = []
        client_id = id(websocket)
        with self._subscription_lock:
            client_tokens = self._client_subscriptions.setdefault(client_id, set())
            for token in tokens:
                if token in client_tokens:
                    continue
                client_tokens.add(token)
                if token in self._default_tokens:
                    continue
                current_count = self._dynamic_refcounts.get(token, 0)
                self._dynamic_refcounts[token] = current_count + 1
                if current_count == 0:
                    added_dynamic.append(token)
        if added_dynamic:
            self._ensure_token_symbols(added_dynamic)
            self._activate_tokens(added_dynamic)
        return tokens

    def _unsubscribe_tokens_for_client(self, websocket: WebSocket, tokens: List[int]) -> List[int]:
        if not tokens:
            return []
        removed_dynamic: List[int] = []
        client_id = id(websocket)
        with self._subscription_lock:
            client_tokens = self._client_subscriptions.get(client_id)
            if not client_tokens:
                return []
            for token in tokens:
                if token not in client_tokens:
                    continue
                client_tokens.remove(token)
                if token in self._default_tokens:
                    continue
                count = self._dynamic_refcounts.get(token, 0) - 1
                if count <= 0:
                    self._dynamic_refcounts.pop(token, None)
                    removed_dynamic.append(token)
                else:
                    self._dynamic_refcounts[token] = count
        if removed_dynamic and self._ticker:
            try:
                self._ticker.unsubscribe(removed_dynamic)
            except Exception:
                pass
        return tokens

    def _cleanup_client_subscriptions(self, websocket: WebSocket) -> None:
        client_id = id(websocket)
        removed_dynamic: List[int] = []
        with self._subscription_lock:
            tokens = self._client_subscriptions.pop(client_id, set())
            for token in tokens:
                if token in self._default_tokens:
                    continue
                count = self._dynamic_refcounts.get(token, 0) - 1
                if count <= 0:
                    self._dynamic_refcounts.pop(token, None)
                    removed_dynamic.append(token)
                else:
                    self._dynamic_refcounts[token] = count
        if removed_dynamic and self._ticker:
            try:
                self._ticker.unsubscribe(removed_dynamic)
            except Exception:
                pass

    def _set_mode(self, mode: str, tokens: Optional[List[int]]) -> Optional[str]:
        if not self._ticker:
            return "Ticker connection is not yet established."
        mode_key = mode.strip().lower()
        mode_map = {
            "ltp": self._ticker.MODE_LTP,
            "quote": self._ticker.MODE_QUOTE,
            "full": self._ticker.MODE_FULL,
        }
        mode_choice = mode_map.get(mode_key)
        if mode_choice is None:
            return f"Unsupported mode '{mode}'."
        target_tokens = tokens or self._get_all_tokens()
        if not target_tokens:
            return "No tokens available to apply mode."
        try:
            self._ticker.set_mode(mode_choice, target_tokens)
        except Exception as exc:
            return f"Failed to set mode: {exc}"
        return None

    async def handle_client_message(self, websocket: WebSocket, raw_message: str) -> None:
        if not raw_message:
            return
        try:
            payload = json.loads(raw_message)
        except ValueError:
            await websocket.send_json({"type": "error", "detail": "Malformed websocket payload."})
            return
        if not isinstance(payload, dict):
            await websocket.send_json({"type": "error", "detail": "Expected an action object."})
            return
        action = (payload.get("a") or payload.get("action") or "").strip().lower()
        values = payload.get("v")
        if action == "subscribe":
            tokens = self._parse_token_list(values)
            if not tokens:
                await websocket.send_json({"type": "error", "detail": "No tokens provided for subscribe."})
                return
            self._subscribe_tokens_for_client(websocket, tokens)
            await websocket.send_json({"type": "status", "state": "subscribed", "tokens": tokens})
        elif action == "unsubscribe":
            tokens = self._parse_token_list(values)
            if not tokens:
                await websocket.send_json({"type": "error", "detail": "No tokens provided for unsubscribe."})
                return
            self._unsubscribe_tokens_for_client(websocket, tokens)
            await websocket.send_json({"type": "status", "state": "unsubscribed", "tokens": tokens})
        elif action == "mode":
            mode_value, mode_tokens = self._parse_mode_payload(values)
            if not mode_value:
                await websocket.send_json({"type": "error", "detail": "Mode value is required."})
                return
            detail = self._set_mode(mode_value, mode_tokens)
            if detail:
                await websocket.send_json({"type": "error", "detail": detail})
            else:
                await websocket.send_json(
                    {"type": "status", "state": "mode", "mode": mode_value, "tokens": mode_tokens or []}
                )
        else:
            await websocket.send_json(
                {"type": "error", "detail": f"Unsupported websocket action '{action}'."}
            )

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

    async def _broadcast_status(self, payload: Dict[str, Any]) -> None:
        with self._clients_lock:
            clients = list(self._clients)
        if not clients:
            return
        stale: List[WebSocket] = []
        for client in clients:
            try:
                await client.send_json(payload)
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
