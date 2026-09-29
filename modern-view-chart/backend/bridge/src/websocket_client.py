import asyncio
import json
import time
import websockets
from urllib.parse import urlsplit, parse_qsl, urlencode, urlunsplit
from mt5_write_guard import build_write_fingerprint


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
    WRITE_COMMANDS = {"order", "place_order", "buy", "sell", "modify", "close", "delete", "cancel"}
    EXECUTION_RESULT_TTL_SEC = 5 * 60

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
        self.websocket = None
        self.execution_results = {}

    async def connect(self):
        connect_kwargs = {
            "max_size": 10 * 1024 * 1024,
        }
        if self.auth_credential:
            connect_kwargs["subprotocols"] = [f"bearer.{self.auth_credential}"]
        self.websocket = await websockets.connect(self.ws_url, **connect_kwargs)
        print(f"[OK] Bridge connected to {mask_url_for_log(self.ws_url)}")
        return self.websocket

    async def send_json(self, data):
        if self.websocket:
            await self.websocket.send(json.dumps(data))

    async def listen_commands(self):
        async for message in self.websocket:
            await self.dispatch_message(message)

    async def dispatch_message(self, message):
        msg_topic = "unknown"
        try:
            data = json.loads(message)
            msg_topic = data.get("topic") or data.get("type") or "unknown"
            if msg_topic == "mt5_command":
                await self.handle_command(data)
            elif msg_topic == "alert_command":
                await self.handle_alert_command(data)
            elif msg_topic == "memory_command":
                await self.handle_memory_command(data)
            elif msg_topic == "bridge_symbols_interest":
                await self.handle_symbols_interest(data)
        except Exception as e:
            print(f"[ERROR] Command handling error (topic:{msg_topic}): {e}")
            if msg_topic == "mt5_command" and "data" in locals():
                command = str(data.get("command") or "").strip().lower()
                if command in self.WRITE_COMMANDS:
                    await self._send_execution_result(
                        data,
                        {
                            "success": False,
                            "retcode": None,
                            "comment": "bridge_command_exception",
                            "message": str(e),
                        },
                    )

    async def drain_pending_commands(self, max_messages=20, timeout_sec=0.001):
        if not self.websocket:
            return

        for _ in range(max_messages):
            try:
                message = await asyncio.wait_for(self.websocket.recv(), timeout=timeout_sec)
            except asyncio.TimeoutError:
                break
            await self.dispatch_message(message)

    def _scope_fields(self, data):
        return {
            "source": data.get("mt5_source") or ("MT5_PERSONAL" if data.get("account_login") else "MT5"),
            "account_login": data.get("account_login"),
            "terminal_id": data.get("terminal_id"),
            "broker": data.get("broker"),
        }

    def _cleanup_execution_results(self):
        now = time.time()
        expired = [
            request_id
            for request_id, item in self.execution_results.items()
            if item.get("expires_at", 0) <= now
        ]
        for request_id in expired:
            self.execution_results.pop(request_id, None)

    async def _send_execution_result(self, data, result, duplicate=False):
        request_id = str(data.get("request_id") or "").strip() or None
        payload = {
            "topic": "mt5_order_result",
            "request_id": request_id,
            "command": data.get("command"),
            "symbol": data.get("symbol"),
            **self._scope_fields(data),
            **(result or {}),
            "duplicate": duplicate,
        }
        await self.send_json(payload)
        if request_id and not duplicate:
            self.execution_results[request_id] = {
                "payload": payload,
                "fingerprint": build_write_fingerprint(data),
                "expires_at": time.time() + self.EXECUTION_RESULT_TTL_SEC,
            }
        return payload

    async def _reject_scope_mismatch(self, data, actual_login):
        result = {
            "success": False,
            "retcode": None,
            "comment": "account_scope_mismatch",
            "message": f"Bridge MT5 account {actual_login or 'unknown'} does not match requested account {data.get('account_login')}",
        }
        await self._send_execution_result(data, result)

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
        cmd = str(data.get("command") or "").strip().lower()
        ticket = int(data.get("ticket")) if data.get("ticket") else 0
        request_id = str(data.get("request_id") or "").strip() or None

        self._cleanup_execution_results()
        if cmd in self.WRITE_COMMANDS and request_id:
            cached = self.execution_results.get(request_id)
            if cached:
                fingerprint = build_write_fingerprint(data)
                if cached.get("fingerprint") != fingerprint:
                    await self.send_json({
                        "topic": "mt5_order_result",
                        "request_id": request_id,
                        "command": cmd,
                        **self._scope_fields(data),
                        "success": False,
                        "retcode": None,
                        "comment": "request_id_payload_mismatch",
                        "message": "request_id_payload_mismatch",
                        "duplicate": True,
                        "cached": False,
                    })
                    return
                await self.send_json({
                    **cached["payload"],
                    "duplicate": True,
                    "cached": True,
                })
                return

        if cmd in self.WRITE_COMMANDS and data.get("account_login"):
            actual_account = self.mt5.get_account_info()
            actual_login = str(actual_account.get("login") or "").strip()
            requested_login = str(data.get("account_login") or "").strip()
            if not actual_login or actual_login != requested_login:
                await self._reject_scope_mismatch(data, actual_login)
                return

        if cmd in ["close", "delete", "cancel"]:
            result = self.mt5.close_position(ticket)
            print(f"[CMD] {cmd.capitalize()} {ticket}: {'Done' if result.get('success') else 'Failed'}")
            await self._send_execution_result(data, result)

        elif cmd == "modify":
            result = self.mt5.modify_position(ticket, data.get("sl"), data.get("tp"), data.get("price"))
            print(f"[CMD] Modify {ticket}: {'Done' if result.get('success') else 'Failed'}")
            await self._send_execution_result(data, result)

        elif cmd == "get_candles":
            candles = self.mt5.fetch_candles(data["symbol"], data.get("interval", "1m"), data.get("count", 200))
            await self.send_json(
                {
                    "topic": "mt5_candles",
                    "symbol": data["symbol"],
                    "interval": data.get("interval", "1m"),
                    "candles": candles,
                    "request_id": data.get("request_id"),
                    **self._scope_fields(data),
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
                    "candles": candles,
                    "request_id": data.get("request_id"),
                    **self._scope_fields(data),
                }
            )

        elif cmd in ["get_positions", "get_orders", "get_account"]:
            await self.send_json(
                {
                    "topic": "mt5_positions_update",
                    "account": self.mt5.get_account_info(),
                    "positions": self.mt5.get_positions(),
                    "orders": self.mt5.get_orders(),
                    **self._scope_fields(data),
                }
            )

        elif cmd == "close_by_magic":
            symbol = data.get("symbol")
            magic = int(data.get("magic")) if data.get("magic") else 0
            success = self.mt5.close_by_magic(symbol, magic)
            print(f"[CMD] Close By Magic {symbol} ({magic}): {'Done' if success else 'Failed'}")

        elif cmd in ["order", "place_order", "buy", "sell"]:
            order_type = cmd if cmd in ["buy", "sell"] else (data.get("order_type") or data.get("type"))
            result = self.mt5.place_order(
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
            print(f"[CMD] {cmd.capitalize()} {data.get('symbol')}: {'Done' if result.get('success') else 'Failed'}")
            await self._send_execution_result(data, result)

        elif cmd == "get_symbol_info":
            spec = self.mt5.get_symbol_specification(data.get("symbol"))
            if spec:
                await self.send_json({
                    "topic": "mt5_symbol_info",
                    "data": spec,
                    **self._scope_fields(data),
                })

        elif cmd == "get_history":
            limit = data.get("limit", 100)
            history = self.mt5.get_history_deals(None, None, limit)
            total = len(history)
            chunk_size = 500

            if total == 0:
                await self.send_json({
                    "topic": "mt5_history_deals",
                    "data": [],
                    "is_chunk": False,
                    **self._scope_fields(data),
                })
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
                            **self._scope_fields(data),
                        }
                    )
                    print(f"[FETCH] Sent chunk {i // chunk_size + 1} with {len(chunk)} deals")
                    await asyncio.sleep(0.01)

            print(f"[OK] History sent in chunks (Total: {total})")
