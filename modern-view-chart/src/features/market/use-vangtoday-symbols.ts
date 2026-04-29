'use client';

import { useEffect, useState } from 'react';
import { fetchVangTodaySymbols } from './market-list-utils';

export function useVangTodaySymbols(shouldLoadDiscoveryUniverse: boolean): string[] {
    const [vangTodaySymbols, setVangTodaySymbols] = useState<string[]>([]);

    useEffect(() => {
        if (!shouldLoadDiscoveryUniverse) return;
        if (vangTodaySymbols.length > 0) return;

        let isMounted = true;
        const loadSymbols = async () => {
            try {
                const symbols = await fetchVangTodaySymbols();
                if (!isMounted || symbols.length === 0) return;
                setVangTodaySymbols(Array.from(new Set(symbols)));
            } catch {
                // Ignore fetch failures.
            }
        };

        void loadSymbols();
        return () => {
            isMounted = false;
        };
    }, [shouldLoadDiscoveryUniverse, vangTodaySymbols.length]);

    return vangTodaySymbols;
}
