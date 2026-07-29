'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ArrowRight, BellRing, Bot, ChartCandlestick, ShieldCheck, Wallet } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { LanguageSwitcher } from '@/features/landing/components/LanguageSwitcher';
import dynamic from 'next/dynamic';

const Workflow = dynamic(() => import('@/features/landing/components/Workflow').then((m) => ({ default: m.Workflow })), { ssr: true });
const Features = dynamic(() => import('@/features/landing/components/Features').then((m) => ({ default: m.Features })), { ssr: true });

export default function LandingPage() {
    const locale = useLocale();
    const navT = useTranslations('Navigation');
    const isVi = locale === 'vi';
    const docsLabel = isVi ? 'Tài liệu' : 'Docs';

    return (
        <div className="h-screen overflow-y-auto bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.08),_transparent_40%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.05),_transparent_40%)] bg-slate-50 text-slate-900 font-outfit">
            <header className="fixed top-4 left-1/2 z-50 w-[calc(100%-2.5rem)] max-w-7xl -translate-x-1/2 rounded-2xl border border-white/40 bg-white/60 backdrop-blur-2xl transition-all shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
                <div className="mx-auto flex items-center justify-between px-6 py-3">
                    <Logo showText size={26} />
                    <div className="flex items-center gap-3">
                        <LanguageSwitcher />
                        <Link
                            href="/chart"
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow-xl shadow-slate-950/20 transition-all hover:-translate-y-0.5 hover:shadow-slate-950/30 active:scale-95"
                        >
                            {isVi ? 'Mở app' : 'Launch App'}
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    </div>
                </div>
            </header>

            <main className="mx-auto flex w-full max-w-7xl flex-col gap-24 px-5 pt-32 pb-16 md:gap-32 md:px-8">
                <section className="relative overflow-hidden rounded-[2.5rem] border border-white/50 bg-white/40 px-6 py-16 shadow-[0_40px_100px_-20px_rgba(15,23,42,0.08)] backdrop-blur-sm md:px-12 md:py-24">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,_rgba(59,130,246,0.08),_transparent_35%),radial-gradient(circle_at_100%_100%,_rgba(16,185,129,0.08),_transparent_35%)]" />
                    <div className="relative z-10 grid gap-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                        <div className="space-y-8">
                            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700 backdrop-blur-md">
                                {isVi ? 'Hệ sinh thái tiện ích Trading AI' : 'AI Trading Utility Ecosystem'}
                                <Bot className="h-3.5 w-3.5" />
                            </div>
                            <div className="space-y-6">
                                <h1 className="max-w-2xl text-5xl font-black tracking-tight text-slate-950 md:text-7xl lg:leading-[1.1]">
                                    {isVi ? 'Nâng cấp giao diện MT5 cũ kỹ bằng sức mạnh AI.' : 'Upgrade Legacy MT5 with the Power of AI.'}
                                </h1>
                                <p className="max-w-xl text-lg leading-relaxed text-slate-600 md:text-xl">
                                    {isVi
                                        ? 'Chọn các tiện ích bạn cần từ hệ sinh thái Vivutrade và bắt đầu sử dụng ngay trên trình duyệt. Kết nối dữ liệu sàn chỉ là một trong nhiều tính năng mạnh mẽ chúng tôi cung cấp.'
                                        : 'Pick the utilities you need from Vivutrade ecosystem and start trading on your browser. Seamless broker connection is just one of many powerful features we provide.'}
                                </p>
                            </div>
                            <div className="flex flex-col gap-4 sm:flex-row">
                                <Link
                                    href="/pricing"
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-8 py-4 font-black text-white shadow-2xl shadow-slate-950/20 transition hover:-translate-y-1 hover:shadow-slate-950/40 active:scale-95"
                                >
                                    {isVi ? 'Sử dụng ngay' : 'Launch Now'}
                                    <ArrowRight className="h-5 w-5" />
                                </Link>
                                <Link
                                    href="/modules"
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white/80 px-8 py-4 font-black text-emerald-800 backdrop-blur-md transition hover:-translate-y-1 hover:bg-emerald-50 shadow-sm"
                                >
                                    {isVi ? 'Kho tiện ích' : 'Utility Hub'}
                                </Link>
                            </div>
                            <div className="grid gap-4 pt-4 sm:grid-cols-3">
                                {[
                                    { icon: Wallet, label: 'Your MT5', color: 'text-blue-500' },
                                    { icon: ChartCandlestick, label: 'Binance Demo', color: 'text-emerald-500' },
                                    { icon: BellRing, label: 'Telegram Notify', color: 'text-amber-500' },
                                ].map(({ icon: Icon, label, color }) => (
                                    <div key={label} className="group flex items-center gap-3 rounded-2xl border border-white bg-white/40 p-4 text-sm font-bold text-slate-700 shadow-[0_4px_20px_rgba(0,0,0,0.02)] backdrop-blur-md transition-all hover:shadow-lg hover:bg-white/60">
                                        <div className={`rounded-xl bg-white p-2 shadow-inner ${color}`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <span>{label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="relative group">
                            <div className="absolute -inset-4 bg-gradient-to-tr from-blue-100 to-emerald-100 blur-[50px] opacity-30 group-hover:opacity-50 transition-opacity" />
                            <div className="relative overflow-hidden rounded-[2rem] border border-white/50 bg-white/20 p-8 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
                                <div className="space-y-6">
                                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">
                                        {isVi ? 'Hành trình mở khóa' : 'Unlock Journey'}
                                    </p>
                                    <div className="space-y-4">
                                        {[
                                            { step: '1', title: isVi ? 'Chọn Tiện ích' : 'Pick Utility', desc: isVi ? 'Kích hoạt công cụ cần thiết.' : 'Enable necessary tools.' },
                                            { step: '2', title: isVi ? 'Vào Web Terminal' : 'Open Web Terminal', desc: isVi ? 'Trải nghiệm ngay trên web.' : 'Start on your browser.' },
                                            { step: '3', title: isVi ? 'Sử dụng AI' : 'Use AI Power', desc: isVi ? 'Giao dịch thông minh hơn.' : 'Trade smarter with AI.' },
                                        ].map((item) => (
                                            <div key={item.step} className="group/item relative rounded-2xl border border-white bg-white/40 p-5 transition-all hover:bg-white/80 hover:shadow-md">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white shadow-lg">
                                                        {item.step}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-950">{item.title}</div>
                                                        <p className="text-xs text-slate-500">{item.desc}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <Workflow />
                <Features />

                <section className="relative overflow-hidden rounded-[3rem] bg-slate-950 px-8 py-20 text-center shadow-[0_50px_100px_-20px_rgba(15,23,42,0.3)] md:px-16 md:py-32">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.15),_transparent_50%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.15),_transparent_50%)]" />
                    <div className="relative z-10 mx-auto max-w-4xl space-y-10">
                        <h2 className="text-4xl font-black text-white md:text-6xl lg:leading-tight">
                            {isVi ? 'Sẵn sàng nâng tầm giao dịch?' : 'Ready to Level Up Your Trading?'}
                        </h2>
                        <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-300 md:text-xl">
                            {isVi
                                ? 'Tham gia cùng cộng đồng trader hiện đại, tận dụng sức mạnh AI để đưa ra những quyết định chính xác và hiệu quả hơn bao giờ hết.'
                                : 'Join the modern trading community and leverage the power of AI to make more precise and effective decisions than ever before.'}
                        </p>
                        <div className="flex flex-col items-center justify-center gap-6 pt-6 sm:flex-row">
                            <Link
                                href="/pricing"
                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-10 py-5 text-lg font-black text-slate-950 transition-all hover:scale-105 hover:bg-sky-50 shadow-xl sm:w-auto"
                            >
                                {isVi ? 'Xem bảng giá' : 'View Pricing'}
                                <ArrowRight className="h-6 w-6" />
                            </Link>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-8 pt-10 text-xs font-bold uppercase tracking-widest text-slate-500">
                            <span className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                                {isVi ? 'Bảo mật' : 'Secure'}
                            </span>
                            <span className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-blue-400" />
                                {isVi ? 'AI Chiến thuật' : 'AI Strategy'}
                            </span>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t border-slate-200 bg-white/50 px-5 py-20 backdrop-blur-md md:px-8">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-16 lg:flex-row lg:justify-between">
                    <div className="max-w-md space-y-6">
                        <Logo showText size={32} />
                        <p className="text-sm leading-relaxed text-slate-500">
                            {isVi
                                ? 'Hệ sinh thái tiện ích Trading AI, nâng cấp giao diện MT5 cũ kỹ với trải nghiệm web hiện đại và mượt mà.'
                                : 'AI Trading utility ecosystem, upgrading legacy MT5 with a modern and seamless web experience.'}
                        </p>
                    </div>
                    <div className="flex flex-col gap-6 lg:text-right">
                        <div className="flex flex-wrap gap-8 text-sm font-bold text-slate-900 lg:justify-end">
                            <Link className="transition-all hover:text-primary hover:-translate-y-0.5" href="/chart">{navT('chart')}</Link>
                            <Link className="transition-all hover:text-primary hover:-translate-y-0.5" href="/modules">{isVi ? 'Module hub' : 'Module hub'}</Link>
                            <Link className="transition-all hover:text-primary hover:-translate-y-0.5" href="/strategy/dashboard">{navT('dashboard')}</Link>
                        </div>
                        <div className="space-y-4">
                            <p className="text-xs font-medium text-slate-400">
                                &copy; {new Date().getFullYear()} Vivutrade. Precision Engineering.
                            </p>
                            <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-400 lg:justify-end uppercase tracking-widest leading-loose">
                                <Link className="hover:text-slate-900 transition-colors" href="/faq">FAQ</Link>
                                <span className="text-slate-200">/</span>
                                <Link className="hover:text-slate-900 transition-colors" href="/about">About</Link>
                                <span className="text-slate-200">/</span>
                                <Link className="hover:text-slate-900 transition-colors" href="/methodology">Methodology</Link>
                                <span className="text-slate-200">/</span>
                                <Link className="hover:text-slate-900 transition-colors" href="/contact">Contact</Link>
                                <span className="text-slate-200">/</span>
                                <Link className="hover:text-slate-900 transition-colors" href="/terms">Terms</Link>
                                <span className="text-slate-200">/</span>
                                <Link className="hover:text-slate-900 transition-colors" href="/privacy">Privacy</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
