# from kiteconnect import KiteConnect
from app.core.config import settings
import random
import datetime

class MarketDataController:
    def __init__(self):
        self.api_key = settings.ZERODHA_API_KEY
        self.api_secret = settings.ZERODHA_API_SECRET
        self.kite = None
        # if self.api_key and self.api_secret:
        #      self.kite = KiteConnect(api_key=self.api_key)
             # Note: Proper login flow requires request_token which is obtained via frontend redirect 
             # For this backend setup, we will assume we might have a stored access token or we Mock the data.

    async def get_instruments(self):
        # In a real scenario, fetch from Zerodha
        # if self.kite:
        #     return self.kite.instruments()
        
        # Mock data for demonstration
        return [
            {"instrument_token": 1, "tradingsymbol": "INFY", "name": "Infosys", "segment": "NSE", "exchange": "NSE"},
            {"instrument_token": 2, "tradingsymbol": "RELIANCE", "name": "Reliance Industries", "segment": "NSE", "exchange": "NSE"},
            {"instrument_token": 3, "tradingsymbol": "TCS", "name": "Tata Consultancy Services", "segment": "NSE", "exchange": "NSE"},
            {"instrument_token": 4, "tradingsymbol": "NIFTY 50", "name": "Nifty 50 Index", "segment": "INDICES", "exchange": "NSE"},
        ]

    async def get_historical_data(self, instrument_token: int, interval: str, from_date: str, to_date: str):
         # Mock historical candle data
         # Generate some random candle data for chart
        
        data = []
        base_price = 1000.0
        
        start = datetime.datetime.now() - datetime.timedelta(days=30)
        
        for i in range(100):
            date = start + datetime.timedelta(hours=i)
            open_price = base_price + random.uniform(-10, 10)
            high_price = open_price + random.uniform(0, 5)
            low_price = open_price - random.uniform(0, 5)
            close_price = random.uniform(low_price, high_price)
            volume = random.randint(100, 10000)
            
            data.append({
                "date": date.isoformat(),
                "open": round(open_price, 2),
                "high": round(high_price, 2),
                "low": round(low_price, 2),
                "close": round(close_price, 2),
                "volume": volume
            })
            base_price = close_price

        return data

    async def get_nifty50(self, db):
        # Fetch stocks with segment 'NIFTY50'
        # stocks = db.query(Stock).filter(Stock.segment == "NIFTY50").all()
        # For now, to ensure it works without populating DB manually:
        # We can return a list. ideally we query DB.
        # User said "all data is coming through postgress".
        # I should try to query. If empty, return empty list or fallback?
        # I'll Write code to query.
        
        from app.models.market import Stock
        stocks = db.query(Stock).filter(Stock.segment == "NIFTY50").all()
        
        # Transform for frontend
        results = []
        for stock in stocks:
             results.append({
                 "id": stock.id,
                 "name": stock.name,
                 "sector": stock.sector,
                 "position": "NEUTRAL", # Default
                 "candles": [], # Placeholder or fetch from another table
                 "last_price": stock.last_price
             })
        return results

    async def get_banknifty(self, db):
        from app.models.market import Stock
        stocks = db.query(Stock).filter(Stock.segment == "BANKNIFTY").all()
        
        results = []
        for stock in stocks:
             results.append({
                 "id": stock.id,
                 "name": stock.name,
                 "sector": stock.sector,
                 "position": "NEUTRAL",
                 "candles": [],
                 "last_price": stock.last_price
             })
        return results

    async def get_positions(self, db, user_id):
        from app.models.market import Position, Stock
        positions = db.query(Position).filter(Position.user_id == user_id).all()
        
        results = []
        for pos in positions:
            # Maybe join with Stock to get name
            stock = db.query(Stock).filter(Stock.symbol == pos.stock_symbol).first()
            results.append({
                "id": pos.id,
                "name": stock.name if stock else pos.stock_symbol,
                "position": pos.type,
                "candles": [], 
                "avg_price": pos.average_price,
                "qty": pos.quantity
            })
        return results

market_controller = MarketDataController()
