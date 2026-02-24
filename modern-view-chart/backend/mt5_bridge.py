import MetaTrader5 as mt5
import asyncio
import websockets
import json
import time
import sys

# Configuration
NODE_WS_URL = "ws://localhost:8091"
SYMBOLS = ["XAUUSDm", "BTCUSDm", "EURUSDm", "GBPUSDm"]

# Timeframe mapping for historical data
TIMEFRAME_MAP = {
    '1m': mt5.TIMEFRAME_M1,
    '5m': mt5.TIMEFRAME_M5,
    '15m': mt5.TIMEFRAME_M15,
    '1h': mt5.TIMEFRAME_H1,
    '4h': mt5.TIMEFRAME_H4,
    '1d': mt5.TIMEFRAME_D1
}

def fetch_candles(symbol, interval, count=200):
    """Fetch historical candles from MT5"""
    tf = TIMEFRAME_MAP.get(interval, mt5.TIMEFRAME_M1)
    rates = mt5.copy_rates_from_pos(symbol, tf, 0, count)
    if rates is None:
        print(f"[WARN] No candle data for {symbol} {interval}")
        return []
    
    candles = []
    for r in rates:
        candles.append({
            'time': int(r['time']),
            'open': float(r['open']),
            'high': float(r['high']),
            'low': float(r['low']),
            'close': float(r['close']),
            'volume': int(r['tick_volume'])
        })
    print(f"[OK] Fetched {len(candles)} candles for {symbol} {interval}")
    return candles

async def fetch_and_send_positions(websocket):
    """Fetch open positions and account info, then send to Node.js"""
    try:
        # Get Account Info
        account = mt5.account_info()
        acc_data = {}
        if account:
            acc_data = {
                "balance": account.balance,
                "equity": account.equity,
                "margin": account.margin,
                "free_margin": account.margin_free,
                "margin_level": account.margin_level,
                "profit": account.profit
            }

        # Get Positions
        positions = mt5.positions_get()
        pos_list = []
        if positions:
            for p in positions:
                pos_list.append({
                    "ticket": p.ticket,
                    "symbol": p.symbol,
                    "type": "buy" if p.type == mt5.ORDER_TYPE_BUY else "sell",
                    "volume": p.volume,
                    "price_open": p.price_open,
                    "price_current": p.price_current,
                    "sl": p.sl,
                    "tp": p.tp,
                    "profit": p.profit,
                    "time": p.time,
                    "magic": p.magic
                })
        
        # Get Pending Orders
        orders = mt5.orders_get()
        order_list = []
        if orders:
            for o in orders:
                # Map order types to readable strings
                o_type = "limit"
                if o.type == mt5.ORDER_TYPE_BUY_LIMIT: o_type = "buy limit"
                elif o.type == mt5.ORDER_TYPE_SELL_LIMIT: o_type = "sell limit"
                elif o.type == mt5.ORDER_TYPE_BUY_STOP: o_type = "buy stop"
                elif o.type == mt5.ORDER_TYPE_SELL_STOP: o_type = "sell stop"
                
                order_list.append({
                    "ticket": o.ticket,
                    "symbol": o.symbol,
                    "type": o_type,
                    "volume": o.volume_initial,
                    "price_open": o.price_open,
                    "price_current": o.price_current, # usually not useful for pending orders but included for compatibility
                    "sl": o.sl,
                    "tp": o.tp,
                    "profit": 0, # Pending orders don't have profit yet
                    "time": o.time_setup,
                    "magic": o.magic
                })

        await websocket.send(json.dumps({
            "type": "mt5_positions_update",
            "account": acc_data,
            "positions": pos_list,
            "orders": order_list
        }))
    except Exception as e:
        print(f"[ERROR] in fetch_and_send_positions: {e}")

async def handle_node_commands(websocket):
    """Listen for commands from Node.js (close, modify, get_candles)"""
    async for message in websocket:
        try:
            data = json.loads(message)
            if data.get("type") == "mt5_command":
                cmd = data.get("command")
                ticket = data.get("ticket")
                
                if cmd == "close":
                    res = close_position_by_ticket(ticket)
                    print(f"[CMD] Close Position {ticket}: {'Done' if res else 'Failed'}")
                
                elif cmd == "modify":
                    sl = data.get("sl")
                    tp = data.get("tp")
                    res = modify_position_by_ticket(ticket, sl, tp)
                    print(f"[CMD] Modify Position {ticket}: SL={sl}, TP={tp} -> {'Done' if res else 'Failed'}")
                
                elif cmd == "get_candles":
                    symbol = data.get("symbol")
                    interval = data.get("interval", "1m")
                    count = data.get("count", 200)
                    candles = fetch_candles(symbol, interval, count)
                    await websocket.send(json.dumps({
                        "type": "mt5_candles",
                        "symbol": symbol,
                        "interval": interval,
                        "candles": candles
                    }))
            
            elif data.get("type") == "mt5_update":
                # This script also handles price updates (logic from previous step)
                pass # Price loop is separate or integrated

        except Exception as e:
            print(f"[ERROR] Command Error: {e}")

def close_position_by_ticket(ticket):
    # Try Position first
    positions = mt5.positions_get(ticket=ticket)
    if positions:
        pos = positions[0]
        tick = mt5.symbol_info_tick(pos.symbol)
        price = tick.bid if pos.type == mt5.ORDER_TYPE_BUY else tick.ask
        order_type = mt5.ORDER_TYPE_SELL if pos.type == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY
        
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": pos.symbol,
            "volume": pos.volume,
            "type": order_type,
            "position": ticket,
            "price": price,
            "magic": pos.magic,
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        result = mt5.order_send(request)
        return result.retcode == mt5.TRADE_RETCODE_DONE

    # Try Pending Order
    orders = mt5.orders_get(ticket=ticket)
    if orders:
        ord = orders[0]
        request = {
            "action": mt5.TRADE_ACTION_REMOVE,
            "order": ticket
        }
        result = mt5.order_send(request)
        return result.retcode == mt5.TRADE_RETCODE_DONE
    
    return False

def modify_position_by_ticket(ticket, sl, tp):
    # Try Position
    positions = mt5.positions_get(ticket=ticket)
    if positions:
        pos = positions[0]
        request = {
            "action": mt5.TRADE_ACTION_SLTP,
            "symbol": pos.symbol,
            "position": ticket,
            "sl": float(sl) if sl is not None else pos.sl,
            "tp": float(tp) if tp is not None else pos.tp,
        }
        result = mt5.order_send(request)
        return result.retcode == mt5.TRADE_RETCODE_DONE

    # Try Pending Order
    orders = mt5.orders_get(ticket=ticket)
    if orders:
        ord = orders[0]
        request = {
            "action": mt5.TRADE_ACTION_MODIFY,
            "order": ticket,
            "price": ord.price_open, # keep current price or update? for now keep
            "sl": float(sl) if sl is not None else ord.sl,
            "tp": float(tp) if tp is not None else ord.tp,
            "type_time": getattr(ord, 'type_time', mt5.ORDER_TIME_GTC),
            "expiration": getattr(ord, 'expiration', 0)
        }
        result = mt5.order_send(request)
        return result.retcode == mt5.TRADE_RETCODE_DONE

    return False

def fetch_available_symbols():
    """Fetch all tradeable symbols from MT5"""
    symbols = mt5.symbols_get()
    if symbols is None:
        print("[ERROR] Failed to fetch symbols")
        return []
    
    available = []
    for s in symbols:
        # Filter: trade_mode != SYMBOL_TRADE_MODE_DISABLED (0)
        # We also prefer symbols that are visible or have quotes
        if s.trade_mode != mt5.SYMBOL_TRADE_MODE_DISABLED:
            available.append({
                "symbol": s.name,
                "path": s.path,
                "description": s.description,
                "digits": s.digits,
                "trade_mode": s.trade_mode,
                "type": "forex" if "Forex" in s.path else "crypto" if "Crypto" in s.path else "other"
            })
    print(f"[OK] Found {len(available)} tradeable symbols")
    return available

async def bridge_loop():
    if not mt5.initialize():
        print("[ERROR] MT5 Init failed")
        return

    async with websockets.connect(NODE_WS_URL) as websocket:
        print(f"[OK] Bridge connected to {NODE_WS_URL}")
        
        # 1. Send initial available symbols
        available_symbols = fetch_available_symbols()
        await websocket.send(json.dumps({
            "type": "mt5_symbols_available",
            "symbols": available_symbols
        }))

        # Start command listener in background
        asyncio.create_task(handle_node_commands(websocket))
        
        # Define dynamic symbols to track (initially the ones from config, then maybe expanded)
        # For now, let's track the first few available or the ones in SYMBOLS
        tracking_symbols = list(set(SYMBOLS + [s["symbol"] for s in available_symbols[:10]]))

        while True:
            # 1. Send Prices (Fast)
            for symbol in tracking_symbols:
                tick = mt5.symbol_info_tick(symbol)
                if tick:
                    # Get Daily Open for change calculation (accurate from MT5)
                    # Use mt5.copy_rates_from_pos for current day's first candle
                    # This is slightly expensive, maybe cache it per day
                    
                    await websocket.send(json.dumps({
                        "type": "mt5_update",
                        "symbol": symbol,
                        "price": tick.bid,
                        "ask": tick.ask,
                        "time": int(tick.time * 1000) # Use MT5 Server Time (ms)
                    }))
            
            # 2. Send Positions (Slower)
            await fetch_and_send_positions(websocket)
            
            await asyncio.sleep(0.5)

if __name__ == "__main__":
    try:
        asyncio.run(bridge_loop())
    except KeyboardInterrupt:
        pass
    finally:
        mt5.shutdown()
