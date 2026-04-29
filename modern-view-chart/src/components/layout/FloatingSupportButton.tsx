'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircleHeart } from 'lucide-react';

const TELEGRAM_URL = 'https://t.me/htt711';
const ZALO_URL = 'https://zalo.me/84932690949';

export function FloatingSupportButton() {
  const pathname = usePathname();
  const normalizedPath = String(pathname || '').toLowerCase();
  if (normalizedPath === '/chart' || normalizedPath.endsWith('/chart')) return null;

  return (
    <div className="fixed bottom-20 right-4 z-[70] flex flex-col gap-2 md:bottom-6 md:right-6">
      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center justify-center rounded-full bg-sky-500 px-4 py-2 text-xs font-black text-white shadow-lg transition hover:bg-sky-400"
      >
        <MessageCircleHeart className="mr-1 h-4 w-4" />
        Telegram
      </a>
      <a
        href={ZALO_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center justify-center rounded-full bg-blue-700 px-4 py-2 text-xs font-black text-white shadow-lg transition hover:bg-blue-600"
      >
        <MessageCircleHeart className="mr-1 h-4 w-4" />
        Zalo
      </a>
    </div>
  );
}
