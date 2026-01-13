from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class UserIntent(str, Enum):
    intraday = "intraday"
    delivery = "delivery"


class StopLossMethod(str, Enum):
    percent = "percent"
    atr = "atr"


class TargetMode(str, Enum):
    limit = "limit"
    close = "close"


class TradePreviewRequest(BaseModel):
    tradingsymbol: str = Field(..., min_length=1)
    exchange: str = Field(default="NSE")

    ltp: float = Field(..., gt=0, description="Live traded price.")
    intent: UserIntent = Field(..., description="intraday -> MIS, delivery -> CNC.")
    account_risk_inr: float = Field(..., gt=0, description="Max ₹ risk allowed for this trade (and managed trades).")
    quantity_override: Optional[int] = Field(
        default=None,
        gt=0,
        description="Optional manual quantity; risk checks still enforced against account_risk_inr.",
    )

    stop_loss_method: StopLossMethod
    stop_loss_percent: Optional[float] = Field(default=None, gt=0, lt=50)
    atr_period: int = Field(default=14, ge=2, le=100)
    atr_multiplier: float = Field(default=2.0, gt=0, le=10)
    candles: Optional[List[dict]] = Field(
        default=None,
        description="Optional candles for ATR. Each item needs high/low/close.",
    )

    # Optional target
    target_price: Optional[float] = Field(default=None, gt=0)
    target_mode: TargetMode = Field(default=TargetMode.limit)

    # Order preferences
    sl_order_type: str = Field(default="SL-M", description="SL or SL-M for the stop-loss leg.")
    use_close_target_for_mis: bool = Field(
        default=False,
        description="If true and intent=intraday, target leg is handled by auto-close instead of a limit order.",
    )

    @field_validator("tradingsymbol", "exchange", "sl_order_type", mode="before")
    @classmethod
    def _normalize(cls, value: object) -> object:
        if value is None:
            return value
        return str(value).strip().upper()

    @model_validator(mode="after")
    def _validate_stoploss(self) -> "TradePreviewRequest":
        if self.stop_loss_method == StopLossMethod.percent:
            if self.stop_loss_percent is None:
                raise ValueError("stop_loss_percent is required for percent stop-loss.")
        return self


class TradePreviewResponse(BaseModel):
    decision: str  # BUY | NO_BUY
    reason: Optional[str] = None

    tradingsymbol: str
    exchange: str
    product: str  # MIS | CNC

    entry_price: float
    stop_loss_price: float
    quantity: int
    risk_per_unit: float
    total_risk: float

    required_margin: Optional[float] = None
    margin_available: Optional[float] = None
    within_trading_hours: bool


class TradeExecuteRequest(BaseModel):
    preview: TradePreviewRequest
    confirm: bool = Field(default=False, description="Must be true to actually place orders.")

    # Optional safety overrides
    recalc_sl_on_fill: bool = Field(default=True, description="Recompute SL from actual average fill price.")
    poll_timeout_seconds: int = Field(default=20, ge=5, le=120)
    poll_interval_seconds: float = Field(default=0.7, ge=0.2, le=5)


class TradeExecutionResponse(BaseModel):
    decision: str
    reason: Optional[str] = None

    trade_id: Optional[str] = None
    product: Optional[str] = None
    entry_order_id: Optional[str] = None
    sl_order_id: Optional[str] = None
    target_order_id: Optional[str] = None

    entry_avg_price: Optional[float] = None
    stop_loss_price: Optional[float] = None
    quantity: Optional[int] = None
