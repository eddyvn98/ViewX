import { useChartOHLC } from '../hooks/use-chart-ohlc';
import { useMarketStore, Candle } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useChartIndicatorValues } from '../hooks/use-chart-indicator-values';
import { Maximize2 } from 'lucide-react';

interface ChartOverlayProps {
    chartId: string;
    symbol?: string;
    interval?: string;
    source?: string;
    candles: Candle[];
    onReset?: () => void;
}

export function ChartOverlay({ chartId, symbol, interval, source, candles, onReset }: ChartOverlayProps) {
    const data = useChartOHLC(symbol, interval, source);
    const indicatorValues = useChartIndicatorValues(chartId, candles, data?.activeIndex ?? -1);

    if (!data) return null;

    const formatPrice = (p: number) => {
        if (p === 0) return '0.00';
        if (p < 0.0001) return p.toExponential(4);
        if (p < 1) return p.toFixed(5);
        if (p < 100) return p.toFixed(3);
        return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const isPositive = data.change >= 0;
    const colorClass = isPositive ? "text-green-500" : "text-red-500";

    return (
        <div className="absolute top-2 left-3 z-10 flex flex-col gap-1 pointer-events-none select-none">
            {/* Top Row: Symbol & OHLC */}
            <div className="flex items-center gap-3">
                {/* Symbol Info */}
                <div className="flex items-center gap-1.5">
                    <div className="flex items-baseline gap-1">
                        <span className="text-[13px] font-extrabold text-white uppercase tracking-tight">{data.symbol}</span>
                        <span className="text-[10px] text-zinc-500 font-bold opacity-80">{data.interval} · {data.source}</span>
                    </div>
                </div>

                {/* OHLC Data */}
                <div className="flex items-center gap-2 text-[11px] font-bold font-mono">
                    <div className="flex items-center gap-0.5">
                        <span className="text-zinc-600">O</span>
                        <span className={colorClass}>{formatPrice(data.open)}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <span className="text-zinc-600">H</span>
                        <span className={colorClass}>{formatPrice(data.high)}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <span className="text-zinc-600">L</span>
                        <span className={colorClass}>{formatPrice(data.low)}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <span className="text-zinc-600">C</span>
                        <span className={colorClass}>{formatPrice(data.close)}</span>
                    </div>
                    <div className={cn("ml-1 flex items-center gap-1", colorClass)}>
                        <span>{isPositive ? '+' : ''}{formatPrice(Math.abs(data.changeValue))}</span>
                        <span className="text-[10px]">({isPositive ? '+' : ''}{data.change.toFixed(2)}%)</span>
                    </div>
                </div>

                {onReset && (
                    <button
                        onClick={onReset}
                        className="pointer-events-auto p-1.5 hover:bg-white/10 rounded-md text-zinc-400 hover:text-zinc-200 transition-colors ml-2"
                        title="Reset Chart Scale (Auto Fit)"
                    >
                        <Maximize2 size={14} strokeWidth={2.5} />
                    </button>
                )}
            </div>

            {/* Top Row: Main Indicator Values */}
            {indicatorValues.filter((v: any) => v.pane !== 'subchart').length > 0 && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 ml-[26px]">
                    {indicatorValues.filter((v: any) => v.pane !== 'subchart').map((val: any) => (
                        <div key={val.id} className="flex items-center gap-1.5 bg-zinc-900/40 px-1.5 py-0.5 rounded border border-white/5 backdrop-blur-sm">
                            <span className="text-[9px] font-extrabold uppercase tracking-tight text-zinc-400">{val.name}</span>
                            <span
                                className="text-[10px] font-bold font-mono"
                                style={{ color: val.color }}
                            >
                                {val.value !== undefined && !isNaN(val.value) ? val.value.toFixed(2) : '···'}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Bottom Row: Subchart Indicator Values (RSI) */}
            {indicatorValues.filter((v: any) => v.pane === 'subchart').length > 0 && (
                <div className="fixed top-[calc(75%+10px)] left-[calc(16px+64px+14px)] z-20 flex flex-wrap items-center gap-x-4 pointer-events-none">
                    {indicatorValues.filter((v: any) => v.pane === 'subchart').map((val: any) => (
                        <div key={val.id} className="flex items-center gap-1.5 bg-transparent px-1.5 py-0.5 rounded">
                            <span className="text-[10px] font-extrabold uppercase tracking-tight text-zinc-400 opacity-60">{val.name}</span>
                            <span
                                className="text-[11px] font-black font-mono shadow-sm"
                                style={{ color: val.color }}
                            >
                                {val.value !== undefined && !isNaN(val.value) ? val.value.toFixed(2) : '···'}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
