'use client';

import { useEffect } from 'react';
import { usePathname } from '@/i18n/routing';

const STORAGE_KEY = 'vivutrade_last_path';
// Never resume into the landing page itself, or a page that only makes sense
// as a one-time destination (auth/activation flows).
const EXCLUDED_PATHS = new Set(['/', '/mt5-activation']);

export function LastRouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (EXCLUDED_PATHS.has(pathname)) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, pathname);
    } catch {
      // Storage can be unavailable (private mode, quota) — resuming last page
      // is a convenience, not worth surfacing an error for.
    }
  }, [pathname]);

  return null;
}

export function getStoredLastPath(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && !EXCLUDED_PATHS.has(stored) ? stored : null;
  } catch {
    return null;
  }
}
