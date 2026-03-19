'use client';

import React, { useMemo } from 'react';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { PerformanceAnalyzer } from '@/features/strategy/logic/PerformanceAnalyzer';
import { DashboardStats } from '@/features/strategy/components/dashboard/DashboardStats';
import { TradeHistory } from '@/features/strategy/components/dashboard/TradeHistory';
import { EquityChart } from '@/features/strategy/components/dashboard/EquityChart';
import { StrategyAIPanel } from '@/features/strategy/components/dashboard/StrategyAIPanel';
import { LayoutDashboard, LogOut, RefreshCcw, Trash2 } from 'lucide-react';
import { soundService } from '@/features/strategy/logic/SoundService';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

export default function StrategyDashboardPage() {
    const t = useTranslations('StrategyDashboard.page');
    const locale = useLocale();
    const numberFormatter = new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    const { virtualPositions, initialVirtualBalance, resetVirtualAccount } = useStrategyStore();
    const [isConfirming, setIsConfirming] = React.useState(false);

    const metrics = useMemo(() => {
        return PerformanceAnalyzer.analyze(virtualPositions, initialVirtualBalance);
    }, [virtualPositions, initialVirtualBalance]);

    const handleRefresh = () => {
        window.location.reload();
    };

    const handleMasterReset = () => {
        if (isConfirming) {
            resetVirtualAccount();
            setIsConfirming(false);
        } else {
            setIsConfirming(true);
            setTimeout(() => setIsConfirming(false), 3000);
        }
    };

    // Auto-refresh when localStorage changes (e.g. from Reset All in another tab)
    React.useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'strategy-storage') {
                window.location.reload();
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // Unlock WebAudio on first user gesture instead of showing a dedicated button.
    React.useEffect(() => {
        let unlocked = false;
        const unlockAudio = async () => {
            if (unlocked) return;
            unlocked = true;
            try {
                await soundService.resume();
            } catch {
                // Silent fail: browser policies may still block until next gesture.
            } finally {
                window.removeEventListener('pointerdown', unlockAudio);
                window.removeEventListener('keydown', unlockAudio);
                window.removeEventListener('touchstart', unlockAudio);
            }
        };

        window.addEventListener('pointerdown', unlockAudio, { passive: true });
        window.addEventListener('keydown', unlockAudio);
        window.addEventListener('touchstart', unlockAudio, { passive: true });
        return () => {
            window.removeEventListener('pointerdown', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
        };
    }, []);

    return (
        <div className="h-screen overflow-y-auto bg-background text-foreground p-4 md:p-8 font-sans selection:bg-primary/30">
            <div className="max-w-7xl mx-auto flex flex-col gap-8 pb-10">

                {/* HEADER */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 shadow-lg shadow-primary/10">
                            <LayoutDashboard className="text-primary" size={24} />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-black text-foreground tracking-tight uppercase">{t('title')}</h1>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                                <span className="text-[11px] font-bold text-primary uppercase tracking-widest">{t('mode')}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleMasterReset}
                            className={`flex items-center gap-2 px-4 h-10 rounded-xl font-bold transition-all border ${isConfirming
                                ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-500/20'
                                : 'bg-red-500/5 border-red-500/20 text-red-500 hover:bg-red-500/10'
                                } text-xs`}
                        >
                            <Trash2 size={14} />
                            {isConfirming ? t('confirmReset') : t('masterReset')}
                        </button>
                        <button
                            onClick={handleRefresh}
                            className="flex items-center gap-2 px-4 h-10 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold transition-all border border-border"
                        >
                            <RefreshCcw size={14} />
                            {t('refresh')}
                        </button>
                        <Link
                            href="/"
                            className="flex items-center gap-2 px-4 h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black transition-all shadow-lg shadow-primary/20"
                        >
                            <LogOut size={14} />
                            {t('backToChart')}
                        </Link>
                    </div>
                </header>

                {/* KPI SECTION */}
                <section className="flex flex-col gap-6">
                    <StrategyAIPanel metrics={metrics} />
                    <DashboardStats metrics={metrics} />
                </section>

                {/* MAIN CONTENT GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* RECENT TRADES SECTION (2/3) - Priority */}
                    <section className="lg:col-span-2 flex flex-col gap-4">
                        <TradeHistory positions={virtualPositions} />
                    </section>

                    {/* CHART SECTION (1/3) */}
                    <section className="flex flex-col gap-4">
                        <EquityChart data={metrics.equityCurve} />
                    </section>
                </div>

                <footer className="mt-8 border-t border-border/30 pt-4 flex flex-col md:flex-row justify-between items-center gap-4 opacity-50">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase">{t('engine')}</span>
                    <span className="text-[11px] font-mono text-muted-foreground">{t('totalVolume')}: {numberFormatter.format(virtualPositions.reduce((sum, p) => sum + (p.lotSize || 0), 0))} {t('lot')}</span>
                </footer>
            </div>
        </div>
    );
}
