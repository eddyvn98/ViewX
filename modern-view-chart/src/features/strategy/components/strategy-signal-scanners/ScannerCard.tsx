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
                        'h-4 w-6 rounded-full border inline-flex items-center px-0.5 transition-all duration-300',
                        scanner.active ? 'border-primary/50 bg-primary/20 justify-end' : 'border-border/70 bg-background/40 justify-start'
                    )}
                    disabled={!scanner.strategyId}
                    aria-label={scanner.active ? t('on') : t('off')}
                >
                    <span
                        className={cn(
                            'h-3 w-3 rounded-full shadow-sm transition-colors',
                            scanner.active ? 'bg-primary' : 'bg-muted-foreground/60'
                        )}
                    />
                </button>
                <button
                    onClick={() => onRemoveScanner(scanner.id)}
                    className="h-4 w-4 rounded text-rose-400 inline-flex items-center justify-center hover:text-rose-500 transition-colors"
                    title="Remove matrix"
                >
                    <X size={9} />
                </button>
            </div>

            {!selectedStrategy && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-400">
                    {t('selectBotHint')}
                </div>
            )}

            {selectedStrategy && !selectedStrategy.active && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-500">
                    {t('botPaused')}
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
                    onEnableScanner={() => onToggleScanner(scanner.id)}
                    isActive={scanner.active}
                />
            )}
        </div>
    );
}
