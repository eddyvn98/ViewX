'use client';
/* eslint-disable react-hooks/refs */

import React, { memo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
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
    const t = useTranslations('ChartPanel.history');

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
        isLoadingOlderHistory,
        filteredPositions,
        filteredOrders
    } = useChartRuntime(chartId);

    const sendMessageUnknown = useCallback((data: unknown) => {
        sendMessage(data as Parameters<typeof sendMessage>[0]);
    }, [sendMessage]);

    useChartPositions(symbol, seriesRef, filteredPositions, priceChartRef);
    useChartOrders(symbol, seriesRef, filteredOrders);
    useChartDraftOrder(symbol, seriesRef, isReady);

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
        symbol,
        mainContainerRef,
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
        mainContainerRef,
        subchartContainerRef,
        timescaleContainerRef,
        isAutoScrollEnabledRef
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
    const toggleSubchartVisibility = useMarketStore(state => state.toggleSubchartVisibility);
    const setIsSubchartVisible = (visible: boolean) => toggleSubchartVisibility(chartId, visible);

    useSubchartSwitcher(chartId, subchartContainerRef);

    useChartLayoutEffects(
        priceChartRef,
        subchartChartRef,
        timescaleChartRef,
        timezone,
        isSubchartVisible
    );
    useChartShortcuts(chartId);

    const isMinimized = useMarketStore(state => state.activeMobileTab === 'positions');

    return (
        <div
            className="relative flex h-full min-h-0 w-full min-w-0 flex-col bg-theme-pattern"
            onContextMenu={handleContextMenu}
        >
            <ChartOverlay
                chartId={chartId}
                symbol={chartInstance?.symbol}
                interval={chartInstance?.interval}
                source={chartInstance?.source}
                candles={candles}
            />
            {isLoadingOlderHistory && (
                <div className="pointer-events-none absolute left-2 top-2 z-30 rounded-md border border-primary/25 bg-background/85 px-2 py-1 text-[10px] font-semibold text-primary shadow-sm backdrop-blur-sm">
                    {t('loadingMore')}
                </div>
            )}

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
