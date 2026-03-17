import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  return NextResponse.json(
    {
      ok: false,
      error: 'Telegram integration is temporarily disabled',
      code: 'telegram_temporarily_disabled',
    },
    { status: 503 }
  );
}

