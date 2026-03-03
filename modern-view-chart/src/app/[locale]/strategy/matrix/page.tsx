'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMarketStore } from '@/lib/store';
import { useStrategyStore } from '@/features/strategy/store/strategy-store';
import { buildMatrixCellState } from '@/features/strategy/dashboard/matrix-cell-state';
import { compareTimeframe, normalizeDashboardSymbol, normalizeDashboardTf, sortSymbols, timeframeToChartInterval } from '@/features/strategy/dashboard/matrix-utils';
import { useStrategyMatrixMonitor } from '@/features/strategy/dashboard/use-strategy-matrix-monitor';
import { calculateRSI } from '@/features/chart/utils/indicators/rsi';
import { StrategyRunnerBootstrap } from '@/features/strategy/components/StrategyRunnerBootstrap';

export default function StrategyMatrixPage() {
    useStrategyMatrixMonitor();
    const router = useRouter();
    const [symbolInput, setSymbolInput] = useState('');
    const [timeframeInput, setTimeframeInput] = useState('');
    const [isSymbolSuggestOpen, setIsSymbolSuggestOpen] = useState(false);

    const {
        matrixConfig,
        strategies,
        signals,
        virtualPositions,
        addMatrixSymbol,
        removeMatrixSymbol,
        addMatrixTimeframe,
        removeMatrixTimeframe,
        setMatrixSymbolSortMode,
        setMatrixSignalTtlMultiplier,
        setMatrixSignalTtlFloorSec,
    } = useStrategyStore();

    const activeTabId = useMarketStore((state) => state.activeTabId);
    const tabs = useMarketStore((state) => state.tabs);
    const availableSymbols = useMarketStore((state) => state.availableSymbols);
    const watchlist = useMarketStore((state) => state.watchlist);
    const tickers = useMarketStore((state) => state.tickers);
    const candleData = useMarketStore((state) => state.candleData);
    const setChartSymbol = useMarketStore((state) => state.setChartSymbol);
    const setChartTimeframe = useMarketStore((state) => state.setChartTimeframe);
    const setActiveMobileTab = useMarketStore((state) => state.setActiveMobileTab);
    const addChart = useMarketStore((state) => state.addChart);

    const sortedTimeframes = useMemo(
        () => [...matrixConfig.timeframes].sort(compareTimeframe),
        [matrixConfig.timeframes]
    );

    const sortedSymbols = useMemo(
        () => sortSymbols(matrixConfig.symbols, matrixConfig.symbolSortMode),
        [matrixConfig.symbols, matrixConfig.symbolSortMode]
    );

    const symbolCandidates = useMemo(() => {
        const fromAvailable = availableSymbols.map((s: any) => normalizeDashboardSymbol(s?.symbol)).filter(Boolean);
        const fromTickers = Object.keys(tickers).map((s) => normalizeDashboardSymbol(s)).filter(Boolean);
        const fromWatchlist = watchlist.map((s) => normalizeDashboardSymbol(s)).filter(Boolean);
        return Array.from(new Set([...fromAvailable, ...fromTickers, ...fromWatchlist]));
    }, [availableSymbols, tickers, watchlist]);

    const filteredSymbolCandidates = useMemo(() => {
        const q = symbolInput.trim().toLowerCase();
        const list = q
            ? symbolCandidates.filter((s) => s.toLowerCase().includes(q))
            : symbolCandidates;
        return list
            .filter((s) => !matrixConfig.symbols.some((x) => x.toLowerCase() === s.toLowerCase()))
            .slice(0, 12);
    }, [symbolCandidates, symbolInput, matrixConfig.symbols]);

    const cellMap = useMemo(() => {
        const now = Date.now();
        const map = new Map<string, ReturnType<typeof buildMatrixCellState>>();
        for (const symbol of sortedSymbols) {
            for (const timeframe of sortedTimeframes) {
                const cell = buildMatrixCellState({
                    symbol,
                    timeframe,
                    strategies,
                    signals,
                    virtualPositions,
                    matrixConfig,
                    getCandles: (s, tf) => {
                        const interval = timeframeToChartInterval(tf);
                        const key = `MT5:${s}:${interval}`;
                        return candleData[key] || [];
                    },
                    nowMs: now,
                });
                map.set(`${symbol}__${timeframe}`, cell);
            }
        }
        return map;
    }, [sortedSymbols, sortedTimeframes, strategies, signals, virtualPositions, matrixConfig, candleData]);

    const rsiMap = useMemo(() => {
        const map = new Map<string, number | null>();
        for (const symbol of sortedSymbols) {
            for (const tf of sortedTimeframes) {
                const interval = timeframeToChartInterval(tf);
                const key = `MT5:${symbol}:${interval}`;
                const candles = candleData[key] || [];
                if (!Array.isArray(candles) || candles.length < 15) {
                    map.set(`${symbol}__${tf}`, null);
                    continue;
                }
                const closes = candles.map((c: any) => Number(c?.close)).filter((v: number) => Number.isFinite(v));
                if (closes.length < 15) {
                    map.set(`${symbol}__${tf}`, null);
                    continue;
                }
                const rsi = calculateRSI(closes, 14);
                const last = rsi[rsi.length - 1];
                map.set(`${symbol}__${tf}`, Number.isFinite(last) ? Number(last) : null);
            }
        }
        return map;
    }, [sortedSymbols, sortedTimeframes, candleData]);

    const handleOpenChart = (symbol: string, timeframe: string) => {
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
        router.push('/');
    };

    const handleAddSymbol = () => {
        const normalized = normalizeDashboardSymbol(symbolInput);
        if (!normalized) return;
        addMatrixSymbol(normalized);
        setSymbolInput('');
        setIsSymbolSuggestOpen(false);
    };

    const handlePickSymbol = (symbol: string) => {
        setSymbolInput(symbol);
        addMatrixSymbol(symbol);
        setSymbolInput('');
        setIsSymbolSuggestOpen(false);
    };

    const handleAddTimeframe = () => {
        const normalized = normalizeDashboardTf(timeframeInput);
        if (!normalized) return;
        addMatrixTimeframe(normalized);
        setTimeframeInput('');
    };

    return (
        <div className="h-screen overflow-hidden bg-background text-foreground flex flex-col">
            <StrategyRunnerBootstrap />
            <header className="shrink-0 border-b border-border/60 px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Link href="/" className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground">
                        <ArrowLeft size={14} />
                        Back
                    </Link>
                    <div className="text-sm font-black uppercase tracking-wider">Strategy Matrix (Entry Ready)</div>
                </div>
            </header>

            <div className="shrink-0 border-b border-border/60 px-4 py-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <input
                            value={symbolInput}
                            onChange={(e) => {
                                setSymbolInput(e.target.value);
                                setIsSymbolSuggestOpen(true);
                            }}
                            onFocus={() => setIsSymbolSuggestOpen(true)}
                            onBlur={() => setTimeout(() => setIsSymbolSuggestOpen(false), 120)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddSymbol();
                                }
                            }}
                            placeholder="Add symbol (e.g. XAUUSDm)"
                            className="h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm"
                        />
                        {isSymbolSuggestOpen && filteredSymbolCandidates.length > 0 && (
                            <div className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded-md border border-border/70 bg-background shadow-xl">
                                {filteredSymbolCandidates.map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => handlePickSymbol(s)}
                                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-secondary/40"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button onClick={handleAddSymbol} className="h-9 px-3 rounded-md border border-primary/40 text-primary text-xs font-bold inline-flex items-center gap-1">
                        <Plus size={12} /> Add
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        value={timeframeInput}
                        onChange={(e) => setTimeframeInput(e.target.value)}
                        placeholder="Add timeframe (e.g. 30m, 1h)"
                        className="h-9 flex-1 rounded-md border border-border/70 bg-background px-2 text-sm"
                    />
                    <button onClick={handleAddTimeframe} className="h-9 px-3 rounded-md border border-primary/40 text-primary text-xs font-bold inline-flex items-center gap-1">
                        <Plus size={12} /> Add
                    </button>
                </div>
                <div className="flex items-center gap-2 justify-start lg:justify-end flex-wrap">
                    <button
                        onClick={() => setMatrixSymbolSortMode('added')}
                        className={cn("h-9 px-3 rounded-md text-xs font-bold border", matrixConfig.symbolSortMode === 'added' ? "border-primary/40 text-primary bg-primary/10" : "border-border/70 text-muted-foreground")}
                    >
                        Added
                    </button>
                    <button
                        onClick={() => setMatrixSymbolSortMode('abc')}
                        className={cn("h-9 px-3 rounded-md text-xs font-bold border", matrixConfig.symbolSortMode === 'abc' ? "border-primary/40 text-primary bg-primary/10" : "border-border/70 text-muted-foreground")}
                    >
                        ABC
                    </button>
                    <input
                        type="number"
                        min={1}
                        value={matrixConfig.signalTtlMultiplier}
                        onChange={(e) => setMatrixSignalTtlMultiplier(Number(e.target.value))}
                        className="h-9 w-20 rounded-md border border-border/70 bg-background px-2 text-xs"
                        title="TTL multiplier"
                    />
                    <input
                        type="number"
                        min={1}
                        value={matrixConfig.signalTtlFloorSec}
                        onChange={(e) => setMatrixSignalTtlFloorSec(Number(e.target.value))}
                        className="h-9 w-24 rounded-md border border-border/70 bg-background px-2 text-xs"
                        title="TTL floor seconds"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
                <div className="min-w-[760px] group/matrix">
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0 z-20">
                            <tr>
                                <th className="sticky left-0 z-30 bg-background border border-border/60 p-2 text-left text-xs font-black uppercase tracking-wider">Symbol</th>
                                {sortedTimeframes.map((tf) => (
                                    <th key={tf} className="group bg-background border border-border/60 p-2 text-center text-xs font-black uppercase tracking-wider">
                                        <div className="flex items-center justify-center gap-1">
                                            <span>{tf}</span>
                                            <button
                                                onClick={() => removeMatrixTimeframe(tf)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-rose-400"
                                                title={`Remove ${tf}`}
                                            >
                                                <X size={11} />
                                            </button>
                                        </div>
                                    </th>
                                ))}
                                <th className="bg-background border border-dashed border-border/60 p-1 text-center">
                                    <button
                                        onClick={handleAddTimeframe}
                                        className="opacity-0 pointer-events-none group-hover/matrix:opacity-100 group-hover/matrix:pointer-events-auto w-full h-8 rounded-md border border-dashed border-border/70 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors inline-flex items-center justify-center gap-1 text-[11px] font-bold"
                                        title="Add timeframe from input"
                                    >
                                        <Plus size={12} />
                                        TF
                                    </button>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedSymbols.map((symbol) => (
                                <tr key={symbol}>
                                    <td className="group sticky left-0 z-10 bg-background border border-border/60 p-2 text-xs font-bold">
                                        <div className="flex items-center justify-between gap-2">
                                            <span>{symbol}</span>
                                            <button
                                                onClick={() => removeMatrixSymbol(symbol)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-rose-400"
                                                title={`Remove ${symbol}`}
                                            >
                                                <X size={11} />
                                            </button>
                                        </div>
                                    </td>
                                    {sortedTimeframes.map((tf) => {
                                        const cell = cellMap.get(`${symbol}__${tf}`);
                                        const signal = cell?.signal || 'NO_TRADE';
                                        const badge = cell?.badge || null;
                                        return (
                                            <td key={`${symbol}-${tf}`} className="border border-border/60 p-1">
                                                <button
                                                    onClick={() => handleOpenChart(symbol, tf)}
                                                    className={cn(
                                                        "w-full h-[54px] rounded-md border text-xs font-black tracking-wide relative transition-colors",
                                                        signal === 'BUY' && "bg-emerald-500/15 border-emerald-500/40 text-emerald-400",
                                                        signal === 'SELL' && "bg-rose-500/15 border-rose-500/40 text-rose-400",
                                                        signal === 'NO_TRADE' && "bg-secondary/20 border-border/60 text-muted-foreground"
                                                    )}
                                                >
                                                    {signal === 'NO_TRADE' ? 'NO TRADE' : signal}
                                                    {badge && (
                                                        <span className={cn(
                                                            "absolute top-1 right-1 px-1 py-0.5 rounded text-[9px] font-black border",
                                                            badge === 'OPEN' ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "bg-blue-500/20 border-blue-500/40 text-blue-300"
                                                        )}>
                                                            {badge}
                                                        </span>
                                                    )}
                                                </button>
                                            </td>
                                        );
                                    })}
                                    <td className="border border-border/60 bg-background/40" />
                                </tr>
                            ))}
                            <tr>
                                <td className="sticky left-0 z-10 bg-background border border-dashed border-border/60 p-1">
                                    <button
                                        onClick={handleAddSymbol}
                                        className="opacity-0 pointer-events-none group-hover/matrix:opacity-100 group-hover/matrix:pointer-events-auto w-full h-8 rounded-md border border-dashed border-border/70 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors inline-flex items-center justify-center gap-1 text-[11px] font-bold"
                                        title="Add symbol from input"
                                    >
                                        <Plus size={12} />
                                        SYMBOL
                                    </button>
                                </td>
                                {sortedTimeframes.map((tf) => (
                                    <td key={`empty-${tf}`} className="border border-border/60 bg-background/40" />
                                ))}
                                <td className="border border-dashed border-border/60 bg-background/20" />
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 min-w-[760px]">
                    <div className="mb-2 text-xs font-black uppercase tracking-wider text-muted-foreground">RSI Monitor (RSI 14)</div>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="sticky left-0 z-10 bg-background border border-border/60 p-2 text-left text-xs font-black uppercase tracking-wider">Symbol</th>
                                {sortedTimeframes.map((tf) => (
                                    <th key={`rsi-${tf}`} className="bg-background border border-border/60 p-2 text-center text-xs font-black uppercase tracking-wider">
                                        {tf}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedSymbols.map((symbol) => (
                                <tr key={`rsi-row-${symbol}`}>
                                    <td className="sticky left-0 z-10 bg-background border border-border/60 p-2 text-xs font-bold">{symbol}</td>
                                    {sortedTimeframes.map((tf) => {
                                        const value = rsiMap.get(`${symbol}__${tf}`) ?? null;
                                        const tone = value == null
                                            ? "text-muted-foreground"
                                            : value >= 70
                                                ? "text-rose-400"
                                                : value <= 30
                                                    ? "text-emerald-400"
                                                    : "text-foreground";
                                        return (
                                            <td key={`rsi-${symbol}-${tf}`} className="border border-border/60 p-2 text-center">
                                                <span className={cn("text-xs font-black", tone)}>
                                                    {value == null ? '--' : value.toFixed(1)}
                                                </span>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
