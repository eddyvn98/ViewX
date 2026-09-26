'use client';

import { useTranslations } from 'next-intl';
import {
    LineChart,
    Diamond,
    Layers,
    Activity,
    BrainCircuit,
    Database,
    Infinity as InfinityIcon,
    MonitorSmartphone
} from "lucide-react";

export function Features() {
    const t = useTranslations('HomePage.features');

    const featureCards = [
        {
            key: 'chart',
            icon: LineChart,
            color: 'text-blue-600',
            bg: 'bg-blue-100/50',
            border: 'border-blue-200',
        },
        {
            key: 'diamond',
            icon: Diamond,
            color: 'text-violet-600',
            bg: 'bg-violet-100/50',
            border: 'border-violet-200',
        },
        {
            key: 'strategy',
            icon: Layers,
            color: 'text-emerald-600',
            bg: 'bg-emerald-100/50',
            border: 'border-emerald-200',
        },
        {
            key: 'matrix',
            icon: Activity,
            color: 'text-amber-600',
            bg: 'bg-amber-100/50',
            border: 'border-amber-200',
        },
        {
            key: 'aiMonitor',
            icon: BrainCircuit,
            color: 'text-rose-600',
            bg: 'bg-rose-100/50',
            border: 'border-rose-200',
        },
        {
            key: 'mt5Data',
            icon: Database,
            color: 'text-sky-600',
            bg: 'bg-sky-100/50',
            border: 'border-sky-200',
        },
        {
            key: 'indicators',
            icon: InfinityIcon,
            color: 'text-indigo-600',
            bg: 'bg-indigo-100/50',
            border: 'border-indigo-200',
        },
        {
            key: 'multiChart',
            icon: MonitorSmartphone,
            color: 'text-teal-600',
            bg: 'bg-teal-100/50',
            border: 'border-teal-200',
        }
    ];

    const sectionT = useTranslations('HomePage.featuresSection');

    return (
        <section aria-labelledby="features-title" className="space-y-16 py-12">
            <div className="space-y-6 text-center max-w-3xl mx-auto">
                <h2
                    id="features-title"
                    className="text-4xl font-black tracking-tight text-slate-950 md:text-5xl"
                >
                    {sectionT('title')}
                </h2>
                <p className="text-lg text-slate-600 leading-relaxed">
                    {sectionT('subtitle')}
                </p>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                {featureCards.map((feature, index) => {
                    const Icon = feature.icon;
                    return (
                        <article
                            key={feature.key}
                            className="group relative overflow-hidden rounded-[2rem] border border-white bg-white/40 p-8 backdrop-blur-md transition-all duration-300 hover:-translate-y-2 hover:bg-white/60 hover:shadow-[0_20px_50px_rgba(0,0,0,0.04)]"
                            style={{ animationDelay: `${index * 75}ms` }}
                        >
                            <div className={`mb-6 inline-flex rounded-2xl ${feature.bg} p-4 ${feature.color} shadow-inner transition-transform group-hover:scale-110 duration-300`}>
                                <Icon className="h-6 w-6" />
                            </div>
                            <h3 className="mb-4 text-xl font-black text-slate-950">{t(`${feature.key}.title` as any)}</h3>
                            <p className="text-sm leading-relaxed text-slate-600">
                                {t(`${feature.key}.desc` as any)}
                            </p>
                            <div className={`absolute -bottom-10 -right-10 h-40 w-40 rounded-full ${feature.bg} blur-[60px] opacity-0 transition-opacity group-hover:opacity-40`} />
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
