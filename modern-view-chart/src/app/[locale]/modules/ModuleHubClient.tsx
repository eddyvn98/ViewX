'use client';

import React from 'react';
import Link from 'next/link';
import { getClientEntitlements, type ClientModule } from '@/lib/auth/entitlements';
import { ModuleGuideModal } from '@/features/modules/components/ModuleGuideModal';

type ModuleCard = {
  key: ClientModule;
  title: string;
  description: { vi: string; en: string };
  badge?: { vi: string; en: string };
};

const MODULES: ModuleCard[] = [
  {
    key: 'your_mt5',
    title: 'Your MT5',
    description: {
      vi: 'Kết nối MT5 local bằng app native, đồng bộ dữ liệu vào chart và mở khóa terminal ngay trong cùng flow.',
      en: 'Connect local MT5 through the native app, sync the feed into the chart, and unlock the terminal in the same flow.',
    },
    badge: { vi: 'Dành cho MT5', en: 'For MT5' },
  },
  {
    key: 'telegram_notify',
    title: 'Telegram Notify',
    description: {
      vi: 'Nhận cảnh báo và tín hiệu quan trọng trên Telegram cá nhân mà không phải canh chart liên tục.',
      en: 'Receive important alerts and signals in personal Telegram without watching the chart continuously.',
    },
  },
  {
    key: 'telegram_control',
    title: 'Telegram Control',
    description: {
      vi: 'Mở rộng khả năng điều khiển nhanh và phản hồi từ xa qua Telegram.',
      en: 'Extend quick-control and remote response workflows through Telegram.',
    },
  },
  {
    key: 'ai_assistant',
    title: 'AI Assistant',
    description: {
      vi: 'Dùng lớp hỗ trợ AI để tóm tắt ngữ cảnh, tín hiệu và tình huống giao dịch nhanh hơn.',
      en: 'Use the AI layer to summarize context, signals, and trading situations faster.',
    },
  },
];

const SUPPORTED_MODULES: ClientModule[] = ['your_mt5', 'telegram_notify', 'telegram_control', 'ai_assistant'];

export function ModuleHubClient({ locale }: { locale: string }) {
  const [modules, setModules] = React.useState<ClientModule[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeGuide, setActiveGuide] = React.useState<ClientModule | null>(null);
  const isVi = locale.toLowerCase().startsWith('vi');

  React.useEffect(() => {
    const syncLocal = () => setModules(getClientEntitlements().modules.filter((module) => SUPPORTED_MODULES.includes(module)));

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
        const localModules = getClientEntitlements().modules.filter((module) => SUPPORTED_MODULES.includes(module));
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

  return (
    <main className="min-h-screen overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.15),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.15),_transparent_24%),#020617] px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-300">Module hub</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
            {isVi ? 'Quản lý module đã mua và mở đúng hướng dẫn ngay tại chỗ' : 'Manage purchased modules and open the right guide in place'}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
            {isVi
              ? 'Sau khi thanh toán, bạn vào đây để xem module nào đã hoạt động, đọc giới thiệu nhanh ngay trong popup, rồi quay lại chart khi đã sẵn sàng.'
              : 'After payment, use this hub to see which modules are active, open their guide in a popup, and return to the chart when ready.'}
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
            <p className="mt-4 text-sm text-slate-400">{isVi ? 'Đang đồng bộ quyền module từ server...' : 'Syncing module access from the server...'}</p>
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
                    <p className="mt-2 text-sm leading-6 text-slate-300">{isVi ? module.description.vi : module.description.en}</p>
                  </div>
                  {module.badge ? (
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">
                      {isVi ? module.badge.vi : module.badge.en}
                    </span>
                  ) : null}
                </div>
                <div className="mt-6 flex items-center justify-between gap-3">
                  <span className={active ? 'font-bold text-emerald-300' : 'font-bold text-slate-500'}>
                    {active ? (isVi ? 'Đã kích hoạt' : 'Active') : isVi ? 'Chưa kích hoạt' : 'Inactive'}
                  </span>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveGuide(module.key)}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
                    >
                      {isVi ? 'Xem giới thiệu' : 'View guide'}
                    </button>
                    <Link
                      href={active ? `/${locale}/chart` : `/${locale}/pricing`}
                      className={
                        active
                          ? 'rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-400'
                          : 'rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/20'
                      }
                    >
                      {active ? (isVi ? 'Vào chart' : 'Open chart') : isVi ? 'Mở pricing' : 'Open pricing'}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-[28px] border border-amber-400/15 bg-amber-400/10 p-6">
          <h2 className="text-xl font-bold text-amber-100">{isVi ? 'Luồng đề xuất' : 'Recommended flow'}</h2>
          <ol className="mt-4 space-y-3 text-sm leading-7 text-amber-50/90">
            <li>1. {isVi ? 'Xem module nào đã được cấp quyền trên tài khoản hiện tại.' : 'Check which modules are active on the current account.'}</li>
            <li>2. {isVi ? 'Mở popup giới thiệu để hiểu nhanh đúng workflow của module đó.' : 'Open the guide popup to understand that module workflow quickly.'}</li>
            <li>3. {isVi ? 'Quay lại chart hoặc pricing tùy theo trạng thái module.' : 'Return to the chart or pricing depending on module status.'}</li>
          </ol>
        </section>
      </div>

      <ModuleGuideModal open={Boolean(activeGuide)} locale={locale} module={activeGuide} onClose={() => setActiveGuide(null)} />
    </main>
  );
}
