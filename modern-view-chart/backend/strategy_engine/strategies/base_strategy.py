from abc import ABC, abstractmethod

class BaseStrategy(ABC):
    def __init__(self, symbol, timeframe, config=None):
        self.symbol = symbol
        self.timeframe = timeframe
        self.config = config or {}
        self.name = "Base Strategy"

    @abstractmethod
    def on_tick(self, tick):
        """Called every time a new tick arrives."""
        pass

    @abstractmethod
    def on_candle(self, df):
        """
        Called when a new candle is closed (or periodic update).
        df: DataFrame containing OHLCV history.
        Returns: 
           signal (int): 1 (Buy), -1 (Sell), 0 (None)
           metadata (dict): { 'stop_price': float, 'sl': float, 'tp': float, 'reason': str }
        """
        pass

    def get_config(self):
        return self.config
