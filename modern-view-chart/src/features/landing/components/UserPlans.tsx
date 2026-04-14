'use client';

import { Link } from '@/i18n/routing';
import { CheckCircle2, Crown, Gem, Rocket, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function UserPlans() {
    const t = useTranslations('HomePage.userPlans');
    const renderBulletText = (item: string) => {
        const EXCLUSIVE_REGEX = /(độc quyền|exclusive)/i;
        const match = item.match(EXCLUSIVE_REGEX);
        if (!match || match.index === undefined) return <span>{item}</span>;

        const start = match.index;
        const end = start + match[0].length;
        const before = item.slice(0, start);
        const phrase = item.slice(start, end);
        const after = item.slice(end);

        return (
            <span>
                {before}
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-700">
                    <Gem className="h-3.5 w-3.5" />
                    {phrase}
                </span>
                {after}
            </span>
        );
    };

    const plans = [
        {
            key: 'free',
            title: t('free.title'),
            subtitle: t('free.subtitle'),
            price: t('free.price'),
            icon: Shield,
            border: 'border-slate-200',
            bg: 'bg-white',
            cta: t('free.cta'),
            href: '/plan-details/free',
            bullets: [t('free.b1'), t('free.b2'), t('free.b3'), t('free.b4'), t('free.b5'), t('free.b6'), t('free.b7'), t('free.b8')],
        },
        {
            key: 'pro',
            title: t('pro.title'),
            subtitle: t('pro.subtitle'),
            price: t('pro.price'),
            icon: Rocket,
            border: 'border-emerald-300',
            bg: 'bg-emerald-50/60',
            cta: t('pro.cta'),
            href: '/plan-details/pro',
            bullets: [t('pro.b1'), t('pro.b2'), t('pro.b3'), t('pro.b4'), t('pro.b5')],
            badge: t('pro.badge'),
        },
        {
            key: 'pro_plus',
            title: t('proPlus.title'),
            subtitle: t('proPlus.subtitle'),
            price: t('proPlus.price'),
            icon: Crown,
            border: 'border-amber-300',
            bg: 'bg-amber-50/70',
            cta: t('proPlus.cta'),
            href: '/plan-details/pro-plus',
            bullets: [t('proPlus.b1'), t('proPlus.b2'), t('proPlus.b3'), t('proPlus.b4'), t('proPlus.b5')],
        },
    ];

    return (
        <section aria-labelledby="user-plans-title" className="space-y-16 border-t border-slate-100 pt-20">
            <div className="mx-auto max-w-3xl space-y-6 text-center">
                <h2 id="user-plans-title" className="text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
                    {t('title')}
                </h2>
                <p className="text-lg text-slate-600 leading-relaxed">
                    {t('description')}
                </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
                {plans.map((plan) => {
                    const Icon = plan.icon;
                    const isProPlus = plan.key === 'pro_plus';
                    return (
                        <article
                            key={plan.key}
                            className={`relative flex h-full flex-col rounded-[2rem] border border-white bg-white/40 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.02)] backdrop-blur-md transition-all hover:-translate-y-2 hover:bg-white/60 hover:shadow-[0_20px_50px_rgba(0,0,0,0.04)]`}
                        >
                            {plan.badge ? (
                                <p className="absolute -top-3 left-8 rounded-full bg-emerald-600 px-4 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-600/20">
                                    {plan.badge}
                                </p>
                            ) : null}
                            <div className="mb-6 flex items-center gap-4">
                                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-950 shadow-sm border border-slate-50">
                                    <Icon className="h-6 w-6" />
                                </span>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-950">{plan.title}</h3>
                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{plan.subtitle}</p>
                                </div>
                            </div>
                            <div className="mb-6">
                                <span className="text-3xl font-black text-slate-950">{plan.price}</span>
                            </div>
                            <ul className="mb-10 flex-1 space-y-4">
                                {plan.bullets.map((item) => (
                                    <li key={item} className="flex items-start gap-3 text-sm font-medium text-slate-600">
                                        <div className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                                            <CheckCircle2 className="h-3 w-3" />
                                        </div>
                                        {renderBulletText(item)}
                                    </li>
                                ))}
                            </ul>
                            <Link
                                href={plan.href as any}
                                className={`inline-flex w-full items-center justify-center rounded-2xl ${isProPlus ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-slate-950 hover:bg-slate-800 shadow-slate-950/20'} px-6 py-4 text-base font-black text-white shadow-xl transition-all active:scale-95`}
                            >
                                {plan.cta}
                            </Link>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
