import React from 'react';
import { Alert, useMarketStore } from '@/lib/store';
import { getNearElement } from '../logic/chart-hit-test';
import { useChartContextMenu } from './use-chart-context-menu';
import { buildMt5WriteFields, type Mt5TradingIdentity } from '@/lib/mt5/trading-request';
import { resolveChartIdentityDataSource } from '@/lib/mt5/account-scope';
import { normalizeSymbol } from '@/lib/utils/symbol';

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
    const dataSource = React.useMemo(
        () => resolveChartIdentityDataSource(source, mt5Identity),
        [source, mt5Identity],
    );
    const personalMt5 = String(source || '').trim().toUpperCase() === 'MT5_PERSONAL';

    const contextMenuHitTest = React.useCallback((y: number, x: number) => {
        const store = useMarketStore.getState();
        const normSymbol = normalizeSymbol(symbol);
        const scopedTicker = symbol
            ? store.tickers[`${dataSource}:${symbol}`] || store.tickers[`${dataSource}:${normSymbol}`]
            : undefined;
        const scopedInfo = symbol
            ? store.symbolInfo[`${dataSource}:${symbol}`] || store.symbolInfo[`${dataSource}:${normSymbol}`]
            : undefined;
        const draftSource = store.draftOrder?.source
            ? resolveChartIdentityDataSource(store.draftOrder.source || undefined, store.draftOrder)
            : dataSource;
        const state = {
            positions: store.positions.filter((item) => String(item.source || 'MT5') === dataSource),
            orders: store.orders.filter((item) => String(item.source || 'MT5') === dataSource),
            draftOrder: draftSource === dataSource ? store.draftOrder : null,
            symbolInfo: personalMt5 ? scopedInfo : (scopedInfo || (symbol ? store.symbolInfo[normSymbol] : undefined)),
            alerts,
            currentPrice: personalMt5
                ? (scopedTicker?.price || 0)
                : (scopedTicker?.price || (symbol ? store.tickers[symbol]?.price || store.tickers[normSymbol]?.price : 0) || 0),
        };

        return getNearElement(
            y,
            x,
            seriesRef.current,
            mainContainerRef.current,
            symbol,
            state
        );
    }, [alerts, dataSource, mainContainerRef, personalMt5, seriesRef, symbol]);

    const { contextMenu, handleContextMenu, closeContextMenu } = useChartContextMenu(
        priceChartRef,
        priceContainerRef,
        seriesRef,
        undefined,
        contextMenuHitTest
    );

    const onCancelOrder = React.useCallback((ticket: string | number) => {
        const normalizedSource = String(source || '').trim().toUpperCase();
        if (normalizedSource !== 'MT5' && normalizedSource !== 'MT5_PERSONAL') return;
        sendMessage({ topic: 'mt5_command', command: 'delete', ticket: String(ticket), target: source || 'MT5', ...buildMt5WriteFields(mt5Identity) });
    }, [sendMessage, source, mt5Identity]);

    const onClosePosition = React.useCallback((ticket: string | number) => {
        const normalizedSource = String(source || '').trim().toUpperCase();
        if (normalizedSource !== 'MT5' && normalizedSource !== 'MT5_PERSONAL') return;
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
