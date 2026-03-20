import { Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
    onEnableScanner: () => void;
    isActive: boolean;
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
    onEnableScanner,
    isActive,
}: ScannerMatrixTableProps) {
    const t = useTranslations('Signals.matrix');

    return (
        <div className="overflow-auto pb-6 relative">
            <div className={cn(
                "relative inline-block group/matrix transition-all duration-300 subpixel-antialiased",
                !isActive && "opacity-40 grayscale-[0.5] select-none"
            )}>
                <table className={cn("w-max border-collapse", !isActive && "pointer-events-none")}>
                    <thead>
                        <tr>
                            <th className="sticky left-0 z-10 bg-background border border-border/60 px-1 py-0.5 text-left text-[10px] font-medium uppercase tracking-[0.02em] min-w-[80px] w-fit shadow-[1px_0_0_var(--color-border)]">{t('symbol')}</th>
                            {vm.timeframes.map((tf) => (
                                <th key={`${scannerId}-${tf}`} className="bg-background border border-border/60 px-1 py-0.5 text-center text-[10px] font-medium uppercase tracking-[0.02em] min-w-[72px] w-[72px]">
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
                                        className="h-6 w-full rounded border border-border/60 bg-background px-1 text-[11px] font-bold uppercase"
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
                                <td className="sticky left-0 z-10 bg-background border border-border/60 px-1 py-0.5 text-[10px] font-medium min-w-[80px] w-fit shadow-[1px_0_0_var(--color-border)]">
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
                                    const isOpen = cell?.badge === 'OPEN';
                                    const isPending = cell?.badge === 'PENDING';
                                    const isOpenBuy = isOpen && signal === 'BUY';
                                    const isOpenSell = isOpen && signal === 'SELL';
                                    const isPendingBuy = isPending && signal === 'BUY';
                                    const isPendingSell = isPending && signal === 'SELL';
                                    const isSignalBuy = !isOpen && !isPending && signal === 'BUY';
                                    const isSignalSell = !isOpen && !isPending && signal === 'SELL';
                                    const openLabel = isOpenBuy
                                        ? t('openBuy')
                                        : (isOpenSell ? t('openSell') : t('open'));
                                    const pendingLabel = isPendingBuy
                                        ? t('pendingBuy')
                                        : (isPendingSell ? t('pendingSell') : t('pending'));
                                    const signalLabel = isSignalBuy
                                        ? t('signalBuy')
                                        : (isSignalSell ? t('signalSell') : t('noTrade'));

                                    return (
                                        <td key={`${scannerId}-${symbol}-${tf}`} className="border border-border/60 p-0.5 min-w-[72px] w-[72px]">
                                            <button
                                                onClick={() => onOpenChart(symbol, tf)}
                                                className={cn(
                                                    'w-full h-7 rounded border text-[10px] font-medium relative leading-none tracking-[0.01em] transition-colors duration-200',
                                                    isOpen
                                                        ? (isOpenBuy
                                                            ? 'bg-emerald-500/20 border-emerald-500/65 text-emerald-700 dark:text-emerald-400'
                                                            : (isOpenSell
                                                                ? 'bg-rose-500/20 border-rose-500/65 text-rose-600 dark:text-rose-400'
                                                                : 'bg-sky-500/20 border-sky-500/60 text-sky-600 dark:text-sky-400'
                                                            ))
                                                        : isPending
                                                        ? (isPendingBuy
                                                            ? 'bg-emerald-500/14 border-emerald-500/55 text-emerald-600 dark:text-emerald-400'
                                                            : (isPendingSell
                                                                ? 'bg-rose-500/14 border-rose-500/55 text-rose-500'
                                                                : 'bg-amber-500/30 border-amber-500/50 text-amber-500'
                                                            ))
                                                        : (signal === 'BUY'
                                                            ? 'bg-primary/15 border-primary/40 text-primary'
                                                            : (signal === 'SELL'
                                                                ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                                                                : 'bg-secondary/30 border-border/60 text-muted-foreground'
                                                            )
                                                        )
                                                )}
                                            >
                                                <span className="flex items-center justify-center gap-1.5">
                                                    {isOpenBuy || isOpenSell || isPendingBuy || isPendingSell ? (
                                                        <span className="relative flex h-[5px] w-[5px] shrink-0">
                                                            <span
                                                                className={cn(
                                                                    'absolute inline-flex h-full w-full rounded-full animate-ping opacity-75',
                                                                    (isOpenBuy || isPendingBuy) ? 'bg-emerald-500' : 'bg-rose-500'
                                                                )}
                                                            />
                                                            <span
                                                                className={cn(
                                                                    'relative inline-flex h-[5px] w-[5px] rounded-full',
                                                                    (isOpenBuy || isPendingBuy) ? 'bg-emerald-500' : 'bg-rose-500'
                                                                )}
                                                            />
                                                        </span>
                                                    ) : null}
                                                    <span>
                                                        {isOpen
                                                            ? openLabel
                                                            : (isPending
                                                                ? pendingLabel
                                                                : signalLabel)}
                                                    </span>
                                                </span>
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
                                        className="h-6 w-full rounded border border-border/60 bg-background px-1 text-[11px] font-bold"
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

            {!isActive && (
                <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                    <button
                        type="button"
                        onClick={onEnableScanner}
                        className="pointer-events-auto bg-background/80 backdrop-blur-[2px] border border-border/40 px-4 py-2 rounded-full shadow-xl hover:bg-background/90 transition-colors"
                    >
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-pulse" />
                            {t('disabled')}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}
