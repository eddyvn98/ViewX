import type { StrategySignal, VirtualPosition } from '@/features/strategy/types';

export type SignalRange = 'day' | 'week' | 'month';

export type SignalWithIndex = {
    sig: StrategySignal;
    index: number;
};

export type GroupedSignals = Record<SignalRange, SignalWithIndex[]>;

export interface ActivePositionItemModel {
    position: VirtualPosition;
    currentPrice: number;
    pnl: number;
    aiGuardEnabled: boolean;
}
