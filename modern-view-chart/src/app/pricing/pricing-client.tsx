'use client';

import React from 'react';
import { BellRing, Bot, BriefcaseBusiness, Check, Plus, Shield, ShoppingCart, Sparkles, Zap, Headset } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getClientEntitlements, setClientModulesLocal, type ClientModule } from '@/lib/auth/entitlements';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { ModuleGuideModal } from '@/features/modules/components/ModuleGuideModal';

type ModuleCard = {
  key: ClientModule;
  title: string;
  description: string;
  priceLabel: string;
  amount: number;
  icon: React.ReactNode;
};

type CheckoutOrder = {
  id: string;
  module: string;
  modules?: string[];
  orderCode: string;
  amount: number;
  currency: string;
  status: string;
  transferContent: string;
  qrUrl: string;
  bankCode: string;
  bankAccountNo: string;
  bankAccountName: string;
  createdAt?: string;
  expiresAt?: string;
  remainingSeconds?: number;
};

type RecentOrder = {
  _id?: string;
  id?: string;
  module: string;
  modules?: string[];
  orderCode: string;
  amount: number;
  currency: string;
  status: string;
  createdAt?: string;
};

function getLocaleFromPathname() {
  if (typeof window === 'undefined') return 'vi';
  const match = window.location.pathname.match(/^\/(vi|en)(?:\/|$)/i);
  return (match?.[1] || 'vi').toLowerCase();
}

function clearSessionAndRedirect() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('auth_access_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('client_modules');
    window.dispatchEvent(new Event('auth-changed'));
    const locale = getLocaleFromPathname();
    window.location.href = `/${locale}`;
  } catch {
    window.location.href = '/';
  }
}

const MODULES: ModuleCard[] = [
  {
    key: 'your_mt5',
    title: 'Your MT5',
    description: 'K?t n?i tr?c ti?p MT5 d? qu?n lý chart và th?c thi l?nh nhanh.',
    priceLabel: '10k/tháng',
    amount: 10000,
    icon: <BriefcaseBusiness className="h-4 w-4" />,
  },
  {
    key: 'telegram_notify',
    title: 'Telegram Notify',
    description: 'Nh?n c?nh báo tín hi?u và bi?n d?ng giá qua Telegram.',
    priceLabel: '10k/tháng',
    amount: 10000,
    icon: <BellRing className="h-4 w-4" />,
  },
  {
    key: 'telegram_control',
    title: 'Telegram Control',
    description: 'Ði?u khi?n bot và thao tác nhanh qua Telegram.',
    priceLabel: '10k/tháng',
    amount: 10000,
    icon: <Bot className="h-4 w-4" />,
  },
  {
    key: 'ai_assistant',
    title: 'AI Assistant',
    description: 'Tr? lý AI phân tích và g?i ý quy?t d?nh giao d?ch.',
    priceLabel: '10k/tháng',
    amount: 10000,
    icon: <Sparkles className="h-4 w-4" />,
  },
];

const VISIBLE_MODULE_KEYS = new Set<ClientModule>(MODULES.map((module) => module.key));

const DEFAULT_UNIT_PRICE = 10000;

function getModuleAmount(moduleKey: ClientModule) {
  return MODULES.find((item) => item.key === moduleKey)?.amount ?? DEFAULT_UNIT_PRICE;
}

function moduleListText(order: { module?: string; modules?: string[] }) {
  if (Array.isArray(order.modules) && order.modules.length > 0) return order.modules.join(', ');
  return String(order.module || '');
}

function formatCountdown(seconds: number) {
  const safe = Math.max(0, seconds);
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

export default function PricingClient() {
  const [selected, setSelected] = React.useState<ClientModule[]>([]);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [accountLabel, setAccountLabel] = React.useState('Guest');
  const [isCreatingOrder, setIsCreatingOrder] = React.useState(false);
  const [notice, setNotice] = React.useState('');
  const [checkoutOrder, setCheckoutOrder] = React.useState<CheckoutOrder | null>(null);
  const [recentOrders, setRecentOrders] = React.useState<RecentOrder[]>([]);
  const [countdownSeconds, setCountdownSeconds] = React.useState(0);
  const [isCancelingOrder, setIsCancelingOrder] = React.useState(false);
  const [showPaidGuide, setShowPaidGuide] = React.useState(false);
  const [showGoogleLogin, setShowGoogleLogin] = React.useState(false);
  const [activeGuide, setActiveGuide] = React.useState<ClientModule | null>(null);
  const checkoutSectionRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
    return () => {
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
    };
  }, []);

  React.useEffect(() => {
    const syncEntitlements = () => {
      const entitlements = getClientEntitlements();
      setSelected(entitlements.modules.filter((module) => VISIBLE_MODULE_KEYS.has(module)));
      setIsAuthenticated(entitlements.isAuthenticated);
      const raw = String(localStorage.getItem('auth_user') || '').trim();
      if (!raw) {
        setAccountLabel('Guest');
        return;
      }
      try {
        const user = JSON.parse(raw);
        const nextLabel = String(user?.display_name || user?.displayName || user?.username || 'Guest').trim();
        setAccountLabel(nextLabel || 'Guest');
      } catch {
        setAccountLabel('Guest');
      }
    };

    syncEntitlements();
    window.addEventListener('storage', syncEntitlements);
    window.addEventListener('focus', syncEntitlements);
    window.addEventListener('auth-changed', syncEntitlements);
    window.addEventListener('auth-state-changed', syncEntitlements);

    return () => {
      window.removeEventListener('storage', syncEntitlements);
      window.removeEventListener('focus', syncEntitlements);
      window.removeEventListener('auth-changed', syncEntitlements);
      window.removeEventListener('auth-state-changed', syncEntitlements);
    };
  }, []);

  React.useEffect(() => {
    if (!isAuthenticated) {
      setRecentOrders([]);
      return;
    }
    const accessToken = (localStorage.getItem('auth_access_token') || '').trim();
    if (!accessToken) return;
    const loadOrders = async () => {
      try {
        const res = await fetch('/api/user/module-orders', {
          method: 'GET',
          headers: { authorization: `Bearer ${accessToken}` },
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (Array.isArray(data?.orders)) setRecentOrders(data.orders.slice(0, 6));
      } catch {
        // ignore
      }
    };
    void loadOrders();
  }, [isAuthenticated]);

  const toggleModule = React.useCallback((moduleKey: ClientModule) => {
    setSelected((current) => {
      const next = current.includes(moduleKey) ? current.filter((item) => item !== moduleKey) : [...current, moduleKey];
      setClientModulesLocal(next);
      return next;
    });
  }, []);

  const totalAmount = selected.reduce((sum, moduleKey) => sum + getModuleAmount(moduleKey), 0);
  const accountHint = accountLabel || 'Guest';

  const refreshOrders = React.useCallback(async () => {
    const accessToken = (localStorage.getItem('auth_access_token') || '').trim();
    if (!accessToken) return;
    const res = await fetch('/api/user/module-orders', {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}` },
      credentials: 'include',
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    if (!Array.isArray(data?.orders)) return;
    const orders = data.orders as (CheckoutOrder & { _id?: string; id?: string })[];
    setRecentOrders(orders.slice(0, 6));
    if (!checkoutOrder?.id) return;
    const current = orders.find((item) => item.id === checkoutOrder.id || item.orderCode === checkoutOrder.orderCode);
    if (!current) return;
    const prevStatus = checkoutOrder.status;
    setCheckoutOrder(current);
    setCountdownSeconds(Number(current.remainingSeconds || 0));
    if (prevStatus !== 'paid' && current.status === 'paid') {
      setNotice('Thanh toán thành công. Module dã du?c kích ho?t.');
      setShowPaidGuide(true);
      setSelected([]);
      setClientModulesLocal([]);
      const locale = getLocaleFromPathname();
      window.setTimeout(() => {
        window.location.href = `/${locale}/modules`;
      }, 900);
    }
    if (current.status === 'expired') {
      setNotice('Ðon dã h?t h?n sau 15 phút. Vui lòng t?o don m?i d? thanh toán.');
    }
  }, [checkoutOrder]);

  React.useEffect(() => {
    if (!checkoutOrder || checkoutOrder.status !== 'pending') return;
    const id = window.setInterval(() => void refreshOrders(), 5000);
    return () => window.clearInterval(id);
  }, [checkoutOrder, refreshOrders]);

  React.useEffect(() => {
    if (!checkoutOrder) {
      setCountdownSeconds(0);
      return;
    }
    setCountdownSeconds(Number(checkoutOrder.remainingSeconds || 0));
  }, [checkoutOrder]);

  React.useEffect(() => {
    if (!checkoutOrder || checkoutOrder.status !== 'paid') return;
    setSelected([]);
    setClientModulesLocal([]);
  }, [checkoutOrder]);

  React.useEffect(() => {
    if (!checkoutOrder || checkoutOrder.status !== 'pending') return;
    const id = window.setInterval(() => setCountdownSeconds((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [checkoutOrder]);

  const createOrder = React.useCallback(async () => {
    const orderModules = selected.filter((module) => VISIBLE_MODULE_KEYS.has(module));

    if (orderModules.length === 0) {
      setNotice('Ch?n ít nh?t 1 module tru?c khi thanh toán.');
      return;
    }
    if (!isAuthenticated) {
      setNotice('Vui lòng dang nh?p d? thanh toán.');
      return;
    }

    const accessToken = (localStorage.getItem('auth_access_token') || '').trim();
    if (!accessToken) {
      setNotice('Không tìm th?y phiên dang nh?p. Vui lòng dang nh?p l?i.');
      return;
    }

    setIsCreatingOrder(true);
    try {
      const res = await fetch('/api/user/module-orders', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({ modules: orderModules }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.order) throw new Error(String(data?.error || 'Không t?o du?c don thanh toán'));
      setCheckoutOrder(data.order as CheckoutOrder);
      setCountdownSeconds(Number(data.order?.remainingSeconds || 0));
      setShowPaidGuide(false);
      const moduleCount = Array.isArray(data.order?.modules) && data.order.modules.length > 0 ? data.order.modules.length : orderModules.length;
      setNotice(`Ðã t?o don ${data.order.orderCode} cho ${moduleCount} module.`);
      setRecentOrders((prev) => [data.order as RecentOrder, ...prev.filter((item) => item._id !== data.order.id)].slice(0, 6));
      window.setTimeout(() => checkoutSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không t?o du?c don thanh toán');
    } finally {
      setIsCreatingOrder(false);
    }
  }, [isAuthenticated, selected]);

  const cancelOrder = React.useCallback(async () => {
    if (!checkoutOrder?.id) return;
    const accessToken = (localStorage.getItem('auth_access_token') || '').trim();
    if (!accessToken) return;
    setIsCancelingOrder(true);
    try {
      const res = await fetch(`/api/user/module-orders/${checkoutOrder.id}/cancel`, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(data?.error || 'Không h?y du?c don'));
      if (data?.order) setCheckoutOrder(data.order as CheckoutOrder);
      setCountdownSeconds(0);
      setNotice('Ðon dã du?c h?y.');
      await refreshOrders();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không h?y du?c don');
    } finally {
      setIsCancelingOrder(false);
    }
  }, [checkoutOrder, refreshOrders]);

  return (
    <div className="relative min-h-screen overflow-x-hidden overflow-y-auto bg-[#0f1419] text-[#dee3ea]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(ellipse_at_center,rgba(78,222,163,0.12),transparent_60%)]" />

      <main className="relative z-10 mx-auto w-full max-w-[1200px] px-4 pb-56 pt-14 md:px-6 md:pb-40 md:pt-20">
        <section className="relative mb-14 text-center">
          <div className="mb-5 flex flex-wrap justify-center gap-3">
            <a
              href={`/${getLocaleFromPathname()}/modules`}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/20"
            >
              Module c?a tôi
            </a>
            {isAuthenticated ? (
              <button
                type="button"
                onClick={clearSessionAndRedirect}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-[#dee3ea] transition hover:bg-white/10"
              >
                Ðang xu?t
              </button>
            ) : null}
          </div>
          <h1 className="text-[3rem] font-black tracking-tighter leading-[0.95] md:text-7xl">
            Nâng t?m giao d?ch <br /> v?i <span className="text-[#4edea3]">VivuTrade</span>
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-[#bbcabf] md:text-lg">
            Thi?t k? tr?i nghi?m giao d?ch c?a riêng b?n. Ch?n các module m?nh m? d? t?i uu hóa chi?n lu?c và l?i nhu?n.
          </p>
          {notice ? (
            <div className="mx-auto mt-5 max-w-2xl rounded-xl border border-[#4edea3]/20 bg-[#1b2025]/80 px-4 py-3 text-sm text-[#93f3c8]">
              {notice}
            </div>
          ) : null}
          {isAuthenticated ? (
            <div className="mx-auto mt-4 max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-4 text-left md:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#86948a]">Module c?a tôi</p>
                  <p className="mt-1 text-sm text-[#bbcabf]">
                    Vào hub d? m? nhanh module dã mua, xem hu?ng d?n và quay l?i chart.
                  </p>
                  <p className="mt-1 text-xs text-[#86948a]">
                    Tài kho?n hi?n t?i: <span className="font-semibold text-[#dee3ea]">{accountHint}</span>
                  </p>
                </div>
                <a
                  href={`/${getLocaleFromPathname()}/modules`}
                  className="inline-flex items-center justify-center rounded-xl bg-[#4edea3] px-4 py-2.5 text-sm font-black text-[#003824] transition hover:shadow-[0_0_20px_rgba(78,222,163,0.24)]"
                >
                  M? module hub
                </a>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((module) => {
            const isSelected = selected.includes(module.key);
            return (
              <div
                key={module.key}
                onClick={() => toggleModule(module.key)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleModule(module.key);
                  }
                }}
                role="button"
                tabIndex={0}
                className={cn(
                  'group rounded-xl border p-5 text-left transition-all duration-300',
                  'bg-[rgba(27,32,37,0.72)] backdrop-blur-[12px]',
                  isSelected
                    ? 'border-[#4edea3]/40 shadow-[0_0_20px_rgba(78,222,163,0.08)]'
                    : 'border-white/5 hover:border-[#4edea3]/25 hover:-translate-y-1'
                )}
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#30353b] text-[#4edea3] transition-colors group-hover:bg-[#10b981] group-hover:text-[#003824] md:h-14 md:w-14">
                    {module.icon}
                  </div>
                  <div className={cn('flex h-7 w-7 items-center justify-center rounded-md border-2 transition', isSelected ? 'border-[#4edea3] bg-[#4edea3] text-[#003824]' : 'border-[#86948a] text-transparent')}>
                    <Check className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="mb-2 text-[1.75rem] font-bold tracking-tight md:text-[2rem]">{module.title}</h3>
                <p className="mb-6 text-[14px] leading-relaxed text-[#bbcabf] md:mb-8 md:text-[15px]">{module.description}</p>
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-[1.65rem] font-black text-[#4edea3] md:text-[2rem]">{module.priceLabel.replace('/tháng', '')}</span>
                    <span className="ml-1 text-sm text-[#bbcabf]">/tháng</span>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-lg bg-[#4edea3]/10 px-3 py-1.5 text-sm font-bold text-[#4edea3]">Ðã s?n sàng</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveGuide(module.key);
                      }}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-[#dee3ea] transition hover:bg-white/10"
                    >
                      Xem gi?i thi?u
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#3c4a42] bg-[rgba(27,32,37,0.72)] p-7 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#3c4a42] text-[#86948a]">
              <Plus className="h-4 w-4" />
            </div>
            <h3 className="text-2xl font-bold text-[#bbcabf]">Thêm module m?i</h3>
            <p className="mt-2 text-sm text-[#86948a]">S?p m? thêm nhi?u tính nang nâng cao.</p>
          </div>
        </section>

        <section className="mb-12 border-y border-white/5 py-10">
          <div className="grid grid-cols-1 gap-8 text-center md:grid-cols-3">
            <div>
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#4edea3]/10 text-[#4edea3]">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold">Fast Execution</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm text-[#9fb0a4]">Ð? tr? th?p, d?m b?o l?nh c?a b?n luôn du?c kh?p giá t?t nh?t.</p>
            </div>
            <div>
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#56b4ff]/10 text-[#56b4ff]">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold">Secure Data</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm text-[#9fb0a4]">Mã hóa chu?n quân d?i, b?o v? m?i thông tin tài kho?n và l?ch s? giao d?ch.</p>
            </div>
            <div>
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#f9bd22]/10 text-[#f9bd22]">
                <Headset className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold">24/7 Support</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm text-[#9fb0a4]">Ð?i ngu k? thu?t luôn s?n sàng h? tr? b?n b?t k? th?i gian th? tru?ng.</p>
            </div>
          </div>
        </section>

        {checkoutOrder ? (
          <section ref={checkoutSectionRef} className="mb-10 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-xl border border-[#4edea3]/20 bg-[#1b2025]/85 p-5">
              <h2 className="text-xl font-black">Thanh toán don hàng</h2>
              <div className="mt-4 space-y-2 text-sm text-[#bbcabf]">
                <p>Mã don: <span className="font-mono font-bold text-[#4edea3]">{checkoutOrder.orderCode}</span></p>
                <p>Module: <span className="font-semibold text-[#dee3ea]">{moduleListText(checkoutOrder)}</span></p>
                <p>S? ti?n: <span className="font-semibold text-[#dee3ea]">{checkoutOrder.amount} {checkoutOrder.currency}</span></p>
                <p>Tr?ng thái: <span className="font-semibold uppercase text-[#dee3ea]">{checkoutOrder.status}</span></p>
                {checkoutOrder.status === 'pending' ? <p>Th?i gian còn l?i: <span className="font-semibold text-[#f9bd22]">{formatCountdown(countdownSeconds)}</span></p> : null}
                <p>N?i dung CK: <span className="font-mono text-[#4edea3]">{checkoutOrder.transferContent}</span></p>
              </div>
              {checkoutOrder.status === 'pending' ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void refreshOrders()} className="rounded-lg bg-[#30353b] px-3 py-1.5 text-xs font-bold hover:bg-[#3b424a]">Ki?m tra tr?ng thái</button>
                  <button type="button" onClick={() => void cancelOrder()} disabled={isCancelingOrder} className={cn('rounded-lg px-3 py-1.5 text-xs font-bold', isCancelingOrder ? 'bg-[#30353b] text-[#86948a]' : 'bg-red-500/20 text-red-200 hover:bg-red-500/30')}>
                    {isCancelingOrder ? 'Ðang h?y...' : 'H?y don'}
                  </button>
                </div>
              ) : null}
              {showPaidGuide ? (
                <div className="mt-4 rounded-lg border border-[#4edea3]/30 bg-[#10b981]/10 p-3 text-sm text-[#d7ffe9]">
                  Thanh toán dã xác nh?n. Hu?ng d?n: t?i l?i trang ho?c vào dashboard, sau dó m? module v?a mua.
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-white/10 bg-[#1b2025]/85 p-5">
              <h3 className="text-xs font-bold uppercase tracking-[0.24em] text-[#86948a]">QR thanh toán</h3>
              {checkoutOrder.qrUrl ? (
                <img src={checkoutOrder.qrUrl} alt="QR thanh toán" className="mt-4 h-56 w-56 rounded-lg border border-white/10 bg-white p-2" />
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-white/10 px-4 py-10 text-xs text-[#86948a]">
                  Chua có QR vì thi?u PAYMENT_BANK_CODE/PAYMENT_BANK_ACCOUNT_NO.
                </div>
              )}
            </div>
          </section>
        ) : null}

        <section className="rounded-xl border border-white/10 bg-[#171c21] p-5">
          <h2 className="text-base font-black">Ðon hàng g?n dây</h2>
          <div className="mt-3 space-y-2">
            {recentOrders.length === 0 ? (
              <p className="text-sm text-[#86948a]">Chua có don hàng nào.</p>
            ) : recentOrders.map((order) => (
              <div key={order._id || order.id || order.orderCode} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm">
                <div>
                  <p className="font-semibold">{moduleListText(order)} · <span className="font-mono">{order.orderCode}</span></p>
                  <p className="text-xs text-[#86948a]">{order.amount} {order.currency}</p>
                </div>
                <span className={cn('rounded-md px-2 py-0.5 text-xs font-bold uppercase', order.status === 'paid' ? 'bg-[#10b981]/20 text-[#7ff5c5]' : order.status === 'pending' ? 'bg-[#f9bd22]/20 text-[#f9bd22]' : 'bg-[#30353b] text-[#bbcabf]')}>
                  {order.status}
                </span>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-10 border-t border-white/10 py-6">
          <div className="flex flex-col items-center justify-between gap-4 text-sm text-[#9fb0a4] md:flex-row">
            <p className="font-bold text-[#dee3ea]">VivuTrade</p>
            <div className="flex items-center gap-6">
              <a href="#" className="transition hover:text-[#4edea3]">Contact</a>
              <a href="#" className="transition hover:text-[#4edea3]">Support</a>
              <a href="#" className="transition hover:text-[#4edea3]">Privacy</a>
              <a href="#" className="transition hover:text-[#4edea3]">Terms</a>
            </div>
            <p>© 2024 VivuTrade. The Sovereign Analyst.</p>
          </div>
        </footer>
      </main>

      <div className="fixed bottom-2 left-1/2 z-50 w-[calc(100%-12px)] max-w-[860px] -translate-x-1/2 md:bottom-5 md:w-[92%]">
        <div className="flex flex-col items-stretch justify-between gap-2 rounded-xl border border-white/10 bg-[#252a30]/94 px-2.5 py-2 shadow-2xl backdrop-blur md:flex-row md:items-center md:gap-3 md:rounded-2xl md:px-4 md:py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#10b981]/30 text-[#4edea3] md:h-9 md:w-9">
              <ShoppingCart className="h-4 w-4" />
            </div>
            <div>
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-[#86948a] md:block">Gi? hàng c?a b?n</p>
              <p className="text-[0.96rem] font-bold leading-tight md:whitespace-nowrap md:text-[1.35rem]">{selected.length > 0 ? `Ðã ch?n ${selected.length} module` : 'Chua ch?n module'}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 md:justify-end md:gap-4">
            <div className="min-w-0 text-left md:text-right">
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-[#86948a] md:block">T?ng thanh toán</p>
              <p className="whitespace-nowrap text-[1.05rem] font-black leading-none md:text-[1.9rem]">{new Intl.NumberFormat('vi-VN').format(totalAmount)} VNÐ</p>
            </div>

            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => void createOrder()}
                disabled={isCreatingOrder || selected.length === 0}
                className={cn(
                  'h-10 min-w-[150px] whitespace-nowrap rounded-lg px-3 text-[13px] font-bold transition md:h-12 md:min-w-[250px] md:rounded-xl md:px-5 md:text-base',
                  selected.length > 0 && !isCreatingOrder
                    ? 'bg-[#4edea3] text-[#003824] hover:shadow-[0_0_20px_rgba(78,222,163,0.3)]'
                    : 'cursor-not-allowed bg-[#30353b] text-[#86948a]'
                )}
              >
                {isCreatingOrder ? 'Ðang t?o don...' : 'Thanh toán ngay'}
              </button>
            ) : (
              <div className="relative">
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setShowGoogleLogin((v) => !v)}
                    className="h-10 min-w-[150px] whitespace-nowrap rounded-lg px-3 text-[13px] font-bold bg-[#4edea3] text-[#003824] transition hover:shadow-[0_0_20px_rgba(78,222,163,0.3)] md:h-12 md:min-w-[250px] md:rounded-xl md:px-5 md:text-base"
                  >
                    Ðang nh?p d? thanh toán
                  </button>
                  {isAuthenticated ? (
                    <button
                      type="button"
                      onClick={clearSessionAndRedirect}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-[#dee3ea] transition hover:bg-white/10"
                    >
                      Ðang xu?t
                    </button>
                  ) : null}
                  {isAuthenticated ? (
                    <p className="text-[11px] text-[#86948a] text-right">
                      Ðang dùng: <span className="font-semibold text-[#dee3ea]">{accountHint}</span>
                    </p>
                  ) : null}
                </div>
                {showGoogleLogin ? (
                  <div className="absolute bottom-[calc(100%+8px)] right-0 z-[60] w-[190px] rounded-lg border border-white/10 bg-[#1b2025] p-1.5 shadow-xl md:w-[250px] md:p-2">
                    <GoogleSignInButton redirectTo="/vi/pricing" size="medium" text="continue_with" theme="filled_black" width={170} />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <ModuleGuideModal open={Boolean(activeGuide)} locale={getLocaleFromPathname()} module={activeGuide} onClose={() => setActiveGuide(null)} />
    </div>
  );
}



