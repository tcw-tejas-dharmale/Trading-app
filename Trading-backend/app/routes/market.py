from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from app.controllers.market_data_controller import market_controller
from app.core import security
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from app.core.config import settings

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/login/access-token")

def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    return user_id

@router.get("/instruments")
async def get_instruments(current_user: str = Depends(get_current_user)):
    """
    Get list of available instruments. Requires Authentication.
    """
    return await market_controller.get_instruments()

@router.get("/scales")
def get_scales(current_user: str = Depends(get_current_user)):
    """
    Get available time scales. Requires Authentication.
    """
    return ["1m", "5m", "15m", "30m", "1h", "4h", "1d"]

@router.get("/strategies")
def get_strategies(current_user: str = Depends(get_current_user)):
    """
    Get available strategies. Requires Authentication.
    """
    return [
        {"id": "ma_crossover", "name": "Moving Average Crossover"},
        {"id": "rsi_strategy", "name": "RSI Strategy"},
        {"id": "bollinger_bands", "name": "Bollinger Bands"},
    ]

@router.get("/historical-data")
async def get_historical_data(
    instrument_token: int, 
    scale: str, 
    from_date: Optional[str] = None, 
    to_date: Optional[str] = None,
    current_user: str = Depends(get_current_user)
):
    """
    Get historical data for visualization. Requires Authentication.
    """
    return await market_controller.get_historical_data(instrument_token, scale, from_date, to_date)
