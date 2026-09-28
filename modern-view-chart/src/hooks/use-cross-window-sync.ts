'use client';

import { useEffect, useRef } from 'react';
import { useMarketStore } from '@/lib/store';
import type { SymbolDescriptor } from '@/lib/store/types';

const CHANNEL_NAME = 'market_sync_channel';

type SyncMessage =
    | { type: 'SYMBOL_CHANGE'; chartId: string; item: SymbolDescriptor }
    | { type: 'GROUP_SYMBOL_CHANGE'; group: string; item: SymbolDescriptor }
    | { type: 'CROSSHAIR_SYNC'; point: { time: number | null; price: number | null; sourceId: string | null } | null };

type CrosshairPoint = Extract<SyncMessage, { type: 'CROSSHAIR_SYNC' }>['point'];

export function useCrossWindowSync() {
    const channelRef = useRef<BroadcastChannel | null>(null);
    const setChartSymbol = useMarketStore((state) => state.setChartSymbol);
    const syncCrosshair = useMarketStore((state) => state.syncCrosshair);
    const isCrosshairSyncEnabled = useMarketStore((state) => state.isCrosshairSyncEnabled);

    useEffect(() => {
        let channel: BroadcastChannel | null = null;
        try {
            if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
                channel = new BroadcastChannel(CHANNEL_NAME);
                channelRef.current = channel;

                channel.onmessage = (event: MessageEvent<SyncMessage>) => {
                    const msg = event.data;

                    switch (msg.type) {
                        case 'SYMBOL_CHANGE':
                            setChartSymbol(msg.chartId, msg.item.symbol, msg.item.source, msg.item);
                            break;
                        case 'GROUP_SYMBOL_CHANGE':
                            const state = useMarketStore.getState();
                            Object.values(state.tabs).forEach(tab => {
                                Object.values(tab.charts).forEach(chart => {
                                    if (chart.group === msg.group) {
                                        setChartSymbol(chart.id, msg.item.symbol, msg.item.source, msg.item);
                                    }
                                });
                            });
                            break;
                        case 'CROSSHAIR_SYNC':
                            if (isCrosshairSyncEnabled) {
                                syncCrosshair(msg.point);
                            }
                            break;
                    }
                };
            }
        } catch (err) {
            console.warn('⚠️ BroadcastChannel not supported or restricted:', err);
        }

        return () => {
            if (channel) {
                channel.close();
            }
            channelRef.current = null;
        };
    }, [setChartSymbol, syncCrosshair, isCrosshairSyncEnabled]);

    // Function to broadcast symbol changes
    const broadcastSymbolChange = (chartId: string, item: SymbolDescriptor) => {
        channelRef.current?.postMessage({
            type: 'SYMBOL_CHANGE',
            chartId,
            item,
        });
    };

    // Function to broadcast symbol changes for a group
    const broadcastGroupSymbolChange = (group: string, item: SymbolDescriptor) => {
        channelRef.current?.postMessage({
            type: 'GROUP_SYMBOL_CHANGE',
            group,
            item,
        });
    };

    // Function to broadcast crosshair updates
    const broadcastCrosshair = (point: CrosshairPoint) => {
        channelRef.current?.postMessage({
            type: 'CROSSHAIR_SYNC',
            point
        });
    };

    return {
        broadcastSymbolChange,
        broadcastGroupSymbolChange,
        broadcastCrosshair
    };
}
