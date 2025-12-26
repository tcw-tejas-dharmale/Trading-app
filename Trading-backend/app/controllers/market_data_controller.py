# from kiteconnect import KiteConnect
from app.core.config import settings

class MarketDataController:
    def __init__(self):
        self.api_key = settings.ZERODHA_API_KEY
        self.api_secret = settings.ZERODHA_API_SECRET
        self.kite = None
        # if self.api_key and self.api_secret:
        #      self.kite = KiteConnect(api_key=self.api_key)
             # Note: Proper login flow requires request_token which is obtained via frontend redirect 
             # For this backend setup, we will assume we might have a stored access token or we Mock the data.

    async def get_instruments(self, db):
        from app.models.instrument import Instrument
        instruments = db.query(Instrument).all()
        return [
            {
                "instrument_token": inst.instrument_token,
                "tradingsymbol": inst.trading_symbol,
                "name": inst.name,
                "segment": inst.segment,
                "exchange": inst.exchange,
            }
            for inst in instruments
        ]

    async def get_historical_data(self, instrument_token: int, interval: str, from_date: str, to_date: str):
        return []

    async def get_nifty50(self, db):
        from app.models.market import Stock
        stocks = db.query(Stock).filter(Stock.segment == "NIFTY50").all()
        
        if not stocks:
            return []

        results = []
        for stock in stocks:
             results.append({
                 "id": stock.id,
                 "instrument_token": stock.id,
                 "name": stock.name,
                 "price": stock.last_price,
                 "position": "Neutral", # stock.position if available
                 "candles": []
             })
        return results

    async def get_banknifty(self, db):
        from app.models.market import Stock
        stocks = db.query(Stock).filter(Stock.segment == "BANKNIFTY").all()
        
        if not stocks:
            return []
            
        results = []
        for stock in stocks:
             results.append({
                 "id": stock.id,
                 "instrument_token": stock.id,
                 "name": stock.name,
                 "price": stock.last_price,
                 "position": "Neutral",
                 "candles": []
             })
        return results

    async def get_positions(self, db, user_id):
        from app.models.market import Position, Stock
        positions = db.query(Position).filter(Position.user_id == user_id).all()
        
        if not positions:
            return []

        results = []
        for pos in positions:
            stock = db.query(Stock).filter(Stock.symbol == pos.stock_symbol).first()
            ltp = stock.last_price if stock else pos.current_price
            pnl = (ltp - pos.average_price) * pos.quantity if pos.type == 'BUY' else (pos.average_price - ltp) * pos.quantity
            
            results.append({
                "id": pos.id,
                "instrument": stock.name if stock else pos.stock_symbol,
                "type": pos.type,
                "qty": pos.quantity,
                "avgPrice": pos.average_price,
                "ltp": ltp,
                "pnl": pnl
            })
        return results

market_controller = MarketDataController()
