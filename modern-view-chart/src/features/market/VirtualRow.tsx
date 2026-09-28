'use client';

import type { RowComponentProps } from 'react-window';
import type { SymbolDescriptor } from '@/lib/store/types';
import { buildSymbolIdentityKey } from '@/lib/market/symbol-catalog';
import { TickerRow } from './TickerRow';

export interface RowData {
    items: SymbolDescriptor[];
    mode: 'discovery' | 'watchlist';
    activeChartKey: string | null;
    watchedSet: Set<string>;
    onSelect: (item: SymbolDescriptor) => void;
    onAdd: (item: SymbolDescriptor) => void;
    onRemove: (item: SymbolDescriptor) => void;
}

export function VirtualRow({ index, style, ...data }: RowComponentProps<RowData>) {
    const item = data.items[index];
    if (!item) return null;
    const identityKey = buildSymbolIdentityKey(item);

    return (
        <div style={style}>
            <TickerRow
                item={item}
                mode={data.mode}
                isActive={data.activeChartKey === identityKey}
                isWatched={data.watchedSet.has(identityKey)}
                onSelect={data.onSelect}
                onAdd={data.onAdd}
                onRemove={data.onRemove}
            />
        </div>
    );
}
