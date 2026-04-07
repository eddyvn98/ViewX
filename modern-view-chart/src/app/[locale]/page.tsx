'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ArrowRight, BellRing, Bot, ChartCandlestick, ShieldCheck, Wallet } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { LanguageSwitcher } from '@/features/landing/components/LanguageSwitcher';
import dynamic from 'next/dynamic';

const Workflow = dynamic(() => import('@/features/landing/components/Workflow').then((m) => ({ default: m.Workflow })), { ssr: true });
const Features = dynamic(() => import('@/features/landing/components/Features').then((m) => ({ default: m.Features })), { ssr: true });
const UserPlans = dynamic(() => import('@/features/landing/components/UserPlans').then((m) => ({ default: m.UserPlans })), { ssr: true });

export default function LandingPage() {
    const locale = useLocale();
    const navT = useTranslations('Navigation');
    const isVi = locale === 'vi';
    const docsLabel = isVi ? 'Tài liệu' : 'Docs';

    return (
        <div className="h-screen overflow-y-auto bg-gradient-to-b from-slate-50 via-white to-sky-50/30 text-slate-900 [font-family:Outfit,Segoe_UI,Arial,sans-serif]">
            <header className="sticky top-0 z-50 border-b border-sky-100 bg-white/70 backdrop-blur-xl transition-all">
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-3 md:px-8">
                    <nav className="flex w-full items-center justify-between" aria-label="Primary navigation">
                        <Logo showText size={28} />
                        <div className="flex items-center gap-2 md:gap-4">
                            <LanguageSwitcher />
                            <Link
                                href="/chart"
                                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-black text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-primary/30"
                            >
                                {isVi ? 'Mở app' : 'Launch App'}
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </Link>
                        </div>
                    </nav>
                </div>
            </header>

            <main className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-5 py-10 md:gap-24 md:px-8 md:py-16">
                <section className="relative overflow-hidden rounded-[2rem] border border-sky-100 bg-white/90 px-6 py-12 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)] md:px-12 md:py-16">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.12),_transparent_24%)]" />
                    <div className="relative z-10 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
                                {isVi ? 'Module-first experience' : 'Module-first experience'}
                                <Wallet className="h-4 w-4" />
                            </div>
                            <div className="space-y-4">
                                <h1 className="max-w-2xl text-4xl font-black tracking-tight text-slate-950 md:text-6xl">
                                    {isVi ? 'Chọn module, không chọn gói cũ.' : 'Pick modules, not old bundles.'}
                                </h1>
                                <p className="max-w-xl text-lg leading-8 text-slate-600">
                                    {isVi
                                        ? 'Vivutrade giờ đi theo luồng module rõ ràng: Your MT5 để kết nối MT5 local, Binance Demo để test nhanh, và Telegram Notify để theo dõi alert.'
                                        : 'Vivutrade now follows a clear module flow: Your MT5 for local MT5 connection, Binance Demo for fast testing, and Telegram Notify for alerts.'}
                                </p>
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <Link
                                    href="/pricing"
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 font-black text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5"
                                >
                                    {isVi ? 'Xem module' : 'View modules'}
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                                <Link
                                    href="/your-mt5-guide"
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 font-black text-slate-950 transition hover:bg-slate-50"
                                >
                                    {isVi ? 'Hướng dẫn Your MT5' : 'Your MT5 guide'}
                                </Link>
                            </div>
                            <div className="grid gap-3 pt-2 sm:grid-cols-3">
                                {[
                                    { icon: Wallet, label: 'Your MT5' },
                                    { icon: ChartCandlestick, label: 'Binance Demo' },
                                    { icon: BellRing, label: 'Telegram Notify' },
                                ].map(({ icon: Icon, label }) => (
                                    <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                                        <Icon className="h-4 w-4 text-emerald-500" />
                                        <span>{label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="relative rounded-[1.75rem] border border-slate-200 bg-slate-950 px-6 py-6 text-white shadow-2xl">
                            <div className="absolute inset-0 rounded-[1.75rem] bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.14),_transparent_24%)]" />
                            <div className="relative z-10 space-y-4">
                                <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-200">
                                    {isVi ? 'Flow mở module' : 'Open flow'}
                                </p>
                                <div className="space-y-3">
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <div className="font-bold text-white">{isVi ? '1. Mua module' : '1. Buy module'}</div>
                                        <p className="mt-1 text-sm text-slate-300">{isVi ? 'Chọn đúng module theo nhu cầu.' : 'Pick the module that matches your need.'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <div className="font-bold text-white">{isVi ? '2. Cài app native' : '2. Install native app'}</div>
                                        <p className="mt-1 text-sm text-slate-300">{isVi ? 'Cài bridge/agent local trên Windows.' : 'Install the local bridge/agent on Windows.'}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <div className="font-bold text-white">{isVi ? '3. Mở khóa terminal' : '3. Unlock terminal'}</div>
                                        <p className="mt-1 text-sm text-slate-300">{isVi ? 'Consent xong thì quay lại chart.' : 'Complete consent, then return to chart.'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <UserPlans />
                <Workflow />
                <Features />

                <section className="relative overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 px-8 py-16 text-center shadow-2xl md:px-16 md:py-24">
                    <div className="absolute inset-0 bg-[url('/brand/grid.svg')] bg-center opacity-10 mix-blend-overlay" />
                    <div className="relative z-10 mx-auto max-w-3xl space-y-8">
                        <h2 className="text-3xl font-black text-white md:text-5xl">{isVi ? 'Bắt đầu đúng module' : 'Start with the right module'}</h2>
                        <p className="text-lg leading-relaxed text-slate-300 md:text-xl">
                            {isVi
                                ? 'Your MT5 là luồng kết nối MT5 local và mở khóa terminal. Chọn module đúng trước, rồi mới vào guide và activation.'
                                : 'Your MT5 is the local MT5 connection and terminal unlock flow. Pick the right module first, then go to guide and activation.'}
                        </p>
                        <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
                            <Link
                                href="/pricing"
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-black text-slate-900 transition-all hover:scale-105 hover:bg-sky-50 sm:w-auto"
                            >
                                {isVi ? 'Xem pricing' : 'View pricing'}
                                <ArrowRight className="h-5 w-5" />
                            </Link>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-6 pt-8 text-sm font-medium text-slate-400">
                            <span className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                                {isVi ? 'Không cần card' : 'No credit card required'}
                            </span>
                            <span className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-blue-400" />
                                {isVi ? 'Có AI Strategy Builder' : 'AI Strategy Builder included'}
                            </span>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t border-slate-200 bg-white px-5 py-12 md:px-8">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 lg:flex-row lg:justify-between">
                    <div className="max-w-md space-y-4">
                        <Logo showText size={32} />
                        <p className="text-sm leading-relaxed text-slate-500">
                            {isVi
                                ? 'Vivutrade tập trung vào luồng module rõ ràng: Your MT5, Binance Demo và Telegram Notify. Không còn là một bộ gói lẫn lộn.'
                                : 'Vivutrade focuses on a clear module flow: Your MT5, Binance Demo, and Telegram Notify. No more mixed bundles.'}
                        </p>
                    </div>
                    <div className="flex flex-col gap-4 lg:text-right">
                        <div className="flex flex-wrap gap-6 text-sm font-semibold text-slate-700 lg:justify-end">
                            <Link className="transition-colors hover:text-primary" href="/chart">{navT('chart')}</Link>
                            <Link className="transition-colors hover:text-primary" href="/strategy/dashboard">{navT('dashboard')}</Link>
                        </div>
                        <p className="text-xs text-slate-400">
                            &copy; {new Date().getFullYear()} Vivutrade. All rights reserved.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-4 text-xs font-medium text-slate-400 lg:justify-end">
                            <span className="text-slate-500">{docsLabel}:</span>
                            <Link className="hover:text-slate-700" href="/faq">FAQ</Link>
                            <Link className="hover:text-slate-700" href="/about">About</Link>
                            <Link className="hover:text-slate-700" href="/methodology">Methodology</Link>
                            <Link className="hover:text-slate-700" href="/contact">Contact</Link>
                            <Link className="hover:text-slate-700" href="/terms">Terms</Link>
                            <Link className="hover:text-slate-700" href="/privacy">Privacy</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
