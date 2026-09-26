'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import {
    ArrowRight,
    BellRing,
    Bot,
    Check,
    ChartCandlestick,
    Gauge,
    Layers,
    ShieldCheck,
    Sparkles,
    Wallet,
} from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { LanguageSwitcher } from '@/features/landing/components/LanguageSwitcher';
import { getStoredLastPath } from '@/components/layout/LastRouteTracker';
import { readStoredAccessToken } from '@/lib/auth/session';
import dynamic from 'next/dynamic';

const Workflow = dynamic(() => import('@/features/landing/components/Workflow').then((m) => ({ default: m.Workflow })), { ssr: true });
const Features = dynamic(() => import('@/features/landing/components/Features').then((m) => ({ default: m.Features })), { ssr: true });

const MODULE_CHIPS = [
    { icon: Wallet, label: 'Your MT5', color: 'text-blue-500' },
    { icon: ChartCandlestick, label: 'Binance Demo', color: 'text-emerald-500' },
    { icon: BellRing, label: 'Telegram Notify', color: 'text-amber-500' },
];

const PRICING_TIERS = [
    { key: 'free', accent: 'border-slate-200', cta: '/chart', icon: Sparkles, iconColor: 'text-slate-600', highlighted: false },
    { key: 'pro', accent: 'border-primary', cta: '/pricing', icon: Gauge, iconColor: 'text-primary', highlighted: true },
    { key: 'proPlus', accent: 'border-slate-200', cta: '/pricing', icon: Bot, iconColor: 'text-violet-600', highlighted: false },
] as const;

const BULLET_KEYS = ['b1', 'b2', 'b3', 'b4'] as const;

function ChartMockup() {
    const bars = [38, 52, 44, 61, 49, 70, 58, 76, 65, 84, 72, 90];
    return (
        <div className="relative">
            <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-tr from-blue-200/40 via-transparent to-emerald-200/40 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-white/50 p-6 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.15)] backdrop-blur-2xl">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">XAUUSDm &middot; 1m</span>
                </div>

                <div className="mt-6 flex items-end justify-between gap-4">
                    <div>
                        <div className="text-3xl font-black text-slate-950">4,182.60</div>
                        <div className="mt-1 flex items-center gap-1 text-sm font-bold text-emerald-600">
                            <ArrowRight className="h-3.5 w-3.5 -rotate-45" />
                            +1.86%
                        </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700">
                        <Bot className="h-3.5 w-3.5" />
                        AI Monitor
                    </div>
                </div>

                <div className="mt-6 flex h-32 items-end gap-1.5">
                    {bars.map((height, index) => (
                        <div
                            key={index}
                            className={`flex-1 rounded-t-sm ${index % 3 === 0 ? 'bg-emerald-400/80' : 'bg-blue-400/60'}`}
                            style={{ height: `${height}%` }}
                        />
                    ))}
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3 border-t border-slate-200/70 pt-5">
                    {[
                        { icon: Layers, label: 'Diamond' },
                        { icon: ShieldCheck, label: 'Strategy' },
                        { icon: Gauge, label: 'Matrix' },
                    ].map(({ icon: Icon, label }) => (
                        <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl bg-white/70 py-3 text-slate-600 shadow-sm">
                            <Icon className="h-4 w-4" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function LandingPage() {
    const t = useTranslations('HomePage');
    const navT = useTranslations('Navigation');
    const router = useRouter();

    // Reopening the app/PWA should resume where the user left off (e.g. /chart)
    // instead of always showing the marketing landing page.
    useEffect(() => {
        if (!readStoredAccessToken()) return;
        const lastPath = getStoredLastPath();
        if (lastPath) router.replace(lastPath as Parameters<typeof router.replace>[0]);
    }, [router]);

    return (
        <div className="h-screen overflow-y-auto bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.08),_transparent_40%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.05),_transparent_40%)] bg-slate-50 text-slate-900">
            <header className="fixed top-4 left-1/2 z-50 w-[calc(100%-2.5rem)] max-w-7xl -translate-x-1/2 rounded-2xl border border-white/40 bg-white/60 backdrop-blur-2xl transition-all shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
                <div className="mx-auto flex items-center justify-between gap-2 px-4 py-3 sm:px-6">
                    <Logo showText size={24} className="shrink-0" />
                    <div className="flex items-center gap-2 sm:gap-3">
                        <LanguageSwitcher />
                        <Link
                            href="/chart"
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-950 px-3.5 py-2 text-xs font-bold text-white shadow-xl shadow-slate-950/20 transition-all hover:-translate-y-0.5 hover:shadow-slate-950/30 active:scale-95 sm:gap-2 sm:px-5 sm:py-2.5 sm:text-sm"
                        >
                            {t('openChart')}
                            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                        </Link>
                    </div>
                </div>
            </header>

            <main className="mx-auto flex w-full max-w-7xl flex-col gap-24 px-5 pt-32 pb-24 md:gap-32 md:px-8">
                {/* Hero */}
                <section className="relative overflow-hidden rounded-[2.5rem] border border-white/50 bg-white/40 px-6 py-16 shadow-[0_40px_100px_-20px_rgba(15,23,42,0.08)] backdrop-blur-sm md:px-12 md:py-24">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,_rgba(59,130,246,0.08),_transparent_35%),radial-gradient(circle_at_100%_100%,_rgba(16,185,129,0.08),_transparent_35%)]" />
                    <div className="relative z-10 grid gap-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                        <div className="space-y-8">
                            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700 backdrop-blur-md">
                                {t('hero.badge')}
                                <Wallet className="h-3.5 w-3.5" />
                            </div>
                            <div className="space-y-6">
                                <h1 className="max-w-2xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl md:text-6xl lg:leading-[1.08]">
                                    {t('title')}
                                </h1>
                                <p className="max-w-xl text-lg leading-relaxed text-slate-600 md:text-xl">
                                    {t('description')}
                                </p>
                            </div>
                            <div className="flex flex-col gap-4 sm:flex-row">
                                <Link
                                    href="/chart"
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-8 py-4 font-black text-white shadow-2xl shadow-slate-950/20 transition hover:-translate-y-1 hover:shadow-slate-950/40 active:scale-95"
                                >
                                    {t('openChart')}
                                    <ArrowRight className="h-5 w-5" />
                                </Link>
                                <Link
                                    href="/pricing"
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white/80 px-8 py-4 font-black text-emerald-800 backdrop-blur-md transition hover:-translate-y-1 hover:bg-emerald-50 shadow-sm"
                                >
                                    {t('hero.ctaSecondary')}
                                </Link>
                            </div>
                            <div className="space-y-4 pt-2">
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t('hero.trust')}</p>
                                <div className="flex flex-wrap gap-4">
                                    {MODULE_CHIPS.map(({ icon: Icon, label, color }) => (
                                        <div key={label} className="group flex items-center gap-3 rounded-2xl border border-white bg-white/40 p-4 text-sm font-bold text-slate-700 shadow-[0_4px_20px_rgba(0,0,0,0.02)] backdrop-blur-md transition-all hover:shadow-lg hover:bg-white/60">
                                            <div className={`rounded-xl bg-white p-2 shadow-inner ${color}`}>
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <span>{label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <ChartMockup />
                    </div>
                </section>

                {/* Stats */}
                <section className="grid grid-cols-2 gap-4 rounded-[2rem] border border-white/60 bg-white/50 p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.15)] backdrop-blur-xl sm:grid-cols-4 md:p-8 -mt-16">
                    {(['latency', 'sources', 'indicators', 'aiMonitor'] as const).map((key) => (
                        <div key={key} className="text-center">
                            <div className="text-2xl font-black text-slate-950 md:text-3xl">{t(`stats.${key}.value`)}</div>
                            <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{t(`stats.${key}.label`)}</div>
                        </div>
                    ))}
                </section>

                <Features />
                <Workflow />

                {/* Pricing teaser */}
                <section className="space-y-14">
                    <div className="space-y-4 text-center max-w-2xl mx-auto">
                        <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl">
                            {t('userPlans.title')}
                        </h2>
                        <p className="text-lg leading-relaxed text-slate-600">{t('userPlans.description')}</p>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-3">
                        {PRICING_TIERS.map(({ key, accent, cta, icon: Icon, iconColor, highlighted }) => (
                            <div
                                key={key}
                                className={`relative flex flex-col rounded-[2rem] border ${accent} ${highlighted ? 'bg-slate-950 text-white shadow-2xl shadow-slate-950/30 lg:-translate-y-3' : 'bg-white/60 text-slate-900 shadow-sm'} p-8 backdrop-blur-md transition-all hover:-translate-y-1`}
                            >
                                {highlighted && (
                                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
                                        {t(`userPlans.${key}.badge`)}
                                    </span>
                                )}
                                <div className={`mb-6 inline-flex w-fit rounded-2xl p-3 ${highlighted ? 'bg-white/10' : 'bg-slate-100'} ${highlighted ? 'text-white' : iconColor}`}>
                                    <Icon className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-black">{t(`userPlans.${key}.title`)}</h3>
                                <p className={`mt-2 text-sm ${highlighted ? 'text-slate-300' : 'text-slate-500'}`}>
                                    {t(`userPlans.${key}.subtitle`)}
                                </p>
                                <div className="mt-6 text-2xl font-black">{t(`userPlans.${key}.price`)}</div>

                                <ul className="mt-6 flex-1 space-y-3">
                                    {BULLET_KEYS.map((bulletKey) => (
                                        <li key={bulletKey} className="flex items-start gap-2.5 text-sm">
                                            <Check className={`mt-0.5 h-4 w-4 shrink-0 ${highlighted ? 'text-emerald-400' : 'text-emerald-600'}`} />
                                            <span className={highlighted ? 'text-slate-200' : 'text-slate-600'}>
                                                {t(`userPlans.${key}.${bulletKey}`)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>

                                <Link
                                    href={cta}
                                    className={`mt-8 inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black transition hover:-translate-y-0.5 ${
                                        highlighted
                                            ? 'bg-white text-slate-950 hover:bg-sky-50'
                                            : 'bg-slate-950 text-white hover:shadow-xl'
                                    }`}
                                >
                                    {t(`userPlans.${key}.cta`)}
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>
                        ))}
                    </div>

                    <div className="text-center">
                        <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-black text-primary hover:underline">
                            {t('pricingTeaser.viewAll')}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="relative overflow-hidden rounded-[3rem] bg-slate-950 px-8 py-20 text-center shadow-[0_50px_100px_-20px_rgba(15,23,42,0.3)] md:px-16 md:py-32">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.15),_transparent_50%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.15),_transparent_50%)]" />
                    <div className="relative z-10 mx-auto max-w-4xl space-y-10">
                        <h2 className="text-4xl font-black text-white md:text-6xl lg:leading-tight">
                            {t('finalCta.title')}
                        </h2>
                        <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-300 md:text-xl">
                            {t('finalCta.desc')}
                        </p>
                        <div className="flex flex-col items-center justify-center gap-6 pt-6 sm:flex-row">
                            <Link
                                href="/pricing"
                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-10 py-5 text-lg font-black text-slate-950 transition-all hover:scale-105 hover:bg-sky-50 shadow-xl sm:w-auto"
                            >
                                {t('finalCta.cta')}
                                <ArrowRight className="h-6 w-6" />
                            </Link>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-8 pt-10 text-xs font-bold uppercase tracking-widest text-slate-500">
                            <span className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                                {navT('privacy')}
                            </span>
                            <span className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-blue-400" />
                                {t('featuresSection.title')}
                            </span>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t border-slate-200 bg-white/50 px-5 py-20 backdrop-blur-md md:px-8">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-16 lg:flex-row lg:justify-between">
                    <div className="max-w-md space-y-6">
                        <Logo showText size={32} />
                        <p className="text-sm leading-relaxed text-slate-500">{t('footer.tagline')}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
                        <div className="space-y-4">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">{t('footer.productHeading')}</p>
                            <div className="flex flex-col gap-3 text-sm font-bold text-slate-700">
                                <Link className="transition-colors hover:text-primary" href="/chart">{navT('chart')}</Link>
                                <Link className="transition-colors hover:text-primary" href="/modules">{navT('modules')}</Link>
                                <Link className="transition-colors hover:text-primary" href="/pricing">{navT('pricing')}</Link>
                                <Link className="transition-colors hover:text-primary" href="/strategy/dashboard">{navT('dashboard')}</Link>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">{t('footer.companyHeading')}</p>
                            <div className="flex flex-col gap-3 text-sm font-bold text-slate-700">
                                <Link className="transition-colors hover:text-primary" href="/about">{navT('about')}</Link>
                                <Link className="transition-colors hover:text-primary" href="/methodology">{navT('methodology')}</Link>
                                <Link className="transition-colors hover:text-primary" href="/faq">{navT('faq')}</Link>
                                <Link className="transition-colors hover:text-primary" href="/contact">{navT('contact')}</Link>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">{t('footer.legalHeading')}</p>
                            <div className="flex flex-col gap-3 text-sm font-bold text-slate-700">
                                <Link className="transition-colors hover:text-primary" href="/terms">{navT('terms')}</Link>
                                <Link className="transition-colors hover:text-primary" href="/privacy">{navT('privacy')}</Link>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mx-auto mt-16 flex w-full max-w-7xl flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 text-xs font-medium text-slate-400 sm:flex-row">
                    <p>&copy; {new Date().getFullYear()} {t('footer.copyright')}</p>
                </div>
            </footer>
        </div>
    );
}
