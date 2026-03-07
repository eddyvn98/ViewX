'use client';

import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { useWebSocket } from "@/hooks/use-websocket";
import { useUserSetupSync } from "@/hooks/use-user-setup-sync";
import { useMarketStore, RootState } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import React from "react";
import dynamic from "next/dynamic";

const NotificationManager = dynamic(
  () => import("@/features/notifications/NotificationManager").then((m) => m.NotificationManager),
  { ssr: false }
);
const ChartsToolbarMemo = dynamic(
  () => import("@/features/chart/components/ChartsToolbar").then((m) => m.ChartsToolbarMemo),
  { ssr: false }
);
const ChartGrid = dynamic(
  () => import("@/features/chart/components/ChartGrid").then((m) => m.ChartGrid),
  { ssr: false }
);
const MarketList = dynamic(
  () => import("@/features/market/MarketList").then((m) => m.MarketList),
  { ssr: false }
);
const Terminal = dynamic(
  () => import("@/features/terminal/Terminal").then((m) => m.Terminal),
  { ssr: false }
);
const RightSidebar = dynamic(
  () => import("@/features/chart/components/RightSidebar").then((m) => m.RightSidebar),
  { ssr: false }
);
const StrategyPanel = dynamic(
  () => import("@/features/chart/components/StrategyPanel").then((m) => m.StrategyPanel),
  { ssr: false }
);
const LayerManager = dynamic(
  () => import("@/features/chart/components/LayerManager").then((m) => m.LayerManager),
  { ssr: false }
);
const MobileBottomNav = dynamic(
  () => import("@/components/layout/MobileBottomNav").then((m) => m.MobileBottomNav),
  { ssr: false }
);
const StrategyRunnerBootstrap = dynamic(
  () => import("@/features/strategy/components/StrategyRunnerBootstrap").then((m) => m.StrategyRunnerBootstrap),
  { ssr: false }
);

function PanelFallback({ className = "" }: { className?: string }) {
  return <div className={cn("h-full w-full animate-pulse bg-secondary/20", className)} />;
}

function resolvePriceDigits(symbol?: string, digits?: number): number {
  if (Number.isFinite(digits)) return Number(digits);
  const s = String(symbol || "").toUpperCase();
  if (s.includes("JPY")) return 3;
  if (s.includes("XAU") || s.includes("XAG")) return 3;
  if (s.includes("USDT") || s.includes("USD")) return 2;
  return 4;
}

function formatTabPrice(price: number, digits: number): string {
  if (!Number.isFinite(price)) return "--";
  return price.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function Home() {
  useWebSocket();
  useUserSetupSync();
  const strategyEnabled = process.env.NEXT_PUBLIC_STRATEGY_ENGINE_ENABLED === "true";
  const {
    isTerminalVisible,
    isTerminalCollapsed,
    terminalHeight,
    isLeftSidebarOpen,
    isRightSidebarOpen,
    rightSidebarWidth,
    activeMobileTab,
    isInputFocused,
    isScrollingPanel
  } = useMarketStore(useShallow((state: RootState) => ({
    isTerminalVisible: state.isTerminalVisible,
    isTerminalCollapsed: state.isTerminalCollapsed,
    terminalHeight: state.terminalHeight,
    isLeftSidebarOpen: state.isLeftSidebarOpen,
    isRightSidebarOpen: state.isRightSidebarOpen,
    rightSidebarWidth: state.rightSidebarWidth,
    activeMobileTab: state.activeMobileTab,
    isInputFocused: state.isInputFocused,
    isScrollingPanel: state.isScrollingPanel
  })));

  const toggleLeftSidebar = useMarketStore((state) => state.toggleLeftSidebar);
  const setActiveMobileTab = useMarketStore((state) => state.setActiveMobileTab);
  const setInputFocused = useMarketStore((state) => state.setInputFocused);
  const setIsScrollingPanel = useMarketStore((state) => state.setIsScrollingPanel);
  const setRightSidebarWidth = useMarketStore((state) => state.setRightSidebarWidth);
  const activeChart = useMarketStore((state) => {
    const tab = state.tabs[state.activeTabId];
    if (!tab?.activeChartId) return null;
    return tab.charts[tab.activeChartId] || null;
  });
  const activeTicker = useMarketStore((state) => {
    const tab = state.tabs[state.activeTabId];
    const activeChartId = tab?.activeChartId;
    if (!activeChartId) return undefined;
    const chart = tab.charts[activeChartId];
    if (!chart?.symbol) return undefined;
    return state.tickers[chart.symbol];
  });
  const activeDigits = useMarketStore((state) => {
    const tab = state.tabs[state.activeTabId];
    const activeChartId = tab?.activeChartId;
    if (!activeChartId) return undefined;
    const chart = tab.charts[activeChartId];
    if (!chart?.symbol) return undefined;
    return state.symbolInfo[chart.symbol]?.digits;
  });
  const [isMobileWatchlistAddMode, setIsMobileWatchlistAddMode] = React.useState(false);

  // Keyboard Detection & Layout Reset
  React.useEffect(() => {
    if (!window.visualViewport) return;

    const handleResize = () => {
      const isKeyboardVisible = window.visualViewport!.height < window.innerHeight * 0.85;
      if (!isKeyboardVisible && isInputFocused) {
        setInputFocused(false);
        (document.activeElement as HTMLElement)?.blur();
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    return () => window.visualViewport?.removeEventListener('resize', handleResize);
  }, [isInputFocused, setInputFocused]);

  const handleMobileTabChange = (tab: string) => {
    if (activeMobileTab === tab && (tab === 'trade' || tab === 'positions')) {
      setActiveMobileTab('chart');
      setInputFocused(false);
    } else {
      setActiveMobileTab(tab);
    }
  };

  const handleClosePanel = () => {
    setActiveMobileTab('chart');
    setInputFocused(false);
    (document.activeElement as HTMLElement)?.blur();
  };

  const scrollTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleScroll = () => {
    if (!setIsScrollingPanel) return;
    setIsScrollingPanel(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrollingPanel(false);
    }, 1500);
  };

  React.useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      if (setIsScrollingPanel) setIsScrollingPanel(false);
    };
  }, [setIsScrollingPanel]);

  React.useEffect(() => {
    const raw = Number(window.localStorage.getItem('right-sidebar-width') || 320);
    if (!Number.isFinite(raw)) return;
    setRightSidebarWidth(raw);
  }, [setRightSidebarWidth]);

  React.useEffect(() => {
    const symbol = activeChart?.symbol || "XAUUSDm";
    const interval = activeChart?.interval || "1";
    const digits = resolvePriceDigits(symbol, activeDigits);
    const price = activeTicker?.price;
    const changePercent = activeTicker?.change;

    if (!Number.isFinite(price)) {
      document.title = `${symbol} ${interval}m | vivutrade Chart`;
      return;
    }

    const arrow = (changePercent || 0) >= 0 ? "▲" : "▼";
    const pct = `${(changePercent || 0) >= 0 ? "+" : ""}${(changePercent || 0).toFixed(2)}%`;
    document.title = `${symbol} ${formatTabPrice(price as number, digits)} ${arrow} ${pct} | vivutrade`;
  }, [activeChart?.symbol, activeChart?.interval, activeTicker?.price, activeTicker?.change, activeDigits]);

  return (
    <div className="app-root bg-background text-foreground font-sans select-none relative transition-colors duration-300">
      {strategyEnabled && <StrategyRunnerBootstrap />}
      <NotificationManager />
      <div className="hidden md:block">
        <Header />
      </div>

      {/* Mobile Top Bar */}
      <MobileTopBar />

      {/* 
          Mobile Height: 100dvh - 64px (Bottom Nav)
          Desktop Height: 100vh - 48px (Header) 
      */}
      <div className="flex flex-1 pt-0 overflow-hidden min-h-0">
        {/* LEFT BAR: Icons */}
        <div className="hidden md:flex h-full">
          <Sidebar />
        </div>

        {/* BODY AREA */}
        <div className="flex-1 flex overflow-hidden ml-0 relative min-h-0">
          {/* OPTIONAL LEFT PANEL: Market List */}
          <div
            className={cn(
              "border-r border-border bg-background flex-col overflow-hidden transition-all duration-300 ease-in-out shrink-0 hidden md:flex",
              isLeftSidebarOpen ? "w-72 opacity-100" : "w-0 opacity-0 pointer-events-none"
            )}
          >
            <div className="w-72 h-full flex flex-col">
              <div className="p-3 border-b border-border flex justify-between items-center bg-secondary/20 shrink-0">
                <span className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">Market Selection</span>
                <button onClick={toggleLeftSidebar} className="text-muted-foreground hover:text-foreground p-1 transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                {isLeftSidebarOpen ? <MarketList mode="discovery" /> : null}
              </div>
            </div>
          </div>

          {/* MAIN CENTER: Charts & Terminal */}
          <main className={cn(
            "flex-1 flex flex-col p-0 md:p-1.5 overflow-hidden relative min-w-0 bg-secondary/10 pb-0 md:pb-0"
          )}>
            {/* Show Chart ONLY if active tab is 'chart' on Mobile, OR always on Desktop */}
            <div className={cn(
              "flex-1 flex flex-col min-h-0 bg-card rounded-none md:rounded-lg border-0 md:border border-border/50 overflow-hidden shadow-2xl",
              (activeMobileTab === 'chart' || activeMobileTab === 'trade' || activeMobileTab === 'positions' || activeMobileTab === 'strategy' || activeMobileTab === 'indicators') ? 'flex' : 'hidden md:flex'
            )}>
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-0">
                <div className="hidden md:block">
                  <React.Suspense fallback={<PanelFallback className="h-11" />}>
                    <ChartsToolbarMemo />
                  </React.Suspense>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  <React.Suspense fallback={<PanelFallback />}>
                    <ChartGrid />
                  </React.Suspense>
                </div>
              </div>

              {/* Desktop Terminal - CONDITIONAL RENDER to prevent re-renders when hidden */}
              {isTerminalVisible && (
                <div
                  className="transition-all duration-300 ease-in-out overflow-hidden flex-col shrink-0 border-border hidden md:flex border-t opacity-100"
                  style={{ height: isTerminalCollapsed ? 40 : terminalHeight }}
                >
                  <Terminal />
                </div>
              )}
            </div>

            {/* Mobile Place Order Panel Removed (Integrated into Bottom Nav) */}


            {/* Mobile Watchlist Tab */}
            {activeMobileTab === 'watchlist' && (
              <div className="flex-1 flex flex-col bg-background md:hidden h-full min-h-0">
                <div className="flex items-center justify-between p-3 border-b border-border bg-secondary/20">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/80">
                    {isMobileWatchlistAddMode ? 'Add Symbols' : 'My Watchlist'}
                  </h2>
                  <button
                    onClick={() => setIsMobileWatchlistAddMode(!isMobileWatchlistAddMode)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                      isMobileWatchlistAddMode
                        ? "bg-secondary text-muted-foreground hover:text-foreground"
                        : "bg-primary text-primary-foreground shadow-lg shadow-primary/20 active:scale-95"
                    )}
                  >
                    {isMobileWatchlistAddMode ? (
                      <>
                        <X size={14} />
                        <span>Close</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} />
                        <span>Add</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="flex-1 min-h-0 bg-background flex flex-col">
                  <React.Suspense fallback={<PanelFallback />}>
                    <MarketList mode={isMobileWatchlistAddMode ? 'discovery' : 'watchlist'} />
                  </React.Suspense>
                </div>
              </div>
            )}

            {/* Mobile Terminal Panel - CONDITIONAL RENDER to prevent re-renders when hidden */}
            {activeMobileTab === 'positions' && (
              <div className={cn(
                "absolute left-0 right-0 bg-background border-t border-border flex flex-col md:hidden shadow-[0_-15px_40px_rgba(0,0,0,0.2)] z-[60] transition-all duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] transform-gpu will-change-transform translate-y-0 opacity-100",
                "bottom-[calc(48px+env(safe-area-inset-bottom))]",
                isInputFocused ? "h-[80%]" : "h-[29%]"
              )}>
                <div
                  className="h-6 flex items-center justify-center cursor-row-resize active:bg-secondary/20 touch-none shrink-0"
                  onClick={handleClosePanel}
                  onTouchStart={(e) => {
                    const touch = e.touches[0];
                    (window as any)._panelTouchStartY = touch.clientY;
                  }}
                  onTouchEnd={(e) => {
                    const startY = (window as any)._panelTouchStartY;
                    if (startY === undefined) return;
                    const endY = e.changedTouches[0].clientY;
                    if (endY - startY > 30) { // Swipe down
                      handleClosePanel();
                    }
                    delete (window as any)._panelTouchStartY;
                  }}
                >
                  <div className="w-12 h-1 bg-border rounded-full" />
                </div>
                <div
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto flex flex-col custom-scrollbar"
                >
                  <Terminal forceExpanded={true} />
                </div>
              </div>
            )}

            {/* Mobile Strategy Panel - NEW */}
            {activeMobileTab === 'strategy' && (
              <div className="md:hidden flex-1 flex flex-col min-h-0 bg-background overflow-hidden">
                <div className="flex items-center justify-between p-3 border-b border-border bg-secondary/10">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/80">Strategy Manager</h2>
                  <button
                    onClick={handleClosePanel}
                    className="p-1.5 text-muted-foreground hover:text-foreground bg-secondary/40 rounded-md transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <React.Suspense fallback={<PanelFallback />}>
                    <StrategyPanel />
                  </React.Suspense>
                </div>
              </div>
            )}

            {activeMobileTab === 'menu' && (
              <div className="flex-1 bg-background md:hidden overflow-y-auto min-h-0">
                <MobileMenu />
              </div>
            )}

            {/* Mobile Indicators Panel */}
            {activeMobileTab === 'indicators' && (
              <div className="md:hidden absolute inset-0 z-[60] bg-background flex flex-col">
                <div className="flex items-center justify-between p-3 border-b border-border bg-secondary/10">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/80">Active Indicators</h2>
                  <button
                    onClick={() => setActiveMobileTab('chart')}
                    className="p-1.5 text-muted-foreground hover:text-foreground bg-secondary/40 rounded-md transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <React.Suspense fallback={<PanelFallback />}>
                    <LayerManager />
                  </React.Suspense>
                </div>
              </div>
            )}
          </main>

          {/* RIGHT SIDEBAR: 3 Tabs (Market, Indicators, Trade) */}
          <div
            className={cn(
              "transition-all duration-300 ease-in-out overflow-hidden flex-col shrink-0 hidden md:flex",
              isRightSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            style={{ width: isRightSidebarOpen ? `${rightSidebarWidth}px` : '0px' }}
          >
            {isRightSidebarOpen ? <RightSidebar /> : null}
          </div>
        </div>
      </div>

      <MobileBottomNav
        activeTab={activeMobileTab}
        onTabChange={handleMobileTabChange}
        isHidden={isScrollingPanel}
      />
    </div>
  );
}
