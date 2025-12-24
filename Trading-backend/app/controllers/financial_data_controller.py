# Financial data controller for enhanced dashboard features
import random
import datetime
from typing import Dict, List

class FinancialDataController:
    def __init__(self):
        pass

    def generate_historical_financial_data(self, years: int = 5) -> List[Dict]:
        """Generate 5 years of quarterly financial data"""
        data = []
        base_revenue = 1000000
        base_profit_margin = 0.15
        
        current_date = datetime.datetime.now()
        
        for year in range(years):
            year_start = current_date.replace(year=current_date.year - years + year + 1, month=1, day=1)
            for quarter in range(4):
                quarter_date = year_start.replace(month=quarter * 3 + 1)
                
                # Simulate growth trends
                growth_factor = 1 + (year * 0.1) + (quarter * 0.02) + random.uniform(-0.05, 0.05)
                revenue = base_revenue * growth_factor * (1 + random.uniform(-0.1, 0.15))
                profit_margin = base_profit_margin + random.uniform(-0.05, 0.05)
                profit = revenue * profit_margin
                
                # Year-over-year growth
                if year > 0:
                    prev_year_revenue = base_revenue * (1 + ((year - 1) * 0.1) + (quarter * 0.02))
                    yoy_growth = ((revenue - prev_year_revenue) / prev_year_revenue) * 100
                else:
                    yoy_growth = random.uniform(5, 25)
                
                data.append({
                    "quarter": f"Q{quarter + 1} {quarter_date.year}",
                    "date": quarter_date.isoformat(),
                    "revenue": round(revenue, 2),
                    "profit": round(profit, 2),
                    "profit_margin": round(profit_margin * 100, 2),
                    "yoy_growth": round(yoy_growth, 2),
                    "year": quarter_date.year
                })
        
        return data

    def get_competitor_data(self) -> List[Dict]:
        """Generate competitor comparison data"""
        competitors = [
            {
                "name": "Competitor A",
                "market_share": round(random.uniform(15, 30), 1),
                "pricing_tier": "Premium",
                "user_rating": round(random.uniform(4.0, 5.0), 1),
                "review_count": random.randint(500, 2000),
                "features": ["Advanced Analytics", "Real-time Data", "API Access"],
                "monthly_price": round(random.uniform(99, 299), 2)
            },
            {
                "name": "Competitor B",
                "market_share": round(random.uniform(10, 25), 1),
                "pricing_tier": "Standard",
                "user_rating": round(random.uniform(3.5, 4.5), 1),
                "review_count": random.randint(300, 1500),
                "features": ["Basic Analytics", "Market Data"],
                "monthly_price": round(random.uniform(49, 149), 2)
            },
            {
                "name": "Competitor C",
                "market_share": round(random.uniform(5, 20), 1),
                "pricing_tier": "Enterprise",
                "user_rating": round(random.uniform(4.2, 4.8), 1),
                "review_count": random.randint(200, 1000),
                "features": ["Enterprise Features", "Custom Integration", "Dedicated Support"],
                "monthly_price": round(random.uniform(199, 499), 2)
            }
        ]
        return competitors

    def calculate_roi_projection(self, initial_investment: float, years: int = 5) -> Dict:
        """Calculate ROI projections"""
        annual_growth_rate = random.uniform(0.08, 0.15)
        
        projections = []
        current_value = initial_investment
        
        for year in range(1, years + 1):
            current_value = current_value * (1 + annual_growth_rate)
            roi = ((current_value - initial_investment) / initial_investment) * 100
            projections.append({
                "year": year,
                "projected_value": round(current_value, 2),
                "roi_percentage": round(roi, 2),
                "annual_return": round(annual_growth_rate * 100, 2)
            })
        
        return {
            "initial_investment": initial_investment,
            "projected_final_value": round(current_value, 2),
            "total_roi": round(((current_value - initial_investment) / initial_investment) * 100, 2),
            "annual_growth_rate": round(annual_growth_rate * 100, 2),
            "yearly_projections": projections
        }

    def assess_risk(self) -> Dict:
        """Generate risk assessment"""
        risk_levels = ["Low", "Moderate", "High"]
        risk_level = random.choice(risk_levels)
        
        risk_factors = {
            "Low": {
                "score": random.uniform(1, 3),
                "factors": ["Stable market conditions", "Diversified portfolio", "Strong fundamentals"],
                "recommendation": "Conservative approach recommended"
            },
            "Moderate": {
                "score": random.uniform(4, 6),
                "factors": ["Market volatility", "Economic uncertainties", "Mixed signals"],
                "recommendation": "Balanced approach with risk management"
            },
            "High": {
                "score": random.uniform(7, 10),
                "factors": ["High volatility", "Market corrections", "External risks"],
                "recommendation": "Aggressive risk management required"
            }
        }
        
        selected = risk_factors[risk_level]
        return {
            "level": risk_level,
            "score": round(selected["score"], 1),
            "factors": selected["factors"],
            "recommendation": selected["recommendation"],
            "last_updated": datetime.datetime.now().isoformat()
        }

financial_data_controller = FinancialDataController()

