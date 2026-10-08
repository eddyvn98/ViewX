'use client';

import React, { memo, useState } from 'react';
import Link from 'next/link';
import { Menu, BarChart2, Zap, Pencil, Star, X, BrainCircuit, HeartHandshake } from 'lucide-react';
import { useMarketStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { RootState } from '@/lib/store';
import { CHART_TYPE_CONFIG, ChartTypeOption } from '@/features/chart/components/candle-type-config';
import { useLocale } from 'next-intl';

interface MobileTopBarProps {
    className?: string;
    compact?: boolean;
    mini?: boolean;
}

export const MobileTopBar = memo(function MobileTopBar({ className, compact = false, mini = false }: MobileTopBarProps) {
    const locale = useLocale();
    const [isChartTypePanelOpen, setIsChartTypePanelOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<ChartTypeOption>('candles');
    const [selectedSide, setSelectedSide] = useState<'up' | 'down'>('up');
    const {
        activeMobileTab,
        setActiveMobileTab,
        activeChart
    } = useMarketStore(useShallow((state: RootState) => {
        const activeTab = state.activeTabId ? state.tabs[state.activeTabId] : null;
        const activeChartId = activeTab?.activeChartId;
        const activeChart = activeChartId ? activeTab.charts[activeChartId] : null;
        return {
            activeMobileTab: state.activeMobileTab,
            setActiveMobileTab: state.setActiveMobileTab,
            activeChart
        };
    }));

    const setChartType = useMarketStore((state) => state.setChartType);
    const updateChart = useMarketStore((state) => state.updateChart);
    const favoriteChartTypes = useMarketStore((state) => state.favoriteChartTypes || []);
    const toggleFavoriteChartType = useMarketStore((state) => state.toggleFavoriteChartType);
    const isDrawingToolbarVisible = useMarketStore((state) => state.isDrawingToolbarVisible);
    const toggleDrawingToolbar = useMarketStore((state) => state.toggleDrawingToolbar);

    const handleMenuClick = () => {
        if (activeMobileTab === 'menu') {
            setActiveMobileTab('chart');
        } else {
            setActiveMobileTab('menu');
        }
    };

    const handleIndicatorsClick = () => {
        if (activeMobileTab === 'indicators') {
            setActiveMobileTab('chart');
        } else {
            setActiveMobileTab('indicators');
        }
    };

    const handleChartTypeClick = () => {
        setIsChartTypePanelOpen((prev) => !prev);
    };

    const handleDrawingClick = () => {
        if (activeMobileTab !== 'chart') setActiveMobileTab('chart');
        toggleDrawingToolbar();
    };

    const handleAiClick = () => {
        if (activeMobileTab === 'ai_overlay') {
            setActiveMobileTab('chart');
            return;
        }
        setActiveMobileTab('ai_overlay');
    };

    const getChartTypeLabel = (type: string | undefined) => {
        switch (type) {
            case 'heikin_ashi': return 'HA';
            case 'smart_candles': return 'SC';
            default: return 'C';
        }
    };
    const DEFAULT_UP = '#22c55e';
    const DEFAULT_DOWN = '#ef4444';

    const getPalette = (type: ChartTypeOption) => ({
        up: activeChart?.candleColors?.[type]?.up || DEFAULT_UP,
        down: activeChart?.candleColors?.[type]?.down || DEFAULT_DOWN,
    });

    const applyColor = (type: ChartTypeOption, side: 'up' | 'down', color: string) => {
        if (!activeChart) return;
        const next = {
            candles: activeChart.candleColors?.candles || { up: DEFAULT_UP, down: DEFAULT_DOWN },
            heikin_ashi: activeChart.candleColors?.heikin_ashi || { up: DEFAULT_UP, down: DEFAULT_DOWN },
            smart_candles: activeChart.candleColors?.smart_candles || { up: DEFAULT_UP, down: DEFAULT_DOWN },
        };
        next[type] = { ...next[type], [side]: color };
        updateChart(activeChart.id, { candleColors: next });
    };

    const presetColors = ['#22c55e', '#10b981', '#3b82f6', '#6366f1', '#a855f7', '#ef4444', '#f97316', '#eab308', '#ec4899', '#94a3b8'];

    React.useEffect(() => {
        if (!activeChart) return;
        setSelectedType((activeChart.chartType || 'candles') as ChartTypeOption);
    }, [activeChart?.id, activeChart?.chartType]);

    return (
        <>
        <div className={cn(
            "flex items-center justify-between shrink-0 bg-background/80 backdrop-blur-md border-b border-border z-50 sticky top-0 transition-all duration-300",
            mini ? "px-2 h-8" : compact ? "px-2 h-10" : "px-4 h-12",
            className
        )}>
            {/* Left: Menu */}
            <button
                onClick={handleMenuClick}
                aria-label="Open chart menu"
                aria-pressed={activeMobileTab === 'menu'}
                className={cn(
                    "p-2 -ml-2 rounded-full transition-colors active:scale-95",
                    activeMobileTab === 'menu' ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                )}
            >
                <Menu size={20} />
            </button>

            {/* Center: Chart Controls */}
            <div className={cn("flex items-center", mini ? "gap-1" : compact ? "gap-1.5" : "gap-3")}>
                <button
                    onClick={handleChartTypeClick}
                    aria-label="Choose chart type"
                    aria-expanded={isChartTypePanelOpen}
                    className={cn(
                        "touch-target flex items-center rounded-full text-xs font-bold transition-all active:scale-95 border",
                        compact ? "gap-1 px-2 py-1" : "gap-1.5 px-3 py-1.5",
                        activeChart?.chartType !== 'candles'
                            ? "text-primary border-primary/30 bg-primary/10 shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                            : "text-muted-foreground border-border/50 bg-secondary/30"
                    )}
                >
                    <BarChart2 size={14} />
                    {!mini && <span>{getChartTypeLabel(activeChart?.chartType)}</span>}
                </button>

                <button
                    onClick={handleIndicatorsClick}
                    aria-label="Open indicators"
                    aria-pressed={activeMobileTab === 'indicators'}
                    className={cn(
                        "touch-target flex items-center rounded-full text-xs font-bold transition-all active:scale-95 border",
                        compact ? "gap-1 px-2 py-1" : "gap-1.5 px-3 py-1.5",
                        activeMobileTab === 'indicators'
                            ? "text-blue-500 border-blue-500/30 bg-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.15)]"
                            : "text-muted-foreground border-border/50 bg-secondary/30"
                    )}
                >
                    <Zap size={14} />
                    {!mini && <span>Fx</span>}
                </button>

                <button
                    onClick={handleDrawingClick}
                    aria-label="Toggle drawing toolbar"
                    aria-pressed={isDrawingToolbarVisible}
                    className={cn(
                        "touch-target flex items-center rounded-full text-xs font-bold transition-all active:scale-95 border",
                        compact ? "gap-1 px-2 py-1" : "gap-1.5 px-3 py-1.5",
                        isDrawingToolbarVisible
                            ? "text-primary border-primary/30 bg-primary/10 shadow-[0_0_10px_rgba(59,130,246,0.15)]"
                            : "text-muted-foreground border-border/50 bg-secondary/30"
                    )}
                    title="Toggle Drawing Toolbar"
                >
                    <Pencil size={14} />
                    {!compact && !mini && <span>Draw</span>}
                </button>
            </div>

            {/* Right: AI + Support */}
            <div className={cn("flex items-center", compact ? "gap-1" : "gap-2")}>
                <button
                    onClick={handleAiClick}
                    aria-label="Toggle AI assistant"
                    aria-pressed={activeMobileTab === 'ai_overlay'}
                    className={cn(
                        "touch-target flex items-center rounded-full text-xs font-bold transition-all active:scale-95 border",
                        compact ? "gap-1 px-2 py-1" : "gap-1.5 px-3 py-1.5",
                        activeMobileTab === 'ai_overlay'
                            ? "text-primary border-primary/30 bg-primary/10 shadow-[0_0_10px_rgba(59,130,246,0.15)]"
                            : "text-muted-foreground border-border/50 bg-secondary/30"
                    )}
                    title="Toggle AI assistant"
                >
                    <BrainCircuit size={14} />
                    {!mini && <span>AI</span>}
                </button>
                <Link
                    href={`/${locale}/pricing`}
                    aria-label="Support Vivutrade"
                    className={cn(
                        "flex items-center rounded-full border font-black transition-all active:scale-95",
                        compact ? "px-2 py-1" : "px-3 py-1.5",
                        "bg-amber-500 text-slate-950 border-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.35)] hover:bg-amber-400"
                    )}
                    title="Ủng hộ Vivutrade"
                >
                    <HeartHandshake size={14} />
                </Link>
            </div>
        </div>

        {isChartTypePanelOpen && activeChart && (
            <div className="fixed inset-0 z-[120] bg-black/35 backdrop-blur-[1px]">
                <div className="absolute inset-x-2 top-14 rounded-xl border border-border bg-background/95 shadow-2xl p-3">
                    <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-foreground/80 uppercase tracking-wide">Loại Nến</span>
                        <button
                            onClick={() => setIsChartTypePanelOpen(false)}
                            aria-label="Close chart type picker"
                            className="touch-target p-1 rounded hover:bg-secondary/40 text-muted-foreground"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-3 gap-1.5">
                            {CHART_TYPE_CONFIG.map((item) => {
                                const isTypeActive = selectedType === item.id;
                                const isFav = favoriteChartTypes.includes(item.id);
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            setSelectedType(item.id);
                                            setChartType(activeChart.id, item.id);
                                        }}
                                        className={cn(
                                            'relative rounded-lg border px-2 py-2 text-[11px] font-semibold text-left transition-all',
                                            isTypeActive ? 'border-primary/35 bg-primary/10 text-primary' : 'border-border/30 bg-secondary/10 text-muted-foreground'
                                        )}
                                    >
                                        {item.label}
                                        <span
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFavoriteChartType(item.id);
                                            }}
                                            className={cn('absolute right-1 top-1', isFav ? 'text-yellow-500' : 'text-muted-foreground/50')}
                                        >
                                            <Star size={11} fill={isFav ? 'currentColor' : 'none'} />
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="rounded-lg border border-border/30 bg-secondary/10 p-2">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                                Loại đang sửa: {CHART_TYPE_CONFIG.find((i) => i.id === selectedType)?.label}
                            </div>
                            <div className="flex items-center gap-2 mb-3">
                                <button
                                    onClick={() => setSelectedSide('up')}
                                    className={cn(
                                        'flex-1 rounded-lg border px-2 py-2 text-left',
                                        selectedSide === 'up' ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-border/30 bg-background/50'
                                    )}
                                >
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 mb-1">Nến Tăng</div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-6 rounded border border-border/30" style={{ backgroundColor: getPalette(selectedType).up }} />
                                        <span className="text-[10px] font-mono text-muted-foreground">{getPalette(selectedType).up.toUpperCase()}</span>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setSelectedSide('down')}
                                    className={cn(
                                        'flex-1 rounded-lg border px-2 py-2 text-left',
                                        selectedSide === 'down' ? 'border-rose-500/50 bg-rose-500/10' : 'border-border/30 bg-background/50'
                                    )}
                                >
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-rose-600 mb-1">Nến Giảm</div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-6 rounded border border-border/30" style={{ backgroundColor: getPalette(selectedType).down }} />
                                        <span className="text-[10px] font-mono text-muted-foreground">{getPalette(selectedType).down.toUpperCase()}</span>
                                    </div>
                                </button>
                            </div>

                            <div className="grid grid-cols-10 gap-1.5">
                                {presetColors.map((color) => (
                                    <button
                                        key={`${selectedType}-${selectedSide}-${color}`}
                                        onClick={() => applyColor(selectedType, selectedSide, color)}
                                        className="h-5 w-5 rounded border border-border/30"
                                        style={{ backgroundColor: color }}
                                        aria-label={`Set ${selectedSide} candle color to ${color}`}
                                        title="Chọn màu"
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    );
});
