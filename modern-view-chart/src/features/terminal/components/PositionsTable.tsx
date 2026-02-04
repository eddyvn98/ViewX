import { Position } from "@/lib/store/types";
import React, { useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useMarketStore } from "@/lib/store";
import { calculatePnL } from "@/lib/utils/pnl";

interface PositionsTableProps {
    positions: Position[];
    onClosePosition: (ticket: number) => void;
    onUpdatePosition: (ticket: number, sl?: number, tp?: number) => void;
    onSymbolClick: (symbol: string) => void;
}

type SortField = 'symbol' | 'ticket' | 'type' | 'volume' | 'open_price' | 'current_price' | 'sl' | 'tp' | 'profit' | 'time' | 'magic';
type SortDirection = 'asc' | 'desc';

// Internal component
function PositionsTableImpl({ positions = [], onClosePosition, onUpdatePosition, onSymbolClick }: PositionsTableProps) {
    const [editingCell, setEditingCell] = useState<{ ticket: number, field: 'sl' | 'tp', value: string } | null>(null);
    const [sortField, setSortField] = useState<SortField>('time');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const safePositions = Array.isArray(positions) ? positions : [];
    const sortedPositions = [...safePositions].sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];

        if (aValue === bValue) return 0;

        const aSafe = aValue ?? 0;
        const bSafe = bValue ?? 0;

        if (typeof aSafe === 'string' && typeof bSafe === 'string') {
            return sortDirection === 'asc'
                ? aSafe.localeCompare(bSafe)
                : bSafe.localeCompare(aSafe);
        }

        if (sortDirection === 'asc') {
            return (aSafe as number) - (bSafe as number);
        } else {
            return (bSafe as number) - (aSafe as number);
        }
    });

    const startEditing = (ticket: number, field: 'sl' | 'tp', current: number) => {
        setEditingCell({ ticket, field, value: current > 0 ? current.toString() : '' });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            commitEdit();
        } else if (e.key === 'Escape') {
            setEditingCell(null);
        }
    };

    const commitEdit = () => {
        if (!editingCell) return;
        const val = parseFloat(editingCell.value);
        if (!isNaN(val)) {
            onUpdatePosition(editingCell.ticket,
                editingCell.field === 'sl' ? val : undefined as any,
                editingCell.field === 'tp' ? val : undefined as any
            );
        }
        setEditingCell(null);
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown size={12} className="opacity-30 ml-1" />;
        return sortDirection === 'asc' ? <ArrowUp size={12} className="ml-1 text-blue-500" /> : <ArrowDown size={12} className="ml-1 text-blue-500" />;
    };

    const HeaderCell = ({ field, label, className = "" }: { field: SortField, label: string, className?: string }) => (
        <th
            className={`p-2 font-medium border-b border-[#2a2e39] cursor-pointer hover:bg-[#2a2e39] transition-colors ${className}`}
            onClick={() => handleSort(field)}
        >
            <div className="flex items-center">
                {label}
                <SortIcon field={field} />
            </div>
        </th>
    );

    return (
        <table className="w-full text-[11px] text-left border-collapse min-w-[1000px]">
            <thead className="sticky top-0 bg-[#1e222d] text-[#787b86] z-10">
                <tr>
                    <HeaderCell field="time" label="Time" />
                    <HeaderCell field="symbol" label="Symbol" />
                    <HeaderCell field="ticket" label="Ticket" />
                    <HeaderCell field="magic" label="Magic" />
                    <HeaderCell field="type" label="Type" />
                    <HeaderCell field="volume" label="Volume" />
                    <HeaderCell field="open_price" label="Open P." />
                    <HeaderCell field="current_price" label="Current P." />
                    <HeaderCell field="sl" label="SL" />
                    <HeaderCell field="tp" label="TP" />
                    <HeaderCell field="profit" label="Profit" />
                    <th className="p-2 font-medium border-b border-[#2a2e39]">Actions</th>
                </tr>
            </thead>
            <tbody>
                {sortedPositions && sortedPositions.length > 0 ? (
                    sortedPositions.map((pos) => (
                        <PositionRow
                            key={pos.ticket}
                            pos={pos}
                            onClosePosition={onClosePosition}
                            onUpdatePosition={onUpdatePosition}
                            onSymbolClick={onSymbolClick}
                            editingCell={editingCell}
                            setEditingCell={setEditingCell}
                            commitEdit={commitEdit}
                            handleKeyDown={handleKeyDown}
                        />
                    ))
                ) : (
                    <tr>
                        <td colSpan={12} className="p-4 text-center text-[#787b86]">No open positions</td>
                    </tr>
                )}
            </tbody>
        </table >
    );
}

interface PositionRowProps {
    pos: Position;
    onClosePosition: (ticket: number) => void;
    onUpdatePosition: (ticket: number, sl?: number, tp?: number) => void;
    onSymbolClick: (symbol: string) => void;
    editingCell: { ticket: number, field: 'sl' | 'tp', value: string } | null;
    setEditingCell: (val: { ticket: number, field: 'sl' | 'tp', value: string } | null) => void;
    commitEdit: () => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
}

const PositionRow = React.memo(({
    pos, onClosePosition, onUpdatePosition, onSymbolClick,
    editingCell, setEditingCell, commitEdit, handleKeyDown
}: PositionRowProps) => {
    // Subscribe to real-time price for this specific symbol
    const tickerPrice = useMarketStore(state => state.tickers[pos.symbol]?.price);
    const symbolInfo = useMarketStore(state => state.symbolInfo[pos.symbol]);

    // Calculate PnL locally using live price
    const livePrice = tickerPrice || pos.current_price;
    const liveProfit = calculatePnL({
        type: pos.type,
        openPrice: pos.open_price,
        currentPrice: livePrice,
        volume: pos.volume,
        symbolInfo
    });

    // Use MT5 profit if price is not available yet, or if it's the first render
    const displayPrice = livePrice || pos.current_price;
    const displayProfit = tickerPrice ? liveProfit : pos.profit;

    const setHoveredTicket = useMarketStore(state => state.setHoveredTicket);

    const startEditing = (ticket: number, field: 'sl' | 'tp', current: number) => {
        setEditingCell({ ticket, field, value: current > 0 ? current.toString() : '' });
    };

    return (
        <tr
            className="hover:bg-blue-500/10 text-[#d1d4dc] border-b border-[#2a2e39]"
            onMouseEnter={() => setHoveredTicket(pos.ticket)}
            onMouseLeave={() => setHoveredTicket(null)}
        >
            <td className="p-2 whitespace-nowrap">{new Date(pos.time * 1000).toLocaleString()}</td>
            <td
                className="p-2 cursor-pointer hover:text-blue-400 font-medium"
                onClick={() => onSymbolClick(pos.symbol)}
            >
                {pos.symbol ?? '--'}
            </td>
            <td className="p-2">{pos.ticket ?? '--'}</td>
            <td className="p-2">{pos.magic ?? 0}</td>
            <td className={`p-2 font-bold ${(pos.type || '').toLowerCase() === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
                {(pos.type || '--').toUpperCase()}
            </td>
            <td className="p-2">{(pos.volume ?? 0).toFixed(2)}</td>
            <td className="p-2">{(pos.open_price ?? 0).toFixed(5)}</td>
            <td className="p-2">{displayPrice.toFixed(5)}</td>
            <td className="p-2">
                {editingCell?.ticket === pos.ticket && editingCell.field === 'sl' ? (
                    <input
                        autoFocus
                        type="number"
                        step="0.00001"
                        className="w-20 bg-[#2a2e39] text-white px-1 rounded border border-blue-500 outline-none"
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        onBlur={commitEdit}
                        onKeyDown={handleKeyDown}
                    />
                ) : (
                    <span
                        className="cursor-pointer text-blue-500 hover:underline hover:text-blue-400"
                        onClick={() => startEditing(pos.ticket, 'sl', pos.sl)}
                    >
                        {(pos.sl ?? 0) > 0 ? (pos.sl ?? 0).toFixed(5) : '--'}
                    </span>
                )}
            </td>
            <td className="p-2">
                {editingCell?.ticket === pos.ticket && editingCell.field === 'tp' ? (
                    <input
                        autoFocus
                        type="number"
                        step="0.00001"
                        className="w-20 bg-[#2a2e39] text-white px-1 rounded border border-blue-500 outline-none"
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        onBlur={commitEdit}
                        onKeyDown={handleKeyDown}
                    />
                ) : (
                    <span
                        className="cursor-pointer text-blue-500 hover:underline hover:text-blue-400"
                        onClick={() => startEditing(pos.ticket, 'tp', pos.tp)}
                    >
                        {(pos.tp ?? 0) > 0 ? (pos.tp ?? 0).toFixed(5) : '--'}
                    </span>
                )}
            </td>
            <td className={`p-2 font-bold ${displayProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {displayProfit.toFixed(2)}
            </td>
            <td className="p-2">
                <button
                    onClick={() => onClosePosition(pos.ticket)}
                    className="px-2 py-1 text-[10px] text-red-500 border border-red-500 rounded hover:bg-red-500 hover:text-white transition-colors"
                >
                    Close
                </button>
            </td>
        </tr>
    );
});

export const PositionsTable = React.memo(PositionsTableImpl);

