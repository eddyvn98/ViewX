import argparse
import asyncio
import json
import os
import time
import uuid

import MetaTrader5 as mt5
import requests
import websockets


BINANCE_TIME_URL = "https://api.binance.com/api/v3/time"
BINANCE_KLINES_URL = "https://api.binance.com/api/v3/klines"


def load_env(repo_root: str) -> None:
    for env_name in (".env.docker", ".env"):
        env_path = os.path.join(repo_root, env_name)
        if not os.path.exists(env_path):
            continue
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip("\"'"))


def get_binance_offset() -> float:
    t0 = time.time()
    r = requests.get(BINANCE_TIME_URL, timeout=5)
    t1 = time.time()
    r.raise_for_status()
    server_ms = r.json()["serverTime"]
    # Midpoint approximation to reduce RTT bias.
    local_mid = (t0 + t1) / 2.0
    return (server_ms / 1000.0) - local_mid


def get_binance_current_open(symbol: str, interval: str) -> int:
    r = requests.get(
        BINANCE_KLINES_URL,
        params={"symbol": symbol, "interval": interval, "limit": 1},
        timeout=5,
    )
    r.raise_for_status()
    k = r.json()[0]
    return int(k[0] // 1000)


def get_mt5_current_open(symbol: str) -> int:
    rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 0, 1)
    if rates is None or len(rates) == 0:
        return -1
    return int(rates[0]["time"])


async def get_vivu_current_open(ws, symbol: str) -> int:
    req_id = str(uuid.uuid4())
    await ws.send(
        json.dumps(
            {
                "topic": "mt5_command",
                "command": "get_candles",
                "symbol": symbol,
                "interval": "1",
                "count": 2,
                "request_id": req_id,
            }
        )
    )
    deadline = time.time() + 2.0
    while time.time() < deadline:
        raw = await asyncio.wait_for(ws.recv(), timeout=2.0)
        msg = json.loads(raw)
        if msg.get("topic") != "mt5_candles":
            continue
        if msg.get("request_id") != req_id:
            continue
        candles = msg.get("candles") or []
        if not candles:
            return -1
        return int(candles[-1]["time"])
    return -1


def fmt(sec: float) -> str:
    return f"{sec:.3f}s"


async def measure(args) -> None:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    load_env(repo_root)

    access_token = os.getenv("ACCESS_TOKEN", "").strip()
    ws_url = os.getenv("NEXT_PUBLIC_WS_URL", "wss://api.vivutrade.io.vn").strip()
    mt5_symbol = args.mt5_symbol
    binance_symbol = args.binance_symbol

    if not mt5.initialize():
        raise RuntimeError("MT5 initialize failed")

    subprotocols = []
    if access_token:
        subprotocols = [f"bearer.{access_token}"]

    print(f"Using WS: {ws_url}")
    print(f"MT5 symbol: {mt5_symbol}, Binance symbol: {binance_symbol}")
    print(f"Iterations: {args.iterations}, poll: {args.poll_ms}ms")

    offset = get_binance_offset()
    print(f"Estimated Binance-local time offset: {offset:+.3f}s")

    results = []
    try:
        async with websockets.connect(ws_url, subprotocols=subprotocols) as ws:
            for i in range(args.iterations):
                local_now = time.time()
                exchange_now = local_now + offset
                next_boundary = int(exchange_now // 60) * 60 + 60
                boundary_local = next_boundary - offset

                wait_sec = max(0.0, boundary_local - local_now - 0.4)
                print(f"\n[{i+1}/{args.iterations}] Waiting {wait_sec:.2f}s for next 1m boundary...")
                await asyncio.sleep(wait_sec)

                got = {"binance": None, "mt5": None, "vivu": None}
                while True:
                    now = time.time()

                    if got["binance"] is None:
                        try:
                            b_open = get_binance_current_open(binance_symbol, "1m")
                            if b_open >= next_boundary:
                                got["binance"] = now
                        except Exception:
                            pass

                    if got["mt5"] is None:
                        try:
                            m_open = get_mt5_current_open(mt5_symbol)
                            if m_open >= next_boundary:
                                got["mt5"] = now
                        except Exception:
                            pass

                    if got["vivu"] is None:
                        try:
                            v_open = await get_vivu_current_open(ws, mt5_symbol)
                            if v_open >= next_boundary:
                                got["vivu"] = now
                        except Exception:
                            pass

                    if all(v is not None for v in got.values()):
                        break

                    if now - boundary_local > args.max_wait_sec:
                        break

                    await asyncio.sleep(args.poll_ms / 1000.0)

                row = {
                    "boundary_utc": next_boundary,
                    "lag_binance": None if got["binance"] is None else (got["binance"] - boundary_local),
                    "lag_mt5": None if got["mt5"] is None else (got["mt5"] - boundary_local),
                    "lag_vivu": None if got["vivu"] is None else (got["vivu"] - boundary_local),
                }
                results.append(row)

                print(f"Boundary UTC: {next_boundary}")
                print(f"  Binance lag: {fmt(row['lag_binance']) if row['lag_binance'] is not None else 'timeout'}")
                print(f"  MT5 lag:     {fmt(row['lag_mt5']) if row['lag_mt5'] is not None else 'timeout'}")
                print(f"  Vivu lag:    {fmt(row['lag_vivu']) if row['lag_vivu'] is not None else 'timeout'}")
                if row["lag_mt5"] is not None and row["lag_vivu"] is not None:
                    print(f"  Vivu-MT5:    {fmt(row['lag_vivu'] - row['lag_mt5'])}")
                if row["lag_vivu"] is not None and row["lag_binance"] is not None:
                    print(f"  Vivu-Binance:{fmt(row['lag_vivu'] - row['lag_binance'])}")

    finally:
        mt5.shutdown()

    valid = [r for r in results if None not in (r["lag_binance"], r["lag_mt5"], r["lag_vivu"])]
    if not valid:
        print("\nNo complete samples collected.")
        return

    def avg(key: str) -> float:
        return sum(r[key] for r in valid) / len(valid)

    print("\nSummary")
    print(f"  samples: {len(valid)}/{len(results)}")
    print(f"  avg lag Binance: {fmt(avg('lag_binance'))}")
    print(f"  avg lag MT5:     {fmt(avg('lag_mt5'))}")
    print(f"  avg lag Vivu:    {fmt(avg('lag_vivu'))}")
    print(f"  avg Vivu-MT5:    {fmt(sum(r['lag_vivu'] - r['lag_mt5'] for r in valid) / len(valid))}")
    print(f"  avg Vivu-Binance:{fmt(sum(r['lag_vivu'] - r['lag_binance'] for r in valid) / len(valid))}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Measure 1m candle-open lag across Binance/MT5/Vivu.")
    parser.add_argument("--iterations", type=int, default=3)
    parser.add_argument("--poll-ms", type=int, default=200)
    parser.add_argument("--max-wait-sec", type=int, default=15)
    parser.add_argument("--mt5-symbol", default="BTCUSDm")
    parser.add_argument("--binance-symbol", default="BTCUSDT")
    args = parser.parse_args()
    asyncio.run(measure(args))


if __name__ == "__main__":
    main()
