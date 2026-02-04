import datetime
import requests
import os
import asyncio

class AlertService:
    def __init__(self):
        self.alerts = []
        self.last_prices = {} # Track last known price for crossing detection
        self.telegram_token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.telegram_chat_id = os.getenv("TELEGRAM_CHAT_ID")

    def add_alert(self, alert):
        # Alert format: { id, symbol, price, active, type, note }
        self.alerts.append(alert)
        print(f"[ALERT] Added alert for {alert['symbol']} @ {alert['price']}")

    def remove_alert(self, alert_id):
        self.alerts = [a for a in self.alerts if a['id'] != alert_id]
        print(f"[ALERT] Removed alert {alert_id}")
        
    def update_alert(self, alert_id, updates):
        for alert in self.alerts:
            if alert['id'] == alert_id:
                alert.update(updates)
                print(f"[ALERT] Updated alert {alert_id}: {updates}")
                break

    async def check_alerts(self, symbol, current_price, send_ws_callback):
        triggered_alerts = []
        last_price = self.last_prices.get(symbol)
        
        # Update last price immediately for next tick? 
        # No, update at end, so we can compare current vs last.
        
        if last_price is None:
            self.last_prices[symbol] = current_price
            return []

        for alert in self.alerts:
            if not alert['active'] or alert['symbol'] != symbol:
                continue
                
            triggered = False
            target = alert['price']
            
            # Crossing Logic:
            # 1. Bullish Cross: Last < Target <= Current
            # 2. Bearish Cross: Last > Target >= Current
            
            if (last_price < target and current_price >= target) or \
               (last_price > target and current_price <= target):
                triggered = True
            
            # If triggered
            if triggered:
                 alert['active'] = False # One-time trigger
                 triggered_alerts.append(alert)
                 
                 # Detect direction
                 direction = 'bullish' if current_price >= target else 'bearish'
                 direction_icon = '↗️' if direction == 'bullish' else '↘️'
                 
                 msg = f"🔔 Alert: {symbol} crossed {target} ({direction_icon} {direction.capitalize()})"
                 print(msg)
                 
                 # 1. Notify Frontend
                 await send_ws_callback({
                     "topic": "alert_triggered",
                     "alert": alert,
                     "message": msg,
                     "direction": direction
                 })
                 
                 # 2. Notify Telegram
                 self.send_telegram(msg)
        
        self.last_prices[symbol] = current_price         
        return triggered_alerts

    def send_telegram(self, message):
        if not self.telegram_token or not self.telegram_chat_id:
            print("[ALERT] Telegram not configured")
            return

        try:
            url = f"https://api.telegram.org/bot{self.telegram_token}/sendMessage"
            payload = {
                "chat_id": self.telegram_chat_id,
                "text": message
            }
            # Run in thread or non-blocking way if possible, but requests is sync.
            # Ideally use aiohttp, but keeping it simple for now. 
            # We'll just fire and forget (blocking slightly but OK for low volume alerts)
            requests.post(url, json=payload, timeout=5)
        except Exception as e:
            print(f"[ERROR] Failed to send Telegram: {e}")
