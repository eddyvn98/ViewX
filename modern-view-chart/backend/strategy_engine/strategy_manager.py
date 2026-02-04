from strategies.hull_rsi_strategy import HullRsiStrategy
from risk_manager import RiskManager
from trade_logger import TradeLogger

class StrategyManager:
    def __init__(self):
        self.strategies = {} # Key: symbol, Value: Strategy Instance
        self.risk_manager = RiskManager({
            'max_daily_loss': 500.0,
            'max_positions': 1
        })
        self.logger = TradeLogger()

    def add_strategy(self, symbol, timeframe, config=None):
        """Initialize and store a strategy for a symbol."""
        # Hardcoded to HullRsi for now, can make dynamic later
        strategy = HullRsiStrategy(symbol, timeframe, config)
        self.strategies[symbol] = strategy
        print(f"✅ Strategy Loaded: {strategy.name} for {symbol} ({timeframe})")

    def on_account_update(self, data):
        """Update Risk Manager with finding from Account/Positions."""
        # data expected: { balance, equity, positions: [] }
        balance = data.get('balance', 0)
        equity = data.get('equity', 0)
        positions = data.get('positions', [])
        
        self.risk_manager.update_account_state(equity, balance, positions)

    def on_market_data(self, symbol, data):
        """
        Process incoming candle data.
        data: List of candle dicts {time, open, high, low, close, volume}
        """
        if symbol not in self.strategies:
            return None

        strategy = self.strategies[symbol]
        df = self._prepare_dataframe(data)

        # Run Strategy
        signal, metadata = strategy.on_candle(df)

        if signal != 0:
            # CHECK RISK BEFORE SIGNALING
            allowed, reason = self.risk_manager.check_risk(signal, symbol)
            
            if not allowed:
                print(f"🛡️ Risk Blocked Signal on {symbol}: {reason}")
                return None
            
            # Construct Signal Object
            signal_obj = {
                "signal": "BUY" if signal == 1 else "SELL",
                "symbol": symbol,
                "strategy": strategy.name,
                "params": metadata
            }

            # LOG SIGNAL (Capture Context)
            signal_id = self.logger.log_signal(signal_obj, df)
            if signal_id:
                signal_obj['id'] = signal_id

            return signal_obj
        
        return None

    def _prepare_dataframe(self, data):
        """Convert list of dicts to Pandas DataFrame."""
        df = pd.DataFrame(data)
        # Ensure correct types
        cols = ['open', 'high', 'low', 'close', 'volume']
        df[cols] = df[cols].astype(float)
        if 'time' in df.columns:
            df['time'] = pd.to_datetime(df['time'], unit='s')
        return df
