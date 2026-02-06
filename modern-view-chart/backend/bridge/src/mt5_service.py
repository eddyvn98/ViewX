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

    def modify_position(self, ticket, sl, tp):
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
                "price": ord.price_open,
                "sl": float(sl) if sl is not None else ord.sl,
                "tp": float(tp) if tp is not None else ord.tp,
                "type_time": ord.type_time,
                "expiration": ord.expiration
            }
            result = mt5.order_send(request)
            return result.retcode == mt5.TRADE_RETCODE_DONE
            return result.retcode == mt5.TRADE_RETCODE_DONE
        return False

    def place_order(self, symbol, order_type, volume, sl=0.0, tp=0.0, price=0.0, is_market=True):
        tick = mt5.symbol_info_tick(symbol)
        if not tick: 
            print(f"[ERROR] Tick not found for {symbol}")
            return False

        request = {
            "symbol": symbol,
            "volume": float(volume),
            "sl": float(sl) if sl else 0.0,
            "tp": float(tp) if tp else 0.0,
            "magic": 234000,
            "comment": "ViewChart Web",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": self._get_filling_mode(symbol),
        }

        if is_market:
            request["action"] = mt5.TRADE_ACTION_DEAL
            request["price"] = tick.ask if order_type == "buy" else tick.bid
            request["type"] = mt5.ORDER_TYPE_BUY if order_type == "buy" else mt5.ORDER_TYPE_SELL
        else:
            request["action"] = mt5.TRADE_ACTION_PENDING
            request["price"] = float(price)
            
            # Determine Limit vs Stop
            if order_type == "buy":
                if request["price"] < tick.ask:
                    request["type"] = mt5.ORDER_TYPE_BUY_LIMIT
                else:
                    request["type"] = mt5.ORDER_TYPE_BUY_STOP
            else: # sell
                if request["price"] > tick.bid:
                    request["type"] = mt5.ORDER_TYPE_SELL_LIMIT
                else:
                    request["type"] = mt5.ORDER_TYPE_SELL_STOP

        result = mt5.order_send(request)
        if result.retcode != mt5.TRADE_RETCODE_DONE:
             print(f"[ERROR] Order send failed: {result.retcode} - {result.comment}")
             return False
        
        print(f"[ORDER] Sent {request['action']} {order_type} {volume} {symbol} @ {request['price']}")
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
            # Last 365 days
            from_timestamp = int(time.time()) - (365 * 24 * 60 * 60)
        else:
            from_timestamp = int(from_date.timestamp()) if hasattr(from_date, 'timestamp') else int(from_date)
            
        if to_date is None:
            to_timestamp = int(time.time()) + 86400
        else:
            to_timestamp = int(to_date.timestamp()) if hasattr(to_date, 'timestamp') else int(to_date)
            
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
