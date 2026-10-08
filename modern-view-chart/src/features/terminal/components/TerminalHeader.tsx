'use client';

import type { AccountInfo } from '@/lib/store/types';
import type { MouseEventHandler } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AccountSummary } from './AccountSummary';
import { MobileAccountSummary } from './MobileAccountSummary';
import { buildMt5DataSourceKey, Mt5AccountScope } from '@/lib/mt5/account-scope';

type TerminalHeaderProps = {
    forceExpanded: boolean;
    effectiveCollapsed: boolean;
    isBridgeOnline: boolean;
    handleDragStart: MouseEventHandler<HTMLDivElement>;
    toggleCollapse: () => void;
    visibleAccount: AccountInfo | null;
    accountSource: string;
    mt5AccountsAvailable: Mt5AccountScope[];
    selectedMt5Scope: Mt5AccountScope;
    onSelectMt5Scope: (scope: Mt5AccountScope) => void;
};

export function TerminalHeader({
    forceExpanded,
    effectiveCollapsed,
    isBridgeOnline,
    handleDragStart,
    toggleCollapse,
    visibleAccount,
    accountSource,
    mt5AccountsAvailable,
    selectedMt5Scope,
    onSelectMt5Scope,
}: TerminalHeaderProps) {
    return (
        <>
            {!forceExpanded && (
                <div
                    className="absolute top-[-6px] left-0 right-0 h-[12px] cursor-ns-resize hover:bg-primary/20 z-50 transition-all group"
                    onMouseDown={handleDragStart}
                >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-[3px] bg-border/20 rounded-full group-hover:bg-primary/40 transition-all" />
                </div>
            )}

            {!forceExpanded && (
                <div
                    className={cn(
                        'flex items-center justify-between px-3 h-[30px] bg-secondary/10 border-b shrink-0 cursor-pointer hover:bg-secondary/30 transition-all group',
                        !effectiveCollapsed ? 'border-b-border/10' : 'border-b-transparent'
                    )}
                    onClick={toggleCollapse}
                >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div
                            className={cn(
                                'w-1.5 h-1.5 rounded-full shadow-lg shrink-0',
                                isBridgeOnline
                                    ? 'bg-emerald-500 shadow-emerald-500/40 animate-pulse'
                                    : 'bg-rose-500 shadow-rose-500/40'
                            )}
                            title={isBridgeOnline ? 'Bridge Connected' : 'Bridge Disconnected'}
                        />
                        <div className="flex-1 min-w-0 overflow-hidden">
                            {forceExpanded ? (
                                <MobileAccountSummary account={visibleAccount} />
                            ) : (
                                <AccountSummary account={visibleAccount} sourceKey={accountSource} />
                            )}
                        </div>
                        {mt5AccountsAvailable.length > 1 && (
                            <select
                                value={buildMt5DataSourceKey(selectedMt5Scope)}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => {
                                    const next = mt5AccountsAvailable.find(
                                        (scope) => buildMt5DataSourceKey(scope) === event.target.value,
                                    );
                                    if (next) onSelectMt5Scope(next);
                                }}
                                className="h-6 max-w-44 rounded border border-border/40 bg-background/70 px-2 text-[10px] font-semibold text-foreground outline-none"
                                aria-label="MT5 account"
                            >
                                {mt5AccountsAvailable.map((scope) => {
                                    const key = buildMt5DataSourceKey(scope);
                                    const label = scope.source === 'MT5'
                                        ? 'Shared MT5'
                                        : `${scope.accountLogin || 'MT5'}${scope.broker ? ` · ${scope.broker}` : ''}`;
                                    return <option key={key} value={key}>{label}</option>;
                                })}
                            </select>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[11px] text-muted-foreground font-black uppercase tracking-widest hidden group-hover:block transition-all opacity-0 group-hover:opacity-100 italic">
                            {effectiveCollapsed ? 'Maximize' : 'Minimize'}
                        </span>
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                toggleCollapse();
                            }}
                            aria-label={effectiveCollapsed ? "Expand terminal" : "Collapse terminal"}
                            aria-expanded={!effectiveCollapsed}
                            className={cn(
                                'p-1.5 rounded-lg transition-all',
                                !effectiveCollapsed
                                    ? 'text-primary bg-primary/10 shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                            )}
                        >
                            {effectiveCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
