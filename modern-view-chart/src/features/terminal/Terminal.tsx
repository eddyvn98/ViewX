'use client';

import React, { memo } from 'react';
import { TerminalFooter } from './components/TerminalFooter';
import { TerminalHeader } from './components/TerminalHeader';
import { TerminalTabs } from './components/TerminalTabs';
import { Mt5ActivationWizard } from './components/Mt5ActivationWizard';
import { useTerminalState } from './use-terminal-state';

declare global {
    interface Window {
        _terminalTouchStart?: number;
    }
}

export const Terminal = memo(function Terminal({ forceExpanded = false }: { forceExpanded?: boolean }) {
    const {
        strategyEngineEnabled,
        hasMt5Module,
        isBridgeOnline,
        hasLegalConsent,
        hasAccountLinked,
        onboardingSource,
        refreshLegalConsent,
        isProFlowReady,
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
    } = useTerminalState(forceExpanded, {
        warningSetupRequired: 'MT5 flow chua san sang: can module + bridge + account + legal consent.',
        warningModifyUnavailable: 'Khong the sua lenh khi luong MT5 chua san sang.',
    });

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
                    {!hasMt5Module ? (
                        <div className="border-b border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                            DU LIEU TERMINAL MT5 CHI MO KHI MODULE MT5 DA KICH HOAT.
                        </div>
                    ) : null}

                    {!isProFlowReady ? (
                        <Mt5ActivationWizard
                            hasMt5Module={hasMt5Module}
                            isBridgeOnline={isBridgeOnline}
                            hasAccountLinked={hasAccountLinked}
                            hasLegalConsent={hasLegalConsent}
                            onboardingSource={onboardingSource}
                            onConsentSaved={refreshLegalConsent}
                        />
                    ) : null}

                    {hasMt5Module && isProFlowReady ? (
                        <div className="mx-2 mt-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-[10px] text-emerald-800">
                            MT5 flow da san sang: module, bridge, account va legal consent deu da du.
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
