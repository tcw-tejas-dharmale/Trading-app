from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.controllers.market_data_controller import market_controller
from app.core.config import settings
from app.schemas.trade import (
    TradeExecuteRequest,
    TradeExecutionResponse,
    TradePreviewRequest,
    TradePreviewResponse,
)
from app.services.trade_engine import TradeEngine
from app.utils.rate_limiter import SimpleRateLimiter


router = APIRouter()
http_bearer = HTTPBearer(auto_error=False)
rate_limiter = SimpleRateLimiter(limit=30, window_seconds=60)
trade_engine = TradeEngine(market_controller)


def get_current_user(credentials: HTTPAuthorizationCredentials = Security(http_bearer)) -> str:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        token = credentials.credentials
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")
        return user_id
    except (JWTError, Exception):
        raise HTTPException(status_code=401, detail="Authentication required")


def apply_rate_limit(user_id: str) -> None:
    rate_limiter.check(f"user:{user_id}")


@router.post("/preview", response_model=TradePreviewResponse, tags=["Trading"])
def preview_trade(
    request: TradePreviewRequest,
    current_user: str = Security(get_current_user),
) -> TradePreviewResponse:
    apply_rate_limit(current_user)
    try:
        user_id = int(current_user)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid user id") from exc
    return trade_engine.preview(request, user_id)


@router.post("/execute", response_model=TradeExecutionResponse, tags=["Trading"])
async def execute_trade(
    request: TradeExecuteRequest,
    current_user: str = Security(get_current_user),
) -> TradeExecutionResponse:
    apply_rate_limit(current_user)
    try:
        user_id = int(current_user)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid user id") from exc

    if not request.confirm:
        preview = trade_engine.preview(request.preview, user_id)
        return TradeExecutionResponse(decision="NO_BUY", reason="confirm=false", product=preview.product)

    result = await trade_engine.execute(
        request.preview,
        user_id,
        poll_timeout_seconds=request.poll_timeout_seconds,
        poll_interval_seconds=request.poll_interval_seconds,
    )
    return TradeExecutionResponse(**result)
