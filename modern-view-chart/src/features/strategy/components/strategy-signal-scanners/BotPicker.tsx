import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Strategy } from '@/features/strategy/types';

interface BotPickerProps {
    isOpen: boolean;
    strategies: Strategy[];
    onToggle: () => void;
    onPickStrategy: (strategyId: string, strategyName: string) => void;
}

export function BotPicker({ isOpen, strategies, onToggle, onPickStrategy }: BotPickerProps) {
    const t = useTranslations('Signals.matrix');

    return (
        <div className="flex items-center justify-between relative">
            <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{t('title')}</span>
            <button
                onClick={onToggle}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-primary/40 text-primary text-[11px] font-black uppercase transition-all hover:bg-primary/5 shadow-sm"
            >
                <Plus size={11} />
                {t('pickBot')}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-8 z-40 w-72 rounded-lg border border-border/70 bg-background shadow-xl p-1 max-h-64 overflow-auto">
                    {strategies.length === 0 && (
                        <div className="px-2 py-3 text-xs text-muted-foreground">{t('noBotsInList')}</div>
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
