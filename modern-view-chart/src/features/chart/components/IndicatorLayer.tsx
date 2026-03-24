import React, { useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { Plus, Layout } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { IndicatorSelector } from './IndicatorSelector';
import { IndicatorItem } from './indicator-layer/IndicatorItem';
import { isSmartAnalysisIndicator } from './indicator-layer/indicator-layer-actions';
import { useTranslations } from 'next-intl';

const EMPTY_INDICATORS: any[] = [];
const EMPTY_CHARTS: any = {};

export function IndicatorLayer() {
    const t = useTranslations('ChartPanel.layerManager');
    const activeTabId = useMarketStore(state => state.activeTabId);
    const charts = useMarketStore(useShallow(state => state.tabs[activeTabId || '']?.charts || EMPTY_CHARTS));
    const activeChartId = useMarketStore(state => state.tabs[activeTabId || '']?.activeChartId);

    const chartId = activeChartId || Object.keys(charts)[0];
    const indicators = useMarketStore(useShallow(state => chartId ? state.chartIndicators[chartId] || EMPTY_INDICATORS : EMPTY_INDICATORS));

    const updateIndicator = useMarketStore(state => state.updateIndicator);
    const removeIndicator = useMarketStore(state => state.removeIndicator);
    const toggleVisibility = useMarketStore(state => state.toggleIndicatorVisibility);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);

    if (!chartId) return <div className="p-4 text-zinc-500 text-sm">{t('noActiveChart')}</div>;

    const smartIndicators = indicators.filter(i => isSmartAnalysisIndicator(i.type));
    const standardIndicators = indicators.filter(i => !isSmartAnalysisIndicator(i.type));

    return (
        <div className="flex flex-col h-full bg-background relative overflow-y-auto custom-scrollbar">
            {isSelectorOpen && <IndicatorSelector chartId={chartId} onClose={() => setIsSelectorOpen(false)} />}

            <div className="p-3 flex flex-col gap-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-black uppercase text-foreground/80 tracking-tight">{t('layers')}</h4>
                    <button
                        onClick={() => setIsSelectorOpen(true)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-all active:scale-95"
                        title={t('addIndicator')}
                    >
                        <Plus size={10} strokeWidth={3} />
                        <span className="text-[11px] font-bold">{t('add')}</span>
                    </button>
                </div>

                {indicators.length === 0 && (
                    <div className="text-center py-8 flex flex-col items-center gap-2 text-muted-foreground/40 bg-secondary/5 rounded-xl border border-dashed border-border/40">
                        <Layout size={24} strokeWidth={1.5} className="opacity-50" />
                        <span className="text-[11px] font-medium">{t('noActiveLayers')}</span>
                    </div>
                )}

                {smartIndicators.length > 0 && (
                    <div className="flex flex-col gap-1">
                        <h5 className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest px-1 mb-1">{t('smartAnalysis')}</h5>
                        {smartIndicators.map(indicator => (
                            <IndicatorItem
                                key={indicator.id}
                                indicator={indicator}
                                chartId={chartId}
                                editingId={editingId}
                                setEditingId={setEditingId}
                                toggleVisibility={toggleVisibility}
                                updateIndicator={updateIndicator}
                                removeIndicator={removeIndicator}
                            />
                        ))}
                    </div>
                )}

                {standardIndicators.length > 0 && (
                    <div className="flex flex-col gap-1">
                        {smartIndicators.length > 0 && <h5 className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest px-1 mb-1 mt-1">{t('indicators')}</h5>}
                        {standardIndicators.map(indicator => (
                            <IndicatorItem
                                key={indicator.id}
                                indicator={indicator}
                                chartId={chartId}
                                editingId={editingId}
                                setEditingId={setEditingId}
                                toggleVisibility={toggleVisibility}
                                updateIndicator={updateIndicator}
                                removeIndicator={removeIndicator}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
