from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    zerodha_order_id = Column(String, index=True, nullable=False)
    tradingsymbol = Column(String, nullable=False)
    exchange = Column(String, nullable=False)
    transaction_type = Column(String, nullable=False)
    order_type = Column(String, nullable=False)
    product = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    price = Column(Float, nullable=True)
    trigger_price = Column(Float, nullable=True)
    variety = Column(String, nullable=False)
    validity = Column(String, nullable=False)
    required_margin = Column(Float, nullable=True)
    charges_total = Column(Float, nullable=True)
    market_open = Column(Boolean, nullable=False, default=True)
    status = Column(String, nullable=False, default="PLACED")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
