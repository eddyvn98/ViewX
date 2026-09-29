import type { Strategy, StrategyDirection, StrategyLeg } from '../types';

export interface BuildStrategyForSaveInput {
    editingStrategy?: Strategy | null;
    name: string;
    buy: StrategyLeg;
    sell: StrategyLeg;
    buyEnabled: boolean;
    sellEnabled: boolean;
    executionMode: 'virtual' | 'real';
    magic: number;
    comment: string;
    activeChart?: { symbol?: string; interval?: string } | null;
    idFactory?: () => string;
}

export function buildStrategyForSave(input: BuildStrategyForSaveInput): Strategy {
    const primaryDirection: StrategyDirection = input.buyEnabled ? 'BUY' : 'SELL';
    const primaryLeg = primaryDirection === 'BUY' ? input.buy : input.sell;
    const enabledDirections: StrategyDirection[] = [
        ...(input.buyEnabled ? ['BUY' as const] : []),
        ...(input.sellEnabled ? ['SELL' as const] : []),
    ];

    return {
        id: input.editingStrategy?.id || input.idFactory?.() || Math.random().toString(36).substring(7),
        name: input.name.trim(),
        active: input.editingStrategy?.active ?? true,
        buy: input.buy,
        sell: input.sell,
        enabledDirections,
        risk: primaryLeg.risk,
        entry: primaryLeg.entry,
        exit: primaryLeg.exit,
        trigger: primaryLeg.trigger,
        cancelConditions: primaryLeg.cancelConditions,
        side: primaryDirection,
        symbol: input.editingStrategy?.symbol || input.activeChart?.symbol || 'XAUUSDm',
        timeframe: input.editingStrategy?.timeframe || input.activeChart?.interval || '5m',
        positionMode: primaryLeg.positionMode || 'single_position',
        executionMode: input.executionMode,
        entryType: primaryLeg.entryType || 'stop',
        entryPrice: primaryLeg.entryPrice,
        magic: input.magic,
        comment: input.comment,
        sessions: ['London', 'NewYork'],
    };
}
