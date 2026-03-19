'use client';

import React from 'react';
import { useMarketStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import {
    Layers,
    TrendingUp,
    Zap,
    Combine,
    Box,
    Workflow
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SMART_ANALYSIS_TYPES } from '../indicators/registry/indicator-categories';

interface SmartAnalysisTogglesProps {
    chartId: string;
}

export function SmartAnalysisToggles({ chartId }: SmartAnalysisTogglesProps) {
    const indicators = useMarketStore(useShallow(
        state => (state.chartIndicators[chartId] || []).filter(i => SMART_ANALYSIS_TYPES.includes(i.type))
    ));

    const toggleIndicatorVisibility = useMarketStore(state => state.toggleIndicatorVisibility);

    if (indicators.length === 0) return null;

    const getIcon = (type: string) => {
        switch (type.toUpperCase()) {
            case 'MARKET_STRUCTURE':
            case 'MARKETSTRUCTURE':
                return <Layers size={14} />;
            case 'TREND_LINES':
            case 'TRENDLINES':
                return <TrendingUp size={14} />;
            case 'BREAKOUT_RAYS':
            case 'BREAKOUTRAYS':
                return <Zap size={14} />;
            case 'FIBONACCI':
                return <Combine size={14} />;
            case 'ORDERBLOCK':
                return <Box size={14} />;
            case 'FVG':
                return <Workflow size={14} />;
            default:
                return <Zap size={14} />;
        }
    };

    const getShortName = (type: string) => {
        switch (type.toUpperCase()) {
            case 'MARKET_STRUCTURE':
            case 'MARKETSTRUCTURE':
                return 'MS';
            case 'TREND_LINES':
            case 'TRENDLINES':
                return 'TL';
            case 'BREAKOUT_RAYS':
            case 'BREAKOUTRAYS':
                return 'BR';
            case 'FIBONACCI':
                return 'FIB';
            case 'ORDERBLOCK':
                return 'OB';
            case 'FVG':
                return 'FVG';
            default:
                return type;
        }
    };

    return (
        <div className="flex flex-wrap gap-1 mt-2">
            {indicators.map((ind: any) => (
                <button
                    key={ind.id}
                    onClick={() => toggleIndicatorVisibility(chartId, ind.id)}
                    className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-bold transition-all border pointer-events-auto",
                        ind.visible
                            ? "bg-primary/20 border-primary/40 text-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.2)]"
                            : "bg-secondary/5 border-border/10 text-muted-foreground/60 hover:text-foreground hover:bg-secondary/10"
                    )}
                    title={`${ind.type} (${ind.visible ? 'Visible' : 'Hidden'})`}
                >
                    {getIcon(ind.type)}
                    <span className="uppercase tracking-tighter">{getShortName(ind.type)}</span>
                </button>
            ))}
        </div>
    );
}
