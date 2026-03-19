'use client';

import { memo } from 'react';
import { TerminalFooter } from './components/TerminalFooter';
import { TerminalHeader } from './components/TerminalHeader';
import { TerminalTabs } from './components/TerminalTabs';
import { useTerminalState } from './use-terminal-state';

declare global {
    interface Window {
        _terminalTouchStart?: number;
    }
}

export const Terminal = memo(function Terminal({ forceExpanded = false }: { forceExpanded?: boolean }) {
    const {
        strategyEngineEnabled,
        isProUser,
        isBridgeOnline,
        visibleAccount,
        visiblePositions,
        visibleOrders,
        visibleHistory,
        terminalTab,
        setTerminalTab,
        effectiveCollapsed,
        handleDragStart,
        toggleCollapse,
        handleScroll,
        handleClosePosition,
        handleUpdatePosition,
        handleSymbolClick,
        handleAnalyze,
    } = useTerminalState(forceExpanded);

    return (
        <div className="flex flex-col h-full bg-background/30 backdrop-blur-xl relative shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.2)] border-t border-border/20">
            <TerminalHeader
                forceExpanded={forceExpanded}
                effectiveCollapsed={effectiveCollapsed}
                isBridgeOnline={isBridgeOnline}
                handleDragStart={handleDragStart}
                toggleCollapse={toggleCollapse}
                visibleAccount={visibleAccount}
            />

            {!effectiveCollapsed && (
                <div className="flex-1 flex flex-col min-h-0">
                    {!isProUser ? (
                        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-amber-400 border-b border-amber-500/20 bg-amber-500/10">
                            Terminal data is available for Pro. You can explore the layout in Free mode.
                        </div>
                    ) : null}

                    <TerminalTabs
                        forceExpanded={forceExpanded}
                        terminalTab={terminalTab}
                        setTerminalTab={setTerminalTab}
                        visiblePositions={visiblePositions}
                        visibleOrders={visibleOrders}
                        visibleHistory={visibleHistory}
                        handleScroll={handleScroll}
                        handleClosePosition={handleClosePosition}
                        handleUpdatePosition={handleUpdatePosition}
                        handleSymbolClick={handleSymbolClick}
                        handleAnalyze={handleAnalyze}
                        strategyEngineEnabled={strategyEngineEnabled}
                    />

                    <TerminalFooter
                        forceExpanded={forceExpanded}
                        terminalTab={terminalTab}
                        setTerminalTab={setTerminalTab}
                        visiblePositions={visiblePositions.length}
                        visibleOrders={visibleOrders.length}
                    />
                </div>
            )}
        </div>
    );
});
