'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useMarketStore } from '@/lib/store';
import type { AccountInfo } from '@/lib/store';
import { getClientEntitlements } from '@/lib/auth/entitlements';
import { readStoredAccessToken, refreshStoredAccessToken } from '@/lib/auth/session';
import { buildMt5TermsStorageKey } from '@/lib/store/slices/ui-slice';
import { CheckCircle2, CircleAlert, Loader2 } from 'lucide-react';

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
        };
    }
}

function buildMt5AccountScope(account: AccountInfo | null) {
    const login = String(account?.login || '').trim();
    const server = String(account?.server || '').trim();
    if (!login && !server) return '';
    if (!login) return server;
    return server ? `${login}@${server}` : login;
}

function hasMt5AccountSnapshot(account: AccountInfo | null) {
    if (!account) return false;
    return ['balance', 'equity', 'margin', 'free_margin', 'margin_level', 'profit'].some((key) => {
        const value = account[key as keyof AccountInfo];
        return typeof value === 'number' && Number.isFinite(value);
    });
}

async function fetchWithStoredAuth(input: string, init: RequestInit = {}) {
    let accessToken = readStoredAccessToken();
    const headers = new Headers(init.headers || {});
    if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);

    const response = await fetch(input, {
        ...init,
        headers,
        credentials: 'include',
    });

    if (response.status !== 401) return response;

    accessToken = await refreshStoredAccessToken();
    if (!accessToken) return response;

    const retryHeaders = new Headers(init.headers || {});
    retryHeaders.set('authorization', `Bearer ${accessToken}`);
    return fetch(input, {
        ...init,
        headers: retryHeaders,
        credentials: 'include',
    });
}

async function readConsentError(response: Response) {
    const fallback = 'Không thể lưu consent MT5 lúc này.';
    const data = await response.json().catch(() => null);
    const error = String(data?.error || '').trim();
    if (response.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (error === 'account_scope_required') return 'Chưa đọc được tài khoản MT5 hiện tại.';
    if (error === 'User not found') return 'Không tìm thấy tài khoản người dùng để lưu consent.';
    return error || fallback;
}

function MiniCheck({
    checked,
    title,
    subtitle,
}: {
    checked: boolean;
    title: string;
    subtitle: string;
}) {
    return (
        <div className="flex items-start gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
            <div className="mt-0.5">
                {checked ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                    <CircleAlert className="h-4 w-4 text-amber-400" />
                )}
            </div>
            <div className="min-w-0">
                <div className={`text-[12px] font-bold ${checked ? 'text-emerald-300' : 'text-amber-300'}`}>{title}</div>
                <div className="text-[11px] leading-relaxed text-slate-400">{subtitle}</div>
            </div>
        </div>
    );
}

export function ActivationChecklist() {
    const t = useTranslations('Mt5Activation');
    const isBridgeOnline = useMarketStore((state) => state.isBridgeOnline);
    const hasAcceptedMt5Terms = useMarketStore((state) => state.hasAcceptedMt5Terms);
    const setHasAcceptedMt5Terms = useMarketStore((state) => state.setHasAcceptedMt5Terms);
    const syncHasAcceptedMt5Terms = useMarketStore((state) => state.syncHasAcceptedMt5Terms);
    const addNotification = useMarketStore((state) => state.addNotification);
    const accounts = useMarketStore((state) => state.accounts);

    const [desktopStatus, setDesktopStatus] = useState<NativeDesktopStatus | null>(null);
    const [hasYourMt5Module, setHasYourMt5Module] = useState(
        () => typeof window !== 'undefined' && getClientEntitlements().hasYourMt5
    );
    const [riskAccepted, setRiskAccepted] = useState(false);
    const [accountAccepted, setAccountAccepted] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const account = accounts.MT5 || null;
    const accountScope = useMemo(() => buildMt5AccountScope(account), [account]);
    const hasAccountSnapshot = useMemo(() => hasMt5AccountSnapshot(account), [account]);
    const storageKey = useMemo(
        () => buildMt5TermsStorageKey({ accountId: accountScope }),
        [accountScope]
    );

    useEffect(() => {
        syncHasAcceptedMt5Terms(storageKey);
    }, [storageKey, syncHasAcceptedMt5Terms]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const syncEntitlements = () => setHasYourMt5Module(getClientEntitlements().hasYourMt5);
        syncEntitlements();
        window.addEventListener('storage', syncEntitlements);
        window.addEventListener('focus', syncEntitlements);
        window.addEventListener('auth-changed', syncEntitlements);
        window.addEventListener('auth-state-changed', syncEntitlements);
        return () => {
            window.removeEventListener('storage', syncEntitlements);
            window.removeEventListener('focus', syncEntitlements);
            window.removeEventListener('auth-changed', syncEntitlements);
            window.removeEventListener('auth-state-changed', syncEntitlements);
        };
    }, []);

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

    useEffect(() => {
        if (typeof window === 'undefined' || !accountScope) return;

        fetchWithStoredAuth(`/api/user/mt5-consent?accountScope=${encodeURIComponent(accountScope)}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (!data) return;
                setRiskAccepted(Boolean(data.riskAccepted));
                setAccountAccepted(Boolean(data.accountAccepted));
                if (Boolean(data.accepted)) {
                    setHasAcceptedMt5Terms(true, storageKey);
                }
            })
            .catch(() => undefined);
    }, [accountScope, setHasAcceptedMt5Terms, storageKey]);

    const bridgeReady = Boolean(isBridgeOnline || desktopStatus?.bridgeStatus === 'running');
    const accountReady = Boolean(accountScope);
    const needsConsent = !hasAcceptedMt5Terms;
    const canSaveConsent =
        hasYourMt5Module && bridgeReady && accountReady && riskAccepted && accountAccepted && !isSaving;

    const handleSaveConsent = async () => {
        if (!canSaveConsent || typeof window === 'undefined') return;

        setIsSaving(true);
        try {
            const response = await fetchWithStoredAuth('/api/user/mt5-consent', {
                method: 'PUT',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    accountScope,
                    riskAccepted,
                    accountAccepted,
                }),
            });
            if (!response.ok) {
                throw new Error(await readConsentError(response));
            }
            setHasAcceptedMt5Terms(true, storageKey);
            addNotification(t('successMessage'), 'success');
        } catch (error) {
            addNotification(error instanceof Error ? error.message : 'Không thể lưu consent MT5 lúc này.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="relative z-20 mx-auto w-full max-w-5xl px-3 pt-3">
            <div className="rounded-2xl border border-yellow-500/20 bg-slate-950/95 p-3 shadow-xl">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-white">MT5 sẵn sàng</div>
                        <div className="mt-1 text-[12px] text-slate-400">
                            Chỉ giữ 3 bước ngắn: module, bridge/tài khoản, consent.
                        </div>
                    </div>
                    {!hasYourMt5Module && (
                        <Link
                            href="/pricing"
                            className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white transition hover:bg-emerald-400"
                        >
                            Mua Your MT5
                        </Link>
                    )}
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <MiniCheck
                        checked={hasYourMt5Module}
                        title={hasYourMt5Module ? 'Đã có module' : 'Chưa có module'}
                        subtitle={
                            hasYourMt5Module
                                ? 'Tài khoản này đã mở khóa Your MT5.'
                                : 'Cần module your_mt5 để mở terminal.'
                        }
                    />
                    <MiniCheck
                        checked={bridgeReady}
                        title={bridgeReady ? 'Bridge sẵn sàng' : 'Bridge chưa sẵn sàng'}
                        subtitle={
                            bridgeReady
                                ? 'Bridge đang online.'
                                : 'Mở app native và đăng nhập đúng tài khoản.'
                        }
                    />
                    <MiniCheck
                        checked={accountReady}
                        title={accountReady ? 'Đã nhận tài khoản' : 'Chưa có tài khoản'}
                        subtitle={
                            accountReady
                                ? `Scope đang dùng: ${accountScope}`
                                : hasAccountSnapshot
                                    ? 'Đã có số dư/equity từ bridge nhưng thiếu login/server. Kiểm tra bridge đang chạy có phải bản mới không.'
                                    : 'Chờ terminal store đọc login/server của account hiện tại.'
                        }
                    />
                </div>

                {needsConsent && (
                    <div className="mt-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                        <div className="text-[12px] font-bold uppercase tracking-wide text-slate-200">Consent</div>
                        <div className="mt-2 space-y-2">
                            <label className="flex items-start gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-left">
                                <input
                                    type="checkbox"
                                    className="mt-1"
                                    checked={riskAccepted}
                                    onChange={(e) => setRiskAccepted(e.target.checked)}
                                />
                                <div>
                                    <div className="text-[12px] font-semibold text-white">
                                        Tôi tự chịu trách nhiệm quản lý rủi ro.
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                        Xác nhận bạn tự quyết định lệnh và quản lý vốn.
                                    </div>
                                </div>
                            </label>
                            <label className="flex items-start gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-left">
                                <input
                                    type="checkbox"
                                    className="mt-1"
                                    checked={accountAccepted}
                                    onChange={(e) => setAccountAccepted(e.target.checked)}
                                />
                                <div>
                                    <div className="text-[12px] font-semibold text-white">
                                        Tôi đồng ý đồng bộ tài khoản MT5 hiện tại.
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                        Consent sẽ được lưu theo account này để lần sau không phải tick lại.
                                    </div>
                                </div>
                            </label>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                                onClick={handleSaveConsent}
                                disabled={!canSaveConsent}
                                className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-yellow-950 transition disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                {isSaving ? 'Đang lưu' : 'Lưu consent'}
                            </button>
                            {!canSaveConsent && (
                                <div className="text-[11px] text-slate-400">
                                    Cần đủ module, bridge, account và tick đủ 2 ô.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
