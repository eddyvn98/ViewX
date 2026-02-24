import MetaTrader5 as mt5

class MT5Service:
    def __init__(self, symbols, timeframe_map):
        self.symbols = symbols
        self.timeframe_map = timeframe_map

    def initialize(self):
        if not mt5.initialize():
            print("[ERROR] MT5 Init failed")
            return False
        return True

    def shutdown(self):
        mt5.shutdown()

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
        rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_D1, 0, 1)
        if rates is not None and len(rates) > 0:
            return float(rates[0]['open'])
        return None

    def fetch_candles(self, symbol, interval, count=200):
        tf = self.timeframe_map.get(str(interval), mt5.TIMEFRAME_M1)
        print(f"[FETCH] {symbol} | Interval: {interval} | TF_ID: {tf} | Count: {count}")
        rates = mt5.copy_rates_from_pos(symbol, tf, 0, count)
        if rates is None or len(rates) == 0:
            print(f"[WARN] No rates found for {symbol} {interval}")
            return []
        
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
        tf = self.timeframe_map.get(str(interval), mt5.TIMEFRAME_M1)
        # Using from_date logic: copy_rates_from(symbol, timeframe, date_from, count)
        # Docs: copy_rates_from(symbol, timeframe, datetime/timestamp, count)
        # It gets bars with open time <= date_from
        
        rates = mt5.copy_rates_from(symbol, tf, int(timestamp), count)
        if rates is None:
            return []
            
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
            "profit": float(account.profit)
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

    def close_position(self, ticket):
        positions = mt5.positions_get(ticket=ticket)
        if positions:
            pos = positions[0]
            tick = mt5.symbol_info_tick(pos.symbol)
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
            if result.retcode != mt5.TRADE_RETCODE_DONE:
                print(f"[ERROR] Close position failed: {result.retcode} - {result.comment}")
            return result.retcode == mt5.TRADE_RETCODE_DONE

        orders = mt5.orders_get(ticket=ticket)
        if orders:
            request = { "action": mt5.TRADE_ACTION_REMOVE, "order": ticket }
            result = mt5.order_send(request)
            return result.retcode == mt5.TRADE_RETCODE_DONE
        return False

    def close_by_magic(self, symbol, magic):
        """Close all positions and cancel all orders for a specific symbol/magic."""
        success = True
        
        # 1. Close Market Positions
        positions = mt5.positions_get(symbol=symbol, magic=magic)
        if positions:
            for p in positions:
                if not self.close_position(p.ticket):
                    success = False
        
        # 2. Cancel Pending Orders
        orders = mt5.orders_get(symbol=symbol, magic=magic)
        if orders:
            for o in orders:
                if not self.close_position(o.ticket): # close_position handles orders via TRADE_ACTION_REMOVE
                    success = False
                    
        return success

    def modify_position(self, ticket, sl=None, tp=None, price=None):
        positions = mt5.positions_get(ticket=ticket)
        if positions:
            pos = positions[0]
            request = {
                "action": mt5.TRADE_ACTION_SLTP,
                "symbol": pos.symbol,
                "position": ticket,
                "sl": float(sl) if sl is not None else pos.sl,
                "tp": float(tp) if tp is not None else pos.tp,
            }
            result = mt5.order_send(request)
            return result.retcode == mt5.TRADE_RETCODE_DONE

        orders = mt5.orders_get(ticket=ticket)
        if orders:
            ord = orders[0]
            request = {
                "action": mt5.TRADE_ACTION_MODIFY,
                "order": ticket,
                "price": float(price) if price is not None else ord.price_open,
                "sl": float(sl) if sl is not None else ord.sl,
                "tp": float(tp) if tp is not None else ord.tp,
                "type_time": getattr(ord, 'type_time', mt5.ORDER_TIME_GTC),
                "expiration": getattr(ord, 'expiration', 0)
            }
            result = mt5.order_send(request)
            return result.retcode == mt5.TRADE_RETCODE_DONE
        return False

    def place_order(self, symbol, order_type, volume, sl=0.0, tp=0.0, price=0.0, is_market=True, magic=None, comment=None):
        tick = mt5.symbol_info_tick(symbol)
        if not tick: 
            print(f"[ERROR] Tick not found for {symbol}")
            return False

        request = {
            "symbol": symbol,
            "volume": float(volume),
            "sl": float(sl) if sl else 0.0,
            "tp": float(tp) if tp else 0.0,
            "magic": int(magic) if magic is not None else 234000,
            "comment": str(comment) if comment is not None else "ViewChart Web",
            "type_time": mt5.ORDER_TIME_GTC,
        }

        # Normalize Order Type
        order_type_str = str(order_type).lower()

        if is_market:
            request["action"] = mt5.TRADE_ACTION_DEAL
            request["price"] = tick.ask if "buy" in order_type_str else tick.bid
            request["type"] = mt5.ORDER_TYPE_BUY if "buy" in order_type_str else mt5.ORDER_TYPE_SELL
            request["type_filling"] = self._get_filling_mode(symbol)
        else:
            request["action"] = mt5.TRADE_ACTION_PENDING
            request["price"] = float(price)
            request["type_filling"] = mt5.ORDER_FILLING_RETURN
            
            # Use explicit mapping if provided as buy_stop, sell_limit, etc.
            if order_type_str == "buy_stop": request["type"] = mt5.ORDER_TYPE_BUY_STOP
            elif order_type_str == "sell_stop": request["type"] = mt5.ORDER_TYPE_SELL_STOP
            elif order_type_str == "buy_limit": request["type"] = mt5.ORDER_TYPE_BUY_LIMIT
            elif order_type_str == "sell_limit": request["type"] = mt5.ORDER_TYPE_SELL_LIMIT
            elif "buy" in order_type_str:
                request["type"] = mt5.ORDER_TYPE_BUY_LIMIT if request["price"] < tick.ask else mt5.ORDER_TYPE_BUY_STOP
            else:
                request["type"] = mt5.ORDER_TYPE_SELL_LIMIT if request["price"] > tick.bid else mt5.ORDER_TYPE_SELL_STOP

        print(f"[DEBUG] Sending Order: {request}")
        result = mt5.order_send(request)
        if result.retcode != mt5.TRADE_RETCODE_DONE:
             print(f"[ERROR] Order send failed: {result.retcode} - {result.comment}")
             return False
        
        print(f"[ORDER] Sent {request['action']} {order_type} {volume} {symbol} @ {request['price']} (Ticket: {result.order})")
        return True

    def get_symbol_specification(self, symbol):
        info = mt5.symbol_info(symbol)
        if not info: return None
        return {
            "symbol": info.name,
            "contract_size": info.trade_contract_size,
            "tick_value": info.trade_tick_value,
            "tick_size": info.trade_tick_size,
            "digits": info.digits,
            "swap_long": info.swap_long,
            "swap_short": info.swap_short,
            "currency_margin": info.currency_margin
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
            to_timestamp = int(time.time()) + 86400
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
