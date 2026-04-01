'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, CheckCircle2, Download } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { ENABLE_NATIVE_APP_DOWNLOAD } from '@/config/feature-flags';
import { startClientProTrialLocal } from '@/lib/auth/entitlements';

interface FeatureSlide {
    id: string;
    title: string;
    description: string;
    videoUrl?: string;
    poster?: string;
    color: string;
}

const PLAN_DATA: Record<string, FeatureSlide[]> = {
    free: [
        { id: 'f1', title: 'KhÃ´ng giá»›i háº¡n cáº£nh bÃ¡o', description: 'Nháº­n cáº£nh bÃ¡o realtime 24/7 qua Web, Desktop vÃ  Telegram.', color: 'bg-slate-900', videoUrl: '/videos/free_b1.mp4', poster: '/images/features/unlimited_alerts_preview.png' },
        { id: 'f2', title: 'Äa biá»ƒu Ä‘á»“ trÃªn má»—i tab', description: 'Má»Ÿ Ä‘á»“ng thá»i nhiá»u biá»ƒu Ä‘á»“ vÃ  Ä‘á»“ng bá»™ khung thá»i gian nhanh.', color: 'bg-slate-800', videoUrl: '/videos/free_b2.mp4', poster: '/images/features/multi_chart_preview.png' },
        { id: 'f3', title: 'KhÃ´ng giá»›i háº¡n chá»‰ bÃ¡o', description: 'Káº¿t há»£p MA, RSI, MACD vÃ  cÃ¡c chá»‰ bÃ¡o khÃ¡c khÃ´ng giá»›i háº¡n.', color: 'bg-slate-900', videoUrl: '/videos/free_b3.mp4', poster: '/images/features/unlimited_indicators_preview.png' },
        { id: 'f4', title: 'Táº¡o chiáº¿n lÆ°á»£c dá»… dÃ ng', description: 'XÃ¢y dá»±ng bá»™ quy táº¯c vÃ o lá»‡nh, TP, SL khÃ´ng cáº§n láº­p trÃ¬nh.', color: 'bg-slate-800', videoUrl: '/videos/free_b4.mp4', poster: '/images/features/strategy_builder_preview.png' },
        { id: 'f5', title: 'Báº£ng tÃ­n hiá»‡u Ä‘á»™c quyá»n', description: 'QuÃ©t nhiá»u mÃ£ giao dá»‹ch trÃªn Ä‘a khung thá»i gian báº±ng matrix.', color: 'bg-slate-900', videoUrl: '/videos/free_b5.mp4', poster: '/images/features/signal_matrix_preview.png' },
    ],
    pro: [
        { id: 'p1', title: 'Káº¿t ná»‘i MT5 Extension', description: 'Äá»“ng bá»™ dá»¯ liá»‡u MT5 local vÃ o giao diá»‡n web.', color: 'bg-emerald-900', poster: '/images/features/mt5_extension_preview.png' },
        { id: 'p2', title: 'Äá»“ng bá»™ Symbol vÃ  Data', description: 'Äáº£m báº£o chart vÃ  dá»¯ liá»‡u trÃ¹ng vá»›i broker cá»§a báº¡n.', color: 'bg-emerald-800', poster: '/images/features/symbol_sync_preview.png' },
        { id: 'p3', title: 'Web Terminal Account', description: 'Quáº£n lÃ½ sá»‘ dÆ°, lá»‡nh má»Ÿ, lá»‡nh chá» ngay trÃªn web.', color: 'bg-emerald-900', poster: '/images/features/web_terminal_preview.png' },
        { id: 'p4', title: 'Workflow thao tÃ¡c nhanh', description: 'Tá»‘i Æ°u thao tÃ¡c cho trader cáº§n tá»‘c Ä‘á»™ cao.', color: 'bg-emerald-800', poster: '/images/features/fast_workflow_preview.png' },
        { id: 'p5', title: 'HÆ°á»›ng dáº«n cÃ i Ä‘áº·t vÃ  dÃ¹ng thá»­', description: 'Táº£i file EXE, cÃ i Ä‘áº·t, Ä‘Äƒng nháº­p vÃ  dÃ¹ng thá»­ 7 ngÃ y. Háº¿t 7 ngÃ y cáº§n thanh toÃ¡n Ä‘á»ƒ tiáº¿p tá»¥c.', color: 'bg-emerald-900', poster: '/images/features/modern_trading_preview.png' },
    ],
    'pro-plus': [
        { id: 'pp1', title: 'Bao gá»“m toÃ n bá»™ tÃ­nh nÄƒng Pro', description: 'Sá»Ÿ há»¯u Ä‘áº§y Ä‘á»§ tÃ­nh nÄƒng Pro vÃ  má»Ÿ rá»™ng AI.', color: 'bg-amber-900', poster: '/images/features/pro_plus_all_preview.png' },
        { id: 'pp2', title: 'PhÃ¢n tÃ­ch AI chuyÃªn sÃ¢u', description: 'AI phÃ¢n tÃ­ch bá»‘i cáº£nh thá»‹ trÆ°á»ng vÃ  score Ä‘á»™ tin cáº­y.', color: 'bg-amber-800', poster: '/images/features/ai_analysis_preview.png' },
        { id: 'pp3', title: 'Tá»‘i Æ°u Rule vÃ  quáº£n trá»‹ rá»§i ro', description: 'Gá»£i Ã½ cáº£i tiáº¿n chiáº¿n lÆ°á»£c dá»±a trÃªn dá»¯ liá»‡u lá»‹ch sá»­.', color: 'bg-amber-900', poster: '/images/features/ai_optimization_preview.png' },
        { id: 'pp4', title: 'Hiá»‡u suáº¥t theo ngá»¯ cáº£nh', description: 'ÄÃ¡nh giÃ¡ hiá»‡u suáº¥t theo phiÃªn vÃ  Ä‘á»™ biáº¿n Ä‘á»™ng.', color: 'bg-amber-800', poster: '/images/features/ai_performance_preview.png' },
    ],
};

export function PlanVideoScroll({ planKey }: { planKey: string }) {
    const slides = PLAN_DATA[planKey] || [];
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const router = useRouter();

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const index = Math.round(scrollRef.current.scrollTop / window.innerHeight);
        setActiveIndex(Math.max(0, Math.min(index, slides.length - 1)));
    };

    const getBrandColor = () => {
        if (planKey === 'free') return 'bg-slate-600';
        if (planKey === 'pro') return 'bg-emerald-600';
        return 'bg-amber-600';
    };

    const getGlowColor = () => {
        if (planKey === 'free') return 'hsla(215, 16%, 47%, 0.3)';
        if (planKey === 'pro') return 'var(--glow-success)';
        return 'var(--glow-warning)';
    };

    const isFinalSlide = activeIndex === slides.length - 1;
    const isProInstallStep = planKey === 'pro' && isFinalSlide;
    const localePrefix = typeof window !== 'undefined' && window.location.pathname.startsWith('/en') ? '/en' : '/vi';

    const goTo = (path: string) => {
        if (typeof window === 'undefined') return;
        window.location.assign(`${localePrefix}${path}`);
    };

    const handlePrimaryAction = () => {
        if (planKey === 'free') return goTo('/chart');
        if (isProInstallStep) {
            startClientProTrialLocal(7);
            return goTo('/chart');
        }
        if (planKey === 'pro' || planKey === 'pro-plus') return goTo('/pricing');
        return goTo('/chart');
    };

    return (
        <div className="relative h-screen w-full touch-none overflow-hidden selection:bg-primary/30">
            <div className="absolute left-6 top-8 z-50">
                <button
                    onClick={() => router.back()}
                    className="group flex h-12 w-12 items-center justify-center rounded-full bg-background/20 backdrop-blur-xl text-foreground border border-white/10 transition-all hover:bg-background/40 hover:scale-110 active:scale-95 shadow-ethereal"
                >
                    <ArrowLeft className="h-6 w-6 transition-transform group-hover:-translate-x-1" />
                </button>
            </div>

            <div ref={scrollRef} onScroll={handleScroll} className="h-full w-full snap-y snap-mandatory overflow-y-scroll no-scrollbar scroll-smooth">
                {slides.map((slide, index) => (
                    <section key={slide.id} className="relative h-screen w-full snap-start overflow-hidden bg-background">
                        <div className={`absolute inset-0 opacity-20 ${slide.color} transition-colors duration-1000`} />

                        {slide.poster ? (
                            <div className="absolute inset-0 h-full w-full">
                                <Image
                                    src={slide.poster}
                                    alt={slide.title}
                                    fill
                                    sizes="100vw"
                                    className="h-full w-full object-cover opacity-60 contrast-[1.05] brightness-[0.9]"
                                />
                                {slide.videoUrl && (
                                    <video autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover opacity-100">
                                        <source src={slide.videoUrl} type="video/mp4" />
                                    </video>
                                )}
                            </div>
                        ) : null}

                        <div className="absolute inset-x-0 bottom-36 z-20 px-8 text-foreground animate-in fade-in slide-in-from-bottom-12 duration-1000 ease-out">
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`h-[2px] w-8 ${getBrandColor()}`} style={{ boxShadow: `0 0 10px ${getGlowColor()}` }} />
                                <span className="text-xs font-bold tracking-[0.2em] uppercase opacity-70">TÃ­nh nÄƒng {index + 1}</span>
                            </div>

                            <h2 className="text-3xl md:text-5xl font-extrabold mb-5 leading-[1.1] tracking-tight">{slide.title}</h2>
                            <p className="text-base md:text-lg text-muted-foreground/90 max-w-[95%] md:max-w-[75%] font-medium leading-relaxed balance">{slide.description}</p>

                            {isProInstallStep && (
                                <div className="mt-6 max-w-2xl rounded-2xl border border-emerald-300/30 bg-black/45 p-5 backdrop-blur-xl">
                                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">2 lá»±a chá»n cÃ i Ä‘áº·t</p>
                                    <p className="mt-2 text-sm text-slate-100">1. <b>Web + Extension</b>: giá»¯ luá»“ng web hiá»‡n táº¡i, cÃ i extension rá»“i Ä‘Äƒng nháº­p/xÃ¡c nháº­n.</p>
                                    <p className="mt-1 text-sm text-slate-100">2. <b>Desktop App Full</b>: cÃ i 1 file EXE, Ä‘Äƒng nháº­p, web xÃ¡c nháº­n xong lÃ  cháº¡y tray.</p>
                                    <div className="mt-4 flex flex-wrap gap-3">
                                        {ENABLE_NATIVE_APP_DOWNLOAD ? (
                                        <a
                                            href="/downloads/Vivutrade-Desktop-Full-Installer.exe"
                                            download
                                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-white transition-colors hover:bg-emerald-400"
                                        >
                                            <Download className="h-4 w-4" />
                                            Tải file EXE
                                        </a>
                                    ) : (
                                        <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/50 bg-emerald-500/10 px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-emerald-200">
                                            App native đang khóa tải
                                        </span>
                                    )}
                                        <a
                                            href="/downloads/vivutrade-mt5-extension.zip"
                                            download
                                            className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/60 px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-cyan-100 transition-colors hover:bg-cyan-400/10"
                                        >
                                            Táº£i extension
                                            <ArrowRight className="h-4 w-4" />
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() => goTo('/guides/terminal-setup')}
                                            className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-white transition-colors hover:bg-white/10"
                                        >
                                            Xem 2 lá»±a chá»n
                                            <ArrowRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/60 to-transparent z-10" />
                    </section>
                ))}
            </div>

            <div className="absolute right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-4">
                {slides.map((_, i) => (
                    <div
                        key={i}
                        className={`w-1 rounded-full transition-all duration-500 ${i === activeIndex ? `h-10 ${getBrandColor()}` : 'h-2 bg-foreground/10'}`}
                        style={i === activeIndex ? { boxShadow: `0 0 15px ${getGlowColor()}` } : {}}
                    />
                ))}
            </div>

            <div className="absolute bottom-10 inset-x-0 z-50 px-8 flex justify-center">
                <button
                    type="button"
                    onClick={handlePrimaryAction}
                    className={`group relative w-full max-w-md overflow-hidden rounded-2xl ${getBrandColor()} px-8 py-5 text-sm font-bold uppercase tracking-widest text-white transition-all hover:scale-[1.02] active:scale-95`}
                    style={{ boxShadow: `0 0 30px ${getGlowColor()}` }}
                >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                        {isProInstallStep ? 'DÃ¹ng thá»­ Pro 7 ngÃ y' : `Báº¯t Ä‘áº§u vá»›i ${planKey.toUpperCase()}`}
                        <CheckCircle2 className="h-5 w-5" />
                    </span>
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                </button>
            </div>
        </div>
    );
}

