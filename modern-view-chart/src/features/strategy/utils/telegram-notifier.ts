type TelegramSignalPayload = {
  strategyName: string;
  symbol: string;
  timeframe?: string;
  signalType: 'BUY' | 'SELL' | 'EXIT' | 'CANCEL' | string;
  orderStatus?: 'OPEN' | 'PENDING' | 'CLOSED' | 'CANCELLED' | string;
  price?: number;
};

export async function notifyTelegramSignal(payload: TelegramSignalPayload): Promise<void> {
  try {
    await fetch('/api/telegram/signal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[TelegramNotifier] Failed to notify:', error);
    }
  }
}

