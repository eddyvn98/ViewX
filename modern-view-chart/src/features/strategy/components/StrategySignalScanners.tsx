import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMarketStore } from '@/lib/store';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { timeframeToChartInterval } from '@/features/strategy/dashboard/matrix-utils';
import { BotPicker } from './strategy-signal-scanners/BotPicker';
import { ScannerCard } from './strategy-signal-scanners/ScannerCard';
import { useScannerViewModel } from './strategy-signal-scanners/useScannerViewModel';
import { ExternalLink } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function StrategySignalScanners() {
    const t = useTranslations('Signals.matrix');
    const pathname = usePathname();
    const isSignalsPage = pathname.includes('/signals');

    const [isBotPickerOpen, setIsBotPickerOpen] = useState(false);
    const [addingSymbolScannerId, setAddingSymbolScannerId] = useState<string | null>(null);
    const [addingTfScannerId, setAddingTfScannerId] = useState<string | null>(null);
    const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const {
        matrixScanners,
        focusedMatrixScannerId,
        strategies,
        signals,
        virtualPositions,
        addMatrixScannerForStrategy,
        findMatrixScannerByStrategy,
        setMatrixScannerStrategy,
        focusMatrixScanner,
        removeMatrixScanner,
        setMatrixScannerName,
        toggleMatrixScanner,
        addMatrixScannerSymbol,
        removeMatrixScannerSymbol,
        addMatrixScannerTimeframe,
        removeMatrixScannerTimeframe,
    } = useStrategyStore();

    const candleData = useMarketStore((state) => state.candleData);
    const watchlist = useMarketStore((state) => state.watchlist);
    const tabs = useMarketStore((state) => state.tabs);
    const activeTabId = useMarketStore((state) => state.activeTabId);
    const addChart = useMarketStore((state) => state.addChart);
    const setChartSymbol = useMarketStore((state) => state.setChartSymbol);
    const setChartTimeframe = useMarketStore((state) => state.setChartTimeframe);
    const setActiveMobileTab = useMarketStore((state) => state.setActiveMobileTab);

    const { symbolCandidates, scannerViewMap } = useScannerViewModel({
        matrixScanners,
        strategies,
        signals,
        virtualPositions,
        candleData,
        watchlist,
    });

    useEffect(() => {
        if (!focusedMatrixScannerId) return;
        const el = cardRefs.current[focusedMatrixScannerId];
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [focusedMatrixScannerId, matrixScanners.length]);

    const openChart = (symbol: string, timeframe: string) => {
        const chartInterval = timeframeToChartInterval(timeframe);
        const activeTab = tabs[activeTabId];
        let chartId = activeTab?.activeChartId || '';

        if (!activeTab || !chartId || !activeTab.charts?.[chartId]) {
            addChart(symbol, chartInterval, 'MT5');
            const nextState = useMarketStore.getState();
            const nextTab = nextState.tabs[nextState.activeTabId];
            chartId = nextTab?.activeChartId || '';
        }

        if (chartId) {
            setChartSymbol(chartId, symbol);
            setChartTimeframe(chartId, chartInterval);
        }
        setActiveMobileTab('chart');
    };

    const handlePickStrategy = (strategyId: string, strategyName: string) => {
        const existingScannerId = findMatrixScannerByStrategy(strategyId);
        if (existingScannerId) {
            const existingScanner = matrixScanners.find((scanner) => scanner.id === existingScannerId);
            if (existingScanner && !existingScanner.active) {
                toggleMatrixScanner(existingScannerId);
            }
            focusMatrixScanner(existingScannerId);
            setIsBotPickerOpen(false);
            return;
        }
        const emptyScanner = matrixScanners.find((scanner) => !scanner.strategyId);
        if (emptyScanner) {
            setMatrixScannerStrategy(emptyScanner.id, strategyId);
            setMatrixScannerName(emptyScanner.id, strategyName);
            toggleMatrixScanner(emptyScanner.id);
            focusMatrixScanner(emptyScanner.id);
            setIsBotPickerOpen(false);
            return;
        }

        const scannerId = addMatrixScannerForStrategy(strategyId);
        setMatrixScannerName(scannerId, strategyName);
        toggleMatrixScanner(scannerId);
        focusMatrixScanner(scannerId);
        setIsBotPickerOpen(false);
    };

    const commitAddSymbol = (scannerId: string, symbol: string) => {
        addMatrixScannerSymbol(scannerId, symbol);
        setAddingSymbolScannerId(null);
    };

    const commitAddTimeframe = (scannerId: string, timeframe: string) => {
        addMatrixScannerTimeframe(scannerId, timeframe);
        setAddingTfScannerId(null);
    };

    const openMatrixInNewTab = () => {
        const segments = window.location.pathname.split('/').filter(Boolean);
        const locale = segments[0] || 'en';
        window.open(`/${locale}/signals?focus=matrix`, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="flex flex-col gap-4">
            {!isSignalsPage && (
                <div className="flex items-center justify-end">
                    <button
                        type="button"
                        onClick={openMatrixInNewTab}
                        className="h-7 px-2 rounded-md border border-border/60 bg-secondary/20 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
                    >
                        <ExternalLink size={11} />
                        Open Matrix Tab
                    </button>
                </div>
            )}
            <BotPicker
                isOpen={isBotPickerOpen}
                strategies={strategies}
                onToggle={() => setIsBotPickerOpen((v) => !v)}
                onPickStrategy={handlePickStrategy}
            />

            {matrixScanners.length === 0 && (
                <div className="rounded-lg border border-border/60 p-3 text-xs text-muted-foreground">{t('noBot')}</div>
            )}

            {matrixScanners.map((scanner) => {
                const vm = scannerViewMap.get(scanner.id);
                if (!vm) return null;
                const selectedStrategy = scanner.strategyId ? strategies.find((s) => s.id === scanner.strategyId) || null : null;

                return (
                    <ScannerCard
                        key={scanner.id}
                        scanner={scanner}
                        vm={vm}
                        selectedStrategy={selectedStrategy}
                        isFocused={focusedMatrixScannerId === scanner.id}
                        symbolCandidates={symbolCandidates}
                        addingSymbolScannerId={addingSymbolScannerId}
                        addingTfScannerId={addingTfScannerId}
                        onFocusScanner={focusMatrixScanner}
                        onToggleScanner={toggleMatrixScanner}
                        onRemoveScanner={removeMatrixScanner}
                        onSetAddingSymbolScannerId={setAddingSymbolScannerId}
                        onSetAddingTfScannerId={setAddingTfScannerId}
                        onRemoveSymbol={removeMatrixScannerSymbol}
                        onRemoveTimeframe={removeMatrixScannerTimeframe}
                        onCommitAddSymbol={commitAddSymbol}
                        onCommitAddTimeframe={commitAddTimeframe}
                        onOpenChart={openChart}
                        setCardRef={(el) => {
                            cardRefs.current[scanner.id] = el;
                        }}
                    />
                );
            })}
        </div>
    );
}
