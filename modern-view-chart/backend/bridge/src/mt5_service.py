import time
import calendar

import MetaTrader5 as mt5

class MT5Service:
    def __init__(self, symbols, timeframe_map, terminal_path=None):
        self.symbols = symbols
        self.timeframe_map = timeframe_map
        self.terminal_path = terminal_path

    def initialize(self):
        init_kwargs = {}
        if self.terminal_path:
            init_kwargs["path"] = self.terminal_path
            
        if not mt5.initialize(**init_kwargs):
            error = mt5.last_error()
            print(f"[ERROR] MT5 Init failed: {error}")
            return False
        return True

    def shutdown(self):
        mt5.shutdown()

    def _ensure_mt5_healthy(self):
        """Checks if MT5 terminal connection is active. Re-initializes if lost."""
        err_code, err_desc = mt5.last_error()
        term_info = mt5.terminal_info()
        if term_info is None or err_code < 0:
            print(f"[WARN] MT5 IPC connection unhealthy (error={err_code}: {err_desc}). Re-initializing MT5...")
            try:
                mt5.shutdown()
            except Exception:
                pass
            time.sleep(0.5)
            success = self.initialize()
            if success:
                print("[OK] MT5 IPC connection successfully restored.")
            else:
                print("[ERROR] MT5 IPC re-initialization failed.")
            return success
        return True

    def fetch_available_symbols(self):
        symbols = mt5.symbols_get()
        if symbols is None:
            print("[ERROR] Failed to fetch symbols")
            return []
        
        available = []
        for s in symbols:
            # Only include symbols that are enabled for trading
            if s.trade_mode != mt5.SYMBOL_TRADE_MODE_DISABLED:
                available.append({
                    "symbol": s.name,
                    "path": s.path,
                    "description": s.description,
                    "digits": s.digits,
                    "trade_mode": s.trade_mode,
                    # Determine type based on path
                    "type": "forex" if "Forex" in s.path else "crypto" if "Crypto" in s.path else "other"
                })
        print(f"[OK] Found {len(available)} tradeable symbols")
        return available

    def get_tick(self, symbol):
        return mt5.symbol_info_tick(symbol)

    def get_daily_open(self, symbol):
        resolved = self._resolve_symbol(symbol)
        if not resolved:
            return None
        rates = mt5.copy_rates_from_pos(resolved, mt5.TIMEFRAME_D1, 0, 1)
        if rates is not None and len(rates) > 0:
            return float(rates[0]['open'])
        return None

    def _normalize_symbol_key(self, value):
        s = str(value or "").strip().upper()
        if not s:
            return ""
        s = s.replace(".", "")
        if s.endswith("M") and len(s) > 1:
            s = s[:-1]
        return s

    def _resolve_symbol(self, symbol):
        requested = str(symbol or "").strip()
        if not requested:
            return None

        # Fast path: exact symbol exists.
        info = mt5.symbol_info(requested)
        if info is not None:
            if not info.visible:
                mt5.symbol_select(info.name, True)
            return info.name

        requested_key = self._normalize_symbol_key(requested)
        symbols = mt5.symbols_get()
        if symbols is None:
            self._ensure_mt5_healthy()
            symbols = mt5.symbols_get() or []

        # First pass: exact case-insensitive match.
        for s in symbols:
            name = str(getattr(s, "name", "")).strip()
            if name.lower() == requested.lower():
                mt5.symbol_select(name, True)
                return name

        # Second pass: tolerant suffix match (e.g., BTCUSDm <-> BTCUSD).
        for s in symbols:
            name = str(getattr(s, "name", "")).strip()
            if self._normalize_symbol_key(name) == requested_key:
                mt5.symbol_select(name, True)
                return name

        return None

    def _wait_for_symbol_info(self, resolved_symbol, attempts=3, delay_sec=0.2):
        """mt5.symbol_info() can transiently return None right after
        mt5.symbol_select() while the terminal is still adding the symbol to
        Market Watch. Retry briefly instead of failing the whole request."""
        symbol_info = mt5.symbol_info(resolved_symbol)
        attempt_num = 1
        while symbol_info is None and attempt_num < attempts:
            error_code, error_desc = mt5.last_error()
            print(f"[DEBUG] symbol_info('{resolved_symbol}') None on attempt {attempt_num}/{attempts} | last_error: {error_code} - {error_desc}")
            time.sleep(delay_sec)
            mt5.symbol_select(resolved_symbol, True)
            symbol_info = mt5.symbol_info(resolved_symbol)
            attempt_num += 1
        if symbol_info is None:
            error_code, error_desc = mt5.last_error()
            print(f"[DEBUG] symbol_info('{resolved_symbol}') still None after {attempts} attempts | last_error: {error_code} - {error_desc}")
        return symbol_info

    def _is_yearly_interval(self, interval):
        raw = str(interval or "").strip().upper()
        return raw in {"525600", "Y", "1Y", "Y1"}

    def _aggregate_yearly_rates(self, rates):
        yearly = {}
        if rates is None:
            return []
        for rate in rates:
            ts = int(rate["time"])
            year = time.gmtime(ts).tm_year
            item = {
                "time": calendar.timegm((year, 1, 1, 0, 0, 0)),
                "open": float(rate["open"]),
                "high": float(rate["high"]),
                "low": float(rate["low"]),
                "close": float(rate["close"]),
                "volume": int(rate["tick_volume"]),
            }
            current = yearly.get(year)
            if current is None:
                yearly[year] = item
                continue
            current["high"] = max(current["high"], item["high"])
            current["low"] = min(current["low"], item["low"])
            current["close"] = item["close"]
            current["volume"] += item["volume"]
        return [yearly[year] for year in sorted(yearly)]

    def fetch_candles(self, symbol, interval, count=200):
        resolved_symbol = self._resolve_symbol(symbol)
        if not resolved_symbol:
            self._ensure_mt5_healthy()
            resolved_symbol = self._resolve_symbol(symbol)

        if not resolved_symbol:
            print(f"[ERROR] Symbol not found in MT5: {symbol}")
            return []

        symbol_info = self._wait_for_symbol_info(resolved_symbol)
        if symbol_info is None:
            self._ensure_mt5_healthy()
            symbol_info = mt5.symbol_info(resolved_symbol)

        if symbol_info is None:
            print(f"[ERROR] Symbol not found in MT5: {symbol}")
            return []
        if not symbol_info.visible:
            selected = mt5.symbol_select(resolved_symbol, True)
            if not selected:
                error_code, error_desc = mt5.last_error()
                print(f"[ERROR] Failed to select symbol {resolved_symbol}: {error_code} - {error_desc}")
                return []

        is_yearly = self._is_yearly_interval(interval)
        tf = mt5.TIMEFRAME_MN1 if is_yearly else self.timeframe_map.get(str(interval))
        if tf is None:
            print(f"[ERROR] Unsupported MT5 timeframe: {interval}")
            return []

        fetch_count = max(12, int(count) * 12) if is_yearly else int(count)
        print(f"[FETCH] {symbol} -> {resolved_symbol} | Interval: {interval} | TF_ID: {tf} | Count: {count}")
        rates = None
        for attempt in range(3):
            rates = mt5.copy_rates_from_pos(resolved_symbol, tf, 0, fetch_count)
            if rates is not None and len(rates) > 0:
                break

            error_code, error_desc = mt5.last_error()
            print(
                f"[WARN] No rates found for {symbol} {interval} on attempt {attempt + 1}/3"
                f" | MT5 error: {error_code} - {error_desc}"
            )

            # MT5 can transiently return an empty buffer right after reconnect
            # or when a symbol has not been refreshed yet; re-select then retry.
            mt5.symbol_select(resolved_symbol, True)
            time.sleep(0.2)

        if rates is None or len(rates) == 0:
            return []
        
        if is_yearly:
            return self._aggregate_yearly_rates(rates)[-int(count):]

        return [{
            'time': int(r['time']),
            'open': float(r['open']),
            'high': float(r['high']),
            'low': float(r['low']),
            'close': float(r['close']),
            'volume': int(r['tick_volume'])
        } for r in rates]

    def fetch_candles_at(self, symbol, timestamp, interval='1m', count=200):
        """Fetch candles ending at specific timestamp."""
        resolved_symbol = self._resolve_symbol(symbol)
        if not resolved_symbol:
            print(f"[ERROR] Symbol not found in MT5: {symbol}")
            return []

        symbol_info = self._wait_for_symbol_info(resolved_symbol)
        if symbol_info is None:
            print(f"[ERROR] Symbol not found in MT5: {symbol}")
            return []
        if not symbol_info.visible:
            selected = mt5.symbol_select(resolved_symbol, True)
            if not selected:
                error_code, error_desc = mt5.last_error()
                print(f"[ERROR] Failed to select symbol {resolved_symbol}: {error_code} - {error_desc}")
                return []

        is_yearly = self._is_yearly_interval(interval)
        tf = mt5.TIMEFRAME_MN1 if is_yearly else self.timeframe_map.get(str(interval))
        if tf is None:
            print(f"[ERROR] Unsupported MT5 timeframe: {interval}")
            return []
        fetch_count = max(12, int(count) * 12) if is_yearly else int(count)
        # Using from_date logic: copy_rates_from(symbol, timeframe, date_from, count)
        # Docs: copy_rates_from(symbol, timeframe, datetime/timestamp, count)
        # It gets bars with open time <= date_from
        
        rates = mt5.copy_rates_from(resolved_symbol, tf, int(timestamp), fetch_count)
        if rates is None:
            error_code, error_desc = mt5.last_error()
            print(f"[WARN] No rates_at found for {symbol} {interval} @ {timestamp} | MT5 error: {error_code} - {error_desc}")
            return []
            
        if is_yearly:
            return self._aggregate_yearly_rates(rates)[-int(count):]

        return [{
            'time': int(r['time']),
            'open': float(r['open']),
            'high': float(r['high']),
            'low': float(r['low']),
            'close': float(r['close']),
            'volume': int(r['tick_volume'])
        } for r in rates]

    def get_account_info(self):
        account = mt5.account_info()
        if not account: return {}
        return {
            "balance": float(account.balance),
            "equity": float(account.equity),
            "margin": float(account.margin),
            "free_margin": float(account.margin_free),
            "margin_level": float(account.margin_level),
            "profit": float(account.profit),
            "login": str(account.login) if getattr(account, "login", None) is not None else "",
            "server": str(account.server) if getattr(account, "server", None) is not None else "",
            "name": str(account.name) if getattr(account, "name", None) is not None else "",
            "company": str(account.company) if getattr(account, "company", None) is not None else "",
            "currency": str(account.currency) if getattr(account, "currency", None) is not None else "",
        }

    def get_positions(self):
        positions = mt5.positions_get()
        if not positions: return []
        return [{
            "ticket": int(p.ticket),
            "symbol": str(p.symbol),
            "type": "buy" if p.type == mt5.ORDER_TYPE_BUY else "sell",
            "volume": float(p.volume),
            "price_open": float(p.price_open),
            "price_current": float(p.price_current),
            "sl": float(p.sl),
            "tp": float(p.tp),
            "profit": float(p.profit),
            "time": int(p.time),
            "magic": int(p.magic)
        } for p in positions]

    def get_orders(self):
        orders = mt5.orders_get()
        if not orders: return []
        order_list = []
        for o in orders:
            o_type = "limit"
            if o.type == mt5.ORDER_TYPE_BUY_LIMIT: o_type = "buy limit"
            elif o.type == mt5.ORDER_TYPE_SELL_LIMIT: o_type = "sell limit"
            elif o.type == mt5.ORDER_TYPE_BUY_STOP: o_type = "buy stop"
            elif o.type == mt5.ORDER_TYPE_SELL_STOP: o_type = "sell stop"
            
            order_list.append({
                "ticket": int(o.ticket),
                "symbol": str(o.symbol),
                "type": o_type,
                "volume": float(o.volume_initial),
                "price_open": float(o.price_open),
                "price_current": float(o.price_current),
                "sl": float(o.sl),
                "tp": float(o.tp),
                "profit": 0.0,
                "time": int(o.time_setup),
                "magic": int(o.magic)
            })
        return order_list

    def _get_filling_mode(self, symbol):
        """Determine the correct filling mode for the symbol."""
        # Some MT5 Python versions don't have these constants in the mt5 module
        # So we define the bitmask values here based on MT5 documentation
        SYMBOL_FILLING_FOK = 1
        SYMBOL_FILLING_IOC = 2

        info = mt5.symbol_info(symbol)
        if not info:
            return mt5.ORDER_FILLING_IOC  # Default fallback
        
        # Check supported filling modes bits
        filling_mode = info.filling_mode
        if filling_mode & SYMBOL_FILLING_FOK:
            return mt5.ORDER_FILLING_FOK
        elif filling_mode & SYMBOL_FILLING_IOC:
            return mt5.ORDER_FILLING_IOC
        else:
            return mt5.ORDER_FILLING_RETURN

    def _trade_result(self, result=None, requested_symbol=None, resolved_symbol=None, message=None, retcode=None):
        if result is None:
            last_error = mt5.last_error()
            fallback_retcode = retcode
            fallback_message = message
            if fallback_retcode is None and isinstance(last_error, tuple) and len(last_error) > 0:
                fallback_retcode = last_error[0]
            if not fallback_message and isinstance(last_error, tuple) and len(last_error) > 1:
                fallback_message = str(last_error[1])
            return {
                "success": False,
                "retcode": fallback_retcode,
                "comment": fallback_message or "mt5_order_send_failed",
                "message": fallback_message or "mt5_order_send_failed",
                "order": None,
                "deal": None,
                "requested_symbol": requested_symbol,
                "resolved_symbol": resolved_symbol,
            }

        done_codes = {mt5.TRADE_RETCODE_DONE}
        if hasattr(mt5, "TRADE_RETCODE_PLACED"):
            done_codes.add(mt5.TRADE_RETCODE_PLACED)
        if hasattr(mt5, "TRADE_RETCODE_DONE_PARTIAL"):
            done_codes.add(mt5.TRADE_RETCODE_DONE_PARTIAL)
        success = result.retcode in done_codes
        comment = str(getattr(result, "comment", "") or "")
        return {
            "success": success,
            "retcode": int(result.retcode),
            "comment": comment,
            "message": comment or ("order_executed" if success else "order_failed"),
            "order": int(getattr(result, "order", 0) or 0) or None,
            "deal": int(getattr(result, "deal", 0) or 0) or None,
            "requested_symbol": requested_symbol,
            "resolved_symbol": resolved_symbol,
        }

    def _validation_error(self, message, requested_symbol=None, resolved_symbol=None):
        return {
            "success": False,
            "retcode": None,
            "comment": message,
            "message": message,
            "order": None,
            "deal": None,
            "requested_symbol": requested_symbol,
            "resolved_symbol": resolved_symbol,
        }

    def _validate_volume(self, info, volume):
        try:
            value = float(volume)
        except (TypeError, ValueError):
            return None, "invalid_volume"

        minimum = float(getattr(info, "volume_min", 0.0) or 0.0)
        maximum = float(getattr(info, "volume_max", 0.0) or 0.0)
        step = float(getattr(info, "volume_step", 0.0) or 0.0)

        if value <= 0:
            return None, "invalid_volume"
        if minimum > 0 and value < minimum - 1e-12:
            return None, f"volume_below_min:{minimum}"
        if maximum > 0 and value > maximum + 1e-12:
            return None, f"volume_above_max:{maximum}"
        if step > 0:
            base = minimum if minimum > 0 else 0.0
            steps = (value - base) / step
            if abs(steps - round(steps)) > 1e-8:
                return None, f"volume_invalid_step:{step}"

        return value, None

    def _validate_market_stops(self, info, tick, order_type_str, sl, tp):
        point = float(getattr(info, "point", 0.0) or 0.0)
        stops_level = float(getattr(info, "trade_stops_level", 0.0) or 0.0)
        minimum_distance = point * stops_level
        if minimum_distance <= 0:
            return None

        try:
            sl_value = float(sl or 0.0)
        except (TypeError, ValueError):
            return "invalid_sl"
        try:
            tp_value = float(tp or 0.0)
        except (TypeError, ValueError):
            return "invalid_tp"
        is_buy = "buy" in order_type_str
        reference = float(tick.bid if is_buy else tick.ask)

        if is_buy:
            if sl_value > 0 and reference - sl_value < minimum_distance:
                return f"sl_too_close:min_distance={minimum_distance}"
            if tp_value > 0 and tp_value - reference < minimum_distance:
                return f"tp_too_close:min_distance={minimum_distance}"
        else:
            if sl_value > 0 and sl_value - reference < minimum_distance:
                return f"sl_too_close:min_distance={minimum_distance}"
            if tp_value > 0 and reference - tp_value < minimum_distance:
                return f"tp_too_close:min_distance={minimum_distance}"

        return None

    def close_position(self, ticket):
        positions = mt5.positions_get(ticket=ticket)
        if positions:
            pos = positions[0]
            tick = mt5.symbol_info_tick(pos.symbol)
            if not tick:
                return self._validation_error("tick_not_found", resolved_symbol=pos.symbol)

            price = tick.bid if pos.type == mt5.ORDER_TYPE_BUY else tick.ask
            order_type = mt5.ORDER_TYPE_SELL if pos.type == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY
            request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": pos.symbol,
                "volume": pos.volume,
                "type": order_type,
                "position": ticket,
                "price": price,
                "magic": pos.magic,
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": self._get_filling_mode(pos.symbol),
            }
            result = mt5.order_send(request)
            trade_result = self._trade_result(result, resolved_symbol=pos.symbol)
            if not trade_result["success"]:
                print(f"[ERROR] Close position failed: {trade_result['retcode']} - {trade_result['comment']}")
            return trade_result

        orders = mt5.orders_get(ticket=ticket)
        if orders:
            order = orders[0]
            request = {"action": mt5.TRADE_ACTION_REMOVE, "order": ticket}
            result = mt5.order_send(request)
            return self._trade_result(result, resolved_symbol=str(order.symbol))

        return self._validation_error("ticket_not_found")

    def close_by_magic(self, symbol, magic):
        """Close all positions and cancel all orders for a specific symbol/magic."""
        success = True

        positions = mt5.positions_get(symbol=symbol, magic=magic)
        if positions:
            for position in positions:
                if not self.close_position(position.ticket).get("success"):
                    success = False

        orders = mt5.orders_get(symbol=symbol, magic=magic)
        if orders:
            for order in orders:
                if not self.close_position(order.ticket).get("success"):
                    success = False

        return success

    def modify_position(self, ticket, sl=None, tp=None, price=None):
        positions = mt5.positions_get(ticket=ticket)
        if positions:
            pos = positions[0]
            try:
                next_sl = float(sl) if sl is not None else float(pos.sl)
                next_tp = float(tp) if tp is not None else float(pos.tp)
            except (TypeError, ValueError):
                return self._validation_error("invalid_sl_or_tp", resolved_symbol=str(pos.symbol))

            info = mt5.symbol_info(pos.symbol)
            tick = mt5.symbol_info_tick(pos.symbol)
            if info is None:
                return self._validation_error("symbol_info_not_found", resolved_symbol=str(pos.symbol))
            if tick is None:
                return self._validation_error("tick_not_found", resolved_symbol=str(pos.symbol))

            buy_type = getattr(mt5, "POSITION_TYPE_BUY", mt5.ORDER_TYPE_BUY)
            side = "buy" if pos.type == buy_type else "sell"
            stops_error = self._validate_market_stops(info, tick, side, next_sl, next_tp)
            if stops_error:
                return self._validation_error(
                    stops_error,
                    requested_symbol=str(pos.symbol),
                    resolved_symbol=str(pos.symbol),
                )

            request = {
                "action": mt5.TRADE_ACTION_SLTP,
                "symbol": pos.symbol,
                "position": ticket,
                "sl": next_sl,
                "tp": next_tp,
            }
            result = mt5.order_send(request)
            return self._trade_result(result, resolved_symbol=str(pos.symbol))

        orders = mt5.orders_get(ticket=ticket)
        if orders:
            order = orders[0]
            try:
                next_price = float(price) if price is not None else float(order.price_open)
                next_sl = float(sl) if sl is not None else float(order.sl)
                next_tp = float(tp) if tp is not None else float(order.tp)
            except (TypeError, ValueError):
                return self._validation_error("invalid_order_modification", resolved_symbol=str(order.symbol))

            request = {
                "action": mt5.TRADE_ACTION_MODIFY,
                "order": ticket,
                "price": next_price,
                "sl": next_sl,
                "tp": next_tp,
                "type_time": getattr(order, "type_time", mt5.ORDER_TIME_GTC),
                "expiration": getattr(order, "expiration", 0),
            }
            result = mt5.order_send(request)
            return self._trade_result(result, resolved_symbol=str(order.symbol))

        return self._validation_error("ticket_not_found")

    def place_order(self, symbol, order_type, volume, sl=0.0, tp=0.0, price=0.0, is_market=True, magic=None, comment=None):
        requested_symbol = str(symbol or "").strip()
        if not requested_symbol:
            return self._validation_error("symbol_required")

        # Trading writes intentionally require the exact broker symbol. Read-only
        # chart/search paths may use tolerant aliases, but execution must not.
        info = mt5.symbol_info(requested_symbol)
        if info is None:
            return self._validation_error("exact_broker_symbol_not_found", requested_symbol=requested_symbol)

        if getattr(info, "trade_mode", mt5.SYMBOL_TRADE_MODE_DISABLED) == mt5.SYMBOL_TRADE_MODE_DISABLED:
            return self._validation_error(
                "symbol_trading_disabled",
                requested_symbol=requested_symbol,
                resolved_symbol=info.name,
            )

        if not info.visible and not mt5.symbol_select(info.name, True):
            return self._validation_error(
                "symbol_select_failed",
                requested_symbol=requested_symbol,
                resolved_symbol=info.name,
            )

        volume_value, volume_error = self._validate_volume(info, volume)
        if volume_error:
            return self._validation_error(
                volume_error,
                requested_symbol=requested_symbol,
                resolved_symbol=info.name,
            )

        tick = mt5.symbol_info_tick(info.name)
        if not tick:
            return self._validation_error(
                "tick_not_found",
                requested_symbol=requested_symbol,
                resolved_symbol=info.name,
            )

        order_type_str = str(order_type or "").lower()
        if "buy" not in order_type_str and "sell" not in order_type_str:
            return self._validation_error(
                "invalid_order_type",
                requested_symbol=requested_symbol,
                resolved_symbol=info.name,
            )

        if is_market:
            stops_error = self._validate_market_stops(info, tick, order_type_str, sl, tp)
            if stops_error:
                return self._validation_error(
                    stops_error,
                    requested_symbol=requested_symbol,
                    resolved_symbol=info.name,
                )

        try:
            sl_value = float(sl) if sl else 0.0
            tp_value = float(tp) if tp else 0.0
        except (TypeError, ValueError):
            return self._validation_error(
                "invalid_sl_or_tp",
                requested_symbol=requested_symbol,
                resolved_symbol=info.name,
            )

        request = {
            "symbol": info.name,
            "volume": volume_value,
            "sl": sl_value,
            "tp": tp_value,
            "magic": int(magic) if magic is not None else 234000,
            "comment": str(comment) if comment is not None else "VivuTrade Web",
            "type_time": mt5.ORDER_TIME_GTC,
        }

        if is_market:
            request["action"] = mt5.TRADE_ACTION_DEAL
            request["price"] = tick.ask if "buy" in order_type_str else tick.bid
            request["type"] = mt5.ORDER_TYPE_BUY if "buy" in order_type_str else mt5.ORDER_TYPE_SELL
            request["type_filling"] = self._get_filling_mode(info.name)
        else:
            try:
                pending_price = float(price)
            except (TypeError, ValueError):
                pending_price = 0.0
            if pending_price <= 0:
                return self._validation_error(
                    "pending_price_required",
                    requested_symbol=requested_symbol,
                    resolved_symbol=info.name,
                )
            request["action"] = mt5.TRADE_ACTION_PENDING
            request["price"] = pending_price
            request["type_filling"] = mt5.ORDER_FILLING_RETURN

            if order_type_str == "buy_stop":
                request["type"] = mt5.ORDER_TYPE_BUY_STOP
            elif order_type_str == "sell_stop":
                request["type"] = mt5.ORDER_TYPE_SELL_STOP
            elif order_type_str == "buy_limit":
                request["type"] = mt5.ORDER_TYPE_BUY_LIMIT
            elif order_type_str == "sell_limit":
                request["type"] = mt5.ORDER_TYPE_SELL_LIMIT
            elif "buy" in order_type_str:
                request["type"] = mt5.ORDER_TYPE_BUY_LIMIT if pending_price < tick.ask else mt5.ORDER_TYPE_BUY_STOP
            else:
                request["type"] = mt5.ORDER_TYPE_SELL_LIMIT if pending_price > tick.bid else mt5.ORDER_TYPE_SELL_STOP

        print(f"[DEBUG] Sending Order: {request}")
        result = mt5.order_send(request)
        trade_result = self._trade_result(
            result,
            requested_symbol=requested_symbol,
            resolved_symbol=info.name,
        )
        if not trade_result["success"]:
            print(f"[ERROR] Order send failed: {trade_result['retcode']} - {trade_result['comment']}")
            return trade_result

        print(
            f"[ORDER] Sent {request['action']} {order_type} {volume_value} {info.name}"
            f" @ {request['price']} (Ticket: {trade_result['order']})"
        )
        return trade_result

    def get_symbol_specification(self, symbol):
        requested_symbol = str(symbol or "").strip()
        info = mt5.symbol_info(requested_symbol)
        if not info:
            return None
        return {
            "symbol": info.name,
            "contract_size": float(info.trade_contract_size),
            "tick_value": float(info.trade_tick_value),
            "tick_size": float(info.trade_tick_size),
            "point": float(info.point),
            "digits": int(info.digits),
            "volume_min": float(info.volume_min),
            "volume_max": float(info.volume_max),
            "volume_step": float(info.volume_step),
            "trade_stops_level": int(info.trade_stops_level),
            "trade_freeze_level": int(info.trade_freeze_level),
            "filling_mode": int(info.filling_mode),
            "trade_mode": int(info.trade_mode),
            "swap_long": float(info.swap_long),
            "swap_short": float(info.swap_short),
            "currency_margin": str(info.currency_margin),
        }

    def get_history_deals(self, from_date=None, to_date=None, limit=None):
        import time
        
        # Use timestamps for better reliability
        if from_date is None:
            # OPTIMIZATION: Default to last 30 days if a small limit is requested
            # instead of a whole year which causes MT5 to scan its entire database.
            days = 30 if (limit and limit <= 500) else 365
            from_timestamp = int(time.time()) - (days * 24 * 60 * 60)
        else:
            from_timestamp = int(from_date.timestamp()) if hasattr(from_date, 'timestamp') else int(from_date)
            
        if to_date is None:
            to_timestamp = int(time.time()) + 300
        else:
            to_timestamp = int(to_date.timestamp()) if hasattr(to_date, 'timestamp') else int(to_date)
            
        # If we have a very small limit, we can try to fetch just the last few days first 
        # to avoid the "16k deals" scan if we only need 100.
        if limit and limit <= 200 and from_date is None:
             # Try last 7 days first for small requests
             test_from = int(time.time()) - (7 * 24 * 60 * 60)
             deals = mt5.history_deals_get(test_from, to_timestamp)
             if deals is not None and len(deals) >= limit:
                 from_timestamp = test_from
             else:
                 # Fallback to the 30 days window
                 pass

        print(f"[FETCH] History from TS {from_timestamp} to {to_timestamp}")
        deals = mt5.history_deals_get(from_timestamp, to_timestamp)

        
        if deals is None:
            error_code, error_desc = mt5.last_error()
            print(f"[ERROR] history_deals_get failed: {error_code} - {error_desc}")
            if error_code < 0 or error_code == -10001:
                self._ensure_mt5_healthy()
            return []
            
        print(f"[OK] Fetched {len(deals)} history deals from MT5")
        
        history = []
        for d in deals:
            # Map deal types
            d_type = "unknown"
            if d.type == mt5.DEAL_TYPE_BUY: d_type = "buy"
            elif d.type == mt5.DEAL_TYPE_SELL: d_type = "sell"
            elif d.type == mt5.DEAL_TYPE_BALANCE: d_type = "balance"
            elif d.type == mt5.DEAL_TYPE_CREDIT: d_type = "credit"
            elif d.type == mt5.DEAL_TYPE_CHARGE: d_type = "charge"
            elif d.type == mt5.DEAL_TYPE_CORRECTION: d_type = "correction"
            elif d.type == mt5.DEAL_TYPE_BONUS: d_type = "bonus"
            elif d.type == mt5.DEAL_TYPE_COMMISSION: d_type = "commission"
            
            entry_type = "none"
            if d.entry == mt5.DEAL_ENTRY_IN: entry_type = "in"
            elif d.entry == mt5.DEAL_ENTRY_OUT: entry_type = "out"
            elif d.entry == mt5.DEAL_ENTRY_INOUT: entry_type = "in/out"
            elif d.entry == mt5.DEAL_ENTRY_OUT_BY: entry_type = "out by"

            history.append({
                "ticket": int(d.ticket),
                "order": int(d.order),
                "time": int(d.time),
                "type": d_type,
                "entry": entry_type,
                "symbol": str(d.symbol) if d.symbol else "",
                "volume": float(d.volume),
                "price": float(d.price),
                "profit": float(d.profit),
                "swap": float(d.swap),
                "commission": float(d.commission),
                "magic": int(d.magic),
                "position_id": int(d.position_id)
            })
        
        # Sort by time desc
        history.sort(key=lambda x: x['time'], reverse=True)
        
        # Apply limit if provided
        if limit is not None and isinstance(limit, int):
            history = history[:limit]
            print(f"[FETCH] Limiting to last {limit} items")
            
        return history
