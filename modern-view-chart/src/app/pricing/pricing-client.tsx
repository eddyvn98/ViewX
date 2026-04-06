'use client';

import React from 'react';
import Link from 'next/link';
import { getClientEntitlements } from '@/lib/auth/entitlements';
import { cn } from '@/lib/utils';
import { ArrowRight, BellRing, Bot, ChartCandlestick, Check, Layers3, Sparkles, Wallet } from 'lucide-react';

type ModuleCard = {
    key: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    accent: string;
    bullets: string[];
    ctaLabel: string;
};

const MODULES: ModuleCard[] = [
    {
        key: 'your-mt5',
        title: 'Your MT5',
        description: 'Kết nối MT5 local của user, mở khóa terminal, positions, orders và lịch sử giao dịch trên Vivutrade.',
        icon: <Wallet className="h-5 w-5" />,
        accent: 'from-emerald-500/20 to-cyan-500/10',
        bullets: ['Bridge local cho MT5 của user', 'Terminal web + native desktop shell', 'Consent flow rõ ràng trước khi mở khóa'],
        ctaLabel: 'Mua module Your MT5',
    },
    {
        key: 'binance-demo',
        title: 'Binance Demo',
        description: 'Luồng demo để test chart, signals và dashboard mà không cần bridge MT5.',
        icon: <ChartCandlestick className="h-5 w-5" />,
        accent: 'from-sky-500/20 to-blue-500/10',
        bullets: ['Kết nối nhanh không cần cài MT5', 'Dùng để test UI, chart và alert', 'Phù hợp onboarding và QA'],
        ctaLabel: 'Vào chart demo',
    },
    {
        key: 'telegram',
        title: 'Telegram Notify',
        description: 'Nhận alert và tín hiệu qua Telegram để theo dõi nhanh hơn trên mobile hoặc desktop.',
        icon: <BellRing className="h-5 w-5" />,
        accent: 'from-amber-500/20 to-orange-500/10',
        bullets: ['Thông báo giá và tín hiệu', 'Bám sát workflow giao dịch', 'Kết nối nhẹ, dễ dùng'],
        ctaLabel: 'Xem activation',
    },
];

export default function PricingClient() {
    const [hasYourMt5Module, setHasYourMt5Module] = React.useState(false);

    React.useEffect(() => {
        const syncEntitlements = () => setHasYourMt5Module(getClientEntitlements().hasYourMt5);
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

    return (
        <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-[-10%] top-[-10%] h-[36rem] w-[36rem] rounded-full bg-emerald-500/10 blur-[140px]" />
                <div className="absolute right-[-8%] top-[18%] h-[30rem] w-[30rem] rounded-full bg-sky-500/10 blur-[140px]" />
                <div className="absolute bottom-[-12%] left-[25%] h-[28rem] w-[28rem] rounded-full bg-indigo-500/10 blur-[150px]" />
            </div>

            <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-16 px-4 py-16 md:px-8 md:py-24">
                <section className="mx-auto max-w-4xl text-center">
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.28em] text-emerald-200">
                        Module-first pricing
                        <Sparkles className="h-4 w-4" />
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-white md:text-6xl">Chọn đúng module, không theo gói cũ.</h1>
                    <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
                        Trang này chỉ nói về module và trải nghiệm thực tế của user: Your MT5, Binance Demo, Telegram Notify. Flow
                        được tách theo entitlement để user biết phải đi đâu tiếp theo.
                    </p>
                    <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        {hasYourMt5Module ? (
                            <>
                                <Link
                                    href="/your-mt5-guide"
                                    className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-6 font-black text-slate-950 shadow-lg shadow-white/10 transition hover:bg-slate-100"
                                >
                                    Mở guide Your MT5
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                                <Link
                                    href="/mt5-activation"
                                    className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 font-black text-white transition hover:bg-white/10"
                                >
                                    MT5 activation
                                </Link>
                            </>
                        ) : (
                            <>
                                <a
                                    href="#your-mt5"
                                    className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-6 font-black text-slate-950 shadow-lg shadow-white/10 transition hover:bg-slate-100"
                                >
                                    Mua module Your MT5
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </a>
                                <a
                                    href="#modules"
                                    className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 font-black text-white transition hover:bg-white/10"
                                >
                                    Xem modules
                                </a>
                            </>
                        )}
                    </div>
                </section>

                <section id="modules" className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {MODULES.map((module) => {
                        const isYourMt5 = module.key === 'your-mt5';
                        const hasAccess = isYourMt5 && hasYourMt5Module;

                        return (
                            <article
                                key={module.key}
                                id={isYourMt5 ? 'your-mt5' : undefined}
                                className={cn(
                                    'group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl transition-transform duration-300 hover:-translate-y-1',
                                    hasAccess && 'border-emerald-500/25 bg-emerald-500/10'
                                )}
                            >
                                <div className={cn('absolute inset-0 bg-gradient-to-br opacity-70', module.accent)} />
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/50 text-white">
                                            {module.icon}
                                        </div>
                                        {isYourMt5 ? (
                                            <span
                                                className={cn(
                                                    'rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em]',
                                                    hasAccess
                                                        ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
                                                        : 'border-white/10 bg-white/5 text-slate-200'
                                                )}
                                            >
                                                {hasAccess ? 'Đã mua' : 'Cần mua'}
                                            </span>
                                        ) : null}
                                    </div>

                                    <h2 className="mt-5 text-2xl font-black tracking-tight">{module.title}</h2>
                                    <p className="mt-3 text-sm leading-7 text-slate-300">{module.description}</p>

                                    <ul className="mt-5 space-y-3 text-sm text-slate-100">
                                        {module.bullets.map((bullet) => (
                                            <li key={bullet} className="flex items-start gap-3">
                                                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-emerald-300">
                                                    <Check className="h-3.5 w-3.5" />
                                                </span>
                                                <span>{bullet}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <div className={cn('mt-6', hasAccess ? 'grid gap-3 sm:grid-cols-2' : '')}>
                                        {hasAccess ? (
                                            <>
                                                <Link
                                                    href="/your-mt5-guide"
                                                    className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-emerald-500 font-black text-slate-950 transition hover:bg-emerald-400"
                                                >
                                                    Mở guide Your MT5
                                                    <ArrowRight className="ml-2 h-4 w-4" />
                                                </Link>
                                                <Link
                                                    href="/mt5-activation"
                                                    className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 font-black text-white transition hover:bg-white/10"
                                                >
                                                    MT5 activation
                                                </Link>
                                            </>
                                        ) : module.key === 'binance-demo' ? (
                                            <Link
                                                href="/chart"
                                                className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 font-black text-white transition hover:bg-white/10"
                                            >
                                                {module.ctaLabel}
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Link>
                                        ) : module.key === 'telegram' ? (
                                            <Link
                                                href="/mt5-activation"
                                                className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 font-black text-white transition hover:bg-white/10"
                                            >
                                                {module.ctaLabel}
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Link>
                                        ) : (
                                            <a
                                                href="#your-mt5"
                                                className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 font-black text-white transition hover:bg-white/10"
                                            >
                                                {module.ctaLabel}
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </section>

                <section className="grid grid-cols-1 gap-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 md:grid-cols-3">
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.24em] text-emerald-200">
                            <Layers3 className="h-4 w-4" />
                            Module flow
                        </div>
                        <p className="mt-3 text-sm leading-7 text-slate-300">
                            User mua module, cài native app, mở bridge, rồi mới đi vào activation hoặc guide. Đây là flow thực tế,
                            không phải plan marketing.
                        </p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.24em] text-sky-200">
                            <Bot className="h-4 w-4" />
                            Telegram support
                        </div>
                        <p className="mt-3 text-sm leading-7 text-slate-300">
                            Telegram Notify dùng cho alert, tín hiệu và nhắc việc. Phù hợp khi user đã có flow giao dịch và cần
                            theo dõi nhanh.
                        </p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.24em] text-amber-200">
                            <Sparkles className="h-4 w-4" />
                            No legacy plans
                        </div>
                        <p className="mt-3 text-sm leading-7 text-slate-300">
                            Trang này cố ý không dùng tên gói cũ để tránh làm user hiểu lẫn giữa plan marketing và module hiện tại.
                        </p>
                    </div>
                </section>
            </main>
        </div>
    );
}
