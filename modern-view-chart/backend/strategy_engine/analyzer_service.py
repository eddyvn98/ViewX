
import pandas as pd
import json
import uuid
# Fix import path for indicators - reuse existing module
from indicators import calculate_all

class AnalyzerService:
    def __init__(self):
        self.pending_requests = {} # req_id -> { context: dict, ... }

    def request_analysis(self, deal_data):
        """
        Initiates analysis for a trade deal.
        Returns the message to send to WebSocket (get_candles_at).
        """
        req_id = f"analyze_{deal_data['ticket']}_{uuid.uuid4().hex[:8]}"
        
        # Store context for when response comes back
        self.pending_requests[req_id] = {
            'deal': deal_data
        }
        
        # Determine entry time and symbol
        # Frontend sends deal object. 
        # Typically deal time is entry time if it's an entry deal.
        # If it's a history row, let's assume the frontend sends the relevant time.
        
        entry_time = deal_data.get('time')
        symbol = deal_data.get('symbol')
        
        print(f"🕵️ Analyzer: Requesting context for {symbol} at {entry_time} (ReqID: {req_id})")
        
        return {
            "topic": "mt5_command",
            "command": "get_candles_at",
            "symbol": symbol,
            "timestamp": entry_time,
            "count": 50,
            "request_id": req_id
        }

    def handle_response(self, data):
        """
        Process incoming mt5_candles_at data.
        Returns analysis result or None if not relevant.
        """
        req_id = data.get('request_id')
        if not req_id or req_id not in self.pending_requests:
            return None
            
        context = self.pending_requests.pop(req_id)
        deal = context['deal']
        candles = data.get('candles', [])
        
        if not candles:
            return {
                "ticket": deal.get('ticket'),
                "verdict": "ERROR",
                "reason": "No data found"
            }
            
        # Calculate Indicators
        try:
            df = pd.DataFrame(candles)
            df = calculate_all(df)
            
            # Use -2 candle (Completed candle before entry)
            # Assuming candles are sorted asc
            c_entry = df.iloc[-2]
            
            rsi = c_entry['rsi']
            hull = c_entry['hull25']
            price = c_entry['close']
            
            deal_type = deal.get('type') # 'buy' or 'sell' (as string)
            if isinstance(deal_type, int):
                # Map int type if needed, but frontend likely sends string
                # 0=buy, 1=sell in MT5
                if deal_type == 0: deal_type = 'buy'
                elif deal_type == 1: deal_type = 'sell'
            
            verdict = "NEUTRAL"
            explanation = []
            
            if str(deal_type).lower() in ['buy', '0']:
                if rsi > 60 and price > hull: 
                    verdict = "GOOD ENTRY ✅"
                    explanation.append("Strong Momentum (RSI > 60)")
                    explanation.append("Price above Hull MA")
                elif rsi < 50: 
                    verdict = "BAD ENTRY ❌"
                    explanation.append("Weak Momentum (RSI < 50)")
            elif str(deal_type).lower() in ['sell', '1']:
                if rsi < 40 and price < hull: 
                    verdict = "GOOD ENTRY ✅"
                    explanation.append("Strong Down Momentum (RSI < 40)")
                    explanation.append("Price below Hull MA")
                elif rsi > 50: 
                    verdict = "BAD ENTRY ❌"
                    explanation.append("Weak Down Momentum (RSI > 50)")
            
            return {
                "ticket": deal.get('ticket'),
                "verdict": verdict,
                "analysis": {
                    "rsi": round(rsi, 2),
                    "hull": round(hull, 2),
                    "price": round(price, 2),
                    "explanation": explanation
                }
            }
            
        except Exception as e:
            print(f"❌ Analyzer Error: {e}")
            return {
                "ticket": deal.get('ticket'),
                "verdict": "ERROR",
                "reason": str(e)
            }
