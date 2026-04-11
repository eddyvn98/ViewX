'use client';

import React from 'react';
import Link from 'next/link';
import { getClientEntitlements, type ClientModule } from '@/lib/auth/entitlements';
import { ModuleGuideModal } from '@/features/modules/components/ModuleGuideModal';
import { TelegramLinkDialog } from '@/components/layout/TelegramLinkDialog';

type ModuleCard = {
  key: ClientModule;
  title: string;
  description: { vi: string; en: string };
  badge?: { vi: string; en: string };
};

type ModuleAccessSnapshot = {
  module: ClientModule;
  status: 'active' | 'trial' | 'inactive';
  canUse: boolean;
  trialEndsAt?: string | null;
  activeUntil?: string | null;
};

const MODULES: ModuleCard[] = [
  {
    key: 'your_mt5',
    title: 'Your MT5',
    description: {
      vi: 'Kết nối MT5 local bằng app native, đồng bộ dữ liệu vào chart và mở khóa terminal ngay trong cùng một luồng.',
      en: 'Connect local MT5 through the native app, sync the feed into the chart, and unlock the terminal in the same flow.',
    },
    badge: { vi: 'Dành cho MT5', en: 'For MT5' },
  },
  {
    key: 'vn_gold',
    title: 'Giá vàng Việt Nam',
    description: {
      vi: 'Theo dõi nhanh giá mua và giá bán SJC, DOJI ngay trong market list với dữ liệu cập nhật liên tục.',
      en: 'Track SJC and DOJI buy/sell quotes directly inside the market list with live updates.',
    },
    badge: { vi: 'Vàng Việt Nam', en: 'Vietnam gold' },
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
    key: 'discord_bot',
    title: 'Discord Bot',
    description: {
      vi: 'Vận hành Discord bot trong cùng hệ thống để tự động hóa thao tác và cảnh báo nhanh hơn.',
      en: 'Run a Discord bot in the same workspace for faster automation and alerts.',
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

const SUPPORTED_MODULES: ClientModule[] = ['your_mt5', 'vn_gold', 'telegram_notify', 'telegram_control', 'discord_bot', 'ai_assistant'];
const EXPIRING_SOON_DAYS = 3;

function getExpiryDate(access: ModuleAccessSnapshot | undefined): Date | null {
  if (!access) return null;
  const raw = access.status === 'trial' ? access.trialEndsAt : access.activeUntil;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}

function getDaysRemaining(expiry: Date | null): number | null {
  if (!expiry) return null;
  const diffMs = expiry.getTime() - Date.now();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function ModuleHubClient({ locale }: { locale: string }) {
  const [modules, setModules] = React.useState<ClientModule[]>([]);
  const [moduleAccess, setModuleAccess] = React.useState<Partial<Record<ClientModule, ModuleAccessSnapshot>>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeGuide, setActiveGuide] = React.useState<ClientModule | null>(null);
  const [isTelegramDialogOpen, setIsTelegramDialogOpen] = React.useState(false);
  const [telegramLinked, setTelegramLinked] = React.useState<boolean | null>(null);
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

        const accessResults = await Promise.all(
          SUPPORTED_MODULES.map(async (moduleKey) => {
            const statusRes = await fetch(`/api/user/module-access?module=${encodeURIComponent(moduleKey)}`, {
              method: 'GET',
              headers: { authorization: `Bearer ${accessToken}` },
              credentials: 'include',
            }).catch(() => null);

            if (!statusRes?.ok) return null;
            const statusData = await statusRes.json().catch(() => null);
            if (!statusData?.module) return null;
            return {
              module: moduleKey,
              status: String(statusData.status || 'inactive').toLowerCase() as ModuleAccessSnapshot['status'],
              canUse: Boolean(statusData.canUse),
              trialEndsAt: statusData.trialEndsAt || null,
              activeUntil: statusData.activeUntil || null,
            } satisfies ModuleAccessSnapshot;
          }),
        );

        const nextAccess: Partial<Record<ClientModule, ModuleAccessSnapshot>> = {};
        for (const item of accessResults) {
          if (!item) continue;
          nextAccess[item.module] = item;
        }
        setModuleAccess(nextAccess);
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

  React.useEffect(() => {
    const syncTelegramStatus = async () => {
      const accessToken = String(localStorage.getItem('auth_access_token') || '').trim();
      if (!accessToken) {
        setTelegramLinked(null);
        return;
      }

      try {
        const res = await fetch('/api/user/telegram/status', {
          method: 'GET',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${accessToken}`,
          },
          credentials: 'include',
        });

        if (!res.ok) {
          setTelegramLinked(null);
          return;
        }

        const data = await res.json().catch(() => null);
        setTelegramLinked(Boolean(data?.linked));
      } catch {
        setTelegramLinked(null);
      }
    };

    void syncTelegramStatus();
    window.addEventListener('focus', syncTelegramStatus);
    window.addEventListener('auth-changed', syncTelegramStatus);
    window.addEventListener('auth-state-changed', syncTelegramStatus);
    return () => {
      window.removeEventListener('focus', syncTelegramStatus);
      window.removeEventListener('auth-changed', syncTelegramStatus);
      window.removeEventListener('auth-state-changed', syncTelegramStatus);
    };
  }, []);

  return (
    <main className="h-dvh overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.15),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.15),_transparent_24%),#020617] px-4 py-10 text-white">
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
            const access = moduleAccess[module.key];
            const expiryDate = getExpiryDate(access);
            const daysRemaining = getDaysRemaining(expiryDate);
            const expiringSoon = active && daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= EXPIRING_SOON_DAYS;
            const isTelegramModule = module.key === 'telegram_notify' || module.key === 'telegram_control';
            const telegramStatusLabel = telegramLinked === null ? null : telegramLinked ? (isVi ? 'Telegram đã liên kết' : 'Telegram linked') : isVi ? 'Telegram chưa liên kết' : 'Telegram not linked';
            const cardClassName = expiringSoon
              ? 'rounded-[28px] border border-amber-300/55 bg-amber-500/12 p-6 shadow-xl ring-1 ring-amber-300/35'
              : active
                ? 'rounded-[28px] border border-emerald-300/45 bg-emerald-500/10 p-6 shadow-xl ring-1 ring-emerald-300/25'
                : 'rounded-[28px] border border-white/10 bg-slate-950/70 p-6 shadow-xl';

            return (
              <article key={module.key} className={cardClassName}>
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
                  <span className={expiringSoon ? 'font-bold text-amber-100' : active ? 'font-bold text-emerald-300' : 'font-bold text-slate-500'}>
                    {active ? (isVi ? 'Đã kích hoạt' : 'Active') : isVi ? 'Chưa kích hoạt' : 'Inactive'}
                  </span>
                  {expiringSoon ? (
                    <span className="rounded-full bg-amber-200/20 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-amber-100">
                      {isVi ? 'Sắp hết hạn' : 'Expiring soon'}
                    </span>
                  ) : null}
                  <div className="flex flex-wrap justify-end gap-2">
                    {active && isTelegramModule ? (
                      <button
                        type="button"
                        onClick={() => setIsTelegramDialogOpen(true)}
                        className="rounded-xl border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sm font-bold text-sky-100 transition hover:bg-sky-400/20"
                      >
                        {isVi ? 'Liên kết Telegram' : 'Link Telegram'}
                      </button>
                    ) : null}
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
                {active && isTelegramModule ? (
                  <div className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-200">
                      {isVi ? 'Bước tiếp theo' : 'Next step'}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-sky-50/90">
                      {isVi
                        ? 'Liên kết Telegram với đúng tài khoản web đã mua module để bot gửi thông báo và tín hiệu đúng người.'
                        : 'Link Telegram with the same web account so the bot sends alerts and signals to the right buyer.'}
                    </p>
                    {telegramStatusLabel ? (
                      <div className={telegramLinked ? 'mt-3 inline-flex rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-200' : 'mt-3 inline-flex rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold text-amber-100'}>
                        {telegramStatusLabel}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>

        <section className="rounded-[28px] border border-amber-400/15 bg-amber-400/10 p-6">
          <h2 className="text-xl font-bold text-amber-100">{isVi ? 'Luồng đề xuất' : 'Recommended flow'}</h2>
          <ol className="mt-4 space-y-3 text-sm leading-7 text-amber-50/90">
            <li>1. {isVi ? 'Xem module nào đã được cấp quyền trên tài khoản hiện tại.' : 'Check which modules are active on the current account.'}</li>
            <li>2. {isVi ? 'Mở popup giới thiệu để hiểu nhanh workflow của từng module.' : 'Open the guide popup to understand that module workflow quickly.'}</li>
            <li>3. {isVi ? 'Riêng với Telegram, liên kết bot trước khi quay lại chart để bắt đầu nhận thông báo.' : 'For Telegram, link the bot before returning to the chart so alerts can start immediately.'}</li>
          </ol>
        </section>
      </div>

      <ModuleGuideModal open={Boolean(activeGuide)} locale={locale} module={activeGuide} onClose={() => setActiveGuide(null)} />
      <TelegramLinkDialog open={isTelegramDialogOpen} onClose={() => setIsTelegramDialogOpen(false)} />
    </main>
  );
}
