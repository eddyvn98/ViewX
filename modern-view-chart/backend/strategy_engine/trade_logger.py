import json
import os
import uuid
import pandas as pd
from datetime import datetime

LOG_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'trade_logs')

class TradeLogger:
    def __init__(self):
        if not os.path.exists(LOG_DIR):
            os.makedirs(LOG_DIR, exist_ok=True)
            
    def log_signal(self, signal_data, df):
        """
        Log a trading signal with full market context.
        signal_data: { signal: 'BUY', symbol: '...', strategy: '...', params: {} }
        df: DataFrame with OHLC and Indicators (Full history)
        """
        signal_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        # Snapshot last 20 candles for context
        snapshot_df = df.tail(20).copy()
        
        # Convert Timestamp objects to string for JSON
        if 'time' in snapshot_df.columns:
            snapshot_df['time'] = snapshot_df['time'].astype(str)
            
        context_data = snapshot_df.to_dict(orient='records')
        
        log_entry = {
            "id": signal_id,
            "timestamp": timestamp,
            "type": "SIGNAL",
            "signal": signal_data,
            "market_context": context_data
        }
        
        filename = f"signal_{signal_id}.json"
        filepath = os.path.join(LOG_DIR, filename)
        
        try:
            with open(filepath, 'w') as f:
                json.dump(log_entry, f, indent=2)
            print(f"📝 Signal Logged: {signal_id}")
            return signal_id
        except Exception as e:
            print(f"❌ Failed to log signal: {e}")
            return None

    def log_result(self, signal_id, result_data):
        """
        Update a log with execution result (Future implementation).
        """
        pass
