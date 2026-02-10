'use client';

import React, { useRef, memo, useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useChartInit } from './hooks/use-chart-init';
import { useChartData } from './hooks/use-chart-data';
// import { useChartCrosshair } from './hooks/use-chart-crosshair';
import { useChartPositions } from './hooks/use-chart-positions';
import { useChartOrders } from './hooks/use-chart-orders';
import { useChartDraftOrder } from './hooks/use-chart-draft-order';
import { useChartIndicators } from './hooks/use-chart-indicators';
import { useChartAlerts } from './hooks/use-chart-alerts';
import { useChartInteraction } from './hooks/use-chart-interaction';
import { useChartScaleReset } from './hooks/use-chart-scale-reset';
import { useChartContextMenu } from './hooks/use-chart-context-menu';
import { useSubchartSwitcher } from './hooks/use-subchart-switcher';
import { useChartLayoutEffects } from './hooks/use-chart-layout-effects';
import { useChartShortcuts } from './hooks/use-chart-shortcuts';
import { useWebSocket } from '@/hooks/use-websocket';
import { getNearElement } from './logic/chart-hit-test';

import { CandleCountdown } from './components/CandleCountdown';
import { ChartOverlay } from './components/ChartOverlay';
import { SubchartLegend } from './components/SubchartLegend';
import { SubchartIndicatorsTabs } from './components/SubchartIndicatorsTabs';
import { ChartLegend } from './components/ChartLegend';
import { ChartContextMenu } from './components/ChartContextMenu';
import { OrderLineTags } from './components/OrderLineTags';
import { ChartTradingOverlay } from './components/ChartTradingOverlay';
import { PositionModifier } from '../terminal/components/PositionModifier';
import { ChevronUp, ChevronDown } from 'lucide-react';

const EMPTY_CANDLES: any[] = [];

export const ChartContainer = memo(function ChartContainer({ chartId, isNarrow }: { chartId: string, isNarrow?: boolean }) {
    const positions = useMarketStore((state) => state.positions);
    const orders = useMarketStore((state) => state.orders);

    const chartInstance = useMarketStore((state) => {
        for (const tab of Object.values(state.tabs)) {
            if (tab.charts[chartId]) return tab.charts[chartId];
        }
        return null;
    });

    const symbol = chartInstance?.symbol;
    const interval = chartInstance?.interval;
    const source = chartInstance?.source;
    const timezone = chartInstance?.timezone || 'Asia/Ho_Chi_Minh';

    const normSymbol =
        (symbol || '').toLowerCase().endsWith('m')
            ? symbol!.replace(/[mM]$/, 'm')
            : symbol;

    const key = `${source}:${normSymbol}:${interval}`;
    // ⚡ CPU OPTIMIZATION: Only re-render if the COUNT of candles changes (new candle finalized)
    // For per-tick updates, components use internal subscriptions or DOM-based updates
    const candlesCount = useMarketStore(state => (state.candleData[key] || EMPTY_CANDLES).length);
    const candles = useMarketStore.getState().candleData[key] || EMPTY_CANDLES;

    /* ================= REFS ================= */
    const mainContainerRef = useRef<HTMLDivElement>(null);
    const priceContainerRef = useRef<HTMLDivElement>(null);
    const subchartContainerRef = useRef<HTMLDivElement>(null);
    const timescaleContainerRef = useRef<HTMLDivElement>(null);

    const { isReady, priceChartRef, subchartChartRef, timescaleChartRef, seriesRef, subSyncRef, timescaleSyncRef, syncRange } =
        useChartInit(priceContainerRef, subchartContainerRef, timescaleContainerRef, chartId);

    /* ================= DATA ================= */
    const chartType = chartInstance?.chartType || 'candles';

    /* ================= DATA ================= */
    const { sendMessage } = useWebSocket();
    useChartData(chartId, symbol, interval, source, chartType, priceChartRef, subchartChartRef, seriesRef, subSyncRef, timescaleSyncRef, isReady);

    /* ================= OVERLAYS ================= */
    const filteredPositions = React.useMemo(() => {
        const result = positions.filter(p => !source || ((p as any).source || 'MT5') === source);
        // console.log(`[DEBUG] Chart ${source} filtered ${result.length}/${positions.length} positions`);
        return result;
    }, [positions, source]);

    const filteredOrders = React.useMemo(() => {
        const result = orders.filter(o => !source || ((o as any).source || 'MT5') === source);
        // console.log(`[DEBUG] Chart ${source} filtered ${result.length}/${orders.length} orders`);
        return result;
    }, [orders, source]);

    // useChartCrosshair(chartId, priceChartRef, seriesRef);
    useChartPositions(symbol, seriesRef, filteredPositions, priceChartRef, source);
    useChartOrders(symbol, seriesRef, filteredOrders, source);
    useChartDraftOrder(symbol, seriesRef, isReady, source);

    /* ================= INDICATORS ================= */
    useChartIndicators(
        chartId,
        priceChartRef,
        subchartChartRef,
        seriesRef,
        candles,
        symbol,
        timezone,
        syncRange,
        undefined, // Removed currentPrice from props (hook now handles it if needed)
        isReady
    );

    /* ================= ALERTS ================= */
    const {
        alerts,
        handleAddAlertAtPrice,
        handleRemoveAlert,
        handleUpdateAlertPrice,
        getAlertNearPrice,
    } = useChartAlerts(chartId, priceChartRef, seriesRef, symbol);

    useChartInteraction(
        priceChartRef,
        seriesRef,
        symbol,
        mainContainerRef,
        alerts,
        handleUpdateAlertPrice,
        handleRemoveAlert,
        sendMessage
    );


    useChartScaleReset(
        priceChartRef,
        subchartChartRef,
        timescaleChartRef,
        mainContainerRef, // Updated to use parent container
        subchartContainerRef,
        timescaleContainerRef
    );

    /* ================= CONTEXT MENU ================= */
    const contextMenuHitTest = (y: number, x: number) => {
        const store = useMarketStore.getState();
        const state = {
            positions: store.positions,
            orders: store.orders,
            draftOrder: store.draftOrder,
            symbolInfo: symbol ? store.symbolInfo[symbol] : undefined,
            alerts: alerts, // From useChartAlerts hook
            currentPrice: symbol ? (store.tickers[`${source}:${symbol}`]?.price || store.tickers[symbol]?.price || 0) : 0
        };

        return getNearElement(
            y, x, seriesRef.current, mainContainerRef.current, symbol, state
        );
    };

    const { contextMenu, handleContextMenu, closeContextMenu } = useChartContextMenu(
        priceChartRef,
        priceContainerRef,
        seriesRef,
        getAlertNearPrice,
        contextMenuHitTest
    );

    /* ================= SUBCHART LOGIC ================= */
    const [isSubchartVisible, setIsSubchartVisible] = useState(true);
    useSubchartSwitcher(chartId, subchartContainerRef, subchartChartRef);

    /* ================= LAYOUT EFFECTS ================= */
    useChartLayoutEffects(
        priceChartRef,
        subchartChartRef,
        timescaleChartRef,
        timezone,
        isSubchartVisible
    );
    useChartShortcuts(chartId);

    /* ================= CROSSHAIR STATE (Removed - now handled via DOM) ================= */

    /* ================= MOBILE VIEW OPTIMIZATION ================= */
    const isMinimized = useMarketStore(state => (state.activeMobileTab === 'trade' || state.activeMobileTab === 'positions'));

    return (
        <div
            className="w-full h-full relative flex flex-col bg-[#131722]"
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

            <ChartLegend
                chartId={chartId}
                symbol={chartInstance?.symbol}
                interval={chartInstance?.interval}
                source={chartInstance?.source}
                candles={candles}
                chartType={chartType}
                priceChart={priceChartRef.current}
                series={seriesRef.current}
            />

            {/* MAIN CHART AREA WITH OVERLAY */}
            <div ref={mainContainerRef} className="flex-1 relative min-h-0">
                {/* PRICE CHART (Main) - Always background */}
                <div ref={priceContainerRef} className="w-full h-full" />

                {/* ORDER LINE TAGS (Draggable Handles) */}
                <OrderLineTags
                    symbol={symbol}
                    seriesRef={seriesRef}
                    priceChartRef={priceChartRef}
                    isReady={isReady}
                    sendMessage={sendMessage}
                    source={source}
                />

                {/* CANDLE COUNTDOWN OVERLAY */}
                <CandleCountdown
                    chart={priceChartRef.current}
                    series={seriesRef.current}
                    interval={interval}
                />

                {/* ON-CHART TRADING BUTTONS & CONFIRMATION */}
                <ChartTradingOverlay symbol={symbol} source={source} />

                {/* SUBCHART CONTROL PANEL (ASSEMBLY) */}
                <div
                    className={cn(
                        "absolute right-[50px] md:right-[80px] z-30 flex items-end transition-all duration-300",
                        isMinimized && isSubchartVisible ? "bottom-[32px]" : (isSubchartVisible ? "bottom-[25%]" : "bottom-0")
                    )}
                >
                    <SubchartIndicatorsTabs
                        chartId={chartId}
                        isSubchartVisible={isSubchartVisible}
                    />

                    <button
                        onClick={() => setIsSubchartVisible(!isSubchartVisible)}
                        className={cn(
                            "px-3 md:px-4 py-1 rounded-tr-md border border-zinc-700/40 border-b-0 border-l-0 transition-all active:scale-95 flex items-center gap-1.5 backdrop-blur-md",
                            isSubchartVisible
                                ? "bg-[#1e222d]/80 text-[#787b86] hover:text-blue-400"
                                : "bg-blue-600/30 text-blue-400"
                        )}
                        style={{ marginLeft: '-1px' }}
                    >
                        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-tight md:tracking-widest whitespace-nowrap">
                            {isSubchartVisible ? 'Hide' : (
                                <>
                                    <span className="md:inline hidden">Show Indicator</span>
                                    <span className="md:hidden inline">Show</span>
                                </>
                            )}
                        </span>
                        {isSubchartVisible ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                    </button>
                </div>

                {/* RSI SUBCHART (Overlay) - Floating at bottom */}
                <div
                    className={cn(
                        "absolute bottom-0 left-0 right-0 z-10 border-t border-blue-500/30 transition-all duration-300 transform overflow-hidden",
                        isSubchartVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none",
                        isMinimized && isSubchartVisible ? "h-[32px] bg-[#131722]" : "h-[25%] min-h-[100px] bg-[#131722]/50 backdrop-blur-md"
                    )}
                >
                    {/* Visual Border Highlight */}
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                    {/* RSI/MACD LEGEND */}
                    <div className="absolute left-3 top-[5%] z-10 pointer-events-none select-none">
                        <SubchartLegend
                            chartId={chartId}
                            symbol={chartInstance?.symbol}
                            interval={chartInstance?.interval}
                            source={chartInstance?.source}
                        />
                    </div>
                    <div ref={subchartContainerRef} className="w-full h-full" />
                </div>
            </div>

            <div className="h-[1px] bg-zinc-800" />

            {/* TIMESCALE FOOTER */}
            <div className="h-[38px] relative overflow-hidden shrink-0 bg-[#131722]">
                <div ref={timescaleContainerRef} className="w-full h-full" />
            </div>

            {/* CONTEXT MENU */}
            {contextMenu && (
                <ChartContextMenu
                    visible={contextMenu.visible}
                    x={contextMenu.x}
                    y={contextMenu.y}
                    price={contextMenu.price}
                    nearAlertId={contextMenu.nearAlertId}
                    hitItem={contextMenu.hitItem}
                    onAddAlert={handleAddAlertAtPrice}
                    onRemoveAlert={handleRemoveAlert}
                    onCancelOrder={(ticket) => {
                        sendMessage({ topic: 'mt5_command', command: 'delete', ticket: String(ticket), target: source || 'MT5' });
                    }}
                    onClosePosition={(ticket) => {
                        sendMessage({ topic: 'mt5_command', command: 'close', ticket: String(ticket), target: source || 'MT5' });
                    }}
                    onCancelDraft={() => {
                        useMarketStore.getState().setDraftOrder(null);
                    }}
                    onClose={closeContextMenu}
                />
            )}
        </div>
    );
});
