import asyncio
import websockets
import json
import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from strategy_manager import StrategyManager

from analyzer_service import AnalyzerService
from optimizer_service import OptimizerService

def build_ws_url():
    base_url = os.getenv("NODE_WS_URL", "ws://127.0.0.1:8091").strip()
    access_token = os.getenv("ACCESS_TOKEN", "").strip()
    if not access_token:
        return base_url
    sep = "&" if "?" in base_url else "?"
    return f"{base_url}{sep}access_token={access_token}"


def mask_url_for_log(url):
    if not url:
        return url
    try:
        parts = urlsplit(url)
        query = parse_qsl(parts.query, keep_blank_values=True)
        masked_query = []
        for key, value in query:
            if key in {"access_token", "access_ticket"} and value:
                suffix = value[-4:] if len(value) >= 4 else "****"
                masked_query.append((key, f"***{suffix}"))
            else:
                masked_query.append((key, value))
        return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(masked_query), parts.fragment))
    except Exception:
        return url


WS_URL = build_ws_url()
SYMBOL = "XAUUSDm"
TIMEFRAME = "1m" # Default M1 for Bot

async def main():
    print("🚀 Strategy Engine Starting...")
    
    manager = StrategyManager()
    analyzer = AnalyzerService()
    optimizer = OptimizerService()
    
    # Load Default Strategy
    # In future, this could be dynamic via API/Config
    manager.add_strategy(SYMBOL, TIMEFRAME, {'rsi_buy': 60, 'rsi_sell': 40})

    while True:
        try:
            print(f"🔌 Connecting to {mask_url_for_log(WS_URL)}...")
            async with websockets.connect(WS_URL) as ws:
                print("✅ Strategy Engine Connected to Hub")
                
                # Identify as Strategy Engine
                await ws.send(json.dumps({"topic": "auth", "client": "strategy_engine"}))

                # Subscribe to Market Data
                print(f"📡 Subscribing to {SYMBOL} {TIMEFRAME}...")
                await ws.send(json.dumps({
                    "topic": "subscribeCandle",
                    "symbol": SYMBOL,
                    "interval": TIMEFRAME
                }))

                async for message in ws:
                    try:
                        data = json.loads(message)
                        topic = data.get("topic") or data.get("type")

                        # AI ANALYSIS HANDLER
                        if topic == "request_analysis":
                            print(f"🧠 AI Analysis Requested for Deal {data.get('deal', {}).get('ticket')}")
                            # 1. Generate MT5 Command to fetch context
                            cmd = analyzer.request_analysis(data.get('deal', {}))
                            if cmd:
                                await ws.send(json.dumps(cmd))
                        
                        elif topic == "mt5_candles_at":
                            # 2. Process Data and Evaluate
                            result = analyzer.handle_response(data)
                            if result:
                                print(f"📝 Analysis Result: {result['verdict']}")
                                await ws.send(json.dumps({
                                    "topic": "analysis_result",
                                    "data": result
                                }))

                        # AI OPTIMIZER HANDLER
                        elif topic == "request_optimization":
                            print(f"🧪 Optimization Requested for {data.get('symbol')}")
                            cmd = optimizer.request_optimization(data.get('symbol', SYMBOL), data.get('timeframe', TIMEFRAME))
                            if cmd:
                                await ws.send(json.dumps(cmd))
                                
                        elif topic == "mt5_candles":
                            # Check if it has request_id (Optimization Response)
                            if data.get('request_id'):
                                result = optimizer.handle_candles_response(data)
                                if result:
                                    print(f"🧪 Optimization Result: Best Winrate {result['metrics']['winrate']}%")
                                    await ws.send(json.dumps({
                                        "topic": "optimization_result",
                                        "data": result
                                    }))
                            else:
                                # Standard Process (Market Data update)
                                # Check if symbol matches
                                msg_symbol = data.get("symbol")
                                if msg_symbol == SYMBOL:
                        if topic == "binance_positions_update" or topic == "mt5_account_update" or topic == "account_update":
                             # Normalizing data structure for Risk Manager
                             # Standard format expected: { balance, equity, positions: [] }
                             
                             account = data.get('account', {})
                             positions = data.get('positions', [])
                             
                             risk_data = {
                                 'balance': float(account.get('balance', 0)),
                                 'equity': float(account.get('equity', 0)),
                                 'positions': positions
                             }
                             
                             manager.on_account_update(risk_data)
                             
                        # We listen for candle updates
                        if topic == "mt5_candles" or topic == "candleUpdate":
                             # Check if symbol matches
                             msg_symbol = data.get("symbol")
                             if msg_symbol == SYMBOL:
                                 # Standardize data format
                                 # mt5_candles sends 'candles' array
                                 # candleUpdate sends single 'data' object (realtime)
                                 
                                 candles = []
                                 if topic == "mt5_candles":
                                     candles = data.get("candles", [])
                                 # Realtime updates might be single ticks or partial candles. 
                                 # For this strategy we need HISTORY. 
                                 # Ideally, Node broadcasts 200 candles periodically.
                                 
                                 if candles:
                                     # Run Strategy
                                     signal_msg = manager.on_market_data(SYMBOL, candles)
                                     
                                     if signal_msg:
                                         print(f"💎 SIGNAL: {signal_msg}")
                                         # Send Signal back to Node Hub
                                         # Node Hub can then alert user or forward to Bridge if Auto-Trade is ON
                                         await ws.send(json.dumps({
                                             "topic": "strategy_signal",
                                             "data": signal_msg
                                         }))
                                         
                    except json.JSONDecodeError:
                        pass
                    except Exception as e:
                        print(f"❌ Error processing message: {e}")

        except Exception as e:
             print(f"⚠️ Connection Lost: {e}. Retrying in 5s...")
             await asyncio.sleep(5)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("🛑 Strategy Engine Stopped")
