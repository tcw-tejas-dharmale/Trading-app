from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base
import datetime

class Stock(Base):
    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, index=True) # e.g., INFY
    name = Column(String)
    sector = Column(String)
    segment = Column(String) # NIFTY50, BANKNIFTY, etc.
    last_price = Column(Float)
    
    # We might store candles elsewhere or JSONB here, but for simplicity:
    # positions = relationship("Position", back_populates="stock")
    
class Position(Base):
    __tablename__ = "positions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    stock_symbol = Column(String) # Simplified relation
    quantity = Column(Integer)
    average_price = Column(Float)
    current_price = Column(Float) # Should be realtime but storing for snapshot
    type = Column(String) # LONG / SHORT
    
    # user = relationship("User", back_populates="positions")
