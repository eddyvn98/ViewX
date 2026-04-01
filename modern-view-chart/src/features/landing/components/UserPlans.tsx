'use client';

import Link from 'next/link';
import { CheckCircle2, Crown, Gem, Rocket, Shield } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

type PlanKey = 'free' | 'pro' | 'pro-plus';

export function UserPlans() {
    const t = useTranslations('HomePage.userPlans');
    const locale = useLocale();
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
            planKey: 'free' as PlanKey,
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
            planKey: 'pro' as PlanKey,
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
            planKey: 'pro-plus' as PlanKey,
            bullets: [t('proPlus.b1'), t('proPlus.b2'), t('proPlus.b3'), t('proPlus.b4'), t('proPlus.b5')],
        },
    ];

    return (
        <section aria-labelledby="user-plans-title" className="space-y-8 border-t border-sky-100 pt-12">
            <div className="mx-auto max-w-3xl space-y-3 text-center">
                <h2 id="user-plans-title" className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                    {t('title')}
                </h2>
                <p className="text-slate-600">
                    {t('description')}
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {plans.map((plan) => {
                    const Icon = plan.icon;
                    return (
                        <article
                            key={plan.key}
                            className={`relative flex h-full flex-col rounded-2xl border ${plan.border} ${plan.bg} p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg`}
                        >
                            {plan.badge ? (
                                <p className="absolute -top-3 left-6 rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white">
                                    {plan.badge}
                                </p>
                            ) : null}
                            <div className="mb-5 flex items-center gap-3">
                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-800 shadow-sm">
                                    <Icon className="h-5 w-5" />
                                </span>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">{plan.title}</h3>
                                    <p className="text-xs font-semibold text-slate-500">{plan.subtitle}</p>
                                </div>
                            </div>
                            <p className="mb-5 text-lg font-black text-slate-900">{plan.price}</p>
                            <ul className="mb-6 flex-1 space-y-2">
                                {plan.bullets.map((item) => (
                                    <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                        {renderBulletText(item)}
                                    </li>
                                ))}
                            </ul>
                            <Link
                                href={`/${locale}/plan-details/${plan.planKey}`}
                                className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-slate-700"
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
