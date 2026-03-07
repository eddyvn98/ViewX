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

    return (
        <section aria-labelledby="features-title" className="space-y-10 py-8">
            <div className="space-y-4 text-center max-w-2xl mx-auto">
                <h2
                    id="features-title"
                    className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl"
                >
                    Professional Grade Tools
                </h2>
                <p className="text-slate-600">
                    Everything you need to build, test, and execute strategies autonomously with AI assistance.
                </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {featureCards.map((feature, index) => {
                    const Icon = feature.icon;
                    return (
                        <article
                            key={feature.key}
                            className={`group relative overflow-hidden rounded-2xl border ${feature.border} bg-white/70 p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-${feature.color.split('-')[1]}-500/10`}
                            style={{ animationDelay: `${index * 75}ms` }}
                        >
                            <div className={`mb-4 inline-flex rounded-xl ${feature.bg} p-3 ${feature.color} shadow-inner`}>
                                <Icon className="h-6 w-6" />
                            </div>
                            <h3 className="mb-3 text-lg font-black text-slate-800">{t(`${feature.key}.title` as any)}</h3>
                            <p className="text-sm leading-relaxed text-slate-600">
                                {t(`${feature.key}.desc` as any)}
                            </p>
                            <div className={`absolute bottom-0 right-0 h-32 w-32 translate-x-12 translate-y-12 rounded-full ${feature.bg} blur-3xl opacity-0 transition-opacity group-hover:opacity-100`} />
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
