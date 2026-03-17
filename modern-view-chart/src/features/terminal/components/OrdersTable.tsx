import { Order } from "@/lib/store/types";
import { useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface OrdersTableProps {
    orders: Order[];
    onCancelOrder: (ticket: number) => void;
    onSymbolClick: (symbol: string) => void;
}

type SortField = 'symbol' | 'ticket' | 'type' | 'volume' | 'price_open' | 'current_price' | 'sl' | 'tp' | 'time' | 'magic';
type SortDirection = 'asc' | 'desc';

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
    if (sortField !== field) return <ArrowUpDown size={12} className="opacity-30 ml-1" />;
    return sortDirection === 'asc' ? <ArrowUp size={12} className="ml-1 text-blue-500" /> : <ArrowDown size={12} className="ml-1 text-blue-500" />;
}

function HeaderCell({
    field,
    label,
    className = "",
    onSort,
    sortField,
    sortDirection,
}: {
    field: SortField;
    label: string;
    className?: string;
    onSort: (field: SortField) => void;
    sortField: SortField;
    sortDirection: SortDirection;
}) {
    return (
        <th
            className={`p-2 font-medium border-b border-border cursor-pointer hover:bg-secondary/40 transition-colors ${className}`}
            onClick={() => onSort(field)}
        >
            <div className="flex items-center">
                {label}
                <SortIcon field={field} sortField={sortField} sortDirection={sortDirection} />
            </div>
        </th>
    );
}

export function OrdersTable({ orders, onCancelOrder, onSymbolClick }: OrdersTableProps) {
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

    const sortedOrders = [...orders].sort((a, b) => {
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

    return (
        <table className="w-full text-[11px] text-left border-collapse min-w-[1000px]">
            <thead className="sticky top-0 bg-secondary/10 text-muted-foreground z-10 transition-colors">
                <tr>
                    <HeaderCell field="symbol" label="Symbol" onSort={handleSort} sortField={sortField} sortDirection={sortDirection} />
                    <HeaderCell field="ticket" label="Ticket" onSort={handleSort} sortField={sortField} sortDirection={sortDirection} />
                    <HeaderCell field="time" label="Time" onSort={handleSort} sortField={sortField} sortDirection={sortDirection} />
                    <HeaderCell field="type" label="Type" onSort={handleSort} sortField={sortField} sortDirection={sortDirection} />
                    <HeaderCell field="volume" label="Volume" onSort={handleSort} sortField={sortField} sortDirection={sortDirection} />
                    <HeaderCell field="price_open" label="Price" onSort={handleSort} sortField={sortField} sortDirection={sortDirection} />
                    <HeaderCell field="sl" label="S / L" onSort={handleSort} sortField={sortField} sortDirection={sortDirection} />
                    <HeaderCell field="tp" label="T / P" onSort={handleSort} sortField={sortField} sortDirection={sortDirection} />
                    <HeaderCell field="current_price" label="Price" onSort={handleSort} sortField={sortField} sortDirection={sortDirection} />
                    <HeaderCell field="magic" label="Magic" onSort={handleSort} sortField={sortField} sortDirection={sortDirection} />
                    <th className="p-2 font-medium border-b border-border">Comment</th>
                    <th className="p-2 font-medium border-b border-border text-center">Actions</th>
                </tr>
            </thead>
            <tbody>
                {sortedOrders && sortedOrders.length > 0 ? (
                    sortedOrders.map((ord) => (
                        <tr key={ord.ticket} className="hover:bg-blue-500/10 text-foreground border-b border-border/50">
                            <td
                                className="p-2 cursor-pointer hover:text-blue-400 font-medium"
                                onClick={() => onSymbolClick(ord.symbol)}
                            >
                                {ord.symbol ?? '--'}
                            </td>
                            <td className="p-2">{ord.ticket ?? '--'}</td>
                            <td className="p-2 whitespace-nowrap text-muted-foreground/80">{new Date(ord.time * 1000).toLocaleString()}</td>
                            <td className="p-2 font-bold text-yellow-500/80">
                                {(ord.type || '--').toLowerCase()}
                            </td>
                            <td className="p-2">{(ord.volume ?? 0).toFixed(2)}</td>
                            <td className="p-2">{(ord.price_open ?? 0).toFixed(5)}</td>
                            <td className="p-2">{(ord.sl ?? 0) > 0 ? (ord.sl).toFixed(5) : '--'}</td>
                            <td className="p-2">{(ord.tp ?? 0) > 0 ? (ord.tp).toFixed(5) : '--'}</td>
                            <td className="p-2 font-medium">{(ord.current_price ?? 0).toFixed(5)}</td>
                            <td className="p-2 text-muted-foreground/60">{ord.magic ?? 0}</td>
                            <td className="p-2 text-muted-foreground/40">--</td>
                            <td className="p-2 text-center">
                                <button onClick={() => onCancelOrder(ord.ticket)} className="p-1 text-red-500/60 hover:text-red-500 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                </button>
                            </td>
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan={11} className="p-4 text-center text-muted-foreground">No moving orders</td>
                    </tr>
                )}
            </tbody>
        </table>
    );
}
