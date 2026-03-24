'use client';

import React, { useMemo, useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { X, Plus, Search, Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { filterIndicatorCategories } from './indicator-selector/indicator-selector-filter';
import { CATEGORY_I18N, INDICATOR_I18N } from './indicator-selector/indicator-localization';

interface IndicatorSelectorProps {
    onClose: () => void;
    chartId: string;
}

export function IndicatorSelector({ onClose, chartId }: IndicatorSelectorProps) {
    const t = useTranslations('ChartPanel.layerManager');
    const locale = useLocale();
    const lang = locale === 'vi' ? 'vi' : 'en';

    const addIndicator = useMarketStore(state => state.addIndicator);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const filteredCategories = useMemo(() => filterIndicatorCategories(searchQuery), [searchQuery]);

    const handleAdd = (indicator: any) => {
        addIndicator(chartId, {
            type: indicator.type as any,
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
                            <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-primary text-glow-primary">
                                {t('tabs.indicators')}
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
                            className="flex-1 bg-transparent border-none py-1 text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none font-medium"
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
                    <div className="flex flex-col items-center justify-center py-20 opacity-10 gap-3">
                        <Search size={24} />
                        <span className="text-[9px] font-bold uppercase tracking-widest">{t('noResults')}</span>
                    </div>
                ) : (
                    filteredCategories.map(category => (
                        <div key={category.id} className="space-y-1.5">
                            <div className="flex items-center gap-2 px-1">
                                <h4 className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">
                                    {CATEGORY_I18N[category.id]?.[lang] ?? category.name}
                                </h4>
                                <div className="h-[1px] flex-1 bg-white/5" />
                            </div>

                            <div className="grid gap-1">
                                {category.indicators.map(indicator => (
                                    <button
                                        key={`${indicator.type}-${indicator.pane}`}
                                        onClick={() => handleAdd(indicator)}
                                        className="group relative flex items-center justify-between gap-3 p-2.5 rounded-xl glass-card border-white/5 hover:glow-primary-border transition-all duration-300 text-left overflow-hidden active:scale-[0.98] min-h-[42px]"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 relative z-10">
                                            <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 relative group-hover:scale-110 transition-transform">
                                                <Sparkles size={10} className="text-primary animate-pulse" />
                                                {indicator.defaultColor !== '#ffffff' && (
                                                    <div
                                                        className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background shadow-sm"
                                                        style={{ backgroundColor: indicator.defaultColor }}
                                                    />
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[10px] font-bold text-foreground tracking-tight uppercase truncate">
                                                    {indicator.type === 'RSI' && indicator.pane === 'subchart' ? 'RSI (Sub)' : indicator.type}
                                                </span>
                                                <span className="text-[8px] text-muted-foreground/40 font-semibold truncate leading-none">
                                                    {INDICATOR_I18N[indicator.type]?.[lang] ?? indicator.name}
                                                </span>
                                            </div>
                                        </div>

                                        <Plus size={12} className="text-muted-foreground/20 group-hover:text-primary transition-all shrink-0" />
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
