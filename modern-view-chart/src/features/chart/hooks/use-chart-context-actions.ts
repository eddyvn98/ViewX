import React from 'react';
import { Alert, useMarketStore } from '@/lib/store';
import { getNearElement } from '../logic/chart-hit-test';
import { useChartContextMenu } from './use-chart-context-menu';
import { buildMt5WriteFields, type Mt5TradingIdentity } from '@/lib/mt5/trading-request';

interface ContextDeps {
    symbol: string | undefined;
    source: string | undefined;
    mt5Identity?: Mt5TradingIdentity;
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
    mt5Identity,
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
        sendMessage({ topic: 'mt5_command', command: 'delete', ticket: String(ticket), target: source || 'MT5', ...buildMt5WriteFields(mt5Identity) });
    }, [sendMessage, source, mt5Identity]);

    const onClosePosition = React.useCallback((ticket: string | number) => {
        sendMessage({ topic: 'mt5_command', command: 'close', ticket: String(ticket), target: source || 'MT5', ...buildMt5WriteFields(mt5Identity) });
    }, [sendMessage, source, mt5Identity]);

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
