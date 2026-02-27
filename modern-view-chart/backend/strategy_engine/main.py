import asyncio
import json
import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import websockets

from strategy_manager import StrategyManager
from analyzer_service import AnalyzerService
from optimizer_service import OptimizerService


def parse_bool(value, fallback=False):
    if value is None:
        return fallback
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return fallback


def build_ws_url():
    return os.getenv("NODE_WS_URL", "ws://127.0.0.1:8091").strip()


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
ACCESS_TOKEN = os.getenv("ACCESS_TOKEN", "").strip()
SYMBOL = "XAUUSDm"
TIMEFRAME = "1m"
STRATEGY_ENGINE_ENABLED = parse_bool(os.getenv("STRATEGY_ENGINE_ENABLED", "0"), False)


async def process_message(ws, manager, analyzer, optimizer, data):
    topic = data.get("topic") or data.get("type")

    if topic == "request_analysis":
        print(f"[StrategyEngine] AI analysis requested for deal {data.get('deal', {}).get('ticket')}")
        cmd = analyzer.request_analysis(data.get("deal", {}))
        if cmd:
            await ws.send(json.dumps(cmd))
        return

    if topic == "mt5_candles_at":
        result = analyzer.handle_response(data)
        if result:
            await ws.send(json.dumps({"topic": "analysis_result", "data": result}))
        return

    if topic == "request_optimization":
        print(f"[StrategyEngine] Optimization requested for {data.get('symbol')}")
        cmd = optimizer.request_optimization(data.get("symbol", SYMBOL), data.get("timeframe", TIMEFRAME))
        if cmd:
            await ws.send(json.dumps(cmd))
        return

    if topic in {"binance_positions_update", "mt5_account_update", "account_update"}:
        account = data.get("account", {})
        positions = data.get("positions", [])
        risk_data = {
            "balance": float(account.get("balance", 0) or 0),
            "equity": float(account.get("equity", 0) or 0),
            "positions": positions,
        }
        manager.on_account_update(risk_data)
        return

    if topic == "mt5_candles" and data.get("request_id"):
        result = optimizer.handle_candles_response(data)
        if result:
            await ws.send(json.dumps({"topic": "optimization_result", "data": result}))
        return

    if topic in {"mt5_candles", "candleUpdate"}:
        msg_symbol = data.get("symbol")
        if msg_symbol != SYMBOL:
            return

        candles = []
        if topic == "mt5_candles":
            candles = data.get("candles", [])

        if candles:
            signal_msg = manager.on_market_data(SYMBOL, candles)
            if signal_msg:
                print(f"[StrategyEngine] Signal generated: {signal_msg}")
                await ws.send(json.dumps({"topic": "strategy_signal", "data": signal_msg}))


async def main():
    if not STRATEGY_ENGINE_ENABLED:
        print("[StrategyEngine] Disabled by STRATEGY_ENGINE_ENABLED=0. Exiting safely.")
        return

    print("[StrategyEngine] Starting...")

    manager = StrategyManager()
    analyzer = AnalyzerService()
    optimizer = OptimizerService()

    manager.add_strategy(SYMBOL, TIMEFRAME, {"rsi_buy": 60, "rsi_sell": 40})

    while True:
        try:
            print(f"[StrategyEngine] Connecting to {mask_url_for_log(WS_URL)}")
            connect_kwargs = {}
            if ACCESS_TOKEN:
                connect_kwargs["subprotocols"] = [f"bearer.{ACCESS_TOKEN}"]
            async with websockets.connect(WS_URL, **connect_kwargs) as ws:
                print("[StrategyEngine] Connected")
                await ws.send(json.dumps({"topic": "auth", "client": "strategy_engine"}))
                await ws.send(json.dumps({"topic": "subscribeCandle", "symbol": SYMBOL, "interval": TIMEFRAME}))

                async for message in ws:
                    try:
                        data = json.loads(message)
                        await process_message(ws, manager, analyzer, optimizer, data)
                    except json.JSONDecodeError:
                        continue
                    except Exception as error:
                        print(f"[StrategyEngine] Message processing error: {error}")

        except Exception as error:
            print(f"[StrategyEngine] Connection lost: {error}. Retrying in 5s...")
            await asyncio.sleep(5)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[StrategyEngine] Stopped")
