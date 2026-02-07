import { useEffect, useRef } from 'react';
import { ISeriesApi, IPriceLine, LineStyle } from 'lightweight-charts';
import { useMarketStore } from '@/lib/store';
import { calculatePnL, formatPnL } from '@/lib/utils/pnl';

export function useChartDraftOrder(
    symbol: string | undefined,
    seriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>
) {
    const draftOrder = useMarketStore((state) => state.draftOrder);
    const currentPrice = useMarketStore((state) => (symbol && state.tickers[symbol]) ? state.tickers[symbol].price : 0);
    const symbolInfo = useMarketStore((state) => state.symbolInfo[symbol || '']);

    const linesRef = useRef<{ entry?: IPriceLine, sl?: IPriceLine, tp?: IPriceLine }>({});

    useEffect(() => {
        if (!seriesRef.current || !symbol || !draftOrder || draftOrder.symbol !== symbol) {
            // Cleanup if no draft or symbol mismatch
            const series = seriesRef.current;
            if (series) {
                if (linesRef.current.entry) series.removePriceLine(linesRef.current.entry);
                if (linesRef.current.sl) series.removePriceLine(linesRef.current.sl);
                if (linesRef.current.tp) series.removePriceLine(linesRef.current.tp);
            }
            linesRef.current = {};
            return;
        }

        const series = seriesRef.current;
        const bid = currentPrice;
        const ask = bid * 1.0001; // Mock spread
        const entryPrice = draftOrder.isMarket ? (draftOrder.type === 'buy' ? ask : bid) : (draftOrder.price || bid);

        // Entry Line
        const formatPnLWrapper = (pPrice: number | undefined) => {
            if (pPrice === undefined || !bid) return '';
            const pnl = calculatePnL({
                type: draftOrder.type,
                openPrice: entryPrice,
                currentPrice: pPrice,
                volume: draftOrder.volume,
                symbolInfo
            });
            return `(${formatPnL(pnl)})`;
        };

        const entryTitle = `${draftOrder.type.toUpperCase()} ${draftOrder.volume} (Draft)`;
        if (!linesRef.current.entry) {
            linesRef.current.entry = series.createPriceLine({
                price: entryPrice,
                color: '#71717a', // Zinc 500
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '', // Custom tags handle the title
            });
        } else {
            linesRef.current.entry.applyOptions({ price: entryPrice });
        }

        // SL Line
        if (draftOrder.sl) {
            const slTitle = `SL ${formatPnLWrapper(draftOrder.sl)}`;
            if (!linesRef.current.sl) {
                linesRef.current.sl = series.createPriceLine({
                    price: draftOrder.sl,
                    color: '#ef4444', // Red 500
                    lineWidth: 1,
                    lineStyle: LineStyle.Dotted,
                    axisLabelVisible: false,
                    title: '',
                });
            } else {
                linesRef.current.sl.applyOptions({ price: draftOrder.sl });
            }
        } else if (linesRef.current.sl) {
            series.removePriceLine(linesRef.current.sl);
            linesRef.current.sl = undefined;
        }

        // TP Line
        if (draftOrder.tp) {
            const tpTitle = `TP ${formatPnLWrapper(draftOrder.tp)}`;
            if (!linesRef.current.tp) {
                linesRef.current.tp = series.createPriceLine({
                    price: draftOrder.tp,
                    color: '#22c55e', // Green 500
                    lineWidth: 1,
                    lineStyle: LineStyle.Dotted,
                    axisLabelVisible: false,
                    title: '',
                });
            } else {
                linesRef.current.tp.applyOptions({ price: draftOrder.tp });
            }
        } else if (linesRef.current.tp) {
            series.removePriceLine(linesRef.current.tp);
            linesRef.current.tp = undefined;
        }

        return () => {
            // Note: Partial cleanup handled above by dependency array
        };
    }, [symbol, draftOrder, currentPrice, seriesRef, symbolInfo]);

    // Final cleanup on unmount
    useEffect(() => {
        return () => {
            const series = seriesRef.current;
            if (series) {
                if (linesRef.current.entry) series.removePriceLine(linesRef.current.entry);
                if (linesRef.current.sl) series.removePriceLine(linesRef.current.sl);
                if (linesRef.current.tp) series.removePriceLine(linesRef.current.tp);
            }
        };
    }, []);
}
