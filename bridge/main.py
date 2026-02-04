import asyncio
import sys
import os

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__filename__), 'src'))

from mt5_service import MT5Service
from websocket_client import BridgeClient
import MetaTrader5 as mt5

# Configuration
NODE_WS_URL = "ws://localhost:8090"
SYMBOLS = ["XAUUSDm", "BTCUSDm", "EURUSDm", "GBPUSDm"]
TIMEFRAME_MAP = {
    '1m': mt5.TIMEFRAME_M1, '5m': mt5.TIMEFRAME_M5, '15m': mt5.TIMEFRAME_M15,
    '1h': mt5.TIMEFRAME_H1, '4h': mt5.TIMEFRAME_H4, '1d': mt5.TIMEFRAME_D1
}

async def main():
    service = MT5Service(SYMBOLS, TIMEFRAME_MAP)
    if not service.initialize():
        return

    try:
        client = BridgeClient(NODE_WS_URL, service)
        await client.connect()
        
        # Start command listener
        asyncio.create_task(client.listen_commands())
        
        while True:
            # 1. Send Ticks
            for symbol in SYMBOLS:
                tick = service.get_tick(symbol)
                if tick:
                    await client.send_json({
                        "type": "mt5_update",
                        "symbol": symbol,
                        "price": tick.bid,
                        "ask": tick.ask,
                        "time": int(tick.time * 1000)
                    })
            
            # 2. Send Positions & Account
            acc_data = service.get_account_info()
            pos_list = service.get_positions()
            order_list = service.get_orders()
            
            await client.send_json({
                "type": "mt5_positions_update",
                "account": acc_data,
                "positions": pos_list,
                "orders": order_list
            })
            
            await asyncio.sleep(0.5)
            
    except Exception as e:
        print(f"[CRITICAL] Bridge loop error: {e}")
    finally:
        service.shutdown()

if __name__ == "__main__":
    # Fix for path if needed
    __filename__ = __file__
    asyncio.run(main())
