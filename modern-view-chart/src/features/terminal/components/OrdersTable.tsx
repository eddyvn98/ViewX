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

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown size={12} className="opacity-30 ml-1" />;
        return sortDirection === 'asc' ? <ArrowUp size={12} className="ml-1 text-blue-500" /> : <ArrowDown size={12} className="ml-1 text-blue-500" />;
    };

    const HeaderCell = ({ field, label, className = "" }: { field: SortField, label: string, className?: string }) => (
        <th
            className={`p-2 font-medium border-b border-border cursor-pointer hover:bg-secondary/40 transition-colors ${className}`}
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
            <thead className="sticky top-0 bg-secondary/10 text-muted-foreground z-10 transition-colors">
                <tr>
                    <HeaderCell field="time" label="Time" />
                    <HeaderCell field="symbol" label="Symbol" />
                    <HeaderCell field="ticket" label="Ticket" />
                    <HeaderCell field="magic" label="Magic" />
                    <HeaderCell field="type" label="Type" />
                    <HeaderCell field="volume" label="Volume" />
                    <HeaderCell field="price_open" label="Price" />
                    <HeaderCell field="current_price" label="Current" />
                    <HeaderCell field="sl" label="SL" />
                    <HeaderCell field="tp" label="TP" />
                    <th className="p-2 font-medium border-b border-border">Actions</th>
                </tr>
            </thead>
            <tbody>
                {sortedOrders && sortedOrders.length > 0 ? (
                    sortedOrders.map((ord) => (
                        <tr key={ord.ticket} className="hover:bg-blue-500/10 text-foreground border-b border-border/50">
                            <td className="p-2 whitespace-nowrap">{new Date(ord.time * 1000).toLocaleString()}</td>
                            <td
                                className="p-2 cursor-pointer hover:text-blue-400 font-medium"
                                onClick={() => onSymbolClick(ord.symbol)}
                            >
                                {ord.symbol ?? '--'}
                            </td>
                            <td className="p-2">{ord.ticket ?? '--'}</td>
                            <td className="p-2">{ord.magic ?? 0}</td>
                            <td className="p-2 font-bold text-yellow-500">
                                {(ord.type || '--').toUpperCase()}
                            </td>
                            <td className="p-2">{(ord.volume ?? 0).toFixed(2)}</td>
                            <td className="p-2">{(ord.price_open ?? 0).toFixed(5)}</td>
                            <td className="p-2">{(ord.current_price ?? 0).toFixed(5)}</td>
                            <td className="p-2">{(ord.sl ?? 0) > 0 ? (ord.sl).toFixed(5) : '--'}</td>
                            <td className="p-2">{(ord.tp ?? 0) > 0 ? (ord.tp).toFixed(5) : '--'}</td>
                            <td className="p-2">
                                <button
                                    onClick={() => onCancelOrder(ord.ticket)}
                                    className="px-2 py-1 text-[10px] text-red-500 border border-red-500 rounded hover:bg-red-500 hover:text-white transition-colors"
                                >
                                    Cancel
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
