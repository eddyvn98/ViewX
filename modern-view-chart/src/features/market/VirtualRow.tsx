'use client';

import type { RowComponentProps } from 'react-window';
import type { DataSource } from './market-list-constants';
import { TickerRow } from './TickerRow';
import type { SymbolDisplayMeta } from './build-symbol-list';

export interface RowData {
    items: { symbol: string; source: DataSource; meta?: SymbolDisplayMeta }[];
    mode: 'discovery' | 'watchlist';
    activeChartSymbol: string | null;
    watchedSet: Set<string>;
    onSelect: (symbol: string, source: DataSource) => void;
    onAdd: (symbol: string) => void;
    onRemove: (symbol: string) => void;
}

export function VirtualRow({ index, style, ...data }: RowComponentProps<RowData>) {
    const item = data.items[index];
    if (!item) return null;

    return (
        <div style={style}>
            <TickerRow
                symbol={item.symbol}
                source={item.source}
                meta={item.meta}
                mode={data.mode}
                isActive={data.activeChartSymbol === item.symbol}
                isWatched={data.watchedSet.has(item.symbol)}
                onSelect={data.onSelect}
                onAdd={data.onAdd}
                onRemove={data.onRemove}
            />
        </div>
    );
}
