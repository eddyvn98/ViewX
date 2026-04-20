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
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_access_token') : null;
    await fetch('/api/user/telegram/signal', {
      method: 'POST',
      headers: { 
        'content-type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[TelegramNotifier] Failed to notify:', error);
    }
  }
}

