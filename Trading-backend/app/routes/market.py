from fastapi import APIRouter, Depends, HTTPException, Security, Request
from typing import Optional, Any
from app.core import database
from app.controllers.market_data_controller import market_controller
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.core.config import settings
from app.utils.rate_limiter import SimpleRateLimiter

router = APIRouter()
http_bearer = HTTPBearer(auto_error=False)
rate_limiter = SimpleRateLimiter(limit=60, window_seconds=60)

def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Security(http_bearer)):
    """
    Optional authentication - returns user_id if valid token provided, None otherwise.
    Allows routes to work with or without authentication.
    """
    if not credentials:
        return None
    
    try:
        token = credentials.credentials
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        return user_id
    except (JWTError, Exception):
        return None

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Security(http_bearer)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        token = credentials.credentials
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Authentication required")
        return user_id
    except (JWTError, Exception):
        raise HTTPException(status_code=401, detail="Authentication required")

def apply_rate_limit(user_id: Optional[str]) -> None:
    key = f"user:{user_id}" if user_id else "anonymous"
    rate_limiter.check(key)

@router.get("/instruments")
async def get_instruments(
    db: Any = Depends(database.get_db),
    current_user: Optional[str] = Security(get_current_user_optional)
):
    """
    Get list of available instruments. Authentication is optional.
    """
    apply_rate_limit(current_user)
    return await market_controller.get_instruments(db)

@router.get("/scales")
def get_scales(current_user: Optional[str] = Security(get_current_user_optional)):
    """
    Get available time scales. Authentication is optional.
    """
    return ["1m", "5m", "15m", "30m", "1h", "1d"]

@router.get("/strategies")
def get_strategies(current_user: Optional[str] = Security(get_current_user_optional)):
    """
    Get available strategies. Authentication is optional.
    """
    return [
        {"id": "ma_crossover", "name": "Moving Average Crossover"},
        {"id": "rsi_strategy", "name": "RSI Strategy"},
        {"id": "bollinger_bands", "name": "Bollinger Bands"},
    ]

@router.get("/historical-data")
async def get_historical_data(
    instrument_token: int,
    scale: str = "5m",
    start: Optional[str] = None,
    end: Optional[str] = None,
    current_user: str = Security(get_current_user)
):
    """
    Get historical candle data for an instrument.
    """
    apply_rate_limit(current_user)
    return await market_controller.get_historical_data(
        instrument_token=instrument_token,
        interval=scale,
        from_date=start,
        to_date=end
    )

@router.get("/nifty-50")
async def get_nifty_50(
    db: Any = Depends(database.get_db),
    scale: str = "5m",
    search: Optional[str] = None,
    sort_by: str = "name",
    sort_dir: str = "asc",
    page: int = 1,
    page_size: int = 10,
    current_user: str = Security(get_current_user)
):
    """
    Get Nifty 50 constituents.
    """
    apply_rate_limit(current_user)
    return await market_controller.get_nifty50(
        db=db,
        scale=scale,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )

@router.get("/bank-nifty")
async def get_bank_nifty(
    db: Any = Depends(database.get_db),
    scale: str = "5m",
    search: Optional[str] = None,
    sort_by: str = "name",
    sort_dir: str = "asc",
    page: int = 1,
    page_size: int = 10,
    current_user: str = Security(get_current_user)
):
    """
    Get Bank Nifty constituents.
    """
    apply_rate_limit(current_user)
    return await market_controller.get_banknifty(
        db=db,
        scale=scale,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )

@router.get("/positions")
async def get_positions(
    current_user: str = Security(get_current_user)
):
    """
    Get Open Positions.
    """
    apply_rate_limit(current_user)
    return await market_controller.get_positions()

@router.get("/zerodha/login-url")
def get_zerodha_login_url(
    current_user: str = Security(get_current_user)
):
    apply_rate_limit(current_user)
    return {"login_url": market_controller.get_login_url()}

@router.post("/zerodha/session")
def create_zerodha_session(
    request_token: str,
    current_user: str = Security(get_current_user)
):
    apply_rate_limit(current_user)
    return market_controller.create_session(request_token)

@router.post("/sync-instruments")
async def sync_instruments(
    db: Any = Depends(database.get_db),
    current_user: Optional[str] = Security(get_current_user_optional)
):
    import requests
    import csv
    import io
    from app.models.instrument import Instrument
    from datetime import datetime

    url = "https://api.kite.trade/instruments"
    response = requests.get(url)
    
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch instruments from Kite API")
    
    # Decode content
    content = response.content.decode('utf-8')
    csv_reader = csv.DictReader(io.StringIO(content))
    
    # Clear existing instruments
    db.query(Instrument).delete()
    
    instruments = []
    for row in csv_reader:
        # Handle Date Parsing
        expiry_val = None
        if row.get('expiry') and row.get('expiry').strip():
            try:
                expiry_val = datetime.strptime(row['expiry'], '%Y-%m-%d').date()
            except ValueError:
                expiry_val = None
        
        # Handle Numeric Parsing
        strike_val = row.get('strike')
        if not strike_val or strike_val.strip() == '':
            strike_val = 0
            
        tick_size_val = row.get('tick_size')
        if not tick_size_val or tick_size_val.strip() == '':
             tick_size_val = 0
             
        lot_size_val = row.get('lot_size')
        if not lot_size_val or lot_size_val.strip() == '':
             lot_size_val = 0
        
        inst = Instrument(
            instrument_token=int(row['instrument_token']),
            exchange_token=int(row['exchange_token']) if row.get('exchange_token') else None,
            trading_symbol=row['tradingsymbol'], # Mapping tradingsymbol -> trading_symbol
            name=row.get('name'),
            expiry=expiry_val,
            strike=float(strike_val),
            tick_size=float(tick_size_val),
            lot_size=int(lot_size_val),
            instrument_type=row.get('instrument_type'),
            segment=row.get('segment'),
            exchange=row.get('exchange')
        )
        instruments.append(inst)
        
        # Batch insert if too large to avoid memory issues (optional, but good practice)
        if len(instruments) > 5000:
             db.bulk_save_objects(instruments)
             instruments = []
             
    if instruments:
        db.bulk_save_objects(instruments)
        
    db.commit()
    
    return {"message": "Instruments synced successfully", "count": db.query(Instrument).count()}
