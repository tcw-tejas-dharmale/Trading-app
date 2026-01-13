from __future__ import annotations

import asyncio
import math
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

from fastapi import HTTPException, status
from zoneinfo import ZoneInfo

from app.controllers.market_data_controller import MarketDataController
from app.schemas.trade import StopLossMethod, TargetMode, TradePreviewRequest, TradePreviewResponse


IST = ZoneInfo("Asia/Kolkata")


def _now_ist() -> datetime:
    return datetime.now(IST)


def _market_hours_ist(now: Optional[datetime] = None) -> Tuple[datetime, datetime]:
    now = now or _now_ist()
    start = now.replace(hour=9, minute=15, second=0, microsecond=0)
    end = now.replace(hour=15, minute=30, second=0, microsecond=0)
    return start, end


def _mis_squareoff_time_ist(now: Optional[datetime] = None) -> datetime:
    now = now or _now_ist()
    # Conservative cutoff: square off before Zerodha's RMS cutoff window.
    return now.replace(hour=15, minute=20, second=0, microsecond=0)


def _round_to_tick(price: float, tick_size: float) -> float:
    if tick_size <= 0:
        return round(price, 2)
    return round(round(price / tick_size) * tick_size, 10)


def _atr_from_candles(candles: list[dict], period: int) -> float:
    if not candles or len(candles) < period + 1:
        raise ValueError(f"Need at least {period + 1} candles for ATR({period}).")
    true_ranges: list[float] = []
    prev_close = float(candles[0]["close"])
    for candle in candles[1:]:
        high = float(candle["high"])
        low = float(candle["low"])
        close = float(candle["close"])
        tr = max(high - low, abs(high - prev_close), abs(low - prev_close))
        true_ranges.append(tr)
        prev_close = close
    window = true_ranges[-period:]
    return sum(window) / float(period)


@dataclass
class ManagedTrade:
    trade_id: str
    user_id: int
    tradingsymbol: str
    exchange: str
    product: str
    quantity: int
    risk_inr: float
    entry_order_id: str
    sl_order_id: str
    target_order_id: Optional[str]
    squareoff_at: Optional[datetime]
    target_mode: TargetMode
    target_price: Optional[float]


class TradeEngine:
    def __init__(self, market: MarketDataController) -> None:
        self._market = market
        self._managed: dict[str, ManagedTrade] = {}
        self._managed_lock = asyncio.Lock()

    def _instrument_tick_size(self, tradingsymbol: str) -> float:
        try:
            symbol_map = self._market._symbol_map()  # existing controller helper
            inst = symbol_map.get(tradingsymbol.upper())
            if inst and inst.get("tick_size"):
                return float(inst["tick_size"])
        except Exception:
            pass
        return 0.05

    def _product_for_intent(self, intent: str) -> str:
        return "MIS" if intent == "intraday" else "CNC"

    def _within_trading_hours(self) -> bool:
        now = _now_ist()
        start, end = _market_hours_ist(now)
        return start <= now <= end

    def _current_margin_available(self) -> Optional[float]:
        kite = self._market._require_kite()
        try:
            eq = (kite.margins() or {}).get("equity", {})
            available = (
                (eq.get("available") or {}).get("cash")
                or (eq.get("available") or {}).get("live_balance")
                or (eq.get("available") or {}).get("opening_balance")
            )
            return float(available) if available is not None else None
        except Exception:
            return None

    def _required_margin(self, params: Dict[str, Any]) -> Optional[float]:
        try:
            margin_data = self._market.get_order_margins(params)
            total = margin_data.get("total")
            return float(total) if total is not None else None
        except Exception:
            return None

    async def _managed_risk_for_user(self, user_id: int) -> float:
        async with self._managed_lock:
            return sum(t.risk_inr for t in self._managed.values() if t.user_id == user_id)

    def preview(self, req: TradePreviewRequest, user_id: int) -> TradePreviewResponse:
        tradingsymbol = req.tradingsymbol.upper()
        exchange = req.exchange.upper()
        product = self._product_for_intent(req.intent.value)
        within_hours = self._within_trading_hours()
        if not within_hours:
            return TradePreviewResponse(
                decision="NO_BUY",
                reason="Outside market trading hours.",
                tradingsymbol=tradingsymbol,
                exchange=exchange,
                product=product,
                entry_price=float(req.ltp),
                stop_loss_price=float(req.ltp),
                quantity=0,
                risk_per_unit=0.0,
                total_risk=0.0,
                required_margin=None,
                margin_available=self._current_margin_available(),
                within_trading_hours=within_hours,
            )

        entry_price = float(req.ltp)
        tick = self._instrument_tick_size(tradingsymbol)

        if req.stop_loss_method == StopLossMethod.percent:
            sl_price = entry_price * (1.0 - float(req.stop_loss_percent) / 100.0)
        else:
            if not req.candles:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="candles are required for ATR stop-loss in this module.",
                )
            try:
                atr = _atr_from_candles(req.candles, req.atr_period)
            except Exception as exc:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
            sl_price = entry_price - (atr * float(req.atr_multiplier))

        sl_price = max(0.0, _round_to_tick(sl_price, tick))
        risk_per_unit = entry_price - sl_price
        if risk_per_unit <= 0:
            return TradePreviewResponse(
                decision="NO_BUY",
                reason="Invalid stop-loss (risk_per_unit <= 0).",
                tradingsymbol=tradingsymbol,
                exchange=exchange,
                product=product,
                entry_price=entry_price,
                stop_loss_price=sl_price,
                quantity=0,
                risk_per_unit=0.0,
                total_risk=0.0,
                required_margin=None,
                margin_available=self._current_margin_available(),
                within_trading_hours=True,
            )

        if req.quantity_override is not None:
            quantity = int(req.quantity_override)
        else:
            quantity = int(math.floor(float(req.account_risk_inr) / risk_per_unit))
        if quantity <= 0:
            return TradePreviewResponse(
                decision="NO_BUY",
                reason="Risk limit too small for even 1 quantity.",
                tradingsymbol=tradingsymbol,
                exchange=exchange,
                product=product,
                entry_price=entry_price,
                stop_loss_price=sl_price,
                quantity=0,
                risk_per_unit=risk_per_unit,
                total_risk=0.0,
                required_margin=None,
                margin_available=self._current_margin_available(),
                within_trading_hours=True,
            )

        total_risk = float(quantity) * risk_per_unit
        if total_risk > float(req.account_risk_inr):
            return TradePreviewResponse(
                decision="NO_BUY",
                reason="Quantity would exceed account_risk_inr.",
                tradingsymbol=tradingsymbol,
                exchange=exchange,
                product=product,
                entry_price=entry_price,
                stop_loss_price=sl_price,
                quantity=0,
                risk_per_unit=risk_per_unit,
                total_risk=0.0,
                required_margin=None,
                margin_available=self._current_margin_available(),
                within_trading_hours=True,
            )

        margin_available = self._current_margin_available()
        required_margin = self._required_margin(
            {
                "variety": "regular",
                "exchange": exchange,
                "tradingsymbol": tradingsymbol,
                "transaction_type": "BUY",
                "quantity": quantity,
                "order_type": "MARKET",
                "product": product,
                "validity": "DAY",
            }
        )
        if margin_available is not None and required_margin is not None and required_margin > margin_available:
            return TradePreviewResponse(
                decision="NO_BUY",
                reason="Insufficient margin available.",
                tradingsymbol=tradingsymbol,
                exchange=exchange,
                product=product,
                entry_price=entry_price,
                stop_loss_price=sl_price,
                quantity=0,
                risk_per_unit=risk_per_unit,
                total_risk=0.0,
                required_margin=required_margin,
                margin_available=margin_available,
                within_trading_hours=True,
            )

        return TradePreviewResponse(
            decision="BUY",
            reason=None,
            tradingsymbol=tradingsymbol,
            exchange=exchange,
            product=product,
            entry_price=entry_price,
            stop_loss_price=sl_price,
            quantity=quantity,
            risk_per_unit=risk_per_unit,
            total_risk=total_risk,
            required_margin=required_margin,
            margin_available=margin_available,
            within_trading_hours=True,
        )

    async def execute(
        self,
        req: TradePreviewRequest,
        user_id: int,
        *,
        poll_timeout_seconds: int = 20,
        poll_interval_seconds: float = 0.7,
    ) -> Dict[str, Any]:
        preview = self.preview(req, user_id)
        if preview.decision != "BUY":
            return {"decision": "NO_BUY", "reason": preview.reason}

        existing_risk = await self._managed_risk_for_user(user_id)
        if existing_risk + preview.total_risk > float(req.account_risk_inr):
            return {
                "decision": "NO_BUY",
                "reason": "Total managed risk would exceed account_risk_inr.",
            }

        kite = self._market._require_kite()
        trade_id = uuid.uuid4().hex

        entry_params = {
            "variety": "regular",
            "exchange": preview.exchange,
            "tradingsymbol": preview.tradingsymbol,
            "transaction_type": "BUY",
            "quantity": preview.quantity,
            "order_type": "MARKET",
            "product": preview.product,
            "validity": "DAY",
        }
        try:
            entry_order_id = kite.place_order(**entry_params)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Entry order failed: {exc}") from exc

        # Wait for fill
        entry_avg_price = await self._wait_for_fill(
            order_id=entry_order_id,
            timeout_seconds=poll_timeout_seconds,
            poll_interval_seconds=poll_interval_seconds,
        )

        tick = self._instrument_tick_size(preview.tradingsymbol)
        stop_loss_price = preview.stop_loss_price
        if req.stop_loss_method == StopLossMethod.percent:
            stop_loss_price = float(entry_avg_price) * (1.0 - float(req.stop_loss_percent) / 100.0)
        elif req.candles:
            atr = _atr_from_candles(req.candles, req.atr_period)
            stop_loss_price = float(entry_avg_price) - (atr * float(req.atr_multiplier))
        stop_loss_price = max(0.0, _round_to_tick(stop_loss_price, tick))

        sl_order_type = (req.sl_order_type or "SL-M").strip().upper()
        if sl_order_type not in {"SL", "SL-M"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="sl_order_type must be SL or SL-M.")

        # SELL SL leg
        trigger = stop_loss_price
        price = None
        if sl_order_type == "SL":
            # For SELL SL, limit price should be <= trigger.
            price = max(0.0, _round_to_tick(stop_loss_price - tick, tick))

        sl_params = {
            "variety": "regular",
            "exchange": preview.exchange,
            "tradingsymbol": preview.tradingsymbol,
            "transaction_type": "SELL",
            "quantity": preview.quantity,
            "order_type": sl_order_type,
            "product": preview.product,
            "validity": "DAY",
            "trigger_price": trigger,
        }
        if price is not None:
            sl_params["price"] = price
        try:
            sl_order_id = kite.place_order(**sl_params)
        except Exception as exc:
            # Best-effort cancel entry if SL couldn't be placed (risk control).
            try:
                kite.cancel_order(variety="regular", order_id=entry_order_id)
            except Exception:
                pass
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Stop-loss order failed: {exc}") from exc

        # Target leg
        target_order_id: Optional[str] = None
        target_mode = req.target_mode
        if preview.product == "MIS" and req.use_close_target_for_mis:
            target_mode = TargetMode.close

        if req.target_price and target_mode == TargetMode.limit:
            target_price = _round_to_tick(float(req.target_price), tick)
            target_params = {
                "variety": "regular",
                "exchange": preview.exchange,
                "tradingsymbol": preview.tradingsymbol,
                "transaction_type": "SELL",
                "quantity": preview.quantity,
                "order_type": "LIMIT",
                "product": preview.product,
                "validity": "DAY",
                "price": target_price,
            }
            try:
                target_order_id = kite.place_order(**target_params)
            except Exception:
                target_order_id = None

        squareoff_at = _mis_squareoff_time_ist() if preview.product == "MIS" else None

        async with self._managed_lock:
            self._managed[trade_id] = ManagedTrade(
                trade_id=trade_id,
                user_id=user_id,
                tradingsymbol=preview.tradingsymbol,
                exchange=preview.exchange,
                product=preview.product,
                quantity=preview.quantity,
                risk_inr=preview.total_risk,
                entry_order_id=entry_order_id,
                sl_order_id=sl_order_id,
                target_order_id=target_order_id,
                squareoff_at=squareoff_at,
                target_mode=target_mode,
                target_price=float(req.target_price) if req.target_price else None,
            )

        asyncio.create_task(self._run_managed_trade(trade_id))

        return {
            "decision": "BUY",
            "trade_id": trade_id,
            "product": preview.product,
            "entry_order_id": entry_order_id,
            "sl_order_id": sl_order_id,
            "target_order_id": target_order_id,
            "entry_avg_price": entry_avg_price,
            "stop_loss_price": stop_loss_price,
            "quantity": preview.quantity,
        }

    async def _wait_for_fill(self, order_id: str, timeout_seconds: int, poll_interval_seconds: float) -> float:
        kite = self._market._require_kite()
        deadline = asyncio.get_event_loop().time() + float(timeout_seconds)
        last_status: Optional[str] = None
        while asyncio.get_event_loop().time() < deadline:
            try:
                hist = kite.order_history(order_id)
                if hist:
                    last = hist[-1]
                    last_status = (last.get("status") or "").upper()
                    if last_status == "COMPLETE":
                        avg = last.get("average_price") or last.get("price") or 0
                        avg = float(avg)
                        if avg <= 0:
                            avg = float(last.get("trigger_price") or 0) or 0.0
                        if avg <= 0:
                            avg = 0.0
                        return avg
                    if last_status in {"REJECTED", "CANCELLED"}:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Entry order {last_status.lower()}.",
                        )
            except HTTPException:
                raise
            except Exception:
                pass
            await asyncio.sleep(poll_interval_seconds)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Timed out waiting for entry fill (last_status={last_status}).",
        )

    async def _run_managed_trade(self, trade_id: str) -> None:
        try:
            while True:
                trade = await self._get_trade(trade_id)
                if not trade:
                    return

                # Square-off check (MIS)
                if trade.squareoff_at and _now_ist() >= trade.squareoff_at:
                    await self._squareoff(trade)
                    await self._forget(trade_id)
                    return

                # Target-mode close: if LTP >= target -> close position and cancel SL.
                if trade.target_mode == TargetMode.close and trade.target_price:
                    try:
                        quote = self._market.get_cached_quotes([f"{trade.exchange}:{trade.tradingsymbol}"])
                        ltp = None
                        if quote:
                            q = quote.get(f"{trade.exchange}:{trade.tradingsymbol}") or {}
                            ltp = (q.get("last_price") or q.get("last_price"))
                        if ltp is None:
                            q2 = self._market.get_last_quotes_snapshot([f"{trade.exchange}:{trade.tradingsymbol}"])
                            q = (q2 or {}).get(f"{trade.exchange}:{trade.tradingsymbol}") or {}
                            ltp = q.get("last_price")
                        if ltp is not None and float(ltp) >= float(trade.target_price):
                            await self._close_position_market(trade)
                            await self._cancel_order_safe(trade.target_order_id)
                            await self._cancel_order_safe(trade.sl_order_id)
                            await self._forget(trade_id)
                            return
                    except Exception:
                        pass

                # OCO cancellation via order status
                entry_done, sl_done, target_done = await self._check_order_states(trade)
                if sl_done:
                    await self._cancel_order_safe(trade.target_order_id)
                    await self._forget(trade_id)
                    return
                if target_done:
                    await self._cancel_order_safe(trade.sl_order_id)
                    await self._forget(trade_id)
                    return

                if entry_done is False:
                    # Entry got cancelled/rejected somehow; cancel children.
                    await self._cancel_order_safe(trade.sl_order_id)
                    await self._cancel_order_safe(trade.target_order_id)
                    await self._forget(trade_id)
                    return

                await asyncio.sleep(1.0)
        except Exception:
            # Never crash the server for background loops.
            return

    async def _check_order_states(self, trade: ManagedTrade) -> Tuple[Optional[bool], bool, bool]:
        kite = self._market._require_kite()

        def _is_complete(status_value: str) -> bool:
            return status_value.upper() == "COMPLETE"

        def _is_dead(status_value: str) -> bool:
            return status_value.upper() in {"REJECTED", "CANCELLED"}

        entry_done: Optional[bool] = None
        sl_done = False
        target_done = False
        try:
            entry_hist = kite.order_history(trade.entry_order_id) or []
            if entry_hist:
                st = (entry_hist[-1].get("status") or "").upper()
                if _is_complete(st):
                    entry_done = True
                elif _is_dead(st):
                    entry_done = False
        except Exception:
            pass

        try:
            sl_hist = kite.order_history(trade.sl_order_id) or []
            if sl_hist:
                st = (sl_hist[-1].get("status") or "").upper()
                sl_done = _is_complete(st)
        except Exception:
            pass

        if trade.target_order_id:
            try:
                t_hist = kite.order_history(trade.target_order_id) or []
                if t_hist:
                    st = (t_hist[-1].get("status") or "").upper()
                    target_done = _is_complete(st)
            except Exception:
                pass

        return entry_done, sl_done, target_done

    async def _squareoff(self, trade: ManagedTrade) -> None:
        await self._close_position_market(trade)
        await self._cancel_order_safe(trade.sl_order_id)
        await self._cancel_order_safe(trade.target_order_id)

    async def _close_position_market(self, trade: ManagedTrade) -> None:
        kite = self._market._require_kite()
        try:
            kite.place_order(
                variety="regular",
                exchange=trade.exchange,
                tradingsymbol=trade.tradingsymbol,
                transaction_type="SELL",
                quantity=trade.quantity,
                order_type="MARKET",
                product=trade.product,
                validity="DAY",
            )
        except Exception:
            return

    async def _cancel_order_safe(self, order_id: Optional[str]) -> None:
        if not order_id:
            return
        kite = self._market._require_kite()
        try:
            kite.cancel_order(variety="regular", order_id=order_id)
        except Exception:
            return

    async def _get_trade(self, trade_id: str) -> Optional[ManagedTrade]:
        async with self._managed_lock:
            return self._managed.get(trade_id)

    async def _forget(self, trade_id: str) -> None:
        async with self._managed_lock:
            self._managed.pop(trade_id, None)
