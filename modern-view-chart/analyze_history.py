import asyncio
import websockets
import json
import pandas as pd
from datetime import datetime
import os
import sys

# Add parent directory to path to import indicators
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend', 'strategy_engine'))
from indicators import calculate_all

WS_URL = "ws://127.0.0.1:8091"

async def analyze_history():
    print("🕵️ Connecting to System for Historical Analysis...")
    async with websockets.connect(WS_URL) as ws:
        # Auth
        await ws.send(json.dumps({"topic": "auth", "client": "analyzer"}))
        
        # 1. Fetch History
        print("📥 Fetching last 10 deals for XAUUSDm...")
        await ws.send(json.dumps({
            "topic": "mt5_command",
            "command": "get_history",
            "limit": 100
        }))
        
        deals = []
        pending_requests = {}
        
        timeout = 0
        while True:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                data = json.loads(msg)
                topic = data.get("topic")
                
                if topic == "mt5_history_deals":
                    batch = data.get("data", [])
                    print(f"DEBUG: Received batch of {len(batch)} deals")
                    # Filter for XAUUSDm
                    filtered = [d for d in batch if "XAUUSD" in d['symbol']]
                    print(f"DEBUG: Filtered kept {len(filtered)} XAUUSD deals")
                    deals.extend(filtered)
                    
                    if not data.get("is_chunk") or data.get("is_last_chunk"):
                        print(f"✅ Received {len(deals)} relevant deals.")
                        break
                        
            except asyncio.TimeoutError:
                timeout += 1
                if timeout > 5: break
                
        if deals:
            print(f"DEBUG: First deal: {deals[0]}")

        # 2. Group Deals by Position
        positions = {}
        for deal in deals:
            pid = deal.get('position_id')
            if pid is None:
                pid = deal.get('ticket') # Fallback to Ticket (will group poorly but show data)
            
            if pid not in positions:
                positions[pid] = {'deals': [], 'total_profit': 0.0, 'symbol': deal['symbol']}
            
            positions[pid]['deals'].append(deal)
            positions[pid]['total_profit'] += deal['profit'] + deal['swap'] + deal['commission']

        # 3. Analyze Each Position
        report = ["# Historical Trade Analysis (XAUUSDm)\n"]
        
        # Sort positions by time of first deal
        sorted_pids = sorted(positions.keys(), key=lambda k: positions[k]['deals'][0]['time'], reverse=True)
        
        for pid in sorted_pids[:5]: # Analyze last 5 positions
            pos_data = positions[pid]
            total_profit = pos_data['total_profit']
            
            # Find Entry Deal (First 'in' deal)
            entry_deals = [d for d in pos_data['deals'] if d['entry'] in ['in', 'in/out']]
            if not entry_deals: continue
            
            # Use the earliest entry for context
            entry_deals.sort(key=lambda x: x['time'])
            entry_deal = entry_deals[0]
            
            entry_time = entry_deal['time']
            symbol = entry_deal['symbol']
            deal_type = entry_deal['type'] # buy/sell
            
            print(f"🔍 Analyzing Position {pid} (Profit: ${total_profit:.2f})...")
            
            # Request Context
            req_id = f"req_{pid}"
            await ws.send(json.dumps({
                "topic": "mt5_command",
                "command": "get_candles_at",
                "symbol": symbol,
                "timestamp": entry_time,
                "count": 50,
                "request_id": req_id
            }))
            
            # Wait for response
            candles = []
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                data = json.loads(msg)
                if data.get("topic") == "mt5_candles_at" and data.get("request_id") == req_id:
                    candles = data.get("candles", [])
            except asyncio.TimeoutError:
                print("⚠️ Timeout waiting for candles")
            
            if not candles:
                print("⚠️ No candle data found")
                continue
                
            # Calculate Indicators
            df = pd.DataFrame(candles)
            df = calculate_all(df)
            
            # Snapshot at entry (last closed candle before entry)
            c_entry = df.iloc[-2]
            
            # Evaluation
            rsi = c_entry['rsi']
            hull = c_entry['hull25']
            price = c_entry['close']
            
            verdict = "NEUTRAL"
            if deal_type == 'buy':
                if rsi > 60 and price > hull: verdict = "GOOD ENTRY ✅"
                elif rsi < 50: verdict = "BAD ENTRY (RSI Low) ❌"
            elif deal_type == 'sell':
                if rsi < 40 and price < hull: verdict = "GOOD ENTRY ✅"
                elif rsi > 50: verdict = "BAD ENTRY (RSI High) ❌"
                
            # Append to Report
            ts_str = datetime.fromtimestamp(entry_time).strftime('%Y-%m-%d %H:%M:%S')
            
            report.append(f"## Position {pid} - {deal_type.upper()} @ {ts_str}")
            report.append(f"- **Net Profit**: ${total_profit:.2f} {'(LOSS)' if total_profit < 0 else '(WIN)'}")
            report.append(f"- **Context**: RSI={rsi:.1f}, Hull={hull:.2f}, Price={price:.2f}")
            report.append(f"- **AI Verdict**: {verdict}\n")
            
        # Save Report
        with open("history_analysis.md", "w", encoding="utf-8") as f:
            f.write("\n".join(report))
            
        print("📝 Analysis saved to history_analysis.md")

if __name__ == "__main__":
    asyncio.run(analyze_history())
