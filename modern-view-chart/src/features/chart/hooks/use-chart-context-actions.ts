import React from 'react';
import { Alert, useMarketStore } from '@/lib/store';
import { getNearElement } from '../logic/chart-hit-test';
import { useChartContextMenu } from './use-chart-context-menu';

interface ContextDeps {
    symbol: string | undefined;
    source: string | undefined;
    priceChartRef: React.RefObject<import('lightweight-charts').IChartApi | null>;
    priceContainerRef: React.RefObject<HTMLDivElement | null>;
    seriesRef: React.RefObject<import('lightweight-charts').ISeriesApi<'Candlestick'> | null>;
    mainContainerRef: React.RefObject<HTMLDivElement | null>;
    alerts: Alert[];
    handleAddAlertAtPrice: (price: number) => void;
    handleRemoveAlert: (id: string) => void;
    sendMessage: (data: unknown) => void;
}

export function useChartContextActions({
    symbol,
    source,
    priceChartRef,
    priceContainerRef,
    seriesRef,
    mainContainerRef,
    alerts,
    handleAddAlertAtPrice,
    handleRemoveAlert,
    sendMessage
}: ContextDeps) {
    const contextMenuHitTest = React.useCallback((y: number, x: number) => {
        const store = useMarketStore.getState();
        const state = {
            positions: store.positions,
            orders: store.orders,
            draftOrder: store.draftOrder,
            symbolInfo: symbol ? store.symbolInfo[symbol] : undefined,
            alerts,
            currentPrice: symbol ? (store.tickers[`${source}:${symbol}`]?.price || store.tickers[symbol]?.price || 0) : 0
        };

        return getNearElement(
            y,
            x,
            seriesRef.current,
            mainContainerRef.current,
            symbol,
            state
        );
    }, [alerts, mainContainerRef, seriesRef, source, symbol]);

    const { contextMenu, handleContextMenu, closeContextMenu } = useChartContextMenu(
        priceChartRef,
        priceContainerRef,
        seriesRef,
        undefined,
        contextMenuHitTest
    );

    const onCancelOrder = React.useCallback((ticket: string | number) => {
        sendMessage({ topic: 'mt5_command', command: 'delete', ticket: String(ticket), target: source || 'MT5' });
    }, [sendMessage, source]);

    const onClosePosition = React.useCallback((ticket: string | number) => {
        sendMessage({ topic: 'mt5_command', command: 'close', ticket: String(ticket), target: source || 'MT5' });
    }, [sendMessage, source]);

    const onCancelDraft = React.useCallback(() => {
        useMarketStore.getState().setDraftOrder(null);
    }, []);

    return {
        contextMenu,
        handleContextMenu,
        closeContextMenu,
        onAddAlert: handleAddAlertAtPrice,
        onRemoveAlert: handleRemoveAlert,
        onCancelOrder,
        onClosePosition,
        onCancelDraft
    };
}
