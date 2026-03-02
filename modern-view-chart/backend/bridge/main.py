import asyncio
import json
import os
import sys

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), "src"))

from mt5_service import MT5Service
from websocket_client import BridgeClient
from alert_service import AlertService
from memory_service import MemoryService
import MetaTrader5 as mt5

if sys.platform == "win32":
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

DEFAULT_CORE_SYMBOLS = ["XAUUSDm", "BTCUSDm", "ETHUSDm", "EURUSDm", "GBPUSDm"]
TIMEFRAME_MAP = {
    "1m": mt5.TIMEFRAME_M1,
    "5m": mt5.TIMEFRAME_M5,
    "15m": mt5.TIMEFRAME_M15,
    "30m": mt5.TIMEFRAME_M30,
    "1h": mt5.TIMEFRAME_H1,
    "4h": mt5.TIMEFRAME_H4,
    "1d": mt5.TIMEFRAME_D1,
    "1": mt5.TIMEFRAME_M1,
    "5": mt5.TIMEFRAME_M5,
    "15": mt5.TIMEFRAME_M15,
    "30": mt5.TIMEFRAME_M30,
    "60": mt5.TIMEFRAME_H1,
    "240": mt5.TIMEFRAME_H4,
    "1440": mt5.TIMEFRAME_D1,
}


def normalize_symbol(symbol):
    if not isinstance(symbol, str):
        return ""
    trimmed = symbol.strip()
    if not trimmed:
        return ""
    if "USDT" in trimmed.upper():
        return trimmed.upper()
    if trimmed.endswith("m") or trimmed.endswith("M"):
        return trimmed[:-1] + "m"
    return trimmed


def parse_core_symbols():
    from_env = os.getenv("CORE_SYMBOLS", "").strip()
    if not from_env:
        return DEFAULT_CORE_SYMBOLS
    parsed = [item.strip() for item in from_env.split(",") if item.strip()]
    return parsed if parsed else DEFAULT_CORE_SYMBOLS


def load_env_file():
    # current file is backend/bridge/main.py
    bridge_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(bridge_dir)
    repo_root = os.path.dirname(backend_dir)

    possible_paths = [
        os.path.join(repo_root, ".env"),
        os.path.join(backend_dir, ".env"),
    ]

    env_path = None
    for path in possible_paths:
        if os.path.exists(path):
            env_path = path
            break

    if not env_path:
        return

    try:
        with open(env_path, "r", encoding="utf-8") as file_obj:
            for line in file_obj:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip("\"'"))
        print(f"[BRIDGE] Loaded env from: {env_path}")
    except Exception as exc:
        print(f"[BRIDGE] Warning: failed to load .env ({exc})")


def build_node_ws_url():
    return os.getenv("NODE_WS_URL", "ws://127.0.0.1:8091").strip()


def env_float(name, fallback):
    raw = os.getenv(name, "").strip()
    if not raw:
        return fallback
    try:
        value = float(raw)
        return value if value > 0 else fallback
    except Exception:
        return fallback


load_env_file()
NODE_WS_URL = build_node_ws_url()
ACCESS_TOKEN = os.getenv("ACCESS_TOKEN", "").strip()
if not ACCESS_TOKEN:
    print("[BRIDGE] WARNING: ACCESS_TOKEN is missing; WS auth may fail.")

ACTIVE_LOOP_SLEEP_SEC = env_float("BRIDGE_ACTIVE_LOOP_SLEEP_SEC", 0.5)
IDLE_LOOP_SLEEP_SEC = env_float("BRIDGE_IDLE_LOOP_SLEEP_SEC", 1.5)
ACTIVE_POSITIONS_INTERVAL_SEC = env_float("BRIDGE_ACTIVE_POSITIONS_INTERVAL_SEC", 2.0)
IDLE_POSITIONS_INTERVAL_SEC = env_float("BRIDGE_IDLE_POSITIONS_INTERVAL_SEC", 8.0)
DAILY_OPEN_REFRESH_INTERVAL_SEC = env_float("BRIDGE_DAILY_OPEN_REFRESH_SEC", 300.0)


async def main():
    core_candidates = parse_core_symbols()
    service = MT5Service(core_candidates, TIMEFRAME_MAP)
    alert_service = AlertService()
    memory_service = MemoryService()
    await memory_service.initialize()

    while not service.initialize():
        print("[BRIDGE] MT5 not ready. Retrying in 10s...")
        await asyncio.sleep(10)

    available_symbols = service.fetch_available_symbols()
    available_symbol_map = {}
    for item in available_symbols:
        raw_symbol = item.get("symbol")
        normalized = normalize_symbol(raw_symbol)
        if normalized and normalized not in available_symbol_map:
            available_symbol_map[normalized] = raw_symbol

    core_symbols_actual = []
    for symbol in core_candidates:
        normalized = normalize_symbol(symbol)
        if normalized in available_symbol_map:
            core_symbols_actual.append(available_symbol_map[normalized])

    if not core_symbols_actual:
        core_symbols_actual = list(available_symbol_map.values())[:5]

    symbols_to_track = set(core_symbols_actual)
    symbols_lock = asyncio.Lock()

    async def update_symbols_interest(symbols):
        mapped = []
        for symbol in symbols:
            normalized = normalize_symbol(symbol)
            actual = available_symbol_map.get(normalized)
            if actual:
                mapped.append(actual)

        deduped = list(dict.fromkeys(mapped))

        async with symbols_lock:
            symbols_to_track.clear()
            symbols_to_track.update(deduped)

        if deduped:
            print(f"[BRIDGE] Updated interest symbols ({len(deduped)}): {', '.join(deduped[:10])}")
        else:
            print("[BRIDGE] No active symbol interest from clients. Entering idle mode.")

    try:
        client = BridgeClient(
            NODE_WS_URL,
            service,
            alert_service,
            memory_service,
            symbols_interest_callback=update_symbols_interest,
            auth_credential=ACCESS_TOKEN,
        )
        await client.connect()

        await client.send_json({"topic": "mt5_symbols_available", "symbols": available_symbols})
        last_positions_hash = None
        last_positions_time = 0
        position_update_interval = ACTIVE_POSITIONS_INTERVAL_SEC

        daily_opens = {}
        last_daily_open_refresh = 0

        while True:
            import time

            current_time = time.time()
            await client.drain_pending_commands()

            async with symbols_lock:
                symbols_snapshot = list(symbols_to_track)
            is_idle = len(symbols_snapshot) == 0
            if not is_idle:
                position_update_interval = ACTIVE_POSITIONS_INTERVAL_SEC
            else:
                position_update_interval = IDLE_POSITIONS_INTERVAL_SEC

            if (not is_idle) and (current_time - last_daily_open_refresh > DAILY_OPEN_REFRESH_INTERVAL_SEC):
                for symbol in symbols_snapshot:
                    d_open = await asyncio.to_thread(service.get_daily_open, symbol)
                    if d_open:
                        daily_opens[symbol] = d_open
                last_daily_open_refresh = current_time
                print(f"[REFRESH] Daily Open prices updated for {len(daily_opens)} symbols")

            if not is_idle:
                for symbol in symbols_snapshot:
                    tick = await asyncio.to_thread(service.get_tick, symbol)
                    if tick:
                        await alert_service.check_alerts(symbol, tick.bid, client.send_json)
                        await client.send_json(
                            {
                                "topic": "mt5_update",
                                "symbol": symbol,
                                "price": tick.bid,
                                "ask": tick.ask,
                                "daily_open": daily_opens.get(symbol),
                                "time": int(tick.time * 1000),
                            }
                        )

            acc_data = await asyncio.to_thread(service.get_account_info)
            pos_list = await asyncio.to_thread(service.get_positions)
            order_list = await asyncio.to_thread(service.get_orders)

            positions_hash = json.dumps(
                [
                    {"ticket": p["ticket"], "sl": p["sl"], "tp": p["tp"], "profit": round(p["profit"], 2)}
                    for p in pos_list
                ],
                sort_keys=True,
            )

            is_empty_unchanged = len(pos_list) == 0 and positions_hash == last_positions_hash
            should_send = not is_empty_unchanged and (
                positions_hash != last_positions_hash or (current_time - last_positions_time) >= position_update_interval
            )

            if should_send:
                await client.send_json(
                    {
                        "topic": "mt5_positions_update",
                        "account": acc_data,
                        "positions": pos_list,
                        "orders": order_list,
                    }
                )
                last_positions_hash = positions_hash
                last_positions_time = current_time

            await asyncio.sleep(IDLE_LOOP_SLEEP_SEC if is_idle else ACTIVE_LOOP_SLEEP_SEC)

    except Exception as e:
        print(f"[CRITICAL] Bridge loop error: {e}")
    finally:
        service.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
