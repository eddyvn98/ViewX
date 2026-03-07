import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScannerViewModel } from './useScannerViewModel';

interface ScannerMatrixTableProps {
    scannerId: string;
    vm: ScannerViewModel;
    symbolCandidates: string[];
    addingSymbolScannerId: string | null;
    addingTfScannerId: string | null;
    onSetAddingSymbolScannerId: (scannerId: string | null) => void;
    onSetAddingTfScannerId: (scannerId: string | null) => void;
    onRemoveSymbol: (scannerId: string, symbol: string) => void;
    onRemoveTimeframe: (scannerId: string, timeframe: string) => void;
    onCommitAddSymbol: (scannerId: string, symbol: string) => void;
    onCommitAddTimeframe: (scannerId: string, timeframe: string) => void;
    onOpenChart: (symbol: string, timeframe: string) => void;
}

const TIMEFRAME_OPTIONS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];

export function ScannerMatrixTable({
    scannerId,
    vm,
    symbolCandidates,
    addingSymbolScannerId,
    addingTfScannerId,
    onSetAddingSymbolScannerId,
    onSetAddingTfScannerId,
    onRemoveSymbol,
    onRemoveTimeframe,
    onCommitAddSymbol,
    onCommitAddTimeframe,
    onOpenChart,
}: ScannerMatrixTableProps) {
    return (
        <div className="overflow-auto pb-6">
            <div className="relative inline-block group/matrix">
                <table className="w-max border-collapse">
                    <thead>
                        <tr>
                            <th className="sticky left-0 z-10 bg-background border border-border/60 px-1 py-0.5 text-left text-[9px] font-black uppercase min-w-[80px] w-fit">Symbol</th>
                            {vm.timeframes.map((tf) => (
                                <th key={`${scannerId}-${tf}`} className="bg-background border border-border/60 px-1 py-0.5 text-center text-[9px] font-black uppercase min-w-[72px] w-[72px]">
                                    <div className="flex items-center justify-center gap-1">
                                        <span>{tf}</span>
                                        <button onClick={() => onRemoveTimeframe(scannerId, tf)} className="text-muted-foreground hover:text-rose-400">
                                            <X size={9} />
                                        </button>
                                    </div>
                                </th>
                            ))}
                            {addingTfScannerId === scannerId && (
                                <th className="bg-background border border-dashed border-primary/40 px-1 py-0.5 text-center min-w-[92px] w-[92px]">
                                    <select
                                        autoFocus
                                        defaultValue=""
                                        onChange={(e) => {
                                            if (!e.target.value) return;
                                            onCommitAddTimeframe(scannerId, e.target.value);
                                        }}
                                        className="h-6 w-full rounded border border-border/60 bg-background px-1 text-[9px] font-bold uppercase"
                                    >
                                        <option value="">TF</option>
                                        {TIMEFRAME_OPTIONS.filter((tf) => !vm.timeframes.includes(tf)).map((tf) => (
                                            <option key={`${scannerId}-tf-${tf}`} value={tf}>
                                                {tf}
                                            </option>
                                        ))}
                                    </select>
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {vm.symbols.map((symbol) => (
                            <tr key={`${scannerId}-${symbol}`}>
                                <td className="sticky left-0 z-10 bg-background border border-border/60 px-1 py-0.5 text-[10px] font-bold min-w-[80px] w-fit">
                                    <div className="flex items-center justify-between gap-1">
                                        <span>{symbol}</span>
                                        <button onClick={() => onRemoveSymbol(scannerId, symbol)} className="text-muted-foreground hover:text-rose-400">
                                            <X size={9} />
                                        </button>
                                    </div>
                                </td>
                                {vm.timeframes.map((tf) => {
                                    const cell = vm.cells.get(`${symbol}__${tf}`);
                                    const signal = cell?.signal || 'NO_TRADE';
                                    const isPending = cell?.badge === 'PENDING';

                                    return (
                                        <td key={`${scannerId}-${symbol}-${tf}`} className="border border-border/60 p-0.5 min-w-[72px] w-[72px]">
                                            <button
                                                onClick={() => onOpenChart(symbol, tf)}
                                                className={cn(
                                                    'w-full h-7 rounded border text-[8px] font-black relative leading-none',
                                                    isPending && 'bg-amber-400/20 border-amber-500/50 text-amber-300',
                                                    !isPending && signal === 'BUY' && 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
                                                    !isPending && signal === 'SELL' && 'bg-rose-500/15 border-rose-500/40 text-rose-400',
                                                    signal === 'NO_TRADE' && 'bg-secondary/30 border-border/60 text-muted-foreground'
                                                )}
                                            >
                                                {signal}
                                            </button>
                                        </td>
                                    );
                                })}
                                {addingTfScannerId === scannerId && (
                                    <td className="border border-dashed border-primary/40 bg-background/50 p-0.5 min-w-[92px] w-[92px]" />
                                )}
                            </tr>
                        ))}
                        {addingSymbolScannerId === scannerId && (
                            <tr>
                                <td className="sticky left-0 z-10 bg-background border border-dashed border-primary/40 px-1 py-0.5 min-w-[80px] w-fit">
                                    <select
                                        autoFocus
                                        defaultValue=""
                                        onChange={(e) => {
                                            if (!e.target.value) return;
                                            onCommitAddSymbol(scannerId, e.target.value);
                                        }}
                                        className="h-6 w-full rounded border border-border/60 bg-background px-1 text-[9px] font-bold"
                                    >
                                        <option value="">Symbol</option>
                                        {symbolCandidates.filter((s) => !vm.symbols.includes(s)).map((symbol) => (
                                            <option key={`${scannerId}-symbol-${symbol}`} value={symbol}>
                                                {symbol}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                {vm.timeframes.map((tf) => (
                                    <td key={`${scannerId}-new-row-${tf}`} className="border border-dashed border-primary/40 bg-background/50 p-0.5 min-w-[72px] w-[72px]" />
                                ))}
                            </tr>
                        )}
                    </tbody>
                </table>

                <div className="absolute -top-2 right-1 z-20">
                    {addingTfScannerId !== scannerId ? (
                        <button
                            onClick={() => {
                                onSetAddingTfScannerId(scannerId);
                                onSetAddingSymbolScannerId(null);
                            }}
                            className="h-5 w-5 rounded-full border border-border/70 bg-background text-muted-foreground hover:text-primary opacity-100 shadow-sm inline-flex items-center justify-center"
                            title="Add column"
                        >
                            <Plus size={10} />
                        </button>
                    ) : null}
                </div>

                <div className="absolute -bottom-3 -left-2 z-20">
                    {addingSymbolScannerId !== scannerId ? (
                        <button
                            onClick={() => {
                                onSetAddingSymbolScannerId(scannerId);
                                onSetAddingTfScannerId(null);
                            }}
                            className="h-5 w-5 rounded-full border border-border/70 bg-background text-muted-foreground hover:text-primary opacity-100 shadow-sm inline-flex items-center justify-center"
                            title="Add row"
                        >
                            <Plus size={10} />
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
