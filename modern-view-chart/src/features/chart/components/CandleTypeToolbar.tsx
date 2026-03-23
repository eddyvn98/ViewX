'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMarketStore } from '@/lib/store';
import { CandleTypeSelector } from './CandleTypeSelector';
import { CHART_TYPE_CONFIG, ChartTypeOption } from './candle-type-config';

export function CandleTypeToolbar() {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const favoriteChartTypes = useMarketStore((state) => state.favoriteChartTypes || []);
    const setChartType = useMarketStore((state) => state.setChartType);

    const activeTabId = useMarketStore((state) => state.activeTabId);
    const activeTab = useMarketStore((state) => state.tabs[activeTabId]);
    const activeChartId = activeTab?.activeChartId;
    const currentType = (activeChartId ? activeTab?.charts?.[activeChartId]?.chartType : 'candles') as ChartTypeOption;

    const favorites = useMemo(
        () => CHART_TYPE_CONFIG.filter((item) => favoriteChartTypes.includes(item.id)),
        [favoriteChartTypes]
    );

    useEffect(() => {
        const onOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', onOutside);
        return () => document.removeEventListener('mousedown', onOutside);
    }, []);

    return (
        <div className="flex items-center gap-1 h-full" ref={containerRef}>
            <div className="flex items-center gap-0.5">
                {favorites.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => activeChartId && setChartType(activeChartId, item.id)}
                        className={cn(
                            'px-1.5 py-0.5 rounded text-[11px] font-bold transition-all',
                            currentType === item.id
                                ? 'text-primary bg-primary/10'
                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                        )}
                    >
                        {item.shortLabel}
                    </button>
                ))}
            </div>

            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        'p-0.5 rounded hover:bg-secondary/40 transition-all',
                        isOpen ? 'bg-secondary text-primary' : 'text-muted-foreground'
                    )}
                    title="Chart Type"
                >
                    <ChevronDown size={13} className={cn('transition-transform', isOpen && 'rotate-180')} />
                </button>
                {isOpen && <CandleTypeSelector onClose={() => setIsOpen(false)} />}
            </div>
        </div>
    );
}

