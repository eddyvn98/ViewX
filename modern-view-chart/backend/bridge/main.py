import asyncio
import sys
import os

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from mt5_service import MT5Service
from websocket_client import BridgeClient
from alert_service import AlertService # Import
import MetaTrader5 as mt5

# Configuration
NODE_WS_URL = "ws://127.0.0.1:8091"
SYMBOLS = ["XAUUSDm", "BTCUSDm", "EURUSDm", "GBPUSDm"]
TIMEFRAME_MAP = {
    '1m': mt5.TIMEFRAME_M1, '5m': mt5.TIMEFRAME_M5, '15m': mt5.TIMEFRAME_M15,
    '30m': mt5.TIMEFRAME_M30, '1h': mt5.TIMEFRAME_H1, '4h': mt5.TIMEFRAME_H4, '1d': mt5.TIMEFRAME_D1,
    '1': mt5.TIMEFRAME_M1, '5': mt5.TIMEFRAME_M5, '15': mt5.TIMEFRAME_M15,
    '30': mt5.TIMEFRAME_M30, '60': mt5.TIMEFRAME_H1, '240': mt5.TIMEFRAME_H4, '1440': mt5.TIMEFRAME_D1
}

async def main():
    service = MT5Service(SYMBOLS, TIMEFRAME_MAP)
    alert_service = AlertService() # Instantiate
    
    if not service.initialize():
        return

    try:
        client = BridgeClient(NODE_WS_URL, service, alert_service) # Pass to Client
        await client.connect()
        
        # Start command listener
        asyncio.create_task(client.listen_commands())
        
        # Track last sent positions to avoid redundant updates
        last_positions_hash = None
        last_positions_time = 0
        POSITION_UPDATE_INTERVAL = 2.0  # Only send position updates every 2 seconds unless changed
        
        # Cache for Daily Open prices
        daily_opens = {}
        last_daily_open_refresh = 0
        DAILY_OPEN_REFRESH_INTERVAL = 300 # refresh every 5 mins
        
        while True:
            import time
            current_time = time.time()
            
            # Refresh Daily Opens
            if current_time - last_daily_open_refresh > DAILY_OPEN_REFRESH_INTERVAL:
                for symbol in SYMBOLS:
                    d_open = service.get_daily_open(symbol)
                    if d_open:
                        daily_opens[symbol] = d_open
                last_daily_open_refresh = current_time
                print(f"📊 [REFRESH] Daily Open prices updated for {len(daily_opens)} symbols")

            # 1. Send Ticks
            for symbol in SYMBOLS:
                tick = service.get_tick(symbol)
                if tick:
                    # Check Alerts
                    await alert_service.check_alerts(symbol, tick.bid, client.send_json) # Check Logic
                    
                    await client.send_json({
                        "topic": "mt5_update",
                        "symbol": symbol,
                        "price": tick.bid,
                        "ask": tick.ask,
                        "daily_open": daily_opens.get(symbol),
                        "time": int(tick.time * 1000)
                    })
            
            # 2. Send Positions & Account (THROTTLED)
            import time
            current_time = time.time()
            
            acc_data = service.get_account_info()
            pos_list = service.get_positions()
            order_list = service.get_orders()
            
            # Create hash of positions to detect changes
            import json
            positions_hash = json.dumps([
                {"ticket": p["ticket"], "sl": p["sl"], "tp": p["tp"], "profit": round(p["profit"], 2)}
                for p in pos_list
            ], sort_keys=True)
            
            # CRITICAL FIX: Don't broadcast empty positions if hash hasn't changed
            # This prevents flickering when MT5 temporarily returns empty positions
            is_empty_unchanged = (len(pos_list) == 0 and positions_hash == last_positions_hash)
            
            # Only send if positions changed OR 2 seconds passed (and not empty unchanged)
            should_send = (
                not is_empty_unchanged and (
                    positions_hash != last_positions_hash or 
                    (current_time - last_positions_time) >= POSITION_UPDATE_INTERVAL
                )
            )
            
            if should_send:
                await client.send_json({
                    "topic": "mt5_positions_update",
                    "account": acc_data,
                    "positions": pos_list,
                    "orders": order_list
                })
                last_positions_hash = positions_hash
                last_positions_time = current_time
            
            await asyncio.sleep(0.5)
            
    except Exception as e:
        print(f"[CRITICAL] Bridge loop error: {e}")
    finally:
        service.shutdown()

if __name__ == "__main__":
    asyncio.run(main())
