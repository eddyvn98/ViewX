'use client';

import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { useWebSocket } from "@/hooks/use-websocket";
import { useUserSetupSync } from "@/hooks/use-user-setup-sync";
import { useMarketStore, RootState } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
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

  React.useEffect(() => {
    if (activeMobileTab === "watchlist") {
      setActiveMobileTab("chart");
    }
  }, [activeMobileTab, setActiveMobileTab]);

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

                <MobilePanels
                  showMobileLayout={showMobileLayout}
                  activeMobileTab={activeMobileTab}
                  isInputFocused={isInputFocused}
                  handleClosePanel={handleClosePanel}
                  handleScroll={handleScroll}
                  setActiveMobileTab={setActiveMobileTab}
                  panelTouchStartYRef={panelTouchStartYRef}
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
          </div>
        </div>
      </div>

      {showMobileLayout && (
        <MobileBottomNav
          activeTab={activeMobileTab}
          onTabChange={handleMobileTabChange}
          isHidden={isScrollingPanel}
        />
      )}
    </div>
  );
}
