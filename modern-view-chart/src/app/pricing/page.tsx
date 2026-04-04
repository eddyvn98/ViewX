'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getClientEntitlements, setClientModulesLocal, type ClientModule } from '@/lib/auth/entitlements';
import { Check } from 'lucide-react';

type ModuleItem = {
    key: ClientModule;
    title: string;
    desc: string;
    price: string;
};

const MODULES: ModuleItem[] = [
    { key: 'your_mt5', title: 'Your MT5 (MT5 của bạn)', desc: 'Kết nối MT5 cá nhân để xem chart và giao dịch trên web/app.', price: '20k/tháng' },
    { key: 'binance_trade', title: 'Giao dịch Binance Demo', desc: 'Mô phỏng giao dịch Binance trên nền web.', price: '20k/tháng' },
    { key: 'telegram_notify', title: 'Thông báo Telegram', desc: 'Nhận cảnh báo giá/tín hiệu qua Telegram.', price: '20k/tháng' },
    { key: 'telegram_control', title: 'Điều khiển qua Telegram', desc: 'Ra lệnh nhanh qua Telegram bot.', price: '20k/tháng' },
    { key: 'ai_assistant', title: 'AI Assistant', desc: 'Phân tích và hỗ trợ quyết định với AI.', price: '20k/tháng' },
];

export default function PricingPage() {
    const [selected, setSelected] = React.useState<ClientModule[]>([]);
    const [isAuthed, setIsAuthed] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [notice, setNotice] = React.useState<string>('');
    const [isCreatingOrder, setIsCreatingOrder] = React.useState<string>('');
    const [checkoutOrder, setCheckoutOrder] = React.useState<{
        id: string;
        module: string;
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
    } | null>(null);
    const [recentOrders, setRecentOrders] = React.useState<Array<{
        _id: string;
        module: string;
        orderCode: string;
        amount: number;
        currency: string;
        status: string;
        createdAt?: string;
    }>>([]);

    React.useEffect(() => {
        if (typeof document === 'undefined') return;
        const htmlOverflow = document.documentElement.style.overflow;
        const bodyOverflow = document.body.style.overflow;
        document.documentElement.style.overflow = 'auto';
        document.body.style.overflow = 'auto';
        return () => {
            document.documentElement.style.overflow = htmlOverflow;
            document.body.style.overflow = bodyOverflow;
        };
    }, []);

    React.useEffect(() => {
        const ent = getClientEntitlements();
        setSelected(ent.modules);
        setIsAuthed(ent.isAuthenticated);
        if (!ent.isAuthenticated) return;

        const accessToken = (localStorage.getItem('auth_access_token') || '').trim();
        if (!accessToken) return;

        fetch('/api/user/modules', {
            method: 'GET',
            headers: {
                authorization: `Bearer ${accessToken}`,
            },
            credentials: 'include',
        })
            .then(async (res) => {
                if (!res.ok) return null;
                return res.json().catch(() => null);
            })
            .then((data) => {
                if (!data || !Array.isArray(data.modules)) return;
                const serverModules = data.modules as ClientModule[];
                setSelected(serverModules);
                setClientModulesLocal(serverModules);
            })
            .catch(() => {
                // Keep local fallback silently.
            });

        const loadOrders = async () => {
            try {
                const res = await fetch('/api/user/module-orders', {
                    method: 'GET',
                    headers: {
                        authorization: `Bearer ${accessToken}`,
                    },
                    credentials: 'include',
                });
                if (!res.ok) return;
                const data = await res.json().catch(() => null);
                if (Array.isArray(data?.orders)) {
                    setRecentOrders(data.orders.slice(0, 6));
                }
            } catch {
                // ignore
            }
        };

        void loadOrders();
    }, []);

    const toggleModule = React.useCallback((key: ClientModule) => {
        setSelected((prev) => (prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]));
    }, []);

    const saveSelection = React.useCallback(() => {
        setIsSaving(true);
        const accessToken = (typeof window !== 'undefined' ? localStorage.getItem('auth_access_token') || '' : '').trim();
        if (!accessToken) {
            setClientModulesLocal(selected);
            setNotice('Đã lưu lựa chọn cục bộ. Đăng nhập để tạo đơn thanh toán.');
            setIsSaving(false);
            return;
        }

        fetch('/api/user/modules', {
            method: 'PUT',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${accessToken}`,
            },
            credentials: 'include',
            body: JSON.stringify({ modules: selected }),
        })
            .then(async (res) => {
                if (!res.ok) throw new Error('save_failed');
                const data = await res.json().catch(() => null);
                if (data && Array.isArray(data.modules)) {
                    setClientModulesLocal(data.modules as ClientModule[]);
                } else {
                    setClientModulesLocal(selected);
                }
                setNotice('Đã lưu lựa chọn module. Để kích hoạt, hãy bấm "Mua ngay" ở module tương ứng.');
            })
            .catch(() => {
                setClientModulesLocal(selected);
                setNotice('Không lưu được lên server. Đã lưu cục bộ trên trình duyệt.');
            })
            .finally(() => {
                setIsSaving(false);
            });
    }, [selected]);

    const createOrder = React.useCallback(async (moduleKey: ClientModule) => {
        const accessToken = (typeof window !== 'undefined' ? localStorage.getItem('auth_access_token') || '' : '').trim();
        if (!accessToken) {
            setNotice('Bạn cần đăng nhập trước khi tạo đơn hàng.');
            return;
        }
        setIsCreatingOrder(moduleKey);
        try {
            const res = await fetch('/api/user/module-orders', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${accessToken}`,
                },
                credentials: 'include',
                body: JSON.stringify({ module: moduleKey }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.order) {
                throw new Error(String(data?.error || 'Không tạo được đơn hàng'));
            }
            setCheckoutOrder(data.order);
            setNotice(`Đã tạo đơn ${data.order.orderCode}. Vui lòng quét QR để thanh toán.`);
            setRecentOrders((prev) => [data.order, ...prev.filter((x) => x._id !== data.order._id)].slice(0, 6));
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Không tạo được đơn hàng';
            if (typeof window !== 'undefined') window.alert(msg);
        } finally {
            setIsCreatingOrder('');
        }
    }, []);

    return (
        <div className="min-h-screen overflow-y-auto bg-[#0a0f14] px-4 py-14 text-white">
            <div className="mx-auto max-w-4xl">
                <h1 className="text-3xl font-black tracking-tight md:text-4xl">Mua module</h1>
                <p className="mt-3 text-sm text-slate-300 md:text-base">
                    Chọn module cần dùng và bấm Mua ngay để lấy mã thanh toán QR.
                </p>
                {notice ? (
                    <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                        {notice}
                    </div>
                ) : null}

                <div className="mt-8 grid gap-4">
                    {MODULES.map((item) => {
                        const active = selected.includes(item.key);
                        return (
                            <div
                                key={item.key}
                                role="button"
                                tabIndex={0}
                                onClick={() => toggleModule(item.key)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        toggleModule(item.key);
                                    }
                                }}
                                className={cn(
                                    'w-full rounded-2xl border p-5 text-left transition',
                                    active
                                        ? 'border-emerald-500/60 bg-emerald-500/10'
                                        : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                                )}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-base font-bold">{item.title}</p>
                                        <p className="mt-1 text-sm text-slate-300">{item.desc}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-semibold text-emerald-300">{item.price}</span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                void createOrder(item.key);
                                            }}
                                            className="h-8 rounded-md bg-emerald-500 px-3 text-xs font-bold text-black hover:bg-emerald-400 disabled:opacity-60"
                                            disabled={isCreatingOrder === item.key}
                                        >
                                            {isCreatingOrder === item.key ? 'Đang tạo...' : 'Mua ngay'}
                                        </button>
                                        <span
                                            className={cn(
                                                'flex h-6 w-6 items-center justify-center rounded-full border',
                                                active ? 'border-emerald-500 bg-emerald-500 text-black' : 'border-white/20 text-transparent'
                                            )}
                                        >
                                            <Check size={14} />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                    <p className="text-sm text-slate-300">Da chon: {selected.length} module</p>
                    <p className="mt-1 text-xs text-slate-400">
                        {isAuthed
                            ? 'Nhấn Lưu cấu hình để cập nhật quyền ngay trên trình duyệt.'
                            : 'Bạn chưa đăng nhập. Cấu hình local vẫn được lưu để demo.'}
                    </p>
                    <Button disabled={isSaving} onClick={saveSelection} className="mt-4 bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-70">
                        {isSaving ? 'Đang lưu...' : 'Lưu lựa chọn (không thanh toán)'}
                    </Button>
                </div>

                {checkoutOrder && (
                    <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                        <h2 className="text-lg font-black">Thanh toán đơn hàng</h2>
                        <p className="mt-1 text-xs text-slate-300">Mã đơn: <span className="font-mono font-bold text-emerald-300">{checkoutOrder.orderCode}</span></p>
                        <p className="mt-1 text-xs text-slate-300">Module: <span className="font-semibold">{checkoutOrder.module}</span></p>
                        <p className="mt-1 text-xs text-slate-300">Số tiền: <span className="font-semibold">{checkoutOrder.amount} {checkoutOrder.currency}</span></p>
                        <p className="mt-1 text-xs text-slate-300">Nội dung CK: <span className="font-mono text-emerald-300">{checkoutOrder.transferContent}</span></p>
                        <p className="mt-1 text-xs text-slate-300">Ngân hàng: {checkoutOrder.bankCode} - {checkoutOrder.bankAccountNo} - {checkoutOrder.bankAccountName}</p>
                        {checkoutOrder.qrUrl ? (
                            <div className="mt-3">
                                <img src={checkoutOrder.qrUrl} alt="QR thanh toán" className="h-56 w-56 rounded-md border border-white/10 bg-white p-2" />
                            </div>
                        ) : null}
                        <p className="mt-3 text-xs text-amber-300">
                            Sau khi chuyển khoản, trạng thái đơn sẽ chuyển từ <b>pending</b> sang <b>paid</b> khi webhook/admin xác nhận.
                        </p>
                    </div>
                )}

                <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                    <h2 className="text-lg font-black">Đơn hàng gần đây</h2>
                    <div className="mt-3 space-y-2">
                        {recentOrders.length === 0 ? (
                            <p className="text-xs text-slate-400">Chưa có đơn hàng.</p>
                        ) : recentOrders.map((o) => (
                            <div key={o._id} className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2 text-xs">
                                <div>
                                    <p className="font-semibold">{o.module} · <span className="font-mono">{o.orderCode}</span></p>
                                    <p className="text-slate-400">{o.amount} {o.currency}</p>
                                </div>
                                <span className={cn(
                                    'rounded px-2 py-1 font-bold uppercase',
                                    o.status === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : o.status === 'pending' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-500/20 text-slate-300'
                                )}>
                                    {o.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
