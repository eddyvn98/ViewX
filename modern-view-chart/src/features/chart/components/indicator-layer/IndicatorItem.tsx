import React from 'react';
import { Eye, EyeOff, Settings2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { INDICATOR_REGISTRY } from '../../indicators/registry';

interface IndicatorItemProps {
    indicator: any;
    chartId: string;
    editingId: string | null;
    setEditingId: (id: string | null) => void;
    toggleVisibility: (chartId: string, indicatorId: string) => void;
    updateIndicator: (chartId: string, indicatorId: string, changes: any) => void;
    removeIndicator: (chartId: string, indicatorId: string) => void;
}

export function IndicatorItem({ indicator, chartId, editingId, setEditingId, toggleVisibility, updateIndicator, removeIndicator }: IndicatorItemProps) {
    const metadata = INDICATOR_REGISTRY[indicator.type as keyof typeof INDICATOR_REGISTRY];

    return (
        <div className="flex flex-col mb-0.5">
            <div className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-200 min-h-[36px] group border border-transparent',
                editingId === indicator.id ? 'bg-secondary/40 border-border/20' : 'hover:bg-secondary/20 hover:border-border/10'
            )}>
                <button
                    onClick={() => toggleVisibility(chartId, indicator.id)}
                    className={cn('transition-colors flex-shrink-0 p-1 rounded-md hover:bg-secondary/40 active:scale-95', indicator.visible ? 'text-primary' : 'text-muted-foreground/40')}
                    title={indicator.visible ? 'Hide' : 'Show'}
                >
                    {indicator.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>

                <div className="flex-1 flex items-center gap-2.5 overflow-hidden cursor-pointer select-none" onClick={() => setEditingId(editingId === indicator.id ? null : indicator.id)}>
                    <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 transition-transform duration-300', editingId === indicator.id && 'scale-125')} style={{ backgroundColor: indicator.color }} />
                    <span className={cn('text-[10px] truncate transition-colors font-semibold', editingId === indicator.id ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground')}>
                        {indicator.type.replace(/_/g, ' ')}
                    </span>
                </div>

                <button
                    onClick={() => setEditingId(editingId === indicator.id ? null : indicator.id)}
                    className={cn('p-1.5 rounded-md transition-all active:scale-95', editingId === indicator.id ? 'text-primary bg-primary/10' : 'text-muted-foreground/30 hover:text-foreground hover:bg-secondary/40')}
                >
                    <Settings2 size={12} />
                </button>

                <button onClick={() => removeIndicator(chartId, indicator.id)} className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-95">
                    <Trash2 size={12} />
                </button>
            </div>

            <AnimatePresence>
                {editingId === indicator.id && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-secondary/10 rounded-b-lg mx-2 border-x border-b border-border/20 -mt-1 pt-1"
                    >
                        <div className="p-3 flex flex-col gap-4">
                            {metadata?.params && (
                                <div className="grid grid-cols-2 gap-3">
                                    {Object.entries(metadata.params).map(([key, schema]) => (
                                        <div key={key} className="flex flex-col gap-1.5">
                                            <label className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">{schema.name}</label>
                                            <input
                                                type={schema.type === 'number' ? 'number' : 'text'}
                                                value={indicator.params[key] ?? schema.default}
                                                min={schema.min}
                                                max={schema.max}
                                                step={schema.step}
                                                onChange={(e) => updateIndicator(chartId, indicator.id, { params: { ...indicator.params, [key]: schema.type === 'number' ? Number(e.target.value) : e.target.value } })}
                                                className="bg-background/50 border border-border/20 rounded-md px-2 py-1.5 text-[10px] text-foreground focus:border-primary/50 focus:bg-background outline-none w-full transition-all"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!metadata && indicator.params && (
                                <div className="grid grid-cols-2 gap-3">
                                    {Object.keys(indicator.params).map(key => (
                                        <div key={key} className="flex flex-col gap-1.5">
                                            <label className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">{key}</label>
                                            <input
                                                type="number"
                                                value={indicator.params[key]}
                                                onChange={(e) => updateIndicator(chartId, indicator.id, { params: { ...indicator.params, [key]: Number(e.target.value) } })}
                                                className="bg-background/50 border border-border/20 rounded-md px-2 py-1.5 text-[10px] text-foreground focus:border-primary/50 focus:bg-background outline-none w-full transition-all"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-col gap-2.5 pt-3 border-t border-border/10">
                                <label className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">Appearance</label>
                                <div className="flex flex-col gap-3">
                                    {metadata?.styles ? (
                                        Object.entries(metadata.styles).map(([key, schema]) => (
                                            <div key={key} className="flex items-center justify-between gap-4">
                                                <span className="text-[10px] text-muted-foreground font-medium">{schema.label}</span>
                                                {schema.type === 'color' ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-10 h-6 rounded border border-border/20 overflow-hidden relative">
                                                            <input
                                                                type="color"
                                                                value={indicator.styles?.[key] ?? schema.default}
                                                                onChange={(e) => updateIndicator(chartId, indicator.id, { styles: { ...indicator.styles, [key]: e.target.value } })}
                                                                className="absolute -top-2 -left-2 w-[150%] h-[200%] cursor-pointer p-0"
                                                            />
                                                        </div>
                                                        <span className="text-[9px] font-mono opacity-40 uppercase">{(indicator.styles?.[key] ?? schema.default).slice(1)}</span>
                                                    </div>
                                                ) : schema.type === 'number' ? (
                                                    <input
                                                        type="number"
                                                        value={indicator.styles?.[key] ?? schema.default}
                                                        min={schema.min}
                                                        max={schema.max}
                                                        step={schema.step}
                                                        onChange={(e) => updateIndicator(chartId, indicator.id, { styles: { ...indicator.styles, [key]: Number(e.target.value) } })}
                                                        className="w-12 bg-background/30 border border-border/10 rounded px-1.5 py-0.5 text-[10px] text-right"
                                                    />
                                                ) : null}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-[10px] text-muted-foreground font-medium">Main Color</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-10 h-6 rounded border border-border/20 overflow-hidden relative">
                                                    <input
                                                        type="color"
                                                        value={indicator.color}
                                                        onChange={(e) => updateIndicator(chartId, indicator.id, { color: e.target.value })}
                                                        className="absolute -top-2 -left-2 w-[150%] h-[200%] cursor-pointer p-0"
                                                    />
                                                </div>
                                                <span className="text-[9px] font-mono opacity-40 uppercase">{indicator.color.slice(1)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
