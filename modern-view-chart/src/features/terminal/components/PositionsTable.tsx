import { Position } from "@/lib/store/types";
import React, { useState, useRef, useEffect, useCallback, memo } from "react";
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

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
    if (sortField !== field) return <ArrowUpDown size={12} className="opacity-30 ml-1" />;
    return sortDirection === 'asc' ? <ArrowUp size={12} className="ml-1 text-blue-500" /> : <ArrowDown size={12} className="ml-1 text-blue-500" />;
}

function HeaderCell({
    field,
    label,
    className = "",
    sortField,
    sortDirection,
    onSort,
}: {
    field: SortField;
    label: string;
    className?: string;
    sortField: SortField;
    sortDirection: SortDirection;
    onSort: (field: SortField) => void;
}) {
    return (
        <th className={`p-2 font-medium border-b border-border cursor-pointer hover:bg-secondary/40 transition-colors ${className}`} onClick={() => onSort(field)}>
            <div className="flex items-center">{label}<SortIcon field={field} sortField={sortField} sortDirection={sortDirection} /></div>
        </th>
    );
}

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
            return sortDirection === 'asc' ? aSafe.localeCompare(bSafe) : bSafe.localeCompare(aSafe);
        }
        return sortDirection === 'asc' ? (aSafe as number) - (bSafe as number) : (bSafe as number) - (aSafe as number);
    });

    const commitEdit = useCallback(() => {
        if (!editingCell) return;
        const val = parseFloat(editingCell.value);
        if (!isNaN(val)) {
            onUpdatePosition(editingCell.ticket, editingCell.field === 'sl' ? val : undefined, editingCell.field === 'tp' ? val : undefined);
        }
        setEditingCell(null);
    }, [editingCell, onUpdatePosition]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') commitEdit();
        else if (e.key === 'Escape') setEditingCell(null);
    }, [commitEdit]);

    return (
        <table className="w-full text-[11px] text-left border-collapse min-w-[1000px]">
            <thead className="sticky top-0 bg-secondary/10 text-muted-foreground z-10 transition-colors">
                <tr>
                    <HeaderCell field="symbol" label="Symbol" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                    <HeaderCell field="ticket" label="Ticket" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                    <HeaderCell field="time" label="Time" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                    <HeaderCell field="type" label="Type" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                    <HeaderCell field="volume" label="Volume" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                    <HeaderCell field="open_price" label="Price" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                    <HeaderCell field="sl" label="S / L" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                    <HeaderCell field="tp" label="T / P" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                    <HeaderCell field="current_price" label="Price" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                    <HeaderCell field="profit" label="Profit" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                    <HeaderCell field="magic" label="Magic" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                    <th className="p-2 font-medium border-b border-border">Comment</th>
                    <th className="p-2 font-medium border-b border-border text-center">Actions</th>
                </tr>
            </thead>
            <tbody>
                {sortedPositions.length > 0 ? sortedPositions.map((pos) => (
                    <PositionRow
                        key={pos.ticket}
                        pos={pos}
                        onClosePosition={onClosePosition}
                        onSymbolClick={onSymbolClick}
                        editingCell={editingCell}
                        setEditingCell={setEditingCell}
                        commitEdit={commitEdit}
                        handleKeyDown={handleKeyDown}
                    />
                )) : (
                    <tr><td colSpan={12} className="p-4 text-center text-muted-foreground">No open positions</td></tr>
                )}
            </tbody>
        </table>
    );
}

interface PositionRowProps {
    pos: Position;
    onClosePosition: (ticket: number) => void;
    onSymbolClick: (symbol: string) => void;
    editingCell: { ticket: number, field: 'sl' | 'tp', value: string } | null;
    setEditingCell: (val: { ticket: number, field: 'sl' | 'tp', value: string } | null) => void;
    commitEdit: () => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * PositionRow with DOM-based updates for realtime fields (price, profit)
 * Avoids React re-renders on every ticker update
 */
const PositionRow = memo(function PositionRow({ pos, onClosePosition, onSymbolClick, editingCell, setEditingCell, commitEdit, handleKeyDown }: PositionRowProps) {
    const priceRef = useRef<HTMLTableCellElement>(null);
    const profitRef = useRef<HTMLTableCellElement>(null);
    const rafIdRef = useRef<number | null>(null);
    const lastPriceRef = useRef<string>('');
    const lastProfitRef = useRef<string>('');

    const setHoveredTicket = useMarketStore(state => state.setHoveredTicket);

    // DOM update loop - bypasses React
    const updateDOM = useCallback(() => {
        const state = useMarketStore.getState();
        const tickerPrice = state.tickers[pos.symbol]?.price;
        const symbolInfo = state.symbolInfo[pos.symbol];

        const livePrice = tickerPrice || pos.current_price;
        const liveProfit = calculatePnL({
            type: pos.type,
            openPrice: pos.open_price,
            currentPrice: livePrice,
            volume: pos.volume,
            symbolInfo,
            symbol: pos.symbol
        });

        const displayProfit = tickerPrice ? liveProfit : pos.profit;
        const priceStr = livePrice.toFixed(5);
        const profitStr = displayProfit.toFixed(2);

        if (priceRef.current && priceStr !== lastPriceRef.current) {
            lastPriceRef.current = priceStr;
            priceRef.current.textContent = priceStr;
        }

        if (profitRef.current && profitStr !== lastProfitRef.current) {
            lastProfitRef.current = profitStr;
            profitRef.current.textContent = profitStr;
            profitRef.current.className = `p-2 font-bold ${displayProfit >= 0 ? 'text-green-500' : 'text-red-500'}`;
        }
    }, [pos]);

    useEffect(() => {
        let running = true;
        let lastUpdate = 0;
        const interval = 100; // 10fps max

        const tick = () => {
            if (!running) return;
            const now = Date.now();
            if (now - lastUpdate >= interval) {
                lastUpdate = now;
                updateDOM();
            }
            rafIdRef.current = requestAnimationFrame(tick);
        };

        // Initial update
        updateDOM();
        rafIdRef.current = requestAnimationFrame(tick);

        return () => {
            running = false;
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        };
    }, [updateDOM]);

    const startEditing = (ticket: number, field: 'sl' | 'tp', current: number) => {
        setEditingCell({ ticket, field, value: current > 0 ? current.toString() : '' });
    };

    return (
        <tr className="hover:bg-blue-500/10 text-foreground border-b border-border/50"
            onMouseEnter={() => setHoveredTicket(pos.ticket)}
            onMouseLeave={() => setHoveredTicket(null)}>
            <td className="p-2 cursor-pointer hover:text-blue-400 font-medium" onClick={() => onSymbolClick(pos.symbol)}>{pos.symbol ?? '--'}</td>
            <td className="p-2">{pos.ticket ?? '--'}</td>
            <td className="p-2 whitespace-nowrap text-muted-foreground/80">{new Date(pos.time * 1000).toLocaleString()}</td>
            <td className={`p-2 font-bold ${(pos.type || '').toLowerCase() === 'buy' ? 'text-green-500' : 'text-red-500'}`}>{(pos.type || '--').toLowerCase()}</td>
            <td className="p-2">{(pos.volume ?? 0).toFixed(2)}</td>
            <td className="p-2">{(pos.open_price ?? 0).toFixed(5)}</td>
            <td className="p-2">
                {editingCell?.ticket === pos.ticket && editingCell.field === 'sl' ? (
                    <input autoFocus type="number" step="0.00001" className="w-20 bg-secondary text-foreground px-1 rounded border border-blue-500 outline-none"
                        value={editingCell.value} onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })} onBlur={commitEdit} onKeyDown={handleKeyDown} />
                ) : (
                    <span className="cursor-pointer text-blue-500 hover:underline hover:text-blue-400" onClick={() => startEditing(pos.ticket, 'sl', pos.sl)}>
                        {(pos.sl ?? 0) > 0 ? (pos.sl ?? 0).toFixed(5) : '--'}
                    </span>
                )}
            </td>
            <td className="p-2">
                {editingCell?.ticket === pos.ticket && editingCell.field === 'tp' ? (
                    <input autoFocus type="number" step="0.00001" className="w-20 bg-secondary text-foreground px-1 rounded border border-blue-500 outline-none"
                        value={editingCell.value} onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })} onBlur={commitEdit} onKeyDown={handleKeyDown} />
                ) : (
                    <span className="cursor-pointer text-blue-500 hover:underline hover:text-blue-400" onClick={() => startEditing(pos.ticket, 'tp', pos.tp)}>
                        {(pos.tp ?? 0) > 0 ? (pos.tp ?? 0).toFixed(5) : '--'}
                    </span>
                )}
            </td>
            <td ref={priceRef} className="p-2 font-medium">{pos.current_price.toFixed(5)}</td>
            <td ref={profitRef} className={`p-2 font-bold ${pos.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>{pos.profit.toFixed(2)}</td>
            <td className="p-2 text-muted-foreground/60">{pos.magic ?? 0}</td>
            <td className="p-2 text-muted-foreground/40">--</td>
            <td className="p-2 text-center">
                <button onClick={() => onClosePosition(pos.ticket)} className="p-1 text-red-500/60 hover:text-red-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
            </td>
        </tr>
    );
});

export const PositionsTable = memo(PositionsTableImpl);
