---
name: server
description: "Skill for the Server area of BE_ViewChart. 26 symbols across 6 files."
---

# Server

26 symbols | 6 files | Cohesion: 92%

## When to Use

- Working with code in `modern-view-chart/`
- Understanding how load_env, get_binance_offset, get_binance_current_open work
- Modifying server-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `modern-view-chart/scripts/server/measure_candle_lag.py` | load_env, get_binance_offset, get_binance_current_open, get_mt5_current_open, get_vivu_current_open (+4) |
| `modern-view-chart/scripts/server/ws-auth-smoke.mjs` | parseArgs, maskCredential, withQueryToken, runWsCase, finish (+1) |
| `modern-view-chart/scripts/server/ws-soak-test.mjs` | parseArgs, withAccessToken, main, countTopic, pollHealth |
| `modern-view-chart/scripts/server/api-auth-smoke.mjs` | parseArgs, maskCredential, runCase, main |
| `modern-view-chart/src/hooks/use-websocket/senders.ts` | queueForegroundResync |
| `modern-view-chart/src/app/[locale]/signals/page.tsx` | run |

## Entry Points

Start here when exploring this area:

- **`load_env`** (Function) — `modern-view-chart/scripts/server/measure_candle_lag.py:16`
- **`get_binance_offset`** (Function) — `modern-view-chart/scripts/server/measure_candle_lag.py:30`
- **`get_binance_current_open`** (Function) — `modern-view-chart/scripts/server/measure_candle_lag.py:41`
- **`get_mt5_current_open`** (Function) — `modern-view-chart/scripts/server/measure_candle_lag.py:52`
- **`get_vivu_current_open`** (Function) — `modern-view-chart/scripts/server/measure_candle_lag.py:59`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `load_env` | Function | `modern-view-chart/scripts/server/measure_candle_lag.py` | 16 |
| `get_binance_offset` | Function | `modern-view-chart/scripts/server/measure_candle_lag.py` | 30 |
| `get_binance_current_open` | Function | `modern-view-chart/scripts/server/measure_candle_lag.py` | 41 |
| `get_mt5_current_open` | Function | `modern-view-chart/scripts/server/measure_candle_lag.py` | 52 |
| `get_vivu_current_open` | Function | `modern-view-chart/scripts/server/measure_candle_lag.py` | 59 |
| `fmt` | Function | `modern-view-chart/scripts/server/measure_candle_lag.py` | 88 |
| `measure` | Function | `modern-view-chart/scripts/server/measure_candle_lag.py` | 92 |
| `avg` | Function | `modern-view-chart/scripts/server/measure_candle_lag.py` | 189 |
| `main` | Function | `modern-view-chart/scripts/server/measure_candle_lag.py` | 201 |
| `queueForegroundResync` | Function | `modern-view-chart/src/hooks/use-websocket/senders.ts` | 33 |
| `run` | Function | `modern-view-chart/src/app/[locale]/signals/page.tsx` | 18 |
| `parseArgs` | Function | `modern-view-chart/scripts/server/ws-auth-smoke.mjs` | 15 |
| `maskCredential` | Function | `modern-view-chart/scripts/server/ws-auth-smoke.mjs` | 28 |
| `withQueryToken` | Function | `modern-view-chart/scripts/server/ws-auth-smoke.mjs` | 35 |
| `runWsCase` | Function | `modern-view-chart/scripts/server/ws-auth-smoke.mjs` | 41 |
| `finish` | Function | `modern-view-chart/scripts/server/ws-auth-smoke.mjs` | 46 |
| `main` | Function | `modern-view-chart/scripts/server/ws-auth-smoke.mjs` | 107 |
| `parseArgs` | Function | `modern-view-chart/scripts/server/ws-soak-test.mjs` | 13 |
| `withAccessToken` | Function | `modern-view-chart/scripts/server/ws-soak-test.mjs` | 26 |
| `main` | Function | `modern-view-chart/scripts/server/ws-soak-test.mjs` | 43 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Backend | 2 calls |

## How to Explore

1. `gitnexus_context({name: "load_env"})` — see callers and callees
2. `gitnexus_query({query: "server"})` — find related execution flows
3. Read key files listed above for implementation details
