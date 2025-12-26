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

    def _generate_sparkline(self, base_price):
        import random
        current = base_price
        candles = []
        for _ in range(5):
             open_p = current
             close_p = current + (random.random() - 0.5) * 10
             high_p = max(open_p, close_p) + random.random() * 2
             low_p = min(open_p, close_p) - random.random() * 2
             candles.append({
                 "open": open_p, "close": close_p, "high": high_p, "low": low_p
             })
             current = close_p
        return candles

    async def get_nifty50(self, db):
        from app.models.market import Stock
        stocks = db.query(Stock).filter(Stock.segment == "NIFTY50").all()
        
        if not stocks:
            # Fallback Mock Data
            mock_data = [
                {"id": 1, "name": "Reliance Industries", "price": 2450.00, "position": "Long"},
                {"id": 2, "name": "TCS", "price": 3400.00, "position": "Short"},
                {"id": 3, "name": "HDFC Bank", "price": 1600.00, "position": "Long"},
                {"id": 4, "name": "Infosys", "price": 1450.00, "position": "Neutral"},
                {"id": 5, "name": "ICICI Bank", "price": 950.00, "position": "Long"},
            ]
            results = []
            for item in mock_data:
                item["candles"] = self._generate_sparkline(item["price"])
                results.append(item)
            return results

        results = []
        for stock in stocks:
             results.append({
                 "id": stock.id,
                 "name": stock.name,
                 "price": stock.last_price,
                 "position": "Neutral", # stock.position if available
                 "candles": self._generate_sparkline(stock.last_price)
             })
        return results

    async def get_banknifty(self, db):
        from app.models.market import Stock
        stocks = db.query(Stock).filter(Stock.segment == "BANKNIFTY").all()
        
        if not stocks:
            mock_data = [
                {"id": 1, "name": "HDFC Bank", "price": 1600.00, "position": "Long"},
                {"id": 2, "name": "ICICI Bank", "price": 950.00, "position": "Long"},
                {"id": 3, "name": "SBI", "price": 580.00, "position": "Short"},
                {"id": 4, "name": "Axis Bank", "price": 980.00, "position": "Neutral"},
                {"id": 5, "name": "Kotak Bank", "price": 1800.00, "position": "Long"},
            ]
            results = []
            for item in mock_data:
                item["candles"] = self._generate_sparkline(item["price"])
                results.append(item)
            return results
            
        results = []
        for stock in stocks:
             results.append({
                 "id": stock.id,
                 "name": stock.name,
                 "price": stock.last_price,
                 "position": "Neutral",
                 "candles": self._generate_sparkline(stock.last_price)
             })
        return results

    async def get_positions(self, db, user_id):
        from app.models.market import Position, Stock
        positions = db.query(Position).filter(Position.user_id == user_id).all()
        
        if not positions:
            # Fallback
            return [
                {"id": 1, "instrument": "NIFTY 50", "type": "BUY", "qty": 50, "avgPrice": 19500.00, "ltp": 19650.00, "pnl": 7500.00},
                {"id": 2, "instrument": "BANKNIFTY", "type": "SELL", "qty": 25, "avgPrice": 44500.00, "ltp": 44200.00, "pnl": 7500.00},
                {"id": 3, "instrument": "RELIANCE", "type": "BUY", "qty": 100, "avgPrice": 2450.00, "ltp": 2480.00, "pnl": 3000.00},
            ]

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
