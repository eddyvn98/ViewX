'use client';

import { memo } from 'react';
import { X } from 'lucide-react';
import { useMarketStore } from '@/lib/store';

import { MarketListContent } from './MarketListContent';

interface MarketListProps {
    mode?: 'discovery' | 'watchlist';
}

function MarketListInternal({ mode = 'discovery' }: MarketListProps) {
    const isMarketListDialogOpen = useMarketStore((state) => state.isMarketListDialogOpen);
    const setMarketListDialogOpen = useMarketStore((state) => state.setMarketListDialogOpen);

    if (mode === 'discovery') {
        return (
            <MarketListContent
                mode="discovery"
                showSearchHeader
                prioritizeWatched
            />
        );
    }

    return (
        <>
            <MarketListContent
                mode="watchlist"
                showSearchHeader
                showOpenDialogButton
            />

            {isMarketListDialogOpen && (
                <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
                    <button
                        type="button"
                        aria-label="Close market list"
                        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
                        onClick={() => setMarketListDialogOpen(false)}
                    />
                    <div className="relative z-10 w-full max-w-4xl h-[min(78vh,760px)] rounded-3xl border border-white/10 bg-background/95 shadow-2xl overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-secondary/40">
                            <div>
                                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-foreground/90">Market List</h2>
                                <p className="text-xs text-muted-foreground mt-1">Watched symbols stay on top. Click a symbol to open it, or use the star to save it.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMarketListDialogOpen(false)}
                                className="h-9 w-9 rounded-xl border border-border bg-background/70 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all flex items-center justify-center"
                                aria-label="Close market list dialog"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="flex-1 min-h-0">
                            <MarketListContent
                                mode="discovery"
                                showSearchHeader
                                prioritizeWatched
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export const MarketList = memo(MarketListInternal);

export const MobileMarketPickerContent = memo(function MobileMarketPickerContent() {
    return (
        <MarketListContent
            mode="discovery"
            showSearchHeader
            prioritizeWatched
            closeDialogOnSelect={false}
            addToWatchlistOnSelect={false}
        />
    );
});
