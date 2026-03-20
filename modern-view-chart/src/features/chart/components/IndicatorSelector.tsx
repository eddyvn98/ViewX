'use client';

import React, { useState, useMemo } from 'react';
import { useMarketStore } from '@/lib/store';
import { X, Plus, Search, Sparkles } from 'lucide-react';
import { INDICATOR_CATEGORIES } from './indicator-selector/indicator-selector-categories';
import { useLocale, useTranslations } from 'next-intl';

interface IndicatorSelectorProps {
    onClose: () => void;
    chartId: string;
}

type IndicatorTemplate = (typeof INDICATOR_CATEGORIES)[number]['indicators'][number];
type IndicatorTemplateDisplay = IndicatorTemplate & {
    displayName: string;
    displayDescription: string;
};
type IndicatorCategoryDisplay = {
    id: string;
    name: string;
    displayCategoryName: string;
    indicators: IndicatorTemplateDisplay[];
};

const CATEGORY_LABELS_VI: Record<string, string> = {
    averages: 'Duong trung binh',
    oscillators: 'Dao dong',
    volatility: 'Bien dong',
    'smart-analysis': 'Phan tich thong minh',
    fibonacci: 'Cong cu Fibonacci',
};

const VI_META: Record<string, { name: string; description: string }> = {
    EMA: { name: 'EMA', description: 'Duong trung binh luy thua, phan ung nhanh hon.' },
    SuperTrend: { name: 'SuperTrend', description: 'Xac dinh xu huong chinh dua tren ATR.' },
    VWAP: { name: 'VWAP', description: 'Gia trung binh theo khoi luong giao dich.' },
    SMA: { name: 'SMA', description: 'Duong trung binh don gian, theo doi xu huong.' },
    HMA: { name: 'HMA', description: 'Duong trung binh Hull, muot va it tre.' },
    Ichimoku: { name: 'Ichimoku', description: 'He thong tong quan xu huong va ho tro/khang cu.' },
    SAR: { name: 'Parabolic SAR', description: 'Chi bao bam xu huong va dao chieu.' },
    RSI: { name: 'RSI', description: 'Do luong trang thai qua mua va qua ban.' },
    Stochastic: { name: 'Stochastic', description: 'Dao dong dong luong de nhan dien qua mua/qua ban.' },
    ADX: { name: 'ADX', description: 'Do suc manh cua xu huong.' },
    MACD: { name: 'MACD', description: 'Dong luong dua tren hoi tu/phan ky trung binh dong.' },
    BollingerBands: { name: 'Bollinger Bands', description: 'Dai bien dong gia theo do lech chuan.' },
    ATR: { name: 'ATR', description: 'Do bien dong trung binh thuc te cua thi truong.' },
    TrendLines: { name: 'Duong xu huong', description: 'Ve duong xu huong tu cac dinh/day cau truc.' },
    MarketStructure: { name: 'Cau truc thi truong', description: 'Hien thi HH, HL, LH, LL tren bieu do.' },
    BreakoutRays: { name: 'Tia pha vo ngang', description: 'Ve cac muc ngang tai diem pha vo.' },
    OrderBlock: { name: 'Order Block (OB)', description: 'Xac dinh vung lenh lon cua Smart Money.' },
    FVG: { name: 'Fair Value Gap (FVG)', description: 'Tim vung mat can bang gia.' },
    Fibonacci: { name: 'Fibonacci Retracement', description: 'Tu dong ve cac muc hoi Fibonacci.' },
    FibonacciExtension: { name: 'Fibonacci Extension', description: 'Mo rong Fibonacci theo xu huong.' },
};

export function IndicatorSelector({ onClose, chartId }: IndicatorSelectorProps) {
    const t = useTranslations('ChartPanel.layerManager');
    const locale = useLocale();
    const addIndicator = useMarketStore(state => state.addIndicator);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const isVi = locale === 'vi';

    const filteredCategories = useMemo<IndicatorCategoryDisplay[]>(() => {
        const q = searchQuery.trim().toLowerCase();
        const normalized = INDICATOR_CATEGORIES.map(category => ({
            ...category,
            displayCategoryName: isVi ? (CATEGORY_LABELS_VI[category.id] || category.name) : category.name,
            indicators: category.indicators.map(indicator => {
                const vi = VI_META[indicator.type];
                const displayName = isVi && vi ? vi.name : indicator.type;
                const displayDescription = isVi && vi ? vi.description : indicator.name;
                return { ...indicator, displayName, displayDescription };
            }),
        }));

        if (!q) return normalized;

        return normalized
            .map(category => ({
                ...category,
                indicators: category.indicators.filter(ind =>
                    ind.type.toLowerCase().includes(q) ||
                    ind.displayName.toLowerCase().includes(q) ||
                    ind.displayDescription.toLowerCase().includes(q)
                ),
            }))
            .filter(category => category.indicators.length > 0);
    }, [isVi, searchQuery]);

    const handleAdd = (indicator: IndicatorTemplateDisplay) => {
        addIndicator(chartId, {
            type: indicator.type,
            params: { ...indicator.defaultParams },
            color: indicator.defaultColor,
            visible: true,
            lineWidth: 2,
            pane: indicator.pane,
        });
        onClose();
    };

    return (
        <div className="absolute inset-0 z-50 flex flex-col glass-panel animate-in fade-in zoom-in-95 duration-200">
            <div className="px-4 py-3 border-b border-white/5 bg-white/5 backdrop-blur-xl flex items-center justify-between min-h-[52px]">
                {!isSearching ? (
                    <>
                        <div className="flex flex-col">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary text-glow-primary">
                                {t('indicators')}
                            </h3>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setIsSearching(true)} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground transition-all">
                                <Search size={14} />
                            </button>
                            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-white transition-all active:scale-95">
                                <X size={16} />
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center gap-2 animate-in slide-in-from-right-2 duration-200">
                        <Search size={14} className="text-primary shrink-0" />
                        <input
                            autoFocus
                            type="text"
                            placeholder={t('searchIndicatorPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onBlur={() => !searchQuery && setIsSearching(false)}
                            className="flex-1 bg-transparent border-none py-1 text-[11px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none font-medium"
                        />
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setIsSearching(false);
                            }}
                            className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar touch-scrolling p-3 pb-10 space-y-4">
                {filteredCategories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-70 gap-3 text-foreground/70">
                        <Search size={24} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{t('noResults')}</span>
                    </div>
                ) : (
                    filteredCategories.map(category => (
                        <div key={category.id} className="space-y-1.5">
                            <div className="flex items-center gap-2 px-1">
                                <h4 className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{category.displayCategoryName}</h4>
                                <div className="h-[1px] flex-1 bg-white/5" />
                            </div>

                            <div className="grid gap-1">
                                {category.indicators.map(indicator => (
                                    <button
                                        key={`${indicator.type}-${indicator.pane}`}
                                        onClick={() => handleAdd(indicator)}
                                        className="group relative flex items-center justify-between gap-3 p-2.5 rounded-xl glass-card border-white/10 hover:glow-primary-border transition-all duration-300 text-left overflow-hidden active:scale-[0.98] min-h-[42px]"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 relative z-10">
                                            <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 relative group-hover:scale-110 transition-transform">
                                                <Sparkles size={11} className="text-primary animate-pulse" />
                                                {indicator.defaultColor !== '#ffffff' && (
                                                    <div
                                                        className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background shadow-sm"
                                                        style={{ backgroundColor: indicator.defaultColor }}
                                                    />
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[10px] font-bold text-foreground tracking-tight uppercase truncate">
                                                    {indicator.type === 'RSI' && indicator.pane === 'subchart' ? 'RSI (Sub)' : indicator.displayName}
                                                </span>
                                                <span className="text-[8px] text-muted-foreground/75 font-semibold truncate leading-none">{indicator.displayDescription}</span>
                                            </div>
                                        </div>

                                        <Plus size={12} className="text-muted-foreground/50 group-hover:text-primary transition-all shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
