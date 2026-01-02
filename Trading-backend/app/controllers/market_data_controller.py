import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from kiteconnect import KiteConnect
from kiteconnect.exceptions import KiteException

from app.core.config import settings
from app.models.market import Stock


class MarketDataController:
    def __init__(self) -> None:
        self.api_key = settings.ZERODHA_API_KEY
        self.api_secret = settings.ZERODHA_API_SECRET
        self.access_token = settings.ZERODHA_ACCESS_TOKEN or None
        self.kite = KiteConnect(api_key=self.api_key) if self.api_key else None
        if self.kite and self.access_token:
            self.kite.set_access_token(self.access_token)

        self._instruments_cache: Dict[str, Any] = {"data": None, "ts": 0}
        self._quotes_cache: Dict[str, Dict[str, Any]] = {}
        self._positions_cache: Dict[str, Any] = {"data": None, "ts": 0}
        self._candles_cache: Dict[str, Dict[str, Any]] = {}

    def _require_kite(self) -> KiteConnect:
        if not self.kite:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Zerodha API key is not configured.",
            )
        if not self.access_token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Zerodha access token missing. Please connect Zerodha and try again.",
            )
        self.kite.set_access_token(self.access_token)
        return self.kite

    def get_login_url(self) -> str:
        if not self.kite:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Zerodha API key is not configured.",
            )
        return self.kite.login_url()

    def create_session(self, request_token: str) -> Dict[str, Any]:
        if not self.kite or not self.api_secret:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Zerodha API key/secret is not configured.",
            )
        try:
            session = self.kite.generate_session(request_token, api_secret=self.api_secret)
        except KiteException as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to create Zerodha session. Please check the request token.",
            ) from exc
        self.access_token = session.get("access_token")
        if self.access_token:
            self.kite.set_access_token(self.access_token)
        return session

    def _cached_instruments(self, ttl_seconds: int = 600) -> List[Dict[str, Any]]:
        now = time.time()
        if self._instruments_cache["data"] and now - self._instruments_cache["ts"] < ttl_seconds:
            return self._instruments_cache["data"]
        kite = self._require_kite()
        try:
            instruments = kite.instruments("NSE")
        except KiteException as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Unable to fetch instruments from Zerodha.",
            ) from exc
        self._instruments_cache = {"data": instruments, "ts": now}
        return instruments

    def _symbol_map(self) -> Dict[str, Dict[str, Any]]:
        instruments = self._cached_instruments()
        symbol_map = {}
        for inst in instruments:
            if inst.get("segment") != "NSE":
                continue
            if inst.get("instrument_type") != "EQ":
                continue
            symbol_map[inst.get("tradingsymbol")] = inst
        return symbol_map

    def _get_positions(self, ttl_seconds: int = 5) -> Dict[str, Any]:
        now = time.time()
        if self._positions_cache["data"] and now - self._positions_cache["ts"] < ttl_seconds:
            return self._positions_cache["data"]
        kite = self._require_kite()
        try:
            positions = kite.positions().get("net", [])
        except KiteException as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Unable to fetch positions from Zerodha.",
            ) from exc
        self._positions_cache = {"data": positions, "ts": now}
        return positions

    def _get_quotes(self, instruments: List[str], ttl_seconds: int = 3) -> Dict[str, Any]:
        now = time.time()
        results: Dict[str, Any] = {}
        missing: List[str] = []
        for inst in instruments:
            cached = self._quotes_cache.get(inst)
            if cached and now - cached["ts"] < ttl_seconds:
                results[inst] = cached["data"]
            else:
                missing.append(inst)

        if missing:
            kite = self._require_kite()
            try:
                quotes = kite.quote(missing)
            except KiteException as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Unable to fetch live quotes from Zerodha.",
                ) from exc
            for key, value in quotes.items():
                self._quotes_cache[key] = {"data": value, "ts": now}
                results[key] = value
        return results

    def _interval_from_scale(self, scale: str) -> str:
        mapping = {
            "1m": "minute",
            "5m": "5minute",
            "15m": "15minute",
            "30m": "30minute",
            "1h": "60minute",
            "1d": "day",
            "2d": "day",
            "1M": "day",
        }
        return mapping.get(scale, "5minute")

    def _get_candles(self, instrument_token: int, scale: str, ttl_seconds: int = 10) -> List[Dict[str, Any]]:
        cache_key = f"{instrument_token}:{scale}"
        now = time.time()
        cached = self._candles_cache.get(cache_key)
        if cached and now - cached["ts"] < ttl_seconds:
            return cached["data"]

        kite = self._require_kite()
        interval = self._interval_from_scale(scale)
        end = datetime.utcnow()
        start = end - timedelta(days=7)
        try:
            candles = kite.historical_data(
                instrument_token=instrument_token,
                from_date=start,
                to_date=end,
                interval=interval,
                continuous=False,
                oi=False,
            )
        except KiteException as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Unable to fetch candle data from Zerodha.",
            ) from exc
        recent = candles[-5:] if candles else []
        formatted = [
            {
                "date": c["date"].isoformat(),
                "open": c["open"],
                "high": c["high"],
                "low": c["low"],
                "close": c["close"],
                "volume": c["volume"],
            }
            for c in recent
        ]
        self._candles_cache[cache_key] = {"data": formatted, "ts": now}
        return formatted

    def _symbols_from_db(self, db, segment: str) -> List[str]:
        rows = db.query(Stock.symbol).filter(Stock.segment == segment).all()
        return [row[0] for row in rows if row[0]]

    def _build_rows(
        self,
        db,
        segment: str,
        scale: str,
        search: Optional[str],
        sort_by: str,
        sort_dir: str,
        page: int,
        page_size: int,
    ) -> Dict[str, Any]:
        symbol_map = self._symbol_map()
        symbols = self._symbols_from_db(db, segment)
        filtered_symbols = [s for s in symbols if s in symbol_map]

        if search:
            needle = search.lower()
            filtered_symbols = [
                s for s in filtered_symbols
                if needle in s.lower() or needle in (symbol_map[s].get("name") or "").lower()
            ]

        total = len(filtered_symbols)
        start = max(0, (page - 1) * page_size)
        end = start + page_size
        page_symbols = filtered_symbols[start:end]

        quote_keys = [f"NSE:{symbol}" for symbol in page_symbols]
        quotes = self._get_quotes(quote_keys)
        positions = self._get_positions()
        position_map = {pos.get("tradingsymbol"): pos for pos in positions}

        rows: List[Dict[str, Any]] = []
        for symbol in page_symbols:
            inst = symbol_map[symbol]
            quote = quotes.get(f"NSE:{symbol}", {})
            last_price = quote.get("last_price")
            position = position_map.get(symbol)
            net_qty = position.get("quantity") if position else 0
            status = "Neutral"
            if net_qty > 0:
                status = "Long"
            elif net_qty < 0:
                status = "Short"

            rows.append(
                {
                    "id": inst.get("instrument_token"),
                    "instrument_token": inst.get("instrument_token"),
                    "tradingsymbol": symbol,
                    "name": inst.get("name") or symbol,
                    "price": last_price,
                    "position": status,
                    "candles": self._get_candles(inst.get("instrument_token"), scale),
                }
            )

        sort_key_map = {
            "id": lambda r: r.get("id") or 0,
            "name": lambda r: (r.get("name") or "").lower(),
            "price": lambda r: r.get("price") or 0,
            "position": lambda r: r.get("position") or "",
        }
        key_fn = sort_key_map.get(sort_by, sort_key_map["name"])
        rows.sort(key=key_fn, reverse=sort_dir == "desc")

        return {
            "items": rows,
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def get_nifty50(
        self,
        db,
        scale: str,
        search: Optional[str],
        sort_by: str,
        sort_dir: str,
        page: int,
        page_size: int,
    ) -> Dict[str, Any]:
        return self._build_rows(
            db=db,
            segment="NIFTY50",
            scale=scale,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
            page=page,
            page_size=page_size,
        )

    async def get_banknifty(
        self,
        db,
        scale: str,
        search: Optional[str],
        sort_by: str,
        sort_dir: str,
        page: int,
        page_size: int,
    ) -> Dict[str, Any]:
        return self._build_rows(
            db=db,
            segment="BANKNIFTY",
            scale=scale,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
            page=page,
            page_size=page_size,
        )

    async def get_historical_data(self, instrument_token: int, interval: str, from_date: str, to_date: str):
        kite = self._require_kite()
        interval_name = self._interval_from_scale(interval)

        if from_date and to_date:
            start = datetime.fromisoformat(from_date)
            end = datetime.fromisoformat(to_date)
        else:
            end = datetime.utcnow()
            start = end - timedelta(days=30)

        try:
            candles = kite.historical_data(
                instrument_token=instrument_token,
                from_date=start,
                to_date=end,
                interval=interval_name,
                continuous=False,
                oi=False,
            )
        except KiteException as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Unable to fetch historical data from Zerodha.",
            ) from exc
        return [
            {
                "date": c["date"].isoformat(),
                "open": c["open"],
                "high": c["high"],
                "low": c["low"],
                "close": c["close"],
                "volume": c["volume"],
            }
            for c in candles
        ]

    async def get_instruments(self, db):
        instruments = self._cached_instruments()
        return [
            {
                "instrument_token": inst.get("instrument_token"),
                "tradingsymbol": inst.get("tradingsymbol"),
                "name": inst.get("name"),
                "segment": inst.get("segment"),
                "exchange": inst.get("exchange"),
            }
            for inst in instruments
        ]

    async def get_positions(self):
        positions = self._get_positions()
        results = []
        for pos in positions:
            qty = pos.get("quantity") or 0
            ltp = pos.get("last_price") or pos.get("average_price")
            avg = pos.get("average_price") or 0
            pnl = (ltp - avg) * qty if qty >= 0 else (avg - ltp) * abs(qty)
            results.append(
                {
                    "id": pos.get("instrument_token"),
                    "instrument": pos.get("tradingsymbol"),
                    "type": "BUY" if qty >= 0 else "SELL",
                    "qty": qty,
                    "avgPrice": avg,
                    "ltp": ltp,
                    "pnl": pnl,
                }
            )
        return results


market_controller = MarketDataController()
