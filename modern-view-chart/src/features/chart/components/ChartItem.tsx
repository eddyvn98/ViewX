'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Maximize2, ExternalLink, X, Link, Bell } from 'lucide-react';
import { useMarketStore, ChartInstance } from '@/lib/store';
import { ChartContainer } from '../ChartContainer';
import { cn } from '@/lib/utils';


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

    const containerRef = useRef<HTMLDivElement>(null);
    const [isNarrow, setIsNarrow] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                // Determine if width is narrow (e.g., < 450px)
                setIsNarrow(entry.contentRect.width < 450);
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={containerRef}
            onClick={() => setActiveChart(chart.id)}
            onDoubleClick={() => toggleMaximizeChart(isMaximized ? null : chart.id)}
            className={cn(
                "group relative rounded-xl border flex flex-col bg-background transition-all duration-300 overflow-hidden",
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
                                const groups: any = { 'none': 'A', 'A': 'B', 'B': 'C', 'C': 'D', 'D': 'none' };
                                updateChart(chart.id, { group: groups[chart.group || 'none'] });
                            }}
                            className={cn(
                                "flex items-center justify-center w-5 h-5 rounded-lg transition-all shrink-0 active:scale-90",
                                !chart.group || chart.group === 'none'
                                    ? "text-muted-foreground/30 hover:text-foreground hover:bg-secondary"
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
                                "text-[10px] font-bold uppercase tracking-wider transition-colors",
                                isActive ? "text-foreground" : "text-foreground/70"
                            )}>
                                {chart.symbol}
                            </span>
                            <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tight">{chart.interval} • {chart.source}</span>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const store = useMarketStore.getState();
                                const price = store.tickers[`${chart.source}:${chart.symbol}`]?.price || store.tickers[chart.symbol]?.price || 0;
                                if (price > 0) {
                                    store.addAlert({
                                        symbol: chart.symbol,
                                        price: price,
                                        active: true,
                                        type: 'crossing'
                                    });
                                }
                            }}
                            className="ml-0.5 p-1 text-muted-foreground/30 hover:text-amber-500 hover:bg-amber-500/5 rounded-lg transition-all group/bell"
                            title="Quick Alert"
                        >
                            <Bell size={11} className="group-hover/bell:animate-bounce" />
                        </button>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                        <button onClick={(e) => { e.stopPropagation(); toggleMaximizeChart(isMaximized ? null : chart.id); }} className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all" title={isMaximized ? "Restore" : "Maximize"}><Maximize2 size={11} /></button>
                        <a
                            href={`/chart/${chart.id}?symbol=${chart.symbol}&interval=${chart.interval}&source=${chart.source}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                                e.preventDefault();
                                const width = 1200;
                                const height = 800;
                                const left = (window.screen.width - width) / 2;
                                const top = (window.screen.height - height) / 2;
                                window.open(
                                    `/chart/${chart.id}?symbol=${chart.symbol}&interval=${chart.interval}&source=${chart.source}`,
                                    `chart_${chart.id}`,
                                    `width=${width},height=${height},left=${left},top=${top},menubar=no,location=no,status=no,toolbar=no,scrollbars=no`
                                );
                            }}
                            className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all"
                            title="Pop out"
                        >
                            <ExternalLink size={11} />
                        </a>
                        {canClose && <button onClick={(e) => { e.stopPropagation(); removeChart(chart.id); }} className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all" title="Close"><X size={11} /></button>}
                    </div>
                </div>
            </div>
            <div className="flex-1 min-h-0"><ChartContainer chartId={chart.id} isNarrow={isNarrow} /></div>
        </div>
    );
}
