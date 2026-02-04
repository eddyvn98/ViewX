
import pandas as pd
import uuid
import json
from indicators import calculate_all

class OptimizerService:
    def __init__(self):
        self.pending_requests = {} # req_id -> { symbol, timeframe, ... }

    def request_optimization(self, symbol, timeframe="1m"):
        """
        Initiates optimization. Request 500 candles.
        """
        req_id = f"opt_{uuid.uuid4().hex[:8]}"
        self.pending_requests[req_id] = {
            'symbol': symbol,
            'timeframe': timeframe
        }
        
        print(f"🔬 Optimizer: Requesting 500 candles for {symbol} (ReqID: {req_id})")
        
        return {
            "topic": "mt5_command",
            "command": "get_candles",
            "symbol": symbol,
            "interval": timeframe,
            "count": 500,
            "request_id": req_id
        }

    def handle_candles_response(self, data):
        req_id = data.get('request_id')
        if not req_id or req_id not in self.pending_requests:
            return None
            
        context = self.pending_requests.pop(req_id)
        candles = data.get('candles', [])
        
        if not candles or len(candles) < 50:
            return {
                "verdict": "ERROR",
                "reason": "Not enough data"
            }
            
        print(f"🔬 Optimizer: Running Grid Search on {len(candles)} candles...")
        
        # 1. Prepare Data
        df = pd.DataFrame(candles)
        df = calculate_all(df) # RSI, Hull
        
        # 2. Define Parameter Grid
        # We optimize RSI Buy/Sell thresholds
        rsi_buy_options = [20, 25, 30, 35, 40]
        rsi_sell_options = [60, 65, 70, 75, 80]
        
        best_pnl = -9999
        best_params = {}
        best_winrate = 0
        total_trades = 0
        
        # 3. Backtest Loop
        # Simple Logic: Enter when Signal, Exit when Signal Reverses or Fixed TP/SL (simplification: Close on Reverse)
        # We assume 1 lot. Spread not accounted for perfectly, but comparative logic works.
        
        current_strategy = {'rsi_buy': 30, 'rsi_sell': 70} # Default
        current_pnl = 0
        
        results = []
        
        for r_buy in rsi_buy_options:
            for r_sell in rsi_sell_options:
                pnl, winrate, trades = self.run_backtest(df, r_buy, r_sell)
                
                results.append({
                    'rsi_buy': r_buy, 'rsi_sell': r_sell, 
                    'pnl': pnl, 'winrate': winrate, 'trades': trades
                })
                
                if pnl > best_pnl:
                    best_pnl = pnl
                    best_params = {'rsi_buy': r_buy, 'rsi_sell': r_sell}
                    best_winrate = winrate
                    total_trades = trades

        # Check Current Strategy Performance (approx 30/70)
        curr_res = self.run_backtest(df, 30, 70)
        
        return {
            "status": "success",
            "symbol": context['symbol'],
            "best_params": best_params,
            "metrics": {
                "pnl": round(best_pnl, 2),
                "winrate": round(best_winrate * 100, 1),
                "trades": total_trades
            },
            "current_metrics": {
                "pnl": round(curr_res[0], 2),
                "winrate": round(curr_res[1] * 100, 1)
            },
            "improvement": f"{round(curr_res[1]*100,1)}% -> {round(best_winrate*100,1)}%"
        }

    def run_backtest(self, df, rsi_buy, rsi_sell):
        """
        Simple Vectorized Backtest or Looped.
        """
        balance = 0
        wins = 0
        losses = 0
        
        position = 0 # 0=none, 1=long, -1=short
        entry_price = 0
        
        for i in range(2, len(df)):
            row = df.iloc[i]
            prev = df.iloc[i-1]
            
            close = row['close']
            rsi = row['rsi']
            hull = row['hull25']
            
            # Logic matches Main Strategy:
            # Buy: RSI < BuyLimit & Price > Hull (Trend Filter) ? Or Reversal?
            # Strategy says: rsi < 40 and price < hull (Sell??)
            # Wait, let's align with analyzer_service logic:
            # Buy if RSI > 60 ?? No, standard RSI is Buy < 30.
            # Analyzer said: 
            # Buy: RSI > 60 && Price > Hull (Momentum Follow)
            # Sell: RSI < 40 && Price < Hull (Momentum Follow)
            
            # Let's Optimize MOMENTUM Strategy
            # Buy Threshold (e.g. 55, 60, 65)
            # Sell Threshold (e.g. 45, 40, 35)
            
            signal = 0
            if rsi > rsi_sell and close > hull: signal = 1 # Long
            elif rsi < rsi_buy and close < hull: signal = -1 # Short
            
            # Execution
            if position == 0:
                if signal != 0:
                    position = signal
                    entry_price = close
            elif position == 1:
                # Close if Signal Reverse or Stop Logic
                if signal == -1:
                    # Reverse
                    pnl = close - entry_price
                    balance += pnl
                    if pnl > 0: wins += 1
                    else: losses += 1
                    
                    position = -1
                    entry_price = close
            elif position == -1:
                if signal == 1:
                    pnl = entry_price - close # Short PnL
                    balance += pnl
                    if pnl > 0: wins += 1
                    else: losses += 1
                    
                    position = 1
                    entry_price = close
                    
        total = wins + losses
        winrate = wins / total if total > 0 else 0
        return balance, winrate, total
