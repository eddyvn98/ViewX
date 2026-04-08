'use client';

import React from 'react';
import { CheckCircle2, CircleAlert, Clock3, Loader2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { cn } from '@/lib/utils';

type AdminOrder = {
  id: string;
  _id?: string;
  orderCode: string;
  module: string;
  modules?: string[];
  amount: number;
  currency: string;
  status: string;
  transferContent: string;
  qrUrl?: string;
  createdAt?: string;
  expiresAt?: string;
  remainingSeconds?: number;
  userId?: string;
  confirmedBy?: string;
  confirmedAt?: string;
};

type StatsResponse = {
  ok: boolean;
  stats: {
    pendingOrders: number;
    paidOrders: number;
    activeMembers: number;
    expiringToday: number;
    monthlyRevenue: number;
  };
};

const formatMoney = (value: number) => new Intl.NumberFormat('vi-VN').format(value) + ' VND';

const formatCountdown = (seconds?: number) => {
  const safe = Math.max(0, Number(seconds || 0));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
};

function moduleText(order: AdminOrder) {
  if (Array.isArray(order.modules) && order.modules.length > 0) return order.modules.join(', ');
  return order.module || '';
}

export default function AdminPage() {
  const [orders, setOrders] = React.useState<AdminOrder[]>([]);
  const [pendingStats, setPendingStats] = React.useState<StatsResponse['stats'] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [actionId, setActionId] = React.useState<string>('');
  const [notice, setNotice] = React.useState('');
  const [isAdmin, setIsAdmin] = React.useState(false);

  const loadData = React.useCallback(async () => {
    const token = (localStorage.getItem('auth_access_token') || '').trim();
    const rawUser = String(localStorage.getItem('auth_user') || '').trim();
    if (!token) {
      setIsAdmin(false);
      setLoading(false);
      setNotice('Cần đăng nhập bằng tài khoản admin để xem trang này.');
      return;
    }

    setLoading(true);
    try {
      const [ordersRes, statsRes] = await Promise.all([
        fetch('/api/user/admin/module-orders?status=pending', {
          headers: { authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
        fetch('/api/user/admin/module-orders/stats', {
          headers: { authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
      ]);

      let isAdminUser = false;
      if (rawUser) {
        try {
          const user = JSON.parse(rawUser);
          isAdminUser = String(user?.role || '').toLowerCase() === 'admin';
        } catch {
          isAdminUser = false;
        }
      }
      setIsAdmin(isAdminUser);

      if (!ordersRes.ok) throw new Error('Không tải được danh sách đơn chờ duyệt');
      const ordersData = await ordersRes.json().catch(() => null);
      setOrders(Array.isArray(ordersData?.orders) ? ordersData.orders : []);

      if (statsRes.ok) {
        const statsData = (await statsRes.json().catch(() => null)) as StatsResponse | null;
        setPendingStats(statsData?.stats || null);
      }
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không tải được dữ liệu admin');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const confirmOrder = React.useCallback(async (orderId: string) => {
    const token = (localStorage.getItem('auth_access_token') || '').trim();
    if (!token) return;
    setActionId(orderId);
    try {
      const res = await fetch(`/api/user/admin/module-orders/${orderId}/confirm`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(data?.error || 'Không xác nhận được đơn'));
      setNotice(`Đã xác nhận đơn ${data?.order?.orderCode || orderId}.`);
      await loadData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không xác nhận được đơn');
    } finally {
      setActionId('');
    }
  }, [loadData]);

  const rejectOrder = React.useCallback(async (orderId: string) => {
    const token = (localStorage.getItem('auth_access_token') || '').trim();
    if (!token) return;
    setActionId(orderId);
    try {
      const res = await fetch(`/api/user/admin/module-orders/${orderId}/reject`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(data?.error || 'Không từ chối được đơn'));
      setNotice(`Đã từ chối đơn ${data?.order?.orderCode || orderId}.`);
      await loadData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không từ chối được đơn');
    } finally {
      setActionId('');
    }
  }, [loadData]);

  return (
    <div className="min-h-screen bg-[#0b0f14] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-8 md:px-6">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin Orders
            </div>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">Xác nhận thanh toán module</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Dùng trang này để duyệt nhanh đơn module sau khi bạn test thanh toán. Luồng confirm/reject đang nối thẳng vào API hiện có.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4" />
              Làm mới
            </button>
            <a
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-[#062318] hover:bg-emerald-300"
            >
              Sang pricing
            </a>
          </div>
        </header>

        {notice ? (
          <div className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            {notice}
          </div>
        ) : null}

        {!isAdmin ? (
          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-black">Đăng nhập admin</h2>
              <p className="mt-2 text-sm text-slate-400">
                Trang này chỉ mở cho tài khoản có role admin. Nếu bạn chưa đăng nhập, dùng Google Sign-In bên dưới.
              </p>
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                <GoogleSignInButton redirectTo="/admin" size="medium" text="continue_with" theme="filled_black" width={240} />
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 p-6">
              <div className="flex items-center gap-3 text-emerald-300">
                <CircleAlert className="h-5 w-5" />
                <span className="text-sm font-bold uppercase tracking-[0.2em]">Lưu ý</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Sau khi tạo đơn ở trang pricing, bạn quay lại đây để xác nhận thủ công. Nếu cần, mình có thể làm thêm nút auto-refresh.
              </p>
            </div>
          </section>
        ) : (
          <>
            <section className="mb-6 grid gap-4 md:grid-cols-4">
              {[
                ['Chờ duyệt', pendingStats?.pendingOrders ?? orders.length],
                ['Đã thanh toán', pendingStats?.paidOrders ?? 0],
                ['Active members', pendingStats?.activeMembers ?? 0],
                ['Doanh thu tháng', formatMoney(pendingStats?.monthlyRevenue ?? 0)],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
                  <p className="mt-2 text-2xl font-black">{String(value)}</p>
                </div>
              ))}
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">Đơn chờ xử lý</h2>
                  <p className="text-sm text-slate-400">Confirm đơn module sau khi nhận chuyển khoản hoặc test thủ công.</p>
                </div>
                {loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : null}
              </div>

              <div className="space-y-3">
                {orders.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                    Không có đơn pending nào.
                  </div>
                ) : (
                  orders.map((order) => {
                    const busy = actionId === order.id;
                    return (
                      <article key={order.id} className="rounded-2xl border border-white/10 bg-[#0c1117] p-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-black text-emerald-300">{order.orderCode}</p>
                              <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-bold uppercase text-amber-200">{order.status}</span>
                            </div>
                            <p className="text-sm text-slate-400">Modules: <span className="font-semibold text-slate-200">{moduleText(order)}</span></p>
                            <p className="text-sm text-slate-400">Amount: <span className="font-semibold text-slate-200">{formatMoney(order.amount)}</span></p>
                            <p className="text-sm text-slate-400">Remaining: <span className="font-semibold text-slate-200">{formatCountdown(order.remainingSeconds)}</span></p>
                            <p className="text-xs text-slate-500 font-mono break-all">Transfer: {order.transferContent}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void confirmOrder(order.id)}
                              disabled={busy}
                              className={cn(
                                'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition',
                                busy ? 'cursor-not-allowed bg-slate-700 text-slate-400' : 'bg-emerald-400 text-[#062318] hover:bg-emerald-300'
                              )}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Xác nhận
                            </button>
                            <button
                              type="button"
                              onClick={() => void rejectOrder(order.id)}
                              disabled={busy}
                              className={cn(
                                'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition',
                                busy ? 'cursor-not-allowed bg-slate-700 text-slate-400' : 'bg-rose-500/15 text-rose-200 hover:bg-rose-500/25'
                              )}
                            >
                              <XCircle className="h-4 w-4" />
                              Từ chối
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>

            <footer className="mt-6 flex items-center gap-2 text-xs text-slate-500">
              <Clock3 className="h-4 w-4" />
              Dữ liệu lấy từ `/api/user/admin/module-orders` và `/api/user/admin/module-orders/stats`
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
