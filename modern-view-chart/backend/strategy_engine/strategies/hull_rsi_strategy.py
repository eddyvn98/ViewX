from .base_strategy import BaseStrategy
from indicators import calculate_all

class HullRsiStrategy(BaseStrategy):
    def __init__(self, symbol, timeframe, config=None):
        super().__init__(symbol, timeframe, config)
        self.name = "Hull RSI Strategy"
        self.rsi_buy_level = config.get('rsi_buy', 60)
        self.rsi_sell_level = config.get('rsi_sell', 40)
        self.offset = 0.3 # Price offset for stop orders (Gold specific, might config later)
    
    def on_tick(self, tick):
        # This strategy works on candle Close, not ticks
        pass

    def on_candle(self, df):
        # 1. Calculate Indicators
        df = calculate_all(df)
        
        # 2. Get Signal Candle (2nd to last, as last is forming)
        c2 = df.iloc[-2]
        
        # --- BUY LOGIC ---
        if c2['rsi'] > self.rsi_buy_level:
            stop_price = c2['high'] + self.offset
            sl_price = c2['ha_low']
            return 1, {
                'stop_price': stop_price,
                'sl': sl_price,
                'reason': f"RSI {c2['rsi']:.1f} > {self.rsi_buy_level}"
            }

        # --- SELL LOGIC ---
        if c2['rsi'] < self.rsi_sell_level:
            stop_price = c2['low'] # Sell Stop is below
            sl_price = c2['ha_high'] + self.offset
            return -1, {
                'stop_price': stop_price,
                'sl': sl_price,
                'reason': f"RSI {c2['rsi']:.1f} < {self.rsi_sell_level}"
            }
            
        return 0, {}
