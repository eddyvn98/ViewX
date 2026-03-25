'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { TerminalFooter } from './components/TerminalFooter';
import { TerminalHeader } from './components/TerminalHeader';
import { TerminalTabs } from './components/TerminalTabs';
import { ProSetupWizard } from './components/ProSetupWizard';
import { useTerminalState } from './use-terminal-state';

declare global {
    interface Window {
        _terminalTouchStart?: number;
    }
}

export const Terminal = memo(function Terminal({ forceExpanded = false }: { forceExpanded?: boolean }) {
    const t = useTranslations('ProFlow');
    const {
        strategyEngineEnabled,
        isProUser,
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
        warningSetupRequired: t('warningSetupRequired'),
        warningModifyUnavailable: t('warningModifyUnavailable'),
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
                    {!isProUser ? (
                        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-amber-400 border-b border-amber-500/20 bg-amber-500/10">
                            {t('terminalProOnly')}
                        </div>
                    ) : null}

                    {isProUser && !isProFlowReady ? (
                        <ProSetupWizard
                            isProUser={isProUser}
                            isBridgeOnline={isBridgeOnline}
                            hasAccountLinked={hasAccountLinked}
                            hasLegalConsent={hasLegalConsent}
                            onboardingSource={onboardingSource}
                            onConsentSaved={refreshLegalConsent}
                        />
                    ) : null}

                    {isProUser && isProFlowReady ? (
                        <div className="mx-2 mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[10px] text-emerald-200">
                            {t('ready')}
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
