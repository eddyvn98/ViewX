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

    def fetch_candles(self, symbol, interval, count=200):
        tf = self.timeframe_map.get(interval, mt5.TIMEFRAME_M1)
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

    def get_account_info(self):
        account = mt5.account_info()
        if not account: return {}
        return {
            "balance": account.balance,
            "equity": account.equity,
            "margin": account.margin,
            "free_margin": account.margin_free,
            "margin_level": account.margin_level,
            "profit": account.profit
        }

    def get_positions(self):
        positions = mt5.positions_get()
        if not positions: return []
        return [{
            "ticket": p.ticket,
            "symbol": p.symbol,
            "type": "buy" if p.type == mt5.ORDER_TYPE_BUY else "sell",
            "volume": p.volume,
            "price_open": p.price_open,
            "price_current": p.price_current,
            "sl": p.sl,
            "tp": p.tp,
            "profit": p.profit,
            "time": p.time,
            "magic": p.magic
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
                "ticket": o.ticket,
                "symbol": o.symbol,
                "type": o_type,
                "volume": o.volume_initial,
                "price_open": o.price_open,
                "price_current": o.price_current,
                "sl": o.sl,
                "tp": o.tp,
                "profit": 0,
                "time": o.time_setup,
                "magic": o.magic
            })
        return order_list

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
                "type_filling": mt5.ORDER_FILLING_IOC,
            }
            result = mt5.order_send(request)
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
        return False
