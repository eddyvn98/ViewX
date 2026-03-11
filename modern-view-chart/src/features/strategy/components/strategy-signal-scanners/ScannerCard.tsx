import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { MatrixScannerConfig } from '@/features/strategy/dashboard/matrix-types';
import type { Strategy } from '@/features/strategy/types';
import type { ScannerViewModel } from './useScannerViewModel';
import { ScannerMatrixTable } from './ScannerMatrixTable';

interface ScannerCardProps {
    scanner: MatrixScannerConfig;
    vm: ScannerViewModel;
    selectedStrategy: Strategy | null;
    isFocused: boolean;
    symbolCandidates: string[];
    addingSymbolScannerId: string | null;
    addingTfScannerId: string | null;
    onFocusScanner: (scannerId: string) => void;
    onToggleScanner: (scannerId: string) => void;
    onRemoveScanner: (scannerId: string) => void;
    onSetAddingSymbolScannerId: (scannerId: string | null) => void;
    onSetAddingTfScannerId: (scannerId: string | null) => void;
    onRemoveSymbol: (scannerId: string, symbol: string) => void;
    onRemoveTimeframe: (scannerId: string, timeframe: string) => void;
    onCommitAddSymbol: (scannerId: string, symbol: string) => void;
    onCommitAddTimeframe: (scannerId: string, timeframe: string) => void;
    onOpenChart: (symbol: string, timeframe: string) => void;
    setCardRef: (el: HTMLDivElement | null) => void;
}

export function ScannerCard({
    scanner,
    vm,
    selectedStrategy,
    isFocused,
    symbolCandidates,
    addingSymbolScannerId,
    addingTfScannerId,
    onFocusScanner,
    onToggleScanner,
    onRemoveScanner,
    onSetAddingSymbolScannerId,
    onSetAddingTfScannerId,
    onRemoveSymbol,
    onRemoveTimeframe,
    onCommitAddSymbol,
    onCommitAddTimeframe,
    onOpenChart,
    setCardRef,
}: ScannerCardProps) {
    const t = useTranslations('Signals.matrix');

    return (
        <div
            ref={setCardRef}
            className={cn(
                'rounded-xl border p-2.5 flex flex-col gap-2.5 transition-all duration-300',
                scanner.active ? 'bg-secondary/30 border-border/80 shadow-md' : 'bg-secondary/10 border-border/40',
                isFocused && 'ring-1 ring-primary/40 shadow-xl'
            )}
        >
            <div className="flex items-center gap-2">
                <button
                    onClick={() => onFocusScanner(scanner.id)}
                    className="flex-1 h-7 px-2 rounded border border-border/60 bg-background text-[11px] font-semibold text-left leading-tight transition-all hover:bg-secondary/20"
                >
                    {selectedStrategy?.name || t('noBot')}
                </button>
                <button
                    onClick={() => onToggleScanner(scanner.id)}
                    className={cn(
                        'h-8 px-2 rounded border text-[10px] font-black uppercase inline-flex items-center gap-1.5 transition-all duration-300',
                        scanner.active ? 'border-primary/50 text-primary bg-primary/10' : 'border-border/70 text-muted-foreground bg-background/40'
                    )}
                    disabled={!scanner.strategyId}
                >
                    <span className={cn('w-1.5 h-1.5 rounded-full', scanner.active ? 'bg-primary animate-pulse' : 'bg-muted-foreground/60')} />
                    {scanner.active ? t('on') : t('off')}
                </button>
                <button
                    onClick={() => onRemoveScanner(scanner.id)}
                    className="h-8 w-8 rounded border border-rose-500/30 text-rose-400 inline-flex items-center justify-center"
                    title="Remove matrix"
                >
                    <X size={12} />
                </button>
            </div>

            {!selectedStrategy && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-400">
                    {t('selectBotHint')}
                </div>
            )}

            {selectedStrategy && (
                <ScannerMatrixTable
                    scannerId={scanner.id}
                    vm={vm}
                    symbolCandidates={symbolCandidates}
                    addingSymbolScannerId={addingSymbolScannerId}
                    addingTfScannerId={addingTfScannerId}
                    onSetAddingSymbolScannerId={onSetAddingSymbolScannerId}
                    onSetAddingTfScannerId={onSetAddingTfScannerId}
                    onRemoveSymbol={onRemoveSymbol}
                    onRemoveTimeframe={onRemoveTimeframe}
                    onCommitAddSymbol={onCommitAddSymbol}
                    onCommitAddTimeframe={onCommitAddTimeframe}
                    onOpenChart={onOpenChart}
                    isActive={scanner.active}
                />
            )}
        </div>
    );
}
