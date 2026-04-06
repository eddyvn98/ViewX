'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useMarketStore } from '@/lib/store';
import type { AccountInfo } from '@/lib/store';
import { buildMt5TermsStorageKey } from '@/lib/store/slices/ui-slice';
import { CheckCircle2, CircleAlert, ChevronRight, Wallet, Wifi, ShieldAlert, MonitorSmartphone, RefreshCw, FileText, Settings2 } from 'lucide-react';

type NativeDesktopStatus = {
    isNativeDesktop?: boolean;
    bridgeStatus?: string;
    hasAccessToken?: boolean;
};

declare global {
    interface Window {
        vivutradeDesktop?: {
            isNativeDesktop?: boolean;
            getStatus?: () => Promise<NativeDesktopStatus>;
            onStatus?: (handler: (payload: NativeDesktopStatus) => void) => (() => void) | void;
            openLogs?: () => Promise<unknown>;
            openSettings?: () => Promise<unknown>;
            restartBridge?: () => Promise<unknown>;
        };
    }
}

function buildMt5AccountScope(account: AccountInfo | null) {
    const login = String(account?.login || '').trim();
    const server = String(account?.server || '').trim();
    if (!login) return '';
    return server ? `${login}@${server}` : login;
}

export function ActivationChecklist() {
    const t = useTranslations('Mt5Activation');
    const router = useRouter();

    const isBridgeOnline = useMarketStore((state) => state.isBridgeOnline);
    const hasAcceptedMt5Terms = useMarketStore((state) => state.hasAcceptedMt5Terms);
    const syncHasAcceptedMt5Terms = useMarketStore((state) => state.syncHasAcceptedMt5Terms);
    const activeTabId = useMarketStore((state) => state.activeTabId);
    const tabs = useMarketStore((state) => state.tabs);
    const accounts = useMarketStore((state) => state.accounts);
    const [desktopStatus, setDesktopStatus] = useState<NativeDesktopStatus | null>(null);

    const activeChartSource = (() => {
        const tab = tabs[activeTabId];
        if (!tab?.activeChartId) return 'MT5';
        return tab.charts[tab.activeChartId]?.source || 'MT5';
    })();

    const accountSource = activeChartSource === 'BINANCE' ? 'BINANCE_DEMO' : 'MT5';
    const account = accounts[accountSource] || accounts.MT5 || null;
    const accountLabel = accountSource === 'BINANCE_DEMO' ? t('checklist.binanceAccount') : t('checklist.mt5Account');
    const storageKey = useMemo(
        () => buildMt5TermsStorageKey({ accountId: buildMt5AccountScope(account) }),
        [account]
    );

    useEffect(() => {
        syncHasAcceptedMt5Terms(storageKey);
    }, [storageKey, syncHasAcceptedMt5Terms]);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.vivutradeDesktop) return;

        let mounted = true;
        window.vivutradeDesktop.getStatus?.()
            .then((payload) => {
                if (mounted && payload) setDesktopStatus(payload);
            })
            .catch(() => undefined);

        const unsubscribe = window.vivutradeDesktop.onStatus?.((payload) => {
            if (mounted) setDesktopStatus(payload);
        });

        return () => {
            mounted = false;
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, []);

    const nativeBridgeStatus = String(desktopStatus?.bridgeStatus || '').trim();
    const isNativeDesktop = Boolean(desktopStatus?.isNativeDesktop || window?.vivutradeDesktop?.isNativeDesktop);

    const nativeHint = useMemo(() => {
        if (!isNativeDesktop) return null;

        if (nativeBridgeStatus === 'missing_access_token' || !desktopStatus?.hasAccessToken) {
            return {
                title: 'Desktop is waiting for your Vivutrade login',
                body: 'Sign in inside this desktop app. The bridge will start automatically after the access token is detected.',
            };
        }
        if (nativeBridgeStatus === 'starting') {
            return {
                title: 'Desktop bridge is starting',
                body: 'Keep this app open for a moment while the local MT5 bridge boots.',
            };
        }
        if (nativeBridgeStatus === 'error') {
            return {
                title: 'Desktop bridge needs attention',
                body: 'Open the logs to inspect the local bridge error, then restart the bridge from this app.',
            };
        }
        if (nativeBridgeStatus === 'running' && !isBridgeOnline) {
            return {
                title: 'Desktop bridge is running, waiting for MT5',
                body: 'Open MT5 on this machine and sign in to your trading account so the web terminal can detect it.',
            };
        }
        if (nativeBridgeStatus === 'running' && isBridgeOnline && !account) {
            return {
                title: 'Bridge is online, waiting for account data',
                body: 'MT5 is connected but the account payload has not arrived yet. Keep MT5 open and wait for sync.',
            };
        }
        return {
            title: 'Desktop native path is active',
            body: 'Bridge status is being read from the native app. Complete consent below to unlock the terminal.',
        };
    }, [account, desktopStatus?.hasAccessToken, isBridgeOnline, isNativeDesktop, nativeBridgeStatus]);

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/65 p-4 backdrop-blur-md">
            <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-yellow-500/20 bg-slate-950/95 shadow-2xl">
                <div className="border-b border-yellow-500/15 bg-gradient-to-r from-yellow-500/10 to-transparent p-5">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-3">
                            <ShieldAlert className="h-6 w-6 text-yellow-400" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-xl font-bold text-white">{t('checklist.title')}</h3>
                            <p className="text-sm leading-relaxed text-slate-300">
                                {t('checklist.subtitle')}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 p-6">
                    {nativeHint && (
                        <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 rounded-xl border border-sky-400/20 bg-sky-400/10 p-2">
                                    <MonitorSmartphone className="h-4 w-4 text-sky-300" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-semibold text-sky-200">{nativeHint.title}</div>
                                    <div className="mt-1 text-sm leading-relaxed text-slate-300">{nativeHint.body}</div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {nativeBridgeStatus === 'error' && (
                                            <>
                                                <button
                                                    onClick={() => window.vivutradeDesktop?.openLogs?.()}
                                                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                                                >
                                                    <FileText className="h-3.5 w-3.5" />
                                                    Open Logs
                                                </button>
                                                <button
                                                    onClick={() => window.vivutradeDesktop?.restartBridge?.()}
                                                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                                                >
                                                    <RefreshCw className="h-3.5 w-3.5" />
                                                    Restart Bridge
                                                </button>
                                            </>
                                        )}
                                        {(nativeBridgeStatus === 'missing_access_token' || !desktopStatus?.hasAccessToken) && (
                                            <button
                                                onClick={() => window.vivutradeDesktop?.openSettings?.()}
                                                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                                            >
                                                <Settings2 className="h-3.5 w-3.5" />
                                                Open Desktop Settings
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-4">
                        <div className={`mt-0.5 rounded-full p-2 ${isBridgeOnline ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
                            <Wifi className={`h-4 w-4 ${isBridgeOnline ? 'text-emerald-400' : 'text-amber-400'}`} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold ${isBridgeOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {isBridgeOnline ? t('checklist.online') : t('checklist.waiting')}
                                </span>
                            </div>
                            <div className="mt-1 text-sm text-slate-300">{t('checklist.bridgeState')}</div>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-4">
                        <div className={`mt-0.5 rounded-full p-2 ${account ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
                            <Wallet className={`h-4 w-4 ${account ? 'text-emerald-400' : 'text-amber-400'}`} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold ${account ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {account ? t('checklist.accountLinked') : t('checklist.accountMissing')}
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                                    {accountLabel}
                                </span>
                            </div>
                            <div className="mt-1 text-sm text-slate-300">
                                {account ? t('checklist.accountReady') : t('checklist.accountPending')}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 p-4">
                        <div className={`mt-0.5 rounded-full p-2 ${hasAcceptedMt5Terms ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
                            {hasAcceptedMt5Terms ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            ) : (
                                <CircleAlert className="h-4 w-4 text-amber-400" />
                            )}
                        </div>
                        <div className="flex-1">
                            <div className={`text-sm font-semibold ${hasAcceptedMt5Terms ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {hasAcceptedMt5Terms ? t('checklist.consentSaved') : t('checklist.consentRequired')}
                            </div>
                            <div className="mt-1 text-sm text-slate-300">
                                {hasAcceptedMt5Terms ? t('checklist.consentReady') : t('checklist.consentPending')}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-yellow-500/15 bg-yellow-500/5 p-5">
                    <p className="max-w-sm text-xs leading-relaxed text-slate-400">
                        {t('checklist.footer')}
                    </p>
                    <button
                        onClick={() => router.push('/mt5-activation')}
                        className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-bold text-yellow-950 transition-all hover:scale-[1.02] hover:bg-yellow-400 active:scale-95"
                    >
                        {t('buttons.openPage')}
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
