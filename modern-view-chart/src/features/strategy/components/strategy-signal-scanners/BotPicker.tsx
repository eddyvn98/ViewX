import { Plus } from 'lucide-react';
import type { Strategy } from '@/features/strategy/types';

interface BotPickerProps {
    isOpen: boolean;
    strategies: Strategy[];
    onToggle: () => void;
    onPickStrategy: (strategyId: string, strategyName: string) => void;
}

export function BotPicker({ isOpen, strategies, onToggle, onPickStrategy }: BotPickerProps) {
    return (
        <div className="flex items-center justify-between relative">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Signal Matrix Scanner</span>
            <button
                onClick={onToggle}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-primary/40 text-primary text-[10px] font-black uppercase"
            >
                <Plus size={11} />
                Chon chien luoc
            </button>

            {isOpen && (
                <div className="absolute right-0 top-8 z-40 w-72 rounded-lg border border-border/70 bg-background shadow-xl p-1 max-h-64 overflow-auto">
                    {strategies.length === 0 && (
                        <div className="px-2 py-3 text-xs text-muted-foreground">Chua co bot trong My Bot.</div>
                    )}
                    {strategies.map((strategy) => (
                        <button
                            key={strategy.id}
                            onClick={() => onPickStrategy(strategy.id, strategy.name)}
                            className="w-full text-left px-2 py-2 rounded hover:bg-secondary/40 text-xs font-semibold"
                        >
                            {strategy.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
