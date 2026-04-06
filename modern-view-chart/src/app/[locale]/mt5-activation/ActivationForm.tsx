'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useMarketStore } from '@/lib/store';
import type { AccountInfo } from '@/lib/store';
import { buildMt5TermsStorageKey } from '@/lib/store/slices/ui-slice';
import { ArrowRight, Check, ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react';

type SubmitState = 'idle' | 'saving' | 'saved';

function buildMt5AccountScope(account: AccountInfo | null) {
    const login = String(account?.login || '').trim();
    const server = String(account?.server || '').trim();
    if (!login) return '';
    return server ? `${login}@${server}` : login;
}

export function ActivationForm() {
    const t = useTranslations('Mt5Activation');
    const router = useRouter();
    const setHasAcceptedMt5Terms = useMarketStore((state) => state.setHasAcceptedMt5Terms);
    const syncHasAcceptedMt5Terms = useMarketStore((state) => state.syncHasAcceptedMt5Terms);
    const addNotification = useMarketStore((state) => state.addNotification);
    const activeTabId = useMarketStore((state) => state.activeTabId);
    const tabs = useMarketStore((state) => state.tabs);
    const accounts = useMarketStore((state) => state.accounts);

    const [riskAccepted, setRiskAccepted] = useState(false);
    const [accountAccepted, setAccountAccepted] = useState(false);
    const [submitState, setSubmitState] = useState<SubmitState>('idle');

    const activeChartSource = (() => {
        const tab = tabs[activeTabId];
        if (!tab?.activeChartId) return 'MT5';
        return tab.charts[tab.activeChartId]?.source || 'MT5';
    })();
    const accountSource = activeChartSource === 'BINANCE' ? 'BINANCE_DEMO' : 'MT5';
    const account = accounts[accountSource] || accounts.MT5 || null;
    const storageKey = useMemo(
        () => buildMt5TermsStorageKey({ accountId: buildMt5AccountScope(account) }),
        [account]
    );

    const canActivate = riskAccepted && accountAccepted && submitState !== 'saving';
    const isSaving = submitState === 'saving';
    const isSaved = submitState === 'saved';

    useEffect(() => {
        syncHasAcceptedMt5Terms(storageKey);
    }, [storageKey, syncHasAcceptedMt5Terms]);

    const handleActivate = async () => {
        if (!canActivate) return;

        setSubmitState('saving');
        setHasAcceptedMt5Terms(true, storageKey);
        addNotification(t('successMessage'), 'success');

        window.setTimeout(() => {
            setSubmitState('saved');
            window.setTimeout(() => router.push('/chart'), 650);
        }, 450);
    };

    const helperText = isSaved
        ? t('page.redirecting')
        : canActivate
            ? t('page.ready')
            : t('page.needBoth');

    return (
        <div className="mx-auto w-full max-w-2xl space-y-8 px-4 py-10 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
            <div className="space-y-4 text-center">
                <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                    <ShieldCheck className="h-8 w-8 text-emerald-400" />
                </div>
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-300">
                        {t('page.kicker')}
                    </p>
                    <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white md:text-4xl">
                        {t('title')}
                    </h1>
                </div>
                <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted-foreground/90 md:text-base">
                    {t('subtitle')}
                </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left shadow-xl backdrop-blur-md md:p-7">
                <div className="mb-5 rounded-2xl border border-white/5 bg-black/20 p-4 text-sm text-slate-300">
                    {t('page.note')}
                </div>

                <div className="space-y-4">
                    <label
                        className={`group relative flex cursor-pointer select-none items-start gap-4 overflow-hidden rounded-2xl border p-4 transition-all
                            ${riskAccepted ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/5 bg-black/20 hover:bg-white/5'}`}
                    >
                        <div
                            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors
                            ${riskAccepted ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-white/20 text-transparent group-hover:border-white/40'}`}
                        >
                            <Check className="h-4 w-4" />
                        </div>
                        <input
                            type="checkbox"
                            className="absolute h-0 w-0 opacity-0"
                            checked={riskAccepted}
                            onChange={(e) => setRiskAccepted(e.target.checked)}
                        />
                        <div className="z-10 flex w-full flex-col gap-1.5">
                            <span className="flex items-center gap-2 font-semibold text-white/90">
                                <ShieldAlert className="h-4 w-4 text-amber-400" />
                                {t('labels.riskManagement')}
                            </span>
                            <span className="block w-full whitespace-normal text-sm leading-relaxed text-muted-foreground/80">
                                {t('terms.riskWarning')}
                            </span>
                        </div>
                    </label>

                    <label
                        className={`group relative flex cursor-pointer select-none items-start gap-4 overflow-hidden rounded-2xl border p-4 transition-all
                            ${accountAccepted ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/5 bg-black/20 hover:bg-white/5'}`}
                    >
                        <div
                            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors
                            ${accountAccepted ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-white/20 text-transparent group-hover:border-white/40'}`}
                        >
                            <Check className="h-4 w-4" />
                        </div>
                        <input
                            type="checkbox"
                            className="absolute h-0 w-0 opacity-0"
                            checked={accountAccepted}
                            onChange={(e) => setAccountAccepted(e.target.checked)}
                        />
                        <div className="z-10 flex w-full flex-col gap-1.5">
                            <span className="flex items-center gap-2 font-semibold text-white/90">
                                <ShieldCheck className="h-4 w-4 text-sky-400" />
                                {t('labels.accountSync')}
                            </span>
                            <span className="block w-full whitespace-normal text-sm leading-relaxed text-muted-foreground/80">
                                {t('terms.accountSync')}
                            </span>
                        </div>
                    </label>
                </div>

                <div className="mt-6 flex flex-col gap-4 border-t border-white/5 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                        {helperText}
                    </div>

                    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                        <button
                            onClick={() => router.push('/chart')}
                            className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-white"
                        >
                            {t('buttons.backToChart')}
                        </button>

                        <button
                            disabled={!canActivate}
                            onClick={handleActivate}
                            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold transition-all duration-300 sm:w-auto
                                ${canActivate
                                    ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:bg-emerald-400 hover:scale-[1.02] active:scale-95'
                                    : 'cursor-not-allowed bg-white/5 text-muted-foreground/50 opacity-50'}`}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {t('buttons.saving')}
                                </>
                            ) : isSaved ? (
                                <>
                                    {t('buttons.saved')}
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            ) : (
                                <>
                                    {t('buttons.activate')}
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
