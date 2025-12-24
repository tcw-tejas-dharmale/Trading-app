from sqlalchemy import Column, Integer, String, Date, Numeric, Float
from app.core.database import Base

class Instrument(Base):
    __tablename__ = "instrument"

    instrument_token = Column(Integer, primary_key=True, index=True)
    exchange_token = Column(Integer)
    trading_symbol = Column(String)
    name = Column(String)
    expiry = Column(Date)
    strike = Column(Numeric(precision=10, scale=2)) # Adjust precision/scale as needed, image says numeric(2) which is likely scale
    tick_size = Column(Numeric(precision=10, scale=2))
    lot_size = Column(Integer)
    instrument_type = Column(String)
    segment = Column(String)
    exchange = Column(String)

class WatchListInstrumentJunction(Base):
    __tablename__ = "watch_list_instrument_junction"

    id = Column(Integer, primary_key=True, index=True)
    watch_list_id = Column(Integer) # Assuming foreign key to a watch_list table later
    instrument_token = Column(Integer) # Junction to instrument
