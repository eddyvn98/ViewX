'use client';

import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { useWebSocket } from "@/hooks/use-websocket";
import { useUserSetupSync } from "@/hooks/use-user-setup-sync";
import { useMarketStore, RootState } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
<<<<<<< HEAD
=======
import { X, Plus, SlidersHorizontal } from "lucide-react";
>>>>>>> f8b69ef6165f3770b79b16ef423037c2f5e7a664
import { cn } from "@/lib/utils";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import React from "react";
import dynamic from "next/dynamic";
import {
  DESKTOP_SCALE_BASE_HEIGHT,
  DESKTOP_SCALE_BASE_WIDTH,
  getChartHomeLayoutState,
} from "./home-client-helpers";
import {
  ChartCenterPane,
  DesktopLeftPanel,
  DesktopRightPanel,
  MobilePanels,
} from "./home-client-panels";
import {
  useChartDocumentTitle,
  useKeyboardDismissOnViewportReset,
  usePanelScrollState,
  useRightSidebarWidth,
  useViewportState,
} from "./use-home-client-ui";

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

export default function Home() {
  useWebSocket();
  useUserSetupSync();

  const strategyEnabled = process.env.NEXT_PUBLIC_STRATEGY_ENGINE_ENABLED !== "false";
  const {
    isTerminalVisible,
    isTerminalCollapsed,
    terminalHeight,
    isLeftSidebarOpen,
    isRightSidebarOpen,
    rightSidebarWidth,
    activeMobileTab,
    isInputFocused,
    isScrollingPanel,
  } = useMarketStore(
    useShallow((state: RootState) => ({
      isTerminalVisible: state.isTerminalVisible,
      isTerminalCollapsed: state.isTerminalCollapsed,
      terminalHeight: state.terminalHeight,
      isLeftSidebarOpen: state.isLeftSidebarOpen,
      isRightSidebarOpen: state.isRightSidebarOpen,
      rightSidebarWidth: state.rightSidebarWidth,
      activeMobileTab: state.activeMobileTab,
      isInputFocused: state.isInputFocused,
      isScrollingPanel: state.isScrollingPanel,
    }))
  );

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
<<<<<<< HEAD
  const panelTouchStartYRef = React.useRef<number | null>(null);
  const viewport = useViewportState();
  useKeyboardDismissOnViewportReset(isInputFocused, setInputFocused);
  const handleScroll = usePanelScrollState(setIsScrollingPanel);
  useRightSidebarWidth(setRightSidebarWidth);
  useChartDocumentTitle({
    symbol: activeChart?.symbol,
    interval: activeChart?.interval,
    price: activeTicker?.price,
    changePercent: activeTicker?.change,
    digits: activeDigits,
  });
=======
  const [isMobileLayout, setIsMobileLayout] = React.useState(false);
  const [isCompactMobile, setIsCompactMobile] = React.useState(false);
  const [isMiniMobile, setIsMiniMobile] = React.useState(false);
  const [showMiniControls, setShowMiniControls] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const evaluateViewport = () => {
      const vv = window.visualViewport;
      const width = vv?.width ?? window.innerWidth;
      const height = vv?.height ?? window.innerHeight;
      const isCoarsePointer = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
      const isLandscape = window.matchMedia("(orientation: landscape)").matches || width > height;
      const mobileByWidth = width < 768;
      const nextMobileLayout = isCoarsePointer ? !isLandscape : mobileByWidth;
      const compactByHeight = nextMobileLayout && height <= 460;
      const miniByHeight = nextMobileLayout && height <= 300;
      setIsMobileLayout(nextMobileLayout);
      setIsCompactMobile(compactByHeight);
      setIsMiniMobile(miniByHeight);
    };

    evaluateViewport();
    window.addEventListener("resize", evaluateViewport);
    window.visualViewport?.addEventListener("resize", evaluateViewport);
    return () => {
      window.removeEventListener("resize", evaluateViewport);
      window.visualViewport?.removeEventListener("resize", evaluateViewport);
    };
  }, []);

  const enableMiniMode = isMiniMobile;

  React.useEffect(() => {
    if (!enableMiniMode) {
      setShowMiniControls(true);
    } else {
      setShowMiniControls(false);
    }
  }, [enableMiniMode]);

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
>>>>>>> f8b69ef6165f3770b79b16ef423037c2f5e7a664

  const handleMobileTabChange = (tab: string) => {
    if (activeMobileTab === tab && (tab === "trade" || tab === "positions")) {
      setActiveMobileTab("chart");
      setInputFocused(false);
    } else {
      setActiveMobileTab(tab);
    }
  };

  const handleClosePanel = () => {
    setActiveMobileTab("chart");
    setInputFocused(false);
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const {
    isScaledDesktopMode,
    showDesktopLayout,
    showMobileLayout,
    showDesktopHeader,
    showDesktopSidebarRail,
    desktopScale,
    scaledDesktopOffsetX,
    scaledDesktopOffsetY,
  } = getChartHomeLayoutState(viewport);

  const showDesktopLeftPanel = showDesktopLayout && !isScaledDesktopMode && isLeftSidebarOpen;
  const showDesktopRightPanel = showDesktopLayout && !isScaledDesktopMode && isRightSidebarOpen;
  const showDesktopTerminal = showDesktopLayout && !isScaledDesktopMode && isTerminalVisible;
  const scaledDesktopFrameStyle = isScaledDesktopMode
    ? {
        width: `${DESKTOP_SCALE_BASE_WIDTH}px`,
        height: `${DESKTOP_SCALE_BASE_HEIGHT}px`,
        transform: `translate(${scaledDesktopOffsetX}px, ${scaledDesktopOffsetY}px) scale(${desktopScale})`,
      }
    : undefined;

  return (
<<<<<<< HEAD
    <div
      className={cn(
        "app-root bg-background text-foreground font-sans select-none relative transition-colors duration-300",
        isScaledDesktopMode && "chart-scaled-desktop-shell"
      )}
    >
      {strategyEnabled && <StrategyRunnerBootstrap />}
      <NotificationManager />
      <div className={cn("flex flex-1 min-h-0 overflow-hidden", isScaledDesktopMode && "chart-scaled-desktop-viewport")}>
        <div
          className={cn(
            "min-h-0 overflow-hidden flex-col",
            isScaledDesktopMode ? "chart-scaled-desktop-frame" : "flex flex-1"
          )}
          style={scaledDesktopFrameStyle}
        >
          {showDesktopHeader && <Header />}
          {showMobileLayout && <MobileTopBar />}

          <div className="flex flex-1 pt-0 overflow-hidden min-h-0">
            <div className={cn("h-full", showDesktopSidebarRail ? "flex" : "hidden")}>
              <Sidebar />
=======
    <div className="safe-viewport bg-background">
      <div className="h-full w-full overflow-hidden flex items-stretch">
    <div
      className="app-root w-full bg-background text-foreground font-sans select-none relative transition-colors duration-300"
    >
      {strategyEnabled && <StrategyRunnerBootstrap />}
      <NotificationManager />
      {!isMobileLayout && (
        <Header />
      )}

      {/* Mobile Top Bar */}
      <MobileTopBar
        className={cn(isMobileLayout && (!enableMiniMode || showMiniControls) ? "flex" : "hidden")}
        compact={isCompactMobile}
        mini={enableMiniMode}
      />

      {/* 
          Mobile Height: 100dvh - 64px (Bottom Nav)
          Desktop Height: 100vh - 48px (Header) 
      */}
      <div className="flex flex-1 pt-0 overflow-hidden min-h-0">
        {/* LEFT BAR: Icons */}
        <div className={cn("h-full", isMobileLayout ? "hidden" : "flex")}>
          <Sidebar />
        </div>

        {/* BODY AREA */}
        <div className="flex-1 flex overflow-hidden ml-0 relative min-h-0">
          {/* OPTIONAL LEFT PANEL: Market List */}
          <div
            className={cn(
              "border-r border-border bg-background flex-col overflow-hidden transition-all duration-300 ease-in-out shrink-0",
              isMobileLayout ? "hidden" : "flex",
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
            "flex-1 flex flex-col overflow-hidden relative min-w-0 bg-secondary/10 pb-0",
            isMobileLayout ? "p-0" : "p-1.5"
          )}>
            {/* Show Chart ONLY if active tab is 'chart' on Mobile, OR always on Desktop */}
            <div className={cn(
              "flex-1 flex flex-col min-h-0 bg-card border-border/50 overflow-hidden shadow-2xl",
              isMobileLayout ? "rounded-none border-0" : "rounded-lg border",
              (activeMobileTab === 'chart' || activeMobileTab === 'trade' || activeMobileTab === 'positions' || activeMobileTab === 'strategy' || activeMobileTab === 'indicators') ? 'flex' : (isMobileLayout ? 'hidden' : 'flex')
            )}>
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-0">
                {!isMobileLayout && (
                  <React.Suspense fallback={<PanelFallback className="h-11" />}>
                    <ChartsToolbarMemo />
                  </React.Suspense>
                )}
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  <React.Suspense fallback={<PanelFallback />}>
                    <ChartGrid />
                  </React.Suspense>
                </div>
              </div>

              {/* Desktop Terminal - CONDITIONAL RENDER to prevent re-renders when hidden */}
              {isTerminalVisible && (
                <div
                  className={cn(
                    "transition-all duration-300 ease-in-out overflow-hidden flex-col shrink-0 border-border border-t opacity-100",
                    isMobileLayout ? "hidden" : "flex"
                  )}
                  style={{ height: isTerminalCollapsed ? 40 : terminalHeight }}
                >
                  <Terminal />
                </div>
              )}
>>>>>>> f8b69ef6165f3770b79b16ef423037c2f5e7a664
            </div>

            <div className="flex-1 flex overflow-hidden ml-0 relative min-h-0">
              <DesktopLeftPanel
                showDesktopLayout={showDesktopLayout}
                showDesktopLeftPanel={showDesktopLeftPanel}
                toggleLeftSidebar={toggleLeftSidebar}
                MarketList={MarketList}
              />

              <main
                className={cn(
                  "flex-1 flex flex-col overflow-hidden relative min-w-0 bg-secondary/10",
                  showDesktopLayout ? "p-1.5 pb-0" : "p-0 pb-0"
                )}
              >
                <ChartCenterPane
                  showDesktopLayout={showDesktopLayout}
                  activeMobileTab={activeMobileTab}
                  showDesktopTerminal={showDesktopTerminal}
                  isTerminalCollapsed={isTerminalCollapsed}
                  terminalHeight={terminalHeight}
                  ChartsToolbarMemo={ChartsToolbarMemo}
                  ChartGrid={ChartGrid}
                  Terminal={Terminal}
                />

<<<<<<< HEAD
                <MobilePanels
                  showMobileLayout={showMobileLayout}
                  activeMobileTab={activeMobileTab}
                  isMobileWatchlistAddMode={isMobileWatchlistAddMode}
                  setIsMobileWatchlistAddMode={setIsMobileWatchlistAddMode}
                  isInputFocused={isInputFocused}
                  handleClosePanel={handleClosePanel}
                  handleScroll={handleScroll}
                  setActiveMobileTab={setActiveMobileTab}
                  panelTouchStartYRef={panelTouchStartYRef}
                  MarketList={MarketList}
                  Terminal={Terminal}
                  StrategyPanel={StrategyPanel}
                  MobileMenu={MobileMenu}
                  LayerManager={LayerManager}
                />
              </main>

              <DesktopRightPanel
                showDesktopLayout={showDesktopLayout}
                showDesktopRightPanel={showDesktopRightPanel}
                rightSidebarWidth={rightSidebarWidth}
                RightSidebar={RightSidebar}
              />
            </div>
=======
            {/* Mobile Watchlist Tab */}
            {activeMobileTab === 'watchlist' && (
              <div className={cn("flex-1 flex flex-col bg-background h-full min-h-0", isMobileLayout ? "flex" : "hidden")}>
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
                "absolute left-0 right-0 bg-background border-t border-border flex flex-col shadow-[0_-15px_40px_rgba(0,0,0,0.2)] z-[60] transition-all duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] transform-gpu will-change-transform translate-y-0 opacity-100",
                isMobileLayout ? "flex" : "hidden",
                isInputFocused ? "h-[80%]" : (isCompactMobile ? "h-[45%]" : "h-[29%]")
              )}
                style={{
                  bottom:
                    enableMiniMode && !showMiniControls
                      ? "0px"
                      : `calc(${isCompactMobile ? 52 : 62}px + env(safe-area-inset-bottom))`
                }}
              >
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
              <div className={cn("flex-1 flex flex-col min-h-0 bg-background overflow-hidden", isMobileLayout ? "flex" : "hidden")}>
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
              <div className={cn("flex-1 bg-background overflow-y-auto min-h-0", isMobileLayout ? "block" : "hidden")}>
                <MobileMenu />
              </div>
            )}

            {/* Mobile Indicators Panel */}
            {activeMobileTab === 'indicators' && (
              <div className={cn("absolute inset-0 z-[60] bg-background flex flex-col", isMobileLayout ? "flex" : "hidden")}>
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
              "transition-all duration-300 ease-in-out overflow-hidden flex-col shrink-0",
              isMobileLayout ? "hidden" : "flex",
              isRightSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            style={{ width: isRightSidebarOpen ? `${rightSidebarWidth}px` : '0px' }}
          >
            {isRightSidebarOpen ? <RightSidebar /> : null}
>>>>>>> f8b69ef6165f3770b79b16ef423037c2f5e7a664
          </div>
        </div>
      </div>

<<<<<<< HEAD
      {showMobileLayout && (
        <MobileBottomNav
          activeTab={activeMobileTab}
          onTabChange={handleMobileTabChange}
          isHidden={isScrollingPanel}
        />
      )}
=======
      <MobileBottomNav
        activeTab={activeMobileTab}
        onTabChange={handleMobileTabChange}
        isHidden={isScrollingPanel}
        compact={isCompactMobile}
        mini={enableMiniMode}
        className={cn(isMobileLayout && (!enableMiniMode || showMiniControls) ? "flex" : "hidden")}
      />

      {isMobileLayout && enableMiniMode && activeMobileTab === "chart" && (
        <button
          onClick={() => setShowMiniControls((prev) => !prev)}
          className="absolute right-2 bottom-[max(8px,env(safe-area-inset-bottom))] z-[130] h-8 w-8 rounded-full border border-border/60 bg-background/85 backdrop-blur-md text-foreground shadow-lg flex items-center justify-center"
          aria-label={showMiniControls ? "Hide controls" : "Show controls"}
          title={showMiniControls ? "Hide controls" : "Show controls"}
        >
          <SlidersHorizontal size={14} />
        </button>
      )}
    </div>
    </div>
>>>>>>> f8b69ef6165f3770b79b16ef423037c2f5e7a664
    </div>
  );
}
