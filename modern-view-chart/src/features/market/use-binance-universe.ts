'use client';

import { useEffect, useState } from 'react';
import { fetchBinanceUniverse } from './market-list-utils';

export function useBinanceUniverse(shouldLoadDiscoveryUniverse: boolean): string[] {
    const [binanceUniverse, setBinanceUniverse] = useState<string[]>([]);

    useEffect(() => {
        if (!shouldLoadDiscoveryUniverse) return;
        if (binanceUniverse.length > 0) return;

        let isMounted = true;

        const loadBinanceSymbols = async () => {
            try {
                const symbols = await fetchBinanceUniverse();
                if (!isMounted || symbols.length === 0) return;
                setBinanceUniverse(Array.from(new Set(symbols)));
            } catch {
                // Ignore fetch failures.
            }
        };

        void loadBinanceSymbols();
        return () => {
            isMounted = false;
        };
    }, [shouldLoadDiscoveryUniverse, binanceUniverse.length]);

    return binanceUniverse;
}
