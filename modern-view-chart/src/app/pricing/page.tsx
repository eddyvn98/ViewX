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
    { key: 'your_mt5', title: 'Your MT5 (MT5 cua ban)', desc: 'Ket noi MT5 ca nhan de xem chart va giao dich tren web/app.', price: '30k/thang' },
    { key: 'binance_trade', title: 'Giao dich Binance Demo', desc: 'Mo phong giao dich Binance tren nen web.', price: '20k/thang' },
    { key: 'telegram_notify', title: 'Thong bao Telegram', desc: 'Nhan canh bao gia/tin hieu qua Telegram.', price: '15k/thang' },
    { key: 'telegram_control', title: 'Dieu khien qua Telegram', desc: 'Ra lenh nhanh qua Telegram bot.', price: '20k/thang' },
    { key: 'ai_assistant', title: 'AI Assistant', desc: 'Phan tich va ho tro quyet dinh voi AI.', price: '70k/thang' },
];

export default function PricingPage() {
    const [selected, setSelected] = React.useState<ClientModule[]>([]);
    const [isAuthed, setIsAuthed] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);

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
    }, []);

    const toggleModule = React.useCallback((key: ClientModule) => {
        setSelected((prev) => (prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]));
    }, []);

    const saveSelection = React.useCallback(() => {
        setIsSaving(true);
        const accessToken = (typeof window !== 'undefined' ? localStorage.getItem('auth_access_token') || '' : '').trim();
        if (!accessToken) {
            setClientModulesLocal(selected);
            if (typeof window !== 'undefined') window.location.href = '/vi/chart';
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
                if (typeof window !== 'undefined') window.location.href = '/vi/chart';
            })
            .catch(() => {
                setClientModulesLocal(selected);
                if (typeof window !== 'undefined') window.location.href = '/vi/chart';
            })
            .finally(() => {
                setIsSaving(false);
            });
    }, [selected]);

    return (
        <div className="min-h-screen bg-[#0a0f14] px-4 py-14 text-white">
            <div className="mx-auto max-w-4xl">
                <h1 className="text-3xl font-black tracking-tight md:text-4xl">Mua theo module</h1>
                <p className="mt-3 text-sm text-slate-300 md:text-base">
                    Khong con goi Free/Pro/AI. Ban chon dung tinh nang can dung va chi tra theo nhu cau.
                </p>

                <div className="mt-8 grid gap-4">
                    {MODULES.map((item) => {
                        const active = selected.includes(item.key);
                        return (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => toggleModule(item.key)}
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
                            </button>
                        );
                    })}
                </div>

                <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                    <p className="text-sm text-slate-300">Da chon: {selected.length} module</p>
                    <p className="mt-1 text-xs text-slate-400">
                        {isAuthed
                            ? 'Nhan Luu cau hinh de cap nhat quyen ngay tren trinh duyet.'
                            : 'Ban chua dang nhap. Cau hinh local van duoc luu de demo.'}
                    </p>
                    <Button disabled={isSaving} onClick={saveSelection} className="mt-4 bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-70">
                        {isSaving ? 'Dang luu...' : 'Luu cau hinh module'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
