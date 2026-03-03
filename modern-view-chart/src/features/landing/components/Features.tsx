'use client';

import { useTranslations } from 'next-intl';
import { Layers, LineChart, Shield, Radio, ArrowRight } from "lucide-react";

export function Features() {
    const t = useTranslations('HomePage.features');

    const featureCards = [
        {
            title: t('chart.title'),
            description: t('chart.desc'),
            icon: LineChart,
        },
        {
            title: t('matrix.title'),
            description: t('matrix.desc'),
            icon: Layers,
        },
        {
            title: t('backtest.title'),
            description: t('backtest.desc'),
            icon: Shield,
        }
    ];

    return (
        <section aria-labelledby="features-title" className="space-y-6">
            <div className="space-y-3">
                <h2
                    id="features-title"
                    className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl"
                >
                    Infrastructure Excellence
                </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {featureCards.map((feature, index) => {
                    const Icon = feature.icon;
                    return (
                        <article
                            key={feature.title}
                            className="group rounded-xl border border-sky-100 bg-white/90 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg hover:shadow-sky-100"
                            style={{ animationDelay: `${index * 90}ms` }}
                        >
                            <div className="mb-3 inline-flex rounded-lg border border-primary/30 bg-primary/10 p-2 text-primary">
                                <Icon className="h-4 w-4" />
                            </div>
                            <h3 className="mb-2 text-lg font-black">{feature.title}</h3>
                            <p className="text-sm leading-7 text-slate-700">
                                {feature.description}
                            </p>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
