import asyncio
import websockets
import json

class BridgeClient:
    def __init__(self, ws_url, mt5_service, alert_service=None, memory_service=None):
        self.ws_url = ws_url
        self.mt5 = mt5_service
        self.alert_service = alert_service
        self.memory_service = memory_service
        self.websocket = None

    async def connect(self):
        self.websocket = await websockets.connect(self.ws_url, max_size=10*1024*1024)
        print(f"[OK] Bridge connected to {self.ws_url}")
        return self.websocket

    async def send_json(self, data):
        if self.websocket:
            await self.websocket.send(json.dumps(data))

    async def listen_commands(self):
        async for message in self.websocket:
            try:
                data = json.loads(message)
                msg_topic = data.get("topic") or data.get("type")
                if msg_topic == "mt5_command":
                    await self.handle_command(data)
                elif msg_topic == "alert_command":
                    await self.handle_alert_command(data)
                elif msg_topic == "memory_command":
                    await self.handle_memory_command(data)
            except Exception as e:
                print(f"[ERROR] Command handling error (topic:{msg_topic}): {e}")

    async def handle_alert_command(self, data):
        if not self.alert_service: 
            print("[ALERT] No alert service configured")
            return
        
        cmd = data.get("command")
        print(f"[ALERT] Received command: {cmd}")
        
        if cmd == "add":
            alert = data.get("alert")
            print(f"[ALERT] Adding alert: {alert}")
            self.alert_service.add_alert(alert)
        elif cmd == "remove":
            alert_id = data.get("id")
            print(f"[ALERT] Removing alert: {alert_id}")
            self.alert_service.remove_alert(alert_id)
        elif cmd == "update":
            alert_id = data.get("id")
            updates = data.get("updates")
            print(f"[ALERT] Updating alert {alert_id}: {updates}")
            self.alert_service.update_alert(alert_id, updates)
            
    async def handle_memory_command(self, data):
        if not self.memory_service:
            print("[MEMORY] No memory service configured")
            return
            
        cmd = data.get("command")
        print(f"[MEMORY] Received command: {cmd}")
        
        if cmd == "remember":
            content = data.get("content")
            mtype = data.get("type", "observation")
            await self.memory_service.remember(content, mtype)
            
        elif cmd == "recall":
            query = data.get("query")
            request_id = data.get("request_id")
            context = await self.memory_service.recall(query)
            
            await self.send_json({
                "topic": "memory_result",
                "request_id": request_id,
                "query": query,
                "context": context
            })

    async def handle_command(self, data):
        cmd = data.get("command")
        ticket = data.get("ticket")
        
        if cmd == "close":
            res = self.mt5.close_position(ticket)
            print(f"[CMD] Close {ticket}: {'Done' if res else 'Failed'}")
        
        elif cmd == "modify":
            res = self.mt5.modify_position(ticket, data.get("sl"), data.get("tp"), data.get("price"))
            print(f"[CMD] Modify {ticket}: {'Done' if res else 'Failed'}")
        
        elif cmd == "get_candles":
            candles = self.mt5.fetch_candles(data['symbol'], data.get('interval', '1m'), data.get('count', 200))
            await self.send_json({
                "topic": "mt5_candles",
                "symbol": data['symbol'],
                "interval": data.get('interval', '1m'),
                "candles": candles,
                "request_id": data.get('request_id')
            })

        elif cmd == "get_candles_at":
            candles = self.mt5.fetch_candles_at(
                data['symbol'], 
                data['timestamp'], 
                data.get('interval', '1m'), 
                data.get('count', 50)
            )
            await self.send_json({
                "topic": "mt5_candles_at",
                "symbol": data['symbol'],
                "timestamp": data['timestamp'],
                "candles": candles,
                "request_id": data.get('request_id')
            })

        elif cmd in ["order", "place_order", "buy", "sell"]:
            order_type = cmd if cmd in ["buy", "sell"] else data.get('order_type')
            success = self.mt5.place_order(
                data.get('symbol'),
                order_type,
                data.get('volume'),
                data.get('sl'),
                data.get('tp'),
                data.get('price', 0),
                data.get('is_market', True)
            )
            print(f"[CMD] {cmd.capitalize()} {data.get('symbol')}: {'Done' if success else 'Failed'}")
            
            # Send result back to frontend
            await self.send_json({
                "topic": "mt5_order_result",
                "success": success,
                "command": cmd,
                "symbol": data.get('symbol')
            })

        elif cmd == "get_symbol_info":
            spec = self.mt5.get_symbol_specification(data.get('symbol'))
            if spec:
                await self.send_json({
                    "topic": "mt5_symbol_info",
                    "data": spec
                })

        elif cmd == "get_history":
            limit = data.get("limit", 100) # Default to 100 if not specified
            history = self.mt5.get_history_deals(None, None, limit)
            total = len(history)
            chunk_size = 500
            
            if total == 0:
                await self.send_json({
                    "topic": "mt5_history_deals",
                    "data": [],
                    "is_chunk": False
                })
            else:
                for i in range(0, total, chunk_size):
                    chunk = history[i:i + chunk_size]
                    await self.send_json({
                        "topic": "mt5_history_deals",
                        "data": chunk,
                        "is_chunk": True,
                        "chunk_index": i // chunk_size,
                        "total_chunks": (total + chunk_size - 1) // chunk_size,
                        "is_last_chunk": (i + chunk_size) >= total
                    })
                    print(f"[FETCH] Sent chunk {i // chunk_size + 1} with {len(chunk)} deals")
                    await asyncio.sleep(0.01) # Small delay to prevent flooding
            
            print(f"[OK] History sent in chunks (Total: {total})")
