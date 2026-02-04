'use client';

import { HistoryDeal } from "@/lib/store/types";
import { useState, useMemo, memo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Bot, Info } from "lucide-react";
import { useMarketStore } from "@/lib/store";

interface HistoryTableProps {
    history: HistoryDeal[];
    onSymbolClick: (symbol: string) => void;
    onAnalyze: (deal: HistoryDeal) => void;
}

type SortField = 'time' | 'ticket' | 'symbol' | 'type' | 'volume' | 'price' | 'profit' | 'magic';
type SortDirection = 'asc' | 'desc';

// Row component đơn giản, không dùng ảo hóa để cực kỳ ổn định
const HistoryRow = memo(({ deal, onSymbolClick, onAnalyze }: { deal: HistoryDeal, onSymbolClick: (s: string) => void, onAnalyze: (deal: HistoryDeal) => void }) => {
    // Get analysis result from Global Store
    const analysisResult = useMarketStore((state) => state.analysisResults[deal.ticket]);

    return (
        <div className="flex hover:bg-blue-500/10 text-[#d1d4dc] border-b border-[#2a2e39] items-center text-[11px] min-h-[36px]">
            <div className="p-2 whitespace-nowrap overflow-hidden text-ellipsis" style={{ width: "15%" }}>
                {new Date(deal.time * 1000).toLocaleString()}
            </div>
            <div className="p-2" style={{ width: "10%" }}>{deal.ticket}</div>
            <div className="p-2" style={{ width: "10%" }}>{deal.magic}</div>
            <div
                className="p-2 cursor-pointer hover:text-blue-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis"
                style={{ width: "10%" }}
                onClick={() => deal.symbol && onSymbolClick(deal.symbol)}
            >
                {deal.symbol || '---'}
            </div>
            <div className={`p-2 whitespace-nowrap overflow-hidden text-ellipsis ${(deal.type === 'buy' ? 'text-green-500' : deal.type === 'sell' ? 'text-red-500' : 'text-blue-400')}`} style={{ width: "10%" }}>
                {deal.type?.toUpperCase()} {deal.entry !== 'in/out' && deal.entry ? `(${deal.entry})` : ''}
            </div>
            <div className="p-2" style={{ width: "10%" }}>{deal.volume?.toFixed(2)}</div>
            <div className="p-2" style={{ width: "10%" }}>{deal.price?.toFixed(5)}</div>
            <div className="p-2 text-[#787b86]" style={{ width: "10%" }}>
                <span className="text-[10px] mr-2">S: {deal.swap?.toFixed(2)}</span>
            </div>
            <div className={`p-2 font-bold ${(deal.profit >= 0 ? 'text-green-500' : 'text-red-500')}`} style={{ width: "10%" }}>
                {deal.profit?.toFixed(2)}
            </div>

            {/* AI Action/Result Column */}
            <div className="p-2 flex items-center justify-center" style={{ width: "5%" }}>
                {analysisResult ? (
                    <div
                        className={`flex items-center gap-1 px-1 py-0.5 rounded cursor-help ${analysisResult.verdict.includes('GOOD') ? 'bg-green-500/20 text-green-400' : analysisResult.verdict.includes('ERROR') ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-500'}`}
                        title={`${analysisResult.verdict}\n${analysisResult.analysis?.explanation?.join('\n') || analysisResult.reason}`}
                    >
                        <Bot size={14} />
                        {/* Optional: Show verdict text if space allows */}
                    </div>
                ) : (
                    <button
                        onClick={() => onAnalyze(deal)}
                        className="p-1 rounded hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-colors"
                        title="AI Analysis"
                    >
                        <Bot size={14} />
                    </button>
                )}
            </div>
        </div>
    );
});
HistoryRow.displayName = 'HistoryRow';

export function HistoryTable({ history, onSymbolClick, onAnalyze }: HistoryTableProps) {
    const [sortField, setSortField] = useState<SortField>('time');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const sortedHistory = useMemo(() => {
        if (!history || history.length === 0) return [];

        return [...history].sort((a, b) => {
            const aValue = a[sortField];
            const bValue = b[sortField];
            if (aValue === bValue) return 0;
            const aSafe = aValue ?? 0;
            const bSafe = bValue ?? 0;

            if (typeof aSafe === 'string' && typeof bSafe === 'string') {
                return sortDirection === 'asc' ? aSafe.localeCompare(bSafe) : bSafe.localeCompare(aSafe);
            }
            return sortDirection === 'asc' ? (aSafe as number) - (bSafe as number) : (bSafe as number) - (aSafe as number);
        });
    }, [history, sortField, sortDirection]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown size={12} className="opacity-30 ml-1" />;
        return sortDirection === 'asc' ? <ArrowUp size={12} className="ml-1 text-blue-500" /> : <ArrowDown size={12} className="ml-1 text-blue-500" />;
    };

    const HeaderCell = ({ field, label, width }: { field: SortField, label: string, width: string }) => (
        <div
            className="p-2 font-medium cursor-pointer hover:bg-[#2a2e39] transition-colors flex items-center overflow-hidden"
            style={{ width }}
            onClick={() => handleSort(field)}
        >
            <span className="truncate">{label}</span>
            <SortIcon field={field} />
        </div>
    );

    return (
        <div className="flex flex-col h-full w-full min-w-[1000px] text-left text-[11px]">
            {/* Header cố định */}
            <div className="flex bg-[#1e222d] text-[#787b86] border-b border-[#2a2e39] shrink-0 font-medium h-9 items-center sticky top-0 z-10">
                <HeaderCell field="time" label="Time" width="15%" />
                <HeaderCell field="ticket" label="Ticket" width="10%" />
                <HeaderCell field="magic" label="Magic" width="10%" />
                <HeaderCell field="symbol" label="Symbol" width="10%" />
                <HeaderCell field="type" label="Type" width="10%" />
                <HeaderCell field="volume" label="Volume" width="10%" />
                <HeaderCell field="price" label="Price" width="10%" />
                <div className="p-2 flex items-center overflow-hidden" style={{ width: "10%" }}>Swap</div>
                <HeaderCell field="profit" label="Profit" width="10%" />
                <div className="p-2 flex items-center justify-center" style={{ width: "5%" }}>AI</div>
            </div>

            {/* Container dữ liệu dùng overflow truyền thống - Chống lỗi thư viện bên thứ 3 */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-[#131722]">
                {sortedHistory.length > 0 ? (
                    <div className="flex flex-col">
                        {sortedHistory.map((deal) => (
                            <HistoryRow
                                key={`${deal.ticket}-${deal.time}`}
                                deal={deal}
                                onSymbolClick={onSymbolClick}
                                onAnalyze={onAnalyze}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center text-[#787b86] flex flex-col items-center justify-center gap-2">
                        <span>No history deals found</span>
                        <span className="text-[10px] opacity-50">Check Bridge connection or filters</span>
                    </div>
                )}
            </div>
        </div>
    );
}
