import React, { useState } from 'react';
import { PerformanceMetrics } from '../../logic/PerformanceAnalyzer';
import { Sparkles, BrainCircuit, Target, Zap, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

interface Props {
    metrics: PerformanceMetrics;
}

export function StrategyAIPanel({ metrics }: Props) {
    const t = useTranslations('StrategyDashboard.aiPanel');
    const locale = useLocale();
    const numberFormatter = new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    const aiEnabled = true;
    const [isLoading, setIsLoading] = useState(false);
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [remainingCredits, setRemainingCredits] = useState<number | null>(null);
    const toFriendlyError = (raw: string) => {
        const value = String(raw || '').trim();
        if (value.startsWith('Yeu cau ') || value.startsWith('Noi dung ')) {
            return value;
        }
        if (raw.includes('prompt_blocked_by_policy') || raw.includes('response_blocked_by_policy')) {
            return 'Yeu cau khong phu hop chinh sach an toan. Vui long dat cau hoi ve giao dich va cach dung Vivutrade.';
        }
        if (raw.includes('missing_auth_token')) {
            return 'Ban can dang nhap de su dung AI.';
        }
        return 'Khong the phan tich luc nay. Vui long thu lai sau.';
    };

    const bestSession = Object.entries(metrics.sessionStats).sort((a, b) => b[1].winRate - a[1].winRate)[0];
    const avgConfidence = metrics.avgConfidence || 0;

    const handleMacroAnalyze = async () => {
        if (!aiEnabled) return;
        setIsLoading(true);
        setAnalysisError(null);
        setAnalysis(null);
        setRemainingCredits(null);

        try {
            if (typeof window === 'undefined') throw new Error('client_only');
            const accessToken = (localStorage.getItem('auth_access_token') || '').trim();
            if (!accessToken) throw new Error('missing_auth_token');

            const authUserRaw = localStorage.getItem('auth_user') || '';
            let userId = '';
            if (authUserRaw) {
                try {
                    const authUser = JSON.parse(authUserRaw);
                    userId = String(authUser?._id || authUser?.id || '').trim();
                } catch {
                    userId = '';
                }
            }

            const prompt = [
                'You are an expert trading strategy analyst.',
                'Analyze the metrics and provide 3 short sections: (1) Strengths, (2) Risks, (3) Actionable next steps.',
                `Profit factor: ${Number(metrics.profitFactor || 0).toFixed(2)}`,
                `Average confidence: ${Number(avgConfidence || 0).toFixed(2)}%`,
                `Average MAE: ${Number(metrics.avgMae || 0).toFixed(2)} pips`,
                `Average MFE: ${Number(metrics.avgMfe || 0).toFixed(2)} pips`,
                `Best session by win rate: ${bestSession?.[0] || 'N/A'}`,
                'Respond in concise plain text only.',
            ].join('\n');

            const payload: {
                prompt: string;
                source: 'chat';
                userId?: string;
            } = { prompt, source: 'chat' };
            if (userId) payload.userId = userId;

            const response = await fetch('/api/ai/bridge/task', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${accessToken}`,
                },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            const data = await response.json().catch(() => null);
            if (!response.ok || !data) {
                const userMessage = String(data?.user_message || '').trim();
                throw new Error(userMessage || String(data?.msg || data?.error || `request_failed_${response.status}`));
            }

            const text = String(data?.response || '').trim();
            if (!text) throw new Error('empty_ai_response');

            setAnalysis(text);
            if (typeof data?.remainingCredits === 'number') {
                setRemainingCredits(data.remainingCredits);
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'ai_request_failed';
            setAnalysisError(toFriendlyError(msg));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-secondary/20 rounded-2xl border border-primary/20 overflow-hidden shadow-2xl backdrop-blur-sm">
            <div className="p-6 space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <BrainCircuit size={20} className="text-primary" />
                        </div>
                        <div className="flex flex-col">
                            <h3 className="text-sm font-black text-foreground uppercase tracking-widest">{t('title')}</h3>
                            <span className="text-[11px] font-bold text-primary uppercase tracking-tighter">{t('subtitle')}</span>
                        </div>
                    </div>

                    {!analysis && !isLoading && (
                        <button
                            onClick={handleMacroAnalyze}
                            disabled={!aiEnabled}
                            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-xl text-[11px] font-black uppercase transition-all shadow-lg shadow-primary/25 active:scale-95 group disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Sparkles size={14} className="group-hover:animate-pulse" />
                            {t('performAudit')}
                        </button>
                    )}
                </div>

                {isLoading && (
                    <div className="py-12 flex flex-col items-center justify-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                            <Loader2 size={32} className="text-primary animate-spin relative" />
                        </div>
                        <span className="text-[11px] font-black text-primary/80 uppercase tracking-widest animate-pulse">{t('aggregating')}</span>
                    </div>
                )}

                {analysis && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {remainingCredits !== null && (
                            <div className="text-[11px] font-black uppercase tracking-wider text-primary">
                                AI Live | Credits: {remainingCredits}
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-secondary/40 p-4 rounded-xl border border-border/50 flex items-start gap-4">
                                <div className="p-2 bg-green-500/10 rounded-lg">
                                    <Target size={16} className="text-green-400" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[11px] font-black text-muted-foreground uppercase">{t('systemStrength')}</span>
                                    <p className="text-[11px] text-foreground/80 leading-relaxed italic">
                                        &quot;{analysis}&quot;
                                    </p>
                                </div>
                            </div>

                            <div className="bg-secondary/40 p-4 rounded-xl border border-border/50 flex items-start gap-4">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <Zap size={16} className="text-primary" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[11px] font-black text-muted-foreground uppercase">{t('actionableRefinement')}</span>
                                    <div className="space-y-2 mt-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1 h-1 rounded-full bg-primary" />
                                            <span className="text-[11px] font-bold text-foreground/90">{t('filterByConfidence')}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-1 h-1 rounded-full bg-primary" />
                                            <span className="text-[11px] font-bold text-foreground/90">{t('auditSession', { session: bestSession?.[0] || t('current') })}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-center">
                            <button
                                onClick={() => setAnalysis(null)}
                                className="text-[11px] font-black text-muted-foreground hover:text-primary uppercase tracking-widest transition-colors flex items-center gap-2"
                            >
                                <RefreshCcw width={12} height={12} />
                                {t('recalculate')}
                            </button>
                        </div>
                    </div>
                )}

                {analysisError && !isLoading && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[11px] font-bold text-red-300">
                        AI request failed: {analysisError}
                    </div>
                )}

                {!analysis && !isLoading && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        <MacroChip label={t('avgConfidence')} value={`${avgConfidence.toFixed(0)}%`} color="text-primary" />
                        <MacroChip label={t('avgMae')} value={`${numberFormatter.format(metrics.avgMae)} pips`} color="text-red-400" />
                        <MacroChip label={t('avgMfe')} value={`${numberFormatter.format(metrics.avgMfe)} pips`} color="text-green-400" />
                        <MacroChip label={t('predictionAccuracy')} value={t('inTesting')} color="text-primary/80" />
                    </div>
                )}
            </div>
        </div>
    );
}

function MacroChip({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="bg-secondary/40 px-4 py-2 rounded-xl border border-border/30 flex flex-col">
            <span className="text-[11px] font-black text-muted-foreground uppercase tracking-tighter">{label}</span>
            <span className={`text-[11px] font-mono font-black ${color}`}>{value}</span>
        </div>
    );
}

function RefreshCcw(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
        </svg>
    )
}
