'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Maximize2, ExternalLink, X, Link, Bell } from 'lucide-react';
import { useMarketStore, ChartInstance } from '@/lib/store';
import { ChartContainer } from '../ChartContainer';
import { cn } from '@/lib/utils';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { formatChartTimeframe } from './timeframe-config';
import { resolveChartIdentityDataSource } from '@/lib/mt5/account-scope';


interface ChartItemProps {
    chart: ChartInstance;
    isActive: boolean;
    isMaximized: boolean;
    canClose: boolean;
}

export function ChartItem({ chart, isActive, isMaximized, canClose }: ChartItemProps) {
    const setActiveChart = useMarketStore((state) => state.setActiveChart);
    const toggleMaximizeChart = useMarketStore((state) => state.toggleMaximizeChart);
    const removeChart = useMarketStore((state) => state.removeChart);
    const updateChart = useMarketStore((state) => state.updateChart);
    const addNotification = useMarketStore((state) => state.addNotification);

    const containerRef = useRef<HTMLDivElement>(null);
    const [isNarrow, setIsNarrow] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                // Determine if width is narrow (e.g., < 450px)
                setIsNarrow(entry.contentRect.width < 450);
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const resolveAlertPrice = React.useCallback((): number => {
        const store = useMarketStore.getState();
        const normalizedSymbol = normalizeSymbol(chart.symbol);
        const dataSource = resolveChartIdentityDataSource(chart.source, chart);

        const directTicker = store.tickers[`${dataSource}:${normalizedSymbol}`]?.price;
        if (Number.isFinite(directTicker) && Number(directTicker) > 0) return Number(directTicker);

        const normalizedTicker = store.tickers[normalizedSymbol]?.price;
        if (Number.isFinite(normalizedTicker) && Number(normalizedTicker) > 0) return Number(normalizedTicker);

        const exactKey = `${dataSource}:${normalizedSymbol}:${chart.interval}`;
        const exactCandles = store.candleData[exactKey];
        const exactClose = exactCandles?.[exactCandles.length - 1]?.close;
        if (Number.isFinite(exactClose) && Number(exactClose) > 0) return Number(exactClose);

        const prefix = `${dataSource}:${normalizedSymbol}:`;
        const anyKey = Object.keys(store.candleData).find((key) => key.startsWith(prefix));
        if (anyKey) {
            const candles = store.candleData[anyKey];
            const close = candles?.[candles.length - 1]?.close;
            if (Number.isFinite(close) && Number(close) > 0) return Number(close);
        }

        return 0;
    }, [chart]);

    const popoutParams = new URLSearchParams({
        symbol: chart.symbol,
        interval: chart.interval,
        source: chart.source,
    });
    if (chart.accountLogin) popoutParams.set('accountLogin', chart.accountLogin);
    if (chart.terminalId) popoutParams.set('terminalId', chart.terminalId);
    if (chart.broker) popoutParams.set('broker', chart.broker);
    const popoutHref = `/chart/${chart.id}?${popoutParams.toString()}`;

    return (
        <div
            ref={containerRef}
            onClick={() => setActiveChart(chart.id)}
            onDoubleClick={() => toggleMaximizeChart(isMaximized ? null : chart.id)}
            className={cn(
                "group relative rounded-xl border flex flex-col bg-background transition-all duration-300 overflow-hidden h-full w-full min-h-0",
                isActive
                    ? "border-primary/40 ring-2 ring-primary/5 shadow-2xl shadow-primary/10 z-10"
                    : "border-border/30 hover:border-border/50"
            )}
        >
            <div className={cn(
                "bg-secondary/20 backdrop-blur-md border-b border-border/10 flex flex-col shrink-0 transition-colors",
                isActive && "bg-secondary/30",
                isNarrow ? "pb-0" : "pb-0"
            )}>
                {/* Row 1: Main Info & Actions */}
                <div className="px-2 py-0.5 flex justify-between items-center min-h-[26px]">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const groups: Record<'none' | 'A' | 'B' | 'C' | 'D', 'none' | 'A' | 'B' | 'C' | 'D'> = { 'none': 'A', 'A': 'B', 'B': 'C', 'C': 'D', 'D': 'none' };
                                updateChart(chart.id, { group: groups[chart.group || 'none'] });
                            }}
                            aria-label={`Change symbol link group for ${chart.symbol}`}
                            className={cn(
                                "touch-target flex items-center justify-center w-5 h-5 rounded-lg transition-all shrink-0 active:scale-90",
                                !chart.group || chart.group === 'none'
                                    ? "text-muted-foreground hover:text-foreground hover:bg-secondary"
                                    : chart.group === 'A' ? "text-emerald-500 bg-emerald-500/10" :
                                        chart.group === 'B' ? "text-primary bg-primary/10" :
                                            chart.group === 'C' ? "text-orange-500 bg-orange-500/10" : "text-purple-500 bg-purple-500/10"
                            )}
                            title={`Symbol Link: ${chart.group || 'None'}`}
                        >
                            <Link size={10} strokeWidth={2.5} />
                        </button>
                        <div className="flex flex-row items-baseline gap-1.5">
                            <span className={cn(
                                "text-[11px] font-bold uppercase tracking-wider transition-colors",
                                isActive ? "text-foreground" : "text-foreground/70"
                            )}>
                                {chart.symbol}
                            </span>
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">{formatChartTimeframe(chart.interval)} • {chart.source}</span>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const store = useMarketStore.getState();
                                const price = resolveAlertPrice();
                                if (price > 0) {
                                    store.addAlert({
                                        symbol: chart.symbol,
                                        price: price,
                                        active: true,
                                        type: 'crossing'
                                    });
                                    addNotification(`Alert created: ${chart.symbol} @ ${price}`, 'success');
                                } else {
                                    addNotification(`Chua co gia realtime cho ${chart.symbol}. Thu lai sau vai giay.`, 'warning');
                                }
                            }}
                            aria-label={`Create quick alert for ${chart.symbol}`}
                            className="touch-target ml-0.5 p-1 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/5 rounded-lg transition-all group/bell"
                            title="Quick Alert"
                        >
                            <Bell size={11} className="group-hover/bell:animate-bounce" />
                        </button>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                        <button onClick={(e) => { e.stopPropagation(); toggleMaximizeChart(isMaximized ? null : chart.id); }} aria-label={isMaximized ? "Restore chart" : "Maximize chart"} className="touch-target p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all" title={isMaximized ? "Restore" : "Maximize"}><Maximize2 size={11} /></button>
                        <a
                            href={popoutHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                                e.preventDefault();
                                const width = 1200;
                                const height = 800;
                                const left = (window.screen.width - width) / 2;
                                const top = (window.screen.height - height) / 2;
                                window.open(
                                    popoutHref,
                                    `chart_${chart.id}`,
                                    `width=${width},height=${height},left=${left},top=${top},menubar=no,location=no,status=no,toolbar=no,scrollbars=no`
                                );
                            }}
                            aria-label="Open chart in a new window"
                            className="touch-target p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all"
                            title="Pop out"
                        >
                            <ExternalLink size={11} />
                        </a>
                        {canClose && <button onClick={(e) => { e.stopPropagation(); removeChart(chart.id); }} aria-label="Close chart" className="touch-target p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all" title="Close"><X size={11} /></button>}
                    </div>
                </div>
            </div>
            <div className="flex-1 min-h-0"><ChartContainer chartId={chart.id} isNarrow={isNarrow} /></div>
        </div>
    );
}
