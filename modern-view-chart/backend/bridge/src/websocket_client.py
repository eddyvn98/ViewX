import asyncio
import json
import os
import time
import websockets
from urllib.parse import urlsplit, parse_qsl, urlencode, urlunsplit


def mask_url_for_log(url):
    if not url:
        return url
    try:
        parts = urlsplit(url)
        query = parse_qsl(parts.query, keep_blank_values=True)
        masked = []
        for key, value in query:
            if key in {"access_token", "access_ticket"} and value:
                suffix = value[-4:] if len(value) >= 4 else "****"
                masked.append((key, f"***{suffix}"))
            else:
                masked.append((key, value))
        return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(masked), parts.fragment))
    except Exception:
        return url


class BridgeClient:
    def __init__(
        self,
        ws_url,
        mt5_service,
        alert_service=None,
        memory_service=None,
        symbols_interest_callback=None,
        auth_credential=None,
    ):
        self.ws_url = ws_url
        self.mt5 = mt5_service
        self.alert_service = alert_service
        self.memory_service = memory_service
        self.symbols_interest_callback = symbols_interest_callback
        self.auth_credential = (auth_credential or "").strip()
        self.client_mode = (os.getenv("BRIDGE_CLIENT_MODE", "service_bridge").strip() or "service_bridge")
        self.websocket = None
        self.bridge_metadata = None
        self.connected_at = None
        self.last_rx_monotonic = None
        self.last_tx_monotonic = None
        self.last_heartbeat_monotonic = 0.0
        self.heartbeat_interval_sec = self._read_float_env("BRIDGE_HEARTBEAT_INTERVAL_SEC", 15.0, minimum=5.0)
        self.stale_timeout_sec = self._read_float_env(
            "BRIDGE_STALE_TIMEOUT_SEC",
            max(self.heartbeat_interval_sec * 2.5, 45.0),
            minimum=self.heartbeat_interval_sec + 5.0,
        )

    def _read_float_env(self, name, fallback, minimum=None):
        raw = os.getenv(name, "").strip()
        if not raw:
            return fallback
        try:
            value = float(raw)
            if value <= 0:
                return fallback
            if minimum is not None:
                return max(minimum, value)
            return value
        except Exception:
            return fallback

    def _build_bridge_metadata(self):
        if hasattr(self.mt5, "build_bridge_metadata"):
            return self.mt5.build_bridge_metadata(client_mode=self.client_mode)
        return {
            "clientMode": self.client_mode,
            "userId": None,
            "terminalId": None,
            "accountLogin": None,
            "bridgeId": None,
        }

    def _touch_rx(self):
        now = time.monotonic()
        self.last_rx_monotonic = now
        return now

    def _touch_tx(self):
        now = time.monotonic()
        self.last_tx_monotonic = now
        return now

    def _metadata_log_summary(self):
        meta = self.bridge_metadata or {}
        bridge_id = str(meta.get("bridgeId") or "")
        terminal_id = str(meta.get("terminalId") or "")
        account_login = meta.get("accountLogin")
        user_id = str(meta.get("userId") or "")
        return (
            f"mode={meta.get('clientMode') or self.client_mode} "
            f"user={user_id[:12] or '-'} "
            f"term={terminal_id[:12] or '-'} "
            f"acct={account_login if account_login is not None else '-'} "
            f"bridge={bridge_id[:12] or '-'}"
        )

    def _build_heartbeat_payload(self, kind="bridge_heartbeat"):
        metadata = self.bridge_metadata or self._build_bridge_metadata()
        payload = {
            "topic": "app_ping",
            "sentAt": int(time.time() * 1000),
            "kind": kind,
        }
        payload.update(metadata)
        return payload

    async def _send_heartbeat(self, kind="bridge_heartbeat", force=False):
        if not self.websocket:
            raise ConnectionError("WebSocket is not connected")

        now = time.monotonic()
        if not force and (now - self.last_heartbeat_monotonic) < self.heartbeat_interval_sec:
            return False

        await self.websocket.send(json.dumps(self._build_heartbeat_payload(kind), separators=(",", ":")))
        self._touch_tx()
        self.last_heartbeat_monotonic = now
        return True

    async def _ensure_fresh_connection(self):
        if not self.websocket:
            raise ConnectionError("WebSocket is not connected")

        now = time.monotonic()
        last_activity = self.last_rx_monotonic or self.connected_at or now
        if (now - last_activity) > self.stale_timeout_sec:
            raise ConnectionError("WebSocket stale")

        await self._send_heartbeat()

    async def connect(self):
        connect_kwargs = {
            "max_size": 10 * 1024 * 1024,
        }
        if self.auth_credential:
            connect_kwargs["subprotocols"] = [f"bearer.{self.auth_credential}"]
        self.websocket = await websockets.connect(self.ws_url, **connect_kwargs)
        self.bridge_metadata = self._build_bridge_metadata()
        self.connected_at = self._touch_rx()
        self.last_heartbeat_monotonic = 0.0
        await self._send_heartbeat(kind="bridge_handshake", force=True)
        print(f"[OK] Bridge connected to {mask_url_for_log(self.ws_url)}")
        print(f"[WS] Handshake sent ({self._metadata_log_summary()})")
        return self.websocket

    async def send_json(self, data):
        if not self.websocket:
            raise ConnectionError("WebSocket is not connected")
        await self.websocket.send(json.dumps(data, separators=(",", ":")))
        self._touch_tx()

    async def listen_commands(self):
        async for message in self.websocket:
            await self.dispatch_message(message)

    async def dispatch_message(self, message):
        msg_topic = "unknown"
        try:
            self._touch_rx()
            data = json.loads(message)
            msg_topic = data.get("topic") or data.get("type") or "unknown"
            if msg_topic == "app_pong":
                return
            if msg_topic == "mt5_command":
                await self.handle_command(data)
            elif msg_topic == "alert_command":
                await self.handle_alert_command(data)
            elif msg_topic == "memory_command":
                await self.handle_memory_command(data)
            elif msg_topic == "bridge_symbols_interest":
                await self.handle_symbols_interest(data)
        except ConnectionError:
            raise
        except Exception as e:
            print(f"[ERROR] Command handling error (topic:{msg_topic}): {e}")

    async def drain_pending_commands(self, max_messages=20, timeout_sec=0.001):
        if not self.websocket:
            return

        await self._ensure_fresh_connection()
        for _ in range(max_messages):
            try:
                message = await asyncio.wait_for(self.websocket.recv(), timeout=timeout_sec)
            except asyncio.TimeoutError:
                break
            await self.dispatch_message(message)
        await self._ensure_fresh_connection()

    async def handle_symbols_interest(self, data):
        if not self.symbols_interest_callback:
            return
        symbols = data.get("symbols")
        if not isinstance(symbols, list):
            return
        await self.symbols_interest_callback(symbols)

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
        elif cmd == "trigger":
            message = data.get("message")
            print(f"[ALERT] Triggering alert: {message}")
            self.alert_service.send_telegram(message)

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
            await self.send_json(
                {
                    "topic": "memory_result",
                    "request_id": request_id,
                    "query": query,
                    "context": context,
                }
            )

    async def handle_command(self, data):
        cmd = data.get("command")
        ticket = int(data.get("ticket")) if data.get("ticket") else 0

        if cmd in ["close", "delete", "cancel"]:
            res = self.mt5.close_position(ticket)
            print(f"[CMD] {cmd.capitalize()} {ticket}: {'Done' if res else 'Failed'}")

        elif cmd == "modify":
            res = self.mt5.modify_position(ticket, data.get("sl"), data.get("tp"), data.get("price"))
            print(f"[CMD] Modify {ticket}: {'Done' if res else 'Failed'}")

        elif cmd == "get_candles":
            candles = self.mt5.fetch_candles(data["symbol"], data.get("interval", "1m"), data.get("count", 200))
            await self.send_json(
                {
                    "topic": "mt5_candles",
                    "symbol": data["symbol"],
                    "interval": data.get("interval", "1m"),
                    "candles": candles,
                    "request_id": data.get("request_id"),
                }
            )

        elif cmd == "get_candles_at":
            candles = self.mt5.fetch_candles_at(
                data["symbol"], data["timestamp"], data.get("interval", "1m"), data.get("count", 50)
            )
            await self.send_json(
                {
                    "topic": "mt5_candles_at",
                    "symbol": data["symbol"],
                    "interval": data.get("interval", "1m"),
                    "timestamp": data["timestamp"],
                    "source": "MT5",
                    "candles": candles,
                    "request_id": data.get("request_id"),
                }
            )

        elif cmd == "close_by_magic":
            symbol = data.get("symbol")
            magic = int(data.get("magic")) if data.get("magic") else 0
            success = self.mt5.close_by_magic(symbol, magic)
            print(f"[CMD] Close By Magic {symbol} ({magic}): {'Done' if success else 'Failed'}")

        elif cmd in ["order", "place_order", "buy", "sell"]:
            order_type = cmd if cmd in ["buy", "sell"] else (data.get("order_type") or data.get("type"))
            success = self.mt5.place_order(
                data.get("symbol"),
                order_type,
                data.get("volume"),
                data.get("sl"),
                data.get("tp"),
                data.get("price", 0),
                data.get("is_market", True),
                data.get("magic"),
                data.get("comment"),
            )
            print(f"[CMD] {cmd.capitalize()} {data.get('symbol')}: {'Done' if success else 'Failed'}")

            await self.send_json(
                {
                    "topic": "mt5_order_result",
                    "success": success,
                    "command": cmd,
                    "symbol": data.get("symbol"),
                }
            )

        elif cmd == "get_symbol_info":
            spec = self.mt5.get_symbol_specification(data.get("symbol"))
            if spec:
                await self.send_json({"topic": "mt5_symbol_info", "data": spec})

        elif cmd == "get_history":
            limit = data.get("limit", 100)
            history = self.mt5.get_history_deals(None, None, limit)
            total = len(history)
            chunk_size = 500

            if total == 0:
                await self.send_json({"topic": "mt5_history_deals", "data": [], "is_chunk": False})
            else:
                for i in range(0, total, chunk_size):
                    chunk = history[i : i + chunk_size]
                    await self.send_json(
                        {
                            "topic": "mt5_history_deals",
                            "data": chunk,
                            "is_chunk": True,
                            "chunk_index": i // chunk_size,
                            "total_chunks": (total + chunk_size - 1) // chunk_size,
                            "is_last_chunk": (i + chunk_size) >= total,
                        }
                    )
                    print(f"[FETCH] Sent chunk {i // chunk_size + 1} with {len(chunk)} deals")
                    await asyncio.sleep(0.01)

            print(f"[OK] History sent in chunks (Total: {total})")
