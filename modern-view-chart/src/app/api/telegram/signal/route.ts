import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface SignalRequestBody {
  message?: string;
  strategyName?: string;
  symbol?: string;
  timeframe?: string;
  signalType?: 'BUY' | 'SELL' | 'EXIT' | 'CANCEL' | string;
  orderStatus?: 'OPEN' | 'PENDING' | 'CLOSED' | 'CANCELLED' | string;
  price?: number;
}

function buildMessage(body: SignalRequestBody): string {
  if (body.message && body.message.trim()) return body.message.trim();

  const parts: string[] = ['[MyBot]'];
  if (body.signalType) parts.push(String(body.signalType).toUpperCase());
  if (body.orderStatus) parts.push(`(${String(body.orderStatus).toUpperCase()})`);
  if (body.symbol) parts.push(String(body.symbol));
  if (body.timeframe) parts.push(String(body.timeframe).toUpperCase());
  if (body.strategyName) parts.push(`- ${body.strategyName}`);
  if (Number.isFinite(body.price)) parts.push(`@ ${Number(body.price).toFixed(2)}`);
  return parts.join(' ');
}

export async function POST(request: NextRequest): Promise<Response> {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();

  if (!token || !chatId) {
    console.error('telegram.signal.config_missing', {
      hasBotToken: Boolean(token),
      hasChatId: Boolean(chatId),
    });
    return NextResponse.json(
      { ok: false, error: 'Service temporarily unavailable' },
      { status: 503 }
    );
  }

  let body: SignalRequestBody = {};
  try {
    body = (await request.json()) as SignalRequestBody;
  } catch {
    body = {};
  }

  const text = buildMessage(body);
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok || data?.ok === false) {
      console.error('telegram.signal.upstream_failed', {
        status: upstream.status,
        description: data?.description || null,
      });
      return NextResponse.json(
        { ok: false, error: 'Service temporarily unavailable' },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, message_id: data?.result?.message_id || null });
  } catch (error) {
    console.error('telegram.signal.request_failed', error);
    return NextResponse.json({ ok: false, error: 'Service temporarily unavailable' }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}

