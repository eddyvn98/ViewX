import { Condition, ConditionGroup, StrategyDirection, StrategyRisk, SLTPConfig, PositionMode } from '../types';
import { useTranslations } from 'next-intl';

interface StrategyPreviewProps {
    direction: StrategyDirection;
    marketFilter: ConditionGroup;
    entrySetup?: ConditionGroup;
    risk: StrategyRisk;
    entryType?: 'market' | 'stop' | 'limit';
    entryPrice?: SLTPConfig;
    positionMode?: PositionMode;
}

function formatComparator(op: string): string {
    if (op === 'crosses_above') return 'crosses above';
    if (op === 'crosses_below') return 'crosses below';
    return op;
}

function summarizeGroup(group?: ConditionGroup): string[] {
    if (!group || group.conditions.length === 0) return [];
    return group.conditions
        .filter((c): c is Condition => !('operator' in c))
        .map((c) => `${c.left?.type || 'Rule'} (${c.left?.params?.[0] ?? '-'}) ${formatComparator(c.comparator)} ${typeof c.right === 'number' ? c.right : 'value'}`);
}

type Translator = (key: string) => string;

function formatOffset(offset: number | undefined, t: Translator): string {
    const val = offset ?? 0;
    if (val === 0) return t('builder.candle'); // Or 'Signal' from prev, let's keep Signal logic but translate
    // We'll use specific keys if needed, but for now let's keep logic simple
    if (val === 0) return 'Signal'; 
    if (val === 1) return 'Prev';
    return `${val} ago`;
}

function summarizeSL(risk: StrategyRisk, t: Translator): string {
    if (!risk.sl) return t('preview.disabled');
    if (typeof risk.sl === 'number') return `${risk.sl} pts`;
    if (risk.sl.mode === 'candle') return `${t('builder.candle')} ${risk.sl.candleField || 'low'} (${formatOffset(risk.sl.candleOffset, t)})`;
    if (risk.sl.mode === 'fixed') return `${risk.sl.value ?? 0} pts`;
    return risk.sl.mode;
}

function summarizeTP(risk: StrategyRisk, t: Translator): string {
    if (risk.trailing) return t('preview.trailing');
    if (!risk.tp) return t('preview.disabled');
    if (typeof risk.tp === 'number') return `${risk.tp} pts`;
    if (risk.tp.mode === 'candle') return `${t('builder.candle')} ${risk.tp.candleField || 'high'} (${formatOffset(risk.tp.candleOffset, t)})`;
    if (risk.tp.mode === 'fixed') return `${risk.tp.value ?? 0} pts`;
    return risk.tp.mode;
}

function summarizeEntryPrice(entryPrice: SLTPConfig | undefined, direction: StrategyDirection | undefined, t: Translator): string {
    if (!entryPrice) {
        if (!direction) return 'Auto';
        return `${t('builder.candle')} ${direction === 'BUY' ? 'high' : 'low'} (Signal) + 0`;
    }
    if (entryPrice.mode === 'candle') return `${t('builder.candle')} ${entryPrice.candleField || (direction === 'BUY' ? 'high' : 'low')} (${formatOffset(entryPrice.candleOffset, t)}) ${entryPrice.offset ? `+ ${entryPrice.offset}` : ''}`;
    if (entryPrice.mode === 'fixed') return `${entryPrice.value ?? 0} pts`;
    return entryPrice.mode;
}

function summarizeLot(risk: StrategyRisk, t: Translator): string {
    if (typeof risk.lotSize === 'number') return `${risk.lotSize} ${t('builder.volume')}`; // Lot/Volume
    const unit = risk.lotSize.mode === 'fixed' ? 'Lot' : (risk.lotSize.mode === 'percentage' ? '%' : '$');
    return `${risk.lotSize.value} ${unit}`;
}

export function StrategyPreview({ direction, marketFilter, entrySetup, risk, entryType = 'stop', entryPrice, positionMode }: StrategyPreviewProps) {
    const t = useTranslations('Strategy');
    const marketLines = summarizeGroup(marketFilter);
    const entryLines = summarizeGroup(entrySetup);
    const lines = [...marketLines, ...entryLines];

    return (
        <div className="rounded-lg border border-border bg-secondary/20 overflow-hidden">
            <div className="px-4 py-2 border-b border-border bg-secondary/40">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">{t('preview.title')}</span>
            </div>
            <div className="px-4 py-3 flex flex-col gap-1.5">
                <p className="text-[11px] font-medium text-foreground">
                    {direction} {t('preview.when')}
                </p>
                {lines.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">{t('preview.noRules')}</p>
                ) : (
                    <ul className="list-disc pl-5 text-[11px] text-foreground/90 space-y-0.5">
                        {lines.map((line, idx) => (
                            <li key={`${line}-${idx}`}>{line}</li>
                        ))}
                    </ul>
                )}
                <p className="text-[11px] text-foreground"><span className="font-semibold">{t('preview.sl')}</span> <span className="text-muted-foreground">{summarizeSL(risk, t)}</span></p>
                <p className="text-[11px] text-foreground"><span className="font-semibold">{t('preview.tp')}</span> <span className="text-muted-foreground">{summarizeTP(risk, t)}</span></p>
                <p className="text-[11px] text-foreground"><span className="font-semibold">{t('preview.execution')}</span> <span className="text-muted-foreground">{entryType.toUpperCase()} {entryType !== 'market' ? `${t('preview.at')} ${summarizeEntryPrice(entryPrice, direction, t)}` : ''}</span></p>
                <p className="text-[11px] text-foreground"><span className="font-semibold">{t('preview.riskManager')}</span> <span className="text-muted-foreground">Lot {summarizeLot(risk, t)} | {t('preview.trailing')} {risk.trailing ? t('preview.on') : t('preview.off')} | {t('preview.maxTrades')} {risk.maxTrades ?? 1}{positionMode ? ` | ${t(`builder.${positionMode === 'single_position' ? 'single' : positionMode === 'hedge' ? 'hedge' : 'scaleIn'}`)}` : ''}</span></p>
            </div>
        </div>
    );
}

