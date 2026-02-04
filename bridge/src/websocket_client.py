import asyncio
import websockets
import json

class BridgeClient:
    def __init__(self, ws_url, mt5_service):
        self.ws_url = ws_url
        self.mt5 = mt5_service
        self.websocket = None

    async def connect(self):
        self.websocket = await websockets.connect(self.ws_url)
        print(f"[OK] Bridge connected to {self.ws_url}")
        return self.websocket

    async def send_json(self, data):
        if self.websocket:
            await self.websocket.send(json.dumps(data))

    async def listen_commands(self):
        async for message in self.websocket:
            try:
                data = json.loads(message)
                if data.get("type") == "mt5_command":
                    await self.handle_command(data)
            except Exception as e:
                print(f"[ERROR] Command handling error: {e}")

    async def handle_command(self, data):
        cmd = data.get("command")
        ticket = data.get("ticket")
        
        if cmd == "close":
            res = self.mt5.close_position(ticket)
            print(f"[CMD] Close {ticket}: {'Done' if res else 'Failed'}")
        
        elif cmd == "modify":
            res = self.mt5.modify_position(ticket, data.get("sl"), data.get("tp"))
            print(f"[CMD] Modify {ticket}: {'Done' if res else 'Failed'}")
        
        elif cmd == "get_candles":
            candles = self.mt5.fetch_candles(data['symbol'], data.get('interval', '1m'), data.get('count', 200))
            await self.send_json({
                "type": "mt5_candles",
                "symbol": data['symbol'],
                "interval": data.get('interval', '1m'),
                "candles": candles
            })
