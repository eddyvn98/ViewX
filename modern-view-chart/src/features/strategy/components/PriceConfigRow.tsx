import { SLTPConfig, SLTPMode, IndicatorType } from '../types';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PriceConfigRowProps {
    label: string;
    icon: React.ReactNode;
    config: SLTPConfig;
    onChange: (config: SLTPConfig) => void;
    accentColor: string;
    modes?: SLTPMode[];
    showLabel?: boolean;
}

export function PriceConfigRow({
    label, icon, config, onChange, accentColor,
    modes = ['fixed', 'percentage', 'amount', 'candle', 'indicator', 'winrate'],
    showLabel = true
}: PriceConfigRowProps) {
    const t = useTranslations('Strategy');

    const handleModeChange = (mode: SLTPMode) => {
        const newConfig: SLTPConfig = { ...config, mode };
        if (mode === 'candle') {
            const isSL = label.toLowerCase().includes('sl') || label.toLowerCase().includes('stop');
            newConfig.candleField = isSL ? 'low' : 'high';
            newConfig.candleOffset = 1;
            newConfig.offset = 0;
        } else if (mode === 'indicator') {
            newConfig.indicator = { type: 'EMA', params: [200] };
            newConfig.offset = 0;
        } else if (mode === 'winrate') {
            newConfig.value = 2;
        }
        onChange(newConfig);
    };

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-4 h-7">
                {showLabel && (
                    <span className={`text-[10px] font-bold ${accentColor} uppercase tracking-tighter flex items-center gap-1.5 w-[84px] shrink-0`}>
                        {icon} {label}
                    </span>
                )}

                <div className="flex items-center gap-2">
                    <select
                        value={config.mode}
                        onChange={(e) => handleModeChange(e.target.value as SLTPMode)}
                        className="bg-secondary text-[10px] font-black px-1.5 h-6 rounded border border-border outline-none text-muted-foreground appearance-none cursor-pointer min-w-[64px] text-center hover:border-blue-500/50 transition-colors"
                    >
                        {modes.includes('fixed') && <option value="fixed">{t('builder.points')}</option>}
                        {modes.includes('percentage') && <option value="percentage">{t('builder.percent')}</option>}
                        {modes.includes('amount') && <option value="amount">{t('builder.amount')}</option>}
                        {modes.includes('candle') && <option value="candle">{t('builder.candle')}</option>}
                        {modes.includes('indicator') && <option value="indicator">{t('builder.indicator')}</option>}
                        {modes.includes('winrate') && <option value="winrate">{t('builder.rrRatio')}</option>}
                    </select>

                    <div className="flex items-center gap-1.5 bg-secondary/40 rounded px-1 border border-border min-h-[24px]">
                        {(config.mode === 'fixed' || config.mode === 'percentage' || config.mode === 'amount') && (
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    value={config.value || 0}
                                    onChange={(e) => onChange({ ...config, value: parseFloat(e.target.value) })}
                                    className="bg-transparent border-none h-6 px-1 text-xs font-mono font-black text-foreground outline-none w-14 text-right"
                                />
                                <span className="text-[8px] text-muted-foreground font-bold uppercase">
                                    {config.mode === 'fixed' ? 'Pts' : (config.mode === 'percentage' ? '%' : '$')}
                                </span>
                            </div>
                        )}

                        {config.mode === 'candle' && (
                            <div className="flex items-center gap-1.5">
                                <select
                                    value={config.candleField}
                                    onChange={(e) => onChange({ ...config, candleField: e.target.value as 'high' | 'low' | 'close' | 'open' })}
                                    className="bg-transparent text-[10px] font-black text-blue-400 outline-none w-12 appearance-none cursor-pointer"
                                >
                                    <option value="high">High</option>
                                    <option value="low">Low</option>
                                    <option value="close">Close</option>
                                    <option value="open">Open</option>
                                </select>
                                <div className="flex items-center gap-0.5">
                                    <span className="text-[8px] text-muted-foreground font-bold cursor-help" title="0: Nến hiện tại (tín hiệu), 1: Nến trước đó, 2: 2 nến trước...">#</span>
                                    <input
                                        type="number"
                                        value={config.candleOffset}
                                        onChange={(e) => onChange({ ...config, candleOffset: parseInt(e.target.value) })}
                                        className="bg-transparent text-[10px] w-6 text-center font-mono font-black text-foreground outline-none border-b border-border"
                                    />
                                    <span className="text-[7px] text-blue-500/80 font-bold uppercase truncate max-w-[30px]">
                                        {config.candleOffset === 0 ? 'Signal' : config.candleOffset === 1 ? 'Prev' : 'Ago'}
                                    </span>
                                </div>
                                <ChevronRight size={8} className="text-muted-foreground" />
                                <div className="flex items-center gap-0.5">
                                    <span className="text-[8px] text-muted-foreground font-bold">+</span>
                                    <input
                                        type="number"
                                        value={config.offset}
                                        onChange={(e) => onChange({ ...config, offset: parseFloat(e.target.value) })}
                                        className="bg-transparent text-[10px] w-12 text-right font-mono text-foreground outline-none"
                                        placeholder="Pts"
                                    />
                                </div>
                            </div>
                        )}

                        {config.mode === 'indicator' && (
                            <div className="flex items-center gap-1.5">
                                <select
                                    value={config.indicator?.type}
                                    onChange={(e) => onChange({ ...config, indicator: { ...config.indicator!, type: e.target.value as IndicatorType } })}
                                    className="bg-transparent text-[10px] font-black text-blue-400 outline-none w-12 appearance-none cursor-pointer"
                                >
                                    <option value="EMA">EMA</option>
                                    <option value="SMA">SMA</option>
                                    <option value="HMA">HMA</option>
                                </select>
                                <input
                                    type="number"
                                    value={config.indicator?.params[0]}
                                    onChange={(e) => onChange({ ...config, indicator: { ...config.indicator!, params: [parseInt(e.target.value)] } })}
                                    className="bg-transparent text-[10px] w-8 text-center font-mono font-black text-foreground outline-none border-b border-border"
                                />
                                <div className="flex items-center gap-0.5">
                                    <span className="text-[8px] text-muted-foreground font-bold">+</span>
                                    <input
                                        type="number"
                                        value={config.offset}
                                        onChange={(e) => onChange({ ...config, offset: parseFloat(e.target.value) })}
                                        className="bg-transparent text-[10px] w-12 text-right font-mono text-foreground outline-none"
                                        placeholder="Pts"
                                    />
                                </div>
                            </div>
                        )}

                        {config.mode === 'winrate' && (
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    step="0.1"
                                    value={config.value || 0}
                                    onChange={(e) => onChange({ ...config, value: parseFloat(e.target.value) })}
                                    className="bg-transparent border-none h-6 px-1 text-xs font-mono font-black text-foreground outline-none w-10 text-right"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
