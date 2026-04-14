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
        <section className="py-20 border-t border-slate-100">
            <h2 className="text-3xl font-black text-center mb-16 text-slate-950">{t('title')}</h2>

            <div className="grid md:grid-cols-3 gap-12 relative max-w-5xl mx-auto">
                {/* Connection Line Desktop */}
                <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-blue-500/10 via-primary/10 to-emerald-500/10 -z-10" />

                {steps.map((step, index) => {
                    const Icon = step.icon;
                    return (
                        <div key={index} className="group flex flex-col items-center text-center space-y-6">
                            <div className={`w-24 h-24 rounded-3xl ${step.color} flex items-center justify-center text-white shadow-2xl shadow-blue-500/10 transition-transform group-hover:scale-110 group-hover:-rotate-3 duration-300`}>
                                <Icon className="w-10 h-10" />
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-xl font-black text-slate-950">{step.title}</h3>
                                <p className="text-sm text-slate-600 leading-relaxed max-w-[280px]">
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
