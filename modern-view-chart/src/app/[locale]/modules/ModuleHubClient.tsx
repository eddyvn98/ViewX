'use client';

import React from 'react';
import Link from 'next/link';
import { getClientEntitlements, type ClientModule } from '@/lib/auth/entitlements';

type ModuleCard = {
  key: ClientModule;
  title: string;
  description: string;
  href: string;
  badge?: string;
};

const MODULES: ModuleCard[] = [
  { key: 'your_mt5', title: 'Your MT5', description: 'Mở khóa terminal MT5, xác nhận bridge, rồi vào trang hướng dẫn để hoàn tất setup.', href: '/your-mt5-guide', badge: 'Cần cho MT5' },
  { key: 'binance_trade', title: 'Binance Demo', description: 'Xem lại luồng mô phỏng crypto và tài nguyên liên quan.', href: '/chart' },
  { key: 'telegram_notify', title: 'Telegram Notify', description: 'Quản lý cảnh báo và tham chiếu sang tài liệu sử dụng.', href: '/docs/getting-started' },
  { key: 'telegram_control', title: 'Telegram Control', description: 'Xem hướng dẫn điều khiển bot và thao tác nhanh.', href: '/docs/getting-started' },
  { key: 'ai_assistant', title: 'AI Assistant', description: 'Vào trang module AI để đọc hướng dẫn và trạng thái quyền.', href: '/premium-ai' },
];

const SUPPORTED_MODULES: ClientModule[] = [
  'your_mt5',
  'binance_trade',
  'telegram_notify',
  'telegram_control',
  'ai_assistant',
];

export function ModuleHubClient({ locale }: { locale: string }) {
  const [modules, setModules] = React.useState<ClientModule[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const syncLocal = () => setModules(getClientEntitlements().modules);

    const syncFromServer = async () => {
      const accessToken = String(localStorage.getItem('auth_access_token') || '').trim();
      if (!accessToken) {
        syncLocal();
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/user/modules', {
          method: 'GET',
          headers: { authorization: `Bearer ${accessToken}` },
          credentials: 'include',
        });

        if (!res.ok) {
          syncLocal();
          return;
        }

        const data = await res.json().catch(() => null);
        const serverModules = Array.isArray(data?.modules)
          ? data.modules.filter((module: string): module is ClientModule => SUPPORTED_MODULES.includes(module as ClientModule))
          : [];
        const localModules = getClientEntitlements().modules;
        setModules(Array.from(new Set<ClientModule>([...localModules, ...serverModules])));
      } catch {
        syncLocal();
      } finally {
        setIsLoading(false);
      }
    };

    void syncFromServer();
    window.addEventListener('storage', syncFromServer);
    window.addEventListener('focus', syncFromServer);
    window.addEventListener('auth-changed', syncFromServer);
    window.addEventListener('auth-state-changed', syncFromServer);
    return () => {
      window.removeEventListener('storage', syncFromServer);
      window.removeEventListener('focus', syncFromServer);
      window.removeEventListener('auth-changed', syncFromServer);
      window.removeEventListener('auth-state-changed', syncFromServer);
    };
  }, []);

  const isVi = locale === 'vi';

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.15),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.15),_transparent_24%),#020617] px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-300">{isVi ? 'Module hub' : 'Module hub'}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">{isVi ? 'Trang quản lý module đã mua' : 'Manage your purchased modules'}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
            {isVi
              ? 'Sau khi thanh toán xong, bạn vào đây để xem module nào đã kích hoạt. Chọn đúng module để mở trang hướng dẫn, rồi quay lại chart khi đã sẵn sàng.'
              : 'After payment, come here to see which modules are active. Pick the right one to open its guide, then return to the chart when ready.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/${locale}/chart`} className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400">
              {isVi ? 'Mở chart ngay' : 'Open chart now'}
            </Link>
            <Link href={`/${locale}/pricing`} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">
              {isVi ? 'Mua thêm module' : 'Buy more modules'}
            </Link>
          </div>
          {isLoading ? (
            <p className="mt-4 text-sm text-slate-400">
              {isVi ? 'Đang tải module đã mua từ server...' : 'Loading purchased modules from server...'}
            </p>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((module) => {
            const active = modules.includes(module.key);
            return (
              <article key={module.key} className="rounded-[28px] border border-white/10 bg-slate-950/70 p-6 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">{module.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{module.description}</p>
                  </div>
                  {module.badge ? (
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">
                      {module.badge}
                    </span>
                  ) : null}
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <span className={active ? 'font-bold text-emerald-300' : 'font-bold text-slate-500'}>
                    {active ? (isVi ? 'Đã mua' : 'Purchased') : (isVi ? 'Chưa mua' : 'Not purchased')}
                  </span>
                  <Link
                    href={`/${locale}${module.href}`}
                    className={active
                      ? 'rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-400'
                      : 'rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10'}
                  >
                    {active ? (isVi ? 'Mở hướng dẫn' : 'Open guide') : (isVi ? 'Xem hướng dẫn' : 'View guide')}
                  </Link>
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-[28px] border border-amber-400/15 bg-amber-400/10 p-6">
          <h2 className="text-xl font-bold text-amber-100">{isVi ? 'Luồng đề xuất' : 'Recommended flow'}</h2>
          <ol className="mt-4 space-y-3 text-sm leading-7 text-amber-50/90">
            <li>1. {isVi ? 'Mua module xong sẽ tự vào trang này.' : 'After purchase, you land on this hub.'}</li>
            <li>2. {isVi ? 'Chọn đúng module đã mua để mở guide.' : 'Select the purchased module to open its guide.'}</li>
            <li>3. {isVi ? 'Đọc xong thì bấm về chart để dùng ngay.' : 'After reading, return to chart to start using it.'}</li>
          </ol>
        </section>
      </div>
    </main>
  );
}
