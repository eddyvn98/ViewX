'use client';

import { Maximize2, ExternalLink, X, Link } from 'lucide-react';
import { useMarketStore, ChartInstance } from '@/lib/store';
import { ChartContainer } from '../ChartContainer';

interface ChartItemProps {
    chart: ChartInstance;
    isActive: boolean;
    isMaximized: boolean;
    canClose: boolean;
}

export function ChartItem({ chart, isActive, isMaximized, canClose }: ChartItemProps) {
    const setActiveChart = useMarketStore((state) => state.setActiveChart);
    const toggleMaximizeChart = useMarketStore((state) => state.toggleMaximizeChart);
    const removeChart = useMarketStore((state) => state.removeChart);
    const updateChart = useMarketStore((state) => state.updateChart);

    return (
        <div
            onClick={() => setActiveChart(chart.id)}
            onDoubleClick={() => toggleMaximizeChart(isMaximized ? null : chart.id)}
            className={`group relative rounded-xl border overflow-hidden flex flex-col bg-zinc-900 transition-all ${isActive ? 'border-blue-500/50 ring-1 ring-blue-500/20 shadow-xl' : 'border-zinc-800 hover:border-zinc-700'}`}
        >
            <div className="px-3 py-1.5 bg-zinc-950/50 border-b border-zinc-800 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const groups: any = { 'none': 'A', 'A': 'B', 'B': 'C', 'C': 'D', 'D': 'none' };
                            updateChart(chart.id, { group: groups[chart.group || 'none'] });
                        }}
                        className={`flex items-center justify-center w-4 h-4 rounded transition-colors ${!chart.group || chart.group === 'none' ? 'text-zinc-700 hover:text-zinc-500' :
                            chart.group === 'A' ? 'text-green-500 bg-green-500/10' : chart.group === 'B' ? 'text-blue-500 bg-blue-500/10' :
                                chart.group === 'C' ? 'text-orange-500 bg-orange-500/10' : 'text-purple-500 bg-purple-500/10'}`}
                        title={`Symbol Link: ${chart.group || 'None'}`}
                    >
                        <Link size={10} />
                    </button>
                    <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-tighter">{chart.symbol} • {chart.interval}m</span>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button onClick={(e) => { e.stopPropagation(); toggleMaximizeChart(isMaximized ? null : chart.id); }} className="text-zinc-600 hover:text-blue-500 transition-colors" title={isMaximized ? "Restore" : "Maximize"}><Maximize2 size={12} /></button>
                    <a href={`/chart/${chart.id}?symbol=${chart.symbol}&interval=${chart.interval}&source=${chart.source}`} target="_blank" rel="noopener noreferrer" onClick={(e) => {
                        e.preventDefault(); window.open(`/chart/${chart.id}?symbol=${chart.symbol}&interval=${chart.interval}&source=${chart.source}`, `chart_${chart.id}`, 'width=1000,height=600');
                    }} className="text-zinc-600 hover:text-purple-500 transition-colors" title="Pop out"><ExternalLink size={12} /></a>
                    {canClose && <button onClick={(e) => { e.stopPropagation(); removeChart(chart.id); }} className="text-zinc-600 hover:text-red-500 transition-colors"><X size={12} /></button>}
                </div>
            </div>
            <div className="flex-1 min-h-0"><ChartContainer chartId={chart.id} /></div>
        </div>
    );
}
