'use client';

import { useTranslations } from 'next-intl';
import { Search, PenTool, PlayCircle } from "lucide-react";

export function Workflow() {
    const t = useTranslations('HomePage.workflow');

    const steps = [
        {
            title: t('step1.title'),
            desc: t('step1.desc'),
            icon: Search,
            color: 'bg-blue-500',
        },
        {
            title: t('step2.title'),
            desc: t('step2.desc'),
            icon: PenTool,
            color: 'bg-primary',
        },
        {
            title: t('step3.title'),
            desc: t('step3.desc'),
            icon: PlayCircle,
            color: 'bg-emerald-500',
        }
    ];

    return (
        <section className="py-12 border-t border-sky-100">
            <h2 className="text-2xl font-black text-center mb-12">{t('title')}</h2>

            <div className="grid md:grid-cols-3 gap-8 relative">
                {/* Connection Line Desktop */}
                <div className="hidden md:block absolute top-10 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-blue-500/20 via-primary/20 to-emerald-500/20 -z-10" />

                {steps.map((step, index) => {
                    const Icon = step.icon;
                    return (
                        <div key={index} className="flex flex-col items-center text-center space-y-4">
                            <div className={`w-16 h-16 rounded-2xl ${step.color} flex items-center justify-center text-white shadow-xl shadow-sky-200/50`}>
                                <Icon className="w-8 h-8" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-black">{step.title}</h3>
                                <p className="text-sm text-slate-600 leading-relaxed max-w-[240px]">
                                    {step.desc}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
