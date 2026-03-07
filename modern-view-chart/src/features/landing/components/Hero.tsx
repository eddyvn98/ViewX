'use client';

import { useTranslations } from 'next-intl';
import Image from "next/image";
import { ArrowRight, Radio } from "lucide-react";
import { Link } from "@/i18n/routing";

export function Hero() {
    const t = useTranslations('HomePage');

    return (
        <section
            className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12"
            aria-labelledby="hero-title"
        >
            <article className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/50 bg-white/60 backdrop-blur-md px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary shadow-sm">
                    <Radio className="h-4 w-4 animate-pulse" />
                    Live MT5 Broker Data
                </div>
                <h1
                    id="hero-title"
                    className="text-4xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-5xl lg:text-6xl"
                    data-ai-label="platform-core-value-proposition"
                >
                    {t('title')}
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-slate-600 md:text-lg">
                    {t('description')}
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-4">
                    <Link
                        href="/chart"
                        aria-label="Vào vùng làm việc biểu đồ thời gian thực"
                        className="group relative inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-black text-primary-foreground overflow-hidden shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/30"
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full transition-transform group-hover:translate-y-0 duration-300" />
                        <span className="relative">{t('openChart')}</span>
                        <ArrowRight className="relative h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </Link>
                    <Link
                        href="/strategy/dashboard"
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white/50 backdrop-blur-sm px-8 py-4 text-base font-bold text-slate-700 transition-all hover:-translate-y-1 hover:border-slate-300 hover:bg-white shadow-sm hover:shadow-md"
                    >
                        AI Dashboard
                    </Link>
                </div>
            </article>

            <Link
                href="/chart"
                aria-label="Hình ảnh hệ thống thực tế"
                className="relative group cursor-pointer overflow-hidden rounded-2xl border border-sky-200 bg-white p-2 shadow-2xl shadow-sky-200/50 transition-all hover:border-primary/40 block"
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <Image
                    src="/brand/chart-preview.png"
                    alt="Giao diện Vivutrade Trading Chart Realtime"
                    width={1600}
                    height={1000}
                    priority
                    className="w-full h-auto rounded-xl object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                />
                <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between rounded-lg bg-white/90 p-3 backdrop-blur-md border border-sky-100 shadow-lg translate-y-2 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                            <Radio className="h-4 w-4 animate-pulse" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Live Workspace</p>
                            <p className="text-sm font-black text-slate-900">XAUUSD Realtime Feed</p>
                        </div>
                    </div>
                    <div className="rounded-full bg-primary px-3 py-1 text-[10px] font-black text-white">
                        LIVE
                    </div>
                </div>
            </Link>
        </section>
    );
}
