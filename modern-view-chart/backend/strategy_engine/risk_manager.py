class RiskManager:
    def __init__(self, config=None):
        self.config = config or {}
        # Hard limits (Protect capital)
        self.max_daily_loss = self.config.get('max_daily_loss', 100.0) # USD
        self.max_positions = self.config.get('max_positions', 1)
        self.max_position_size = self.config.get('max_position_size', 0.1) # Lots
        
        # State tracking
        self.current_daily_loss = 0.0
        self.open_positions_count = 0
        self.is_locked = False
        self.lock_reason = ""

    def update_account_state(self, equity, balance, positions):
        """Called when account update is received."""
        # Calculate PnL for the day (Simplified for now using Equity - Balance if no history)
        # Ideally we need "History Deals" for the day to calc Daily Loss accurately.
        # For now, we use a simple Equity Drawdown check from starting balance of the session?
        # Or better: The Bridge should send "Daily Profit".
        
        self.open_positions_count = len(positions)
        
        # Simple Safety: If Equity < Balance - MaxLoss -> STOP
        drawdown = balance - equity
        if drawdown > self.max_daily_loss:
            self.is_locked = True
            self.lock_reason = f"Max Loss Hit: -${drawdown:.2f} > -${self.max_daily_loss}"

    def check_risk(self, signal, symbol):
        """
        Evaluate if a signal is safe to execute.
        Returns: (Allowed: bool, Reason: str)
        """
        if self.is_locked:
            return False, f"RISK LOCK: {self.lock_reason}"

        if self.open_positions_count >= self.max_positions:
            # Only allow Close signals if we are at max
            # But the Strategy Engine emits "Signals" (Buy/Sell), typically for Entry.
            # If it's an Exit signal, we should always allow it?
            # For now, assuming "signal" is ENTRY.
            return False, f"Max Positions Reached ({self.open_positions_count}/{self.max_positions})"

        # Future: Check correlational risk, news filter, etc.
        
        return True, "OK"

    def reset_daily(self):
        self.current_daily_loss = 0.0
        self.is_locked = False
        self.lock_reason = ""
