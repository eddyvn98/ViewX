import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { createStrategyStoreState } from './strategy-store.actions';
import { migrateStrategyStoreState } from './strategy-store.migrations';
import type { StrategyState } from './strategy-store.types';

export type { StrategyState } from './strategy-store.types';
export { migrateStrategyStoreState } from './strategy-store.migrations';

export const useStrategyStore = create<StrategyState>()(
    subscribeWithSelector(
        persist(createStrategyStoreState, {
            name: 'strategy-storage',
            version: 6,
            migrate: migrateStrategyStoreState,
        })
    )
);
