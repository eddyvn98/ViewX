'use client';
/* eslint-disable react-hooks/refs */

import React, { memo, useCallback } from 'react';
import { useMarketStore } from '@/lib/store';
import { useChartPositions } from './hooks/use-chart-positions';
import { useChartOrders } from './hooks/use-chart-orders';
import { useChartDraftOrder } from './hooks/use-chart-draft-order';
import { useChartIndicators } from './hooks/use-chart-indicators';
import { useChartAlerts } from './hooks/use-chart-alerts';
import { useChartInteraction } from './hooks/use-chart-interaction';
import { useChartScaleReset } from './hooks/use-chart-scale-reset';
import { useSubchartSwitcher } from './hooks/use-subchart-switcher';
import { useChartLayoutEffects } from './hooks/use-chart-layout-effects';
import { useChartShortcuts } from './hooks/use-chart-shortcuts';
import { useChartDrawings } from './hooks/use-chart-drawings';
import { useChartRuntime } from './hooks/use-chart-runtime';
import { useChartContextActions } from './hooks/use-chart-context-actions';
import { useForecastRenderer } from './hooks/use-forecast-renderer';

import { CandleCountdown } from './components/CandleCountdown';
import { ChartOverlay } from './components/ChartOverlay';
import { ChartLegend } from './components/ChartLegend';
import { ChartContextMenu } from './components/ChartContextMenu';
import { OrderLineTags } from './components/OrderLineTags';
import { AlertLineTags } from './components/AlertLineTags';
import { ChartTradingOverlay } from './components/ChartTradingOverlay';
import { PositionModifier } from '../terminal/components/PositionModifier';
import { StrategyMarkers } from '../strategy/components/StrategyMarkers';
import { DrawingToolbar } from './components/DrawingToolbar';
import { ChartPanels } from './components/ChartPanels';

export const ChartContainer = memo(function ChartContainer({ chartId, isNarrow }: { chartId: string, isNarrow?: boolean }) {
    void isNarrow;

    const {
        chartInstance,
        symbol,
        interval,
        source,
        timezone,
        chartType,
        candles,
        mainContainerRef,
        priceContainerRef,
        subchartContainerRef,
        timescaleContainerRef,
        isReady,
        priceChartRef,
        subchartChartRef,
        timescaleChartRef,
        seriesRef,
        markerSeriesRef,
        syncRange,
        isAutoScrollEnabledRef,
        sendMessage,
        realTimeCandleRef,
        filteredPositions,
        filteredOrders
    } = useChartRuntime(chartId);

    const sendMessageUnknown = useCallback((data: unknown) => {
        sendMessage(data as Parameters<typeof sendMessage>[0]);
    }, [sendMessage]);

    useChartPositions(symbol, seriesRef, filteredPositions, priceChartRef);
    useChartOrders(symbol, seriesRef, filteredOrders);
    useChartDraftOrder(symbol, seriesRef, isReady);
    useForecastRenderer(priceChartRef.current, chartId, isReady);

    useChartIndicators(
        chartId,
        priceChartRef,
        subchartChartRef,
        seriesRef,
        markerSeriesRef,
        candles,
        symbol,
        interval,
        source,
        timezone,
        syncRange,
        undefined,
        isReady
    );

    useChartDrawings(
        chartId,
        priceChartRef.current,
        seriesRef.current,
        isReady,
        priceContainerRef,
        symbol,
        interval,
        source,
        candles
    );

    const { alerts, handleAddAlertAtPrice, handleRemoveAlert, handleUpdateAlertPrice } = useChartAlerts(
        chartId,
        priceChartRef,
        seriesRef,
        symbol
    );

    useChartInteraction(
        priceChartRef,
        seriesRef,
        markerSeriesRef,
        symbol,
        mainContainerRef,
        priceContainerRef,
        isReady,
        alerts,
        handleUpdateAlertPrice,
        handleRemoveAlert,
        sendMessageUnknown
    );

    useChartScaleReset(
        priceChartRef,
        subchartChartRef,
        timescaleChartRef,
        priceContainerRef,
        subchartContainerRef,
        timescaleContainerRef,
        isAutoScrollEnabledRef,
        candles as import('@/lib/store/types').Candle[]
    );

    const {
        contextMenu,
        handleContextMenu,
        closeContextMenu,
        onAddAlert,
        onRemoveAlert,
        onCancelOrder,
        onClosePosition,
        onCancelDraft
    } = useChartContextActions({
        symbol,
        source,
        priceChartRef,
        priceContainerRef,
        seriesRef,
        mainContainerRef,
        alerts,
        handleAddAlertAtPrice,
        handleRemoveAlert,
        sendMessage: sendMessageUnknown
    });

    const isSubchartVisible = useMarketStore(state => {
        const activeTab = state.tabs[state.activeTabId];
        return activeTab?.charts[chartId]?.isSubchartVisible ?? true;
    });
    const subchartHeightPct = useMarketStore(state => {
        const activeTab = state.tabs[state.activeTabId];
        return activeTab?.charts[chartId]?.subchartHeightPct ?? 25;
    });
    const toggleSubchartVisibility = useMarketStore(state => state.toggleSubchartVisibility);
    const setSubchartHeightPct = useMarketStore(state => state.setSubchartHeightPct);
    const resetSubchartHeightPct = useMarketStore(state => state.resetSubchartHeightPct);
    const setIsSubchartVisible = (visible: boolean) => toggleSubchartVisibility(chartId, visible);
    const onSetSubchartHeightPct = (heightPct: number) => setSubchartHeightPct(chartId, heightPct);
    const onResetSubchartHeightPct = () => resetSubchartHeightPct(chartId);

    useSubchartSwitcher(chartId, subchartContainerRef);

    useChartLayoutEffects(
        priceChartRef,
        subchartChartRef,
        timescaleChartRef,
        timezone,
        isReady,
        isSubchartVisible,
        subchartHeightPct
    );
    useChartShortcuts(chartId);

    const isMinimized = useMarketStore(state => state.activeMobileTab === 'positions');

    return (
        <div
            className="w-full h-full relative flex flex-col bg-theme-pattern"
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

            <ChartPanels
                chartId={chartId}
                symbol={chartInstance?.symbol}
                interval={chartInstance?.interval}
                source={chartInstance?.source}
                candles={candles}
                isSubchartVisible={isSubchartVisible}
                setIsSubchartVisible={setIsSubchartVisible}
                subchartHeightPct={subchartHeightPct}
                setSubchartHeightPct={onSetSubchartHeightPct}
                resetSubchartHeightPct={onResetSubchartHeightPct}
                isMinimized={isMinimized}
                mainContainerRef={mainContainerRef}
                priceContainerRef={priceContainerRef}
                subchartContainerRef={subchartContainerRef}
                timescaleContainerRef={timescaleContainerRef}
            >
                <CandleCountdown
                    chart={priceChartRef.current}
                    series={seriesRef.current}
                    interval={interval}
                    realTimeRef={realTimeCandleRef}
                />

                <OrderLineTags
                    symbol={symbol}
                    seriesRef={seriesRef}
                    priceChartRef={priceChartRef}
                    isReady={isReady}
                    sendMessage={sendMessage}
                    source={source}
                    interval={interval}
                />

                <AlertLineTags
                    symbol={symbol}
                    seriesRef={seriesRef}
                    priceChartRef={priceChartRef}
                    isReady={isReady}
                />

                <ChartTradingOverlay symbol={symbol} source={source} />

                {isReady && priceChartRef.current && seriesRef.current && symbol && (
                    <StrategyMarkers
                        chart={priceChartRef.current}
                        mainSeries={seriesRef.current}
                        symbol={symbol}
                        interval={interval}
                    />
                )}
            </ChartPanels>

            <DrawingToolbar chartId={chartId} />

            {contextMenu && (
                <ChartContextMenu
                    visible={contextMenu.visible}
                    x={contextMenu.x}
                    y={contextMenu.y}
                    price={contextMenu.price}
                    nearAlertId={contextMenu.nearAlertId}
                    hitItem={contextMenu.hitItem}
                    onAddAlert={onAddAlert}
                    onRemoveAlert={onRemoveAlert}
                    onCancelOrder={onCancelOrder}
                    onClosePosition={onClosePosition}
                    onCancelDraft={onCancelDraft}
                    onClose={closeContextMenu}
                />
            )}
        </div>
    );
});
