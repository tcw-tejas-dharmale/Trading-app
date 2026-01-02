import csv
import time
from pathlib import Path
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
import requests
from kiteconnect import KiteConnect
from kiteconnect.exceptions import KiteException

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.app_setting import AppSetting


class MarketDataController:
    _TOKEN_SETTING_KEY = "zerodha_access_token"

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
        self._index_cache: Dict[str, Dict[str, Any]] = {}

    def _env_path(self) -> Path:
        return Path(__file__).resolve().parents[2] / ".env"

    def _nse_universe_path(self) -> Path:
        return Path(__file__).resolve().parents[1] / "data" / "nse_universe.csv"

    def _load_access_token_from_db(self) -> Optional[str]:
        db = SessionLocal()
        try:
            row = db.query(AppSetting).filter(AppSetting.key == self._TOKEN_SETTING_KEY).first()
            return row.value if row else None
        finally:
            db.close()

    def _load_access_token_from_env_file(self) -> Optional[str]:
        env_path = self._env_path()
        if not env_path.exists():
            return None
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("ZERODHA_ACCESS_TOKEN="):
                return line.split("=", 1)[1].strip() or None
        return None

    def _write_access_token_to_env(self, token: str) -> None:
        env_path = self._env_path()
        lines: List[str] = []
        if env_path.exists():
            lines = env_path.read_text(encoding="utf-8").splitlines()
        updated = False
        new_lines: List[str] = []
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("ZERODHA_ACCESS_TOKEN=") or stripped.startswith("# ZERODHA_ACCESS_TOKEN="):
                new_lines.append(f"ZERODHA_ACCESS_TOKEN={token}")
                updated = True
            else:
                new_lines.append(line)
        if not updated:
            new_lines.append(f"ZERODHA_ACCESS_TOKEN={token}")
        env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")

    def _persist_access_token(self, token: str) -> None:
        db = SessionLocal()
        try:
            row = db.query(AppSetting).filter(AppSetting.key == self._TOKEN_SETTING_KEY).first()
            if row:
                row.value = token
            else:
                row = AppSetting(key=self._TOKEN_SETTING_KEY, value=token)
                db.add(row)
            db.commit()
        finally:
            db.close()
        self._write_access_token_to_env(token)

    def _load_access_token(self) -> Optional[str]:
        token = self._load_access_token_from_db()
        if token:
            return token
        return self._load_access_token_from_env_file()

    def _require_kite(self) -> KiteConnect:
        if not self.kite:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Zerodha API key is not configured.",
            )
        if not self.access_token:
            self.access_token = self._load_access_token()
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
            error_detail = getattr(exc, "message", None) or str(exc)
            print(f"Zerodha session error: {error_detail}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to create Zerodha session. Please check the request token.",
            ) from exc
        self.access_token = session.get("access_token")
        if self.access_token:
            self.kite.set_access_token(self.access_token)
            self._persist_access_token(self.access_token)
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

    def _nse_universe_entries(self) -> List[Dict[str, str]]:
        path = self._nse_universe_path()
        if not path.exists():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="NSE universe file is missing.",
            )

        entries: List[Dict[str, str]] = []
        with path.open(encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                symbol = (row.get("symbol") or "").strip()
                if not symbol:
                    continue
                entries.append(
                    {
                        "sr_no": (row.get("sr_no") or "").strip(),
                        "underlying": (row.get("underlying") or "").strip(),
                        "symbol": symbol,
                    }
                )
        return entries

    def _nse_universe_symbols(self) -> List[str]:
        return [entry["symbol"] for entry in self._nse_universe_entries()]

    def _get_positions(self, ttl_seconds: int = 5) -> Dict[str, Any]:
        now = time.time()
        if self._positions_cache["data"] and now - self._positions_cache["ts"] < ttl_seconds:
            return self._positions_cache["data"]
        if not self.access_token:
            self.access_token = self._load_access_token()
        if not self.access_token:
            self._positions_cache = {"data": [], "ts": now}
            return []
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

    def _position_qty(self, position: Dict[str, Any]) -> int:
        if position is None:
            return 0
        qty = position.get("quantity")
        if qty is None:
            qty = position.get("net_quantity")
        if qty is None:
            buy_qty = position.get("buy_quantity") or 0
            sell_qty = position.get("sell_quantity") or 0
            qty = buy_qty - sell_qty
        return qty or 0

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
            if not self.access_token:
                self.access_token = self._load_access_token()
            if not self.access_token:
                return results
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

        if not self.access_token:
            self.access_token = self._load_access_token()
        if not self.access_token:
            self._candles_cache[cache_key] = {"data": [], "ts": now}
            return []
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
        symbol_map = self._symbol_map()
        if segment == "NIFTY50":
            return self._filter_symbols_by_list(symbol_map, self._nse_universe_symbols())
        if segment == "BANKNIFTY":
            return self._filter_symbols_by_list(symbol_map, self._banknifty_symbols())
        return list(symbol_map.keys())

    def _filter_symbols_by_list(self, symbol_map: Dict[str, Dict[str, Any]], symbols: List[str]) -> List[str]:
        symbol_set = {symbol.strip().upper() for symbol in symbols if symbol}
        return [symbol for symbol in symbol_map.keys() if symbol.upper() in symbol_set]

    def _filter_symbols_by_list_in_scope(
        self,
        symbols: List[str],
        symbols_in_scope: List[str],
    ) -> List[str]:
        symbol_set = {symbol.strip().upper() for symbol in symbols if symbol}
        return [symbol for symbol in symbols_in_scope if symbol.upper() in symbol_set]

    def _fetch_index_symbols(self, url: str, cache_key: str, ttl_seconds: int = 3600) -> List[str]:
        now = time.time()
        cached = self._index_cache.get(cache_key)
        if cached and now - cached["ts"] < ttl_seconds:
            return cached["data"]

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/91.0.4472.124 Safari/537.36"
            ),
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.nseindia.com/market-data/live-equity-market",
        }
        try:
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code != 200:
                raise ValueError(f"Bad status {response.status_code}")
            data = response.json()
            symbols = [stock.get("symbol") for stock in data.get("data", []) if stock.get("symbol")]
            self._index_cache[cache_key] = {"data": symbols, "ts": now}
            return symbols
        except Exception as exc:
            print(f"NSE index fetch failed ({cache_key}): {exc}")
            if cached:
                return cached["data"]
            return []

    def _nifty50_symbols(self) -> List[str]:
        url = "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050"
        return self._fetch_index_symbols(url, "NIFTY50")

    def _banknifty_symbols(self) -> List[str]:
        url = "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20BANK"
        bank_symbols = self._fetch_index_symbols(url, "BANKNIFTY")
        nifty_symbols = self._nifty50_symbols()
        nifty_set = {symbol.strip().upper() for symbol in nifty_symbols if symbol}
        return [symbol for symbol in bank_symbols if symbol and symbol.strip().upper() in nifty_set]

    def _nifty_category_symbols(self, category: str) -> List[str]:
        mapping = {
            "it": [
                "TCS",
                "INFY",
                "HCLTECH",
                "WIPRO",
                "TECHM",
                "LTIM",
                "MPHASIS",
                "COFORGE",
                "PERSISTENT",
                "TATAELXSI",
                "KPITTECH",
                "OFSS",
            ],
            "banks": [
                "HDFCBANK",
                "ICICIBANK",
                "AXISBANK",
                "SBIN",
                "KOTAKBANK",
                "INDUSINDBK",
                "AUBANK",
                "BANDHANBNK",
                "BANKBARODA",
                "BANKINDIA",
                "CANBK",
                "FEDERALBNK",
                "IDFCFIRSTB",
                "INDIANB",
                "PNB",
                "RBLBANK",
                "UNIONBANK",
                "YESBANK",
            ],
            "healthcare": [
                "SUNPHARMA",
                "DRREDDY",
                "CIPLA",
                "DIVISLAB",
                "LUPIN",
                "AUROPHARMA",
                "GLENMARK",
                "TORNTPHARM",
                "ALKEM",
                "BIOCON",
                "LAURUSLABS",
                "ZYDUSLIFE",
                "SYNGENE",
                "MAXHEALTH",
                "APOLLOHOSP",
                "FORTIS",
            ],
            "energy": [
                "RELIANCE",
                "ONGC",
                "OIL",
                "NTPC",
                "POWERGRID",
                "TATAPOWER",
                "ADANIGREEN",
                "ADANIENSOL",
                "JSWENERGY",
                "NHPC",
                "IOC",
                "BPCL",
                "HINDPETRO",
                "GAIL",
                "IREDA",
                "PFC",
                "RECLTD",
                "SUZLON",
                "WAAREEENER",
            ],
            "fmcg": [
                "HINDUNILVR",
                "ITC",
                "NESTLEIND",
                "BRITANNIA",
                "DABUR",
                "MARICO",
                "TATACONSUM",
                "COLPAL",
                "PATANJALI",
                "VBL",
                "UNITDSPR",
            ],
            "auto": [
                "MARUTI",
                "TMPV",
                "M&M",
                "BAJAJ-AUTO",
                "HEROMOTOCO",
                "TVSMOTOR",
                "EICHERMOT",
                "ASHOKLEY",
                "SONACOMS",
                "MOTHERSON",
                "UNOMINDA",
                "TIINDIA",
            ],
            "infra": [
                "LT",
                "SIEMENS",
                "ABB",
                "CUMMINSIND",
                "CGPOWER",
                "BHEL",
                "POWERINDIA",
                "MAZDOCK",
                "NBCC",
                "RVNL",
                "IRFC",
                "BEL",
                "HAL",
            ],
            "financials": [
                "BAJFINANCE",
                "BAJAJFINSV",
                "HDFCLIFE",
                "SBILIFE",
                "ICICIGI",
                "ICICIPRULI",
                "LICI",
                "HDFCAMC",
                "CHOLAFIN",
                "SHRIRAMFIN",
                "MUTHOOTFIN",
                "MANAPPURAM",
                "PNBHOUSING",
                "LICHSGFIN",
                "JIOFIN",
                "ANGELONE",
                "CAMS",
                "KFINTECH",
                "POLICYBZR",
                "PAYTM",
            ],
            "metals": [
                "TATASTEEL",
                "JSWSTEEL",
                "HINDALCO",
                "VEDL",
                "NMDC",
                "SAIL",
                "NATIONALUM",
                "HINDZINC",
                "COALINDIA",
            ],
            "cement": [
                "ULTRACEMCO",
                "AMBUJACEM",
                "SHREECEM",
                "DALBHARAT",
                "GRASIM",
                "ASTRAL",
                "SUPREMEIND",
                "POLYCAB",
            ],
            "retail": [
                "TITAN",
                "TRENT",
                "DMART",
                "NYKAA",
                "KALYANKJIL",
                "PAGEIND",
                "VOLTAS",
                "BLUESTARCO",
                "CROMPTON",
                "HAVELLS",
                "PHOENIXLTD",
                "OBEROIRLTY",
                "PRESTIGE",
                "LODHA",
            ],
            "logistics": [
                "INDIGO",
                "IRCTC",
                "CONCOR",
                "DELHIVERY",
                "GMRAIRPORT",
            ],
            "food": [
                "JUBLFOOD",
                "INDHOTEL",
                "SWIGGY",
                "VBL",
            ],
            "chemicals": [
                "SRF",
                "PIIND",
                "SOLARINDS",
            ],
            "telecom": [
                "BHARTIARTL",
                "IDEA",
                "INDUSTOWER",
                "BSE",
                "MCX",
                "IEX",
            ],
            "realestate": [
                "DLF",
                "GODREJPROP",
                "OBEROIRLTY",
                "PRESTIGE",
                "LODHA",
            ],
        }
        return mapping.get((category or "").lower(), [])

    def _build_rows(
        self,
        db,
        segment: str,
        scale: str,
        search: Optional[str],
        position: Optional[str],
        category: Optional[str],
        sort_by: str,
        sort_dir: str,
        page: int,
        page_size: int,
        include_candles: bool,
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

        if segment == "NIFTY50" and category:
            filtered_symbols = self._filter_symbols_by_list_in_scope(
                self._nifty_category_symbols(category),
                filtered_symbols,
            )

        positions = self._get_positions()
        position_map = {pos.get("tradingsymbol"): pos for pos in positions}
        if position:
            normalized = position.lower()
            if normalized in {"long", "short", "neutral", "open"}:
                filtered_symbols = [
                    s for s in filtered_symbols
                    if (
                        (normalized == "long" and self._position_qty(position_map.get(s)) > 0)
                        or (normalized == "short" and self._position_qty(position_map.get(s)) < 0)
                        or (normalized == "neutral" and self._position_qty(position_map.get(s)) == 0)
                        or (normalized == "open" and self._position_qty(position_map.get(s)) != 0)
                    )
                ]

        total = len(filtered_symbols)
        start = max(0, (page - 1) * page_size)
        end = start + page_size
        page_symbols = filtered_symbols[start:end]

        quote_keys = [f"NSE:{symbol}" for symbol in page_symbols]
        quotes = self._get_quotes(quote_keys)

        rows: List[Dict[str, Any]] = []
        for symbol in page_symbols:
            inst = symbol_map[symbol]
            quote = quotes.get(f"NSE:{symbol}", {})
            last_price = quote.get("last_price")
            position = position_map.get(symbol)
            net_qty = self._position_qty(position)
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
                    "candles": self._get_candles(inst.get("instrument_token"), scale) if include_candles else [],
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
        position: Optional[str],
        category: Optional[str],
        sort_by: str,
        sort_dir: str,
        page: int,
        page_size: int,
        include_candles: bool,
    ) -> Dict[str, Any]:
        return self._build_rows(
            db=db,
            segment="NIFTY50",
            scale=scale,
            search=search,
            position=position,
            category=category,
            sort_by=sort_by,
            sort_dir=sort_dir,
            page=page,
            page_size=page_size,
            include_candles=include_candles,
        )

    async def get_banknifty(
        self,
        db,
        scale: str,
        search: Optional[str],
        position: Optional[str],
        sort_by: str,
        sort_dir: str,
        page: int,
        page_size: int,
        include_candles: bool,
    ) -> Dict[str, Any]:
        return self._build_rows(
            db=db,
            segment="BANKNIFTY",
            scale=scale,
            search=search,
            position=position,
            category=None,
            sort_by=sort_by,
            sort_dir=sort_dir,
            page=page,
            page_size=page_size,
            include_candles=include_candles,
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

    async def get_nse_universe_zerodha(self) -> Dict[str, Any]:
        symbol_map = self._symbol_map()
        entries = self._nse_universe_entries()
        present: List[Dict[str, Any]] = []
        missing: List[Dict[str, Any]] = []

        for entry in entries:
            symbol = entry["symbol"]
            inst = symbol_map.get(symbol)
            if inst:
                present.append(
                    {
                        **entry,
                        "instrument_token": inst.get("instrument_token"),
                        "zerodha_name": inst.get("name") or symbol,
                    }
                )
            else:
                missing.append(entry)

        return {
            "total": len(entries),
            "present_count": len(present),
            "missing_count": len(missing),
            "present": present,
            "missing": missing,
        }

    async def get_positions(self):
        positions = self._get_positions()
        results = []
        for pos in positions:
            qty = self._position_qty(pos)
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

    def place_order(self, order: Dict[str, Any]) -> Dict[str, Any]:
        kite = self._require_kite()
        tradingsymbol = (order.get("tradingsymbol") or "").strip().upper()
        if not tradingsymbol:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="tradingsymbol is required.")

        quantity = order.get("quantity")
        if not isinstance(quantity, int) or quantity <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="quantity must be a positive integer.")

        transaction_type = (order.get("transaction_type") or "").strip().upper()
        if transaction_type not in {"BUY", "SELL"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="transaction_type must be BUY or SELL.",
            )

        exchange = (order.get("exchange") or "NSE").strip().upper()
        order_type = (order.get("order_type") or "MARKET").strip().upper()
        product = (order.get("product") or "CNC").strip().upper()
        validity = (order.get("validity") or "DAY").strip().upper()
        variety = order.get("variety") or "regular"
        price = order.get("price")
        trigger_price = order.get("trigger_price")

        symbol_map = self._symbol_map()
        if tradingsymbol not in symbol_map:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unknown trading symbol for NSE equity.",
            )

        params = {
            "variety": variety,
            "exchange": exchange,
            "tradingsymbol": tradingsymbol,
            "transaction_type": transaction_type,
            "quantity": quantity,
            "order_type": order_type,
            "product": product,
            "validity": validity,
            "price": price,
            "trigger_price": trigger_price,
        }
        params = {key: value for key, value in params.items() if value is not None}

        try:
            order_id = kite.place_order(**params)
        except KiteException as exc:
            error_detail = getattr(exc, "message", None) or str(exc)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Order rejected by Zerodha: {error_detail}",
            ) from exc

        return {"order_id": order_id}


market_controller = MarketDataController()
