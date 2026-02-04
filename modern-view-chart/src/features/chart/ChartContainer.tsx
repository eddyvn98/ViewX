'use client';

import React, { useRef, memo, useEffect, useState, useCallback, useMemo } from 'react';
import { useMarketStore } from '@/lib/store';
import { useChartInit } from './hooks/use-chart-init';
import { useChartData } from './hooks/use-chart-data';
import { useChartCrosshair } from './hooks/use-chart-crosshair';
import { useChartPositions } from './hooks/use-chart-positions';
import { useChartOrders } from './hooks/use-chart-orders';
import { useChartDraftOrder } from './hooks/use-chart-draft-order';
import { useChartIndicators } from './hooks/use-chart-indicators';
import { useChartAlerts } from './hooks/use-chart-alerts';
import { Bell, BellOff, X } from 'lucide-react'; // Import Icons



import { useChartInteraction } from './hooks/use-chart-interaction';
import { ChartOverlay } from './components/ChartOverlay';
import { PositionModifier } from '../terminal/components/PositionModifier';
import { cn } from '@/lib/utils';
import { IndicatorPane } from './components/IndicatorPane';
import { useChartSync } from './hooks/use-chart-sync';
import { IChartApi } from 'lightweight-charts';

const EMPTY_CANDLES: any[] = [];
const EMPTY_INDICATORS: any[] = [];

export const ChartContainer = memo(function ChartContainer({ chartId }: { chartId: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [subCharts, setSubCharts] = useState<Record<string, IChartApi>>({});

    const positions = useMarketStore((state) => state.positions);
    const orders = useMarketStore((state) => state.orders);

    const activeTabId = useMarketStore(state => state.activeTabId);
    const chartInstance = useMarketStore((state) => {
        const tab = state.tabs[activeTabId || ''];
        return tab?.charts[chartId] || null;
    });

    const indicators = useMarketStore((state) => state.chartIndicators[chartId] || EMPTY_INDICATORS);

    const paneIndicators = useMemo(() => {
        return indicators.filter(ind => ind.visible && (ind.pane === 'rsi' || ind.type === 'RSI'));
    }, [indicators]);

    const symbol = chartInstance?.symbol;
    const interval = chartInstance?.interval;
    const source = chartInstance?.source;

    // KEY NORMALIZATION
    const normSymbol = (symbol || "").toLowerCase().endsWith('m') ? symbol!.replace(/[mM]$/, 'm') : symbol;
    const key = `${source}:${normSymbol}:${interval}`;
    const candles = useMarketStore((state) => state.candleData[key] || EMPTY_CANDLES);

    const { chartRef, seriesRef } = useChartInit(containerRef);

    // Synchronize Main chart + All Sub charts
    const subChartList = Object.values(subCharts);
    useChartSync([chartRef.current, ...subChartList]);

    useChartData(chartId, symbol, interval, source, chartRef, seriesRef);
    useChartCrosshair(chartId, chartRef, seriesRef);
    useChartPositions(symbol, seriesRef, positions, chartRef);
    useChartOrders(symbol, seriesRef, orders);
    useChartDraftOrder(symbol, seriesRef);

    // Indicators for Main Panel only
    const mainIndicators = useMemo(() =>
        indicators.filter(i => i.pane === 'main' || (!i.pane && i.type !== 'RSI')),
        [indicators]);
    useChartIndicators(chartId, chartRef, seriesRef, candles, symbol, mainIndicators);

    const { alerts, handleAddAlertAtPrice, handleRemoveAlert, handleUpdateAlertPrice, getAlertNearPrice } = useChartAlerts(chartId, chartRef, seriesRef, symbol);
    useChartInteraction(chartRef, seriesRef, symbol, containerRef, alerts, handleUpdateAlertPrice, handleRemoveAlert);

    // Pane management
    const registerSubChart = useCallback((id: string, chart: IChartApi) => {
        setSubCharts(prev => ({ ...prev, [id]: chart }));
    }, []);

    const unregisterSubChart = useCallback((id: string) => {
        setSubCharts(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    }, []);

    // Context Menu Handler
    const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; price: number; nearAlertId?: string } | null>(null);
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!chartRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;
        const price = seriesRef.current?.coordinateToPrice(y);
        if (price) {
            const nearAlert = getAlertNearPrice(y, x);
            setContextMenu({ visible: true, x: e.clientX, y: e.clientY, price, nearAlertId: nearAlert?.id });
        }
    };

    useEffect(() => {
        const checkClose = () => setContextMenu(null);
        window.addEventListener('click', checkClose);
        return () => window.removeEventListener('click', checkClose);
    }, []);

    return (
        <div className="w-full h-full relative bg-[#131722] overflow-hidden">
            {/* Main Chart Area - FULL SCREEN BACKDROP */}
            <div
                className="absolute inset-0 group/chart"
                onContextMenu={handleContextMenu}
            >
                <ChartOverlay
                    chartId={chartId}
                    symbol={chartInstance?.symbol}
                    interval={chartInstance?.interval}
                    source={chartInstance?.source}
                    candles={candles}
                />
                <PositionModifier />
                <div ref={containerRef} className="w-full h-full" />
            </div>

            {/* Scrollable Indicator Panes Overlay */}
            {paneIndicators.length > 0 && (
                <div className="absolute bottom-6 left-0 right-14 max-h-[45%] overflow-y-auto custom-scrollbar pointer-events-none z-20">
                    <div className="flex flex-col pointer-events-auto">
                        {paneIndicators.map((ind) => (
                            <IndicatorPane
                                key={ind.id}
                                chartId={chartId}
                                indicator={ind}
                                candles={candles}
                                onChartCreated={registerSubChart}
                                onChartDestroyed={unregisterSubChart}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Context Menu (same as before) */}
            {contextMenu && contextMenu.visible && (
                <div
                    className="fixed z-50 bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-xl py-1 w-48 animate-in fade-in zoom-in-95 duration-100"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {!contextMenu.nearAlertId ? (
                        <button
                            className="w-full text-left px-3 py-2 text-sm text-[#d1d4dc] hover:bg-[#2a2e39] flex items-center gap-2 transition-colors"
                            onClick={() => {
                                handleAddAlertAtPrice(contextMenu.price);
                                setContextMenu(null);
                            }}
                        >
                            <Bell size={14} className="text-orange-500" />
                            <span>Add Alert at {contextMenu.price.toFixed(symbol?.includes('JPY') ? 3 : 5)}</span>
                        </button>
                    ) : (
                        <button
                            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                            onClick={() => {
                                handleRemoveAlert(contextMenu.nearAlertId!);
                                setContextMenu(null);
                            }}
                        >
                            <BellOff size={14} />
                            <span>Remove Alert</span>
                        </button>
                    )}
                    <div className="h-[1px] bg-[#2a2e39] my-1" />
                    <button
                        className="w-full text-left px-3 py-2 text-sm text-[#d1d4dc] hover:bg-[#2a2e39] flex items-center gap-2 transition-colors"
                        onClick={() => setContextMenu(null)}
                    >
                        <X size={14} className="text-zinc-500" />
                        <span>Cancel</span>
                    </button>
                </div>
            )}
        </div>
    );
});

