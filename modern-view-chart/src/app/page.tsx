'use client';

import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { useWebSocket } from "@/hooks/use-websocket";
import { useMarketStore, RootState } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { MarketList } from "@/features/market/MarketList";
import { Terminal } from "@/features/terminal/Terminal";
import { NotificationManager } from "@/features/notifications/NotificationManager";
import { TabContainer } from "@/components/layout/TabContainer";
import { ChartsToolbarMemo } from "@/features/chart/components/ChartsToolbar";
import { ChartGrid } from "@/features/chart/components/ChartGrid";
import { OrderForm } from "@/features/terminal/components/OrderForm";
import { RightSidebar } from "@/features/chart/components/RightSidebar";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { MobileMenu } from "@/components/layout/MobileMenu";
import React from "react";

export default function Home() {
  useWebSocket();
  const {
    isTerminalVisible,
    isTerminalCollapsed,
    terminalHeight,
    isLeftSidebarOpen,
    isRightSidebarOpen,
    activeMobileTab,
    isInputFocused,
    isScrollingPanel
  } = useMarketStore(useShallow((state: RootState) => ({
    isTerminalVisible: state.isTerminalVisible,
    isTerminalCollapsed: state.isTerminalCollapsed,
    terminalHeight: state.terminalHeight,
    isLeftSidebarOpen: state.isLeftSidebarOpen,
    isRightSidebarOpen: state.isRightSidebarOpen,
    activeMobileTab: state.activeMobileTab,
    isInputFocused: state.isInputFocused,
    isScrollingPanel: state.isScrollingPanel
  })));

  const toggleLeftSidebar = useMarketStore((state) => state.toggleLeftSidebar);
  const setActiveMobileTab = useMarketStore((state) => state.setActiveMobileTab);
  const setInputFocused = useMarketStore((state) => state.setInputFocused);
  const setIsScrollingPanel = useMarketStore((state) => state.setIsScrollingPanel);
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

  return (
    <div className="fixed inset-0 bg-zinc-950 text-white flex flex-col font-sans select-none">
      <NotificationManager />
      <div className="hidden md:block">
        <Header />
      </div>

      {/* 
          Mobile Height: 100dvh - 64px (Bottom Nav)
          Desktop Height: 100vh - 48px (Header) 
      */}
      <div className="flex flex-1 pt-0 overflow-hidden">
        {/* LEFT BAR: Icons */}
        <div className="hidden md:flex h-full">
          <Sidebar onToggleMarket={toggleLeftSidebar} />
        </div>

        {/* BODY AREA */}
        <div className="flex-1 flex overflow-hidden ml-0 md:ml-16 relative">
          {/* OPTIONAL LEFT PANEL: Market List */}
          <div
            className={cn(
              "border-r border-zinc-800 bg-zinc-950 flex-col overflow-hidden transition-all duration-300 ease-in-out shrink-0 hidden md:flex",
              isLeftSidebarOpen ? "w-72 opacity-100" : "w-0 opacity-0 pointer-events-none"
            )}
          >
            <div className="w-72 h-full flex flex-col">
              <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/40 shrink-0">
                <span className="text-[11px] font-black uppercase text-zinc-500 tracking-widest">Market Selection</span>
                <button onClick={toggleLeftSidebar} className="text-zinc-600 hover:text-white p-1 transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <MarketList mode="discovery" />
              </div>
            </div>
          </div>

          {/* MAIN CENTER: Charts & Terminal */}
          <main className={cn(
            "flex-1 flex flex-col p-0 md:p-1.5 overflow-hidden relative min-w-0 bg-black/20"
          )}>
            {/* Show Chart ONLY if active tab is 'chart' on Mobile, OR always on Desktop */}
            <div className={cn(
              "flex-1 flex flex-col min-h-0 bg-zinc-900/40 rounded-none md:rounded-lg border-0 md:border border-zinc-800/50 overflow-hidden shadow-2xl",
              (activeMobileTab === 'chart' || activeMobileTab === 'trade' || activeMobileTab === 'positions') ? 'flex' : 'hidden md:flex'
            )}>
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-0 md:p-1 gap-1">
                <div className="hidden md:block">
                  <ChartsToolbarMemo />
                </div>
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  <ChartGrid />
                </div>
              </div>

              {/* Desktop Terminal - CONDITIONAL RENDER to prevent re-renders when hidden */}
              {isTerminalVisible && (
                <div
                  className="transition-all duration-300 ease-in-out overflow-hidden flex-col shrink-0 border-zinc-800 hidden md:flex border-t opacity-100"
                  style={{ height: isTerminalCollapsed ? 40 : terminalHeight }}
                >
                  <Terminal />
                </div>
              )}
            </div>

            {/* Mobile Place Order Panel Removed (Integrated into Bottom Nav) */}


            {/* Mobile Watchlist Tab */}
            {activeMobileTab === 'watchlist' && (
              <div className="flex-1 flex flex-col bg-zinc-950 md:hidden h-full">
                <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900/50">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
                    {isMobileWatchlistAddMode ? 'Add Symbols' : 'My Watchlist'}
                  </h2>
                  <button
                    onClick={() => setIsMobileWatchlistAddMode(!isMobileWatchlistAddMode)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                      isMobileWatchlistAddMode
                        ? "bg-zinc-800 text-zinc-400 hover:text-white"
                        : "bg-blue-600 text-white shadow-lg shadow-blue-500/20 active:scale-95"
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
                <div className="flex-1 min-h-0 bg-zinc-950 flex flex-col">
                  <MarketList mode={isMobileWatchlistAddMode ? 'discovery' : 'watchlist'} />
                </div>
              </div>
            )}

            {/* Mobile Terminal Panel - CONDITIONAL RENDER to prevent re-renders when hidden */}
            {activeMobileTab === 'positions' && (
              <div className={cn(
                "fixed left-0 right-0 bg-[#0b0e14] border-t border-zinc-800 flex flex-col md:hidden shadow-[0_-15px_40px_rgba(0,0,0,0.6)] z-[60] transition-all duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] transform-gpu will-change-transform translate-y-0 opacity-100",
                "bottom-0",
                isInputFocused ? "h-[80%]" : "h-[29%]"
              )}>
                <div
                  className="h-6 flex items-center justify-center cursor-row-resize active:bg-zinc-900 touch-none shrink-0"
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
                  <div className="w-12 h-1 bg-zinc-800 rounded-full" />
                </div>
                <div
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto flex flex-col custom-scrollbar"
                >
                  <Terminal forceExpanded={true} />
                </div>
              </div>
            )}


            {activeMobileTab === 'menu' && (
              <div className="flex-1 bg-zinc-950 md:hidden overflow-y-auto">
                <MobileMenu />
              </div>
            )}
          </main>

          {/* RIGHT SIDEBAR: 3 Tabs (Market, Indicators, Trade) */}
          <div
            className={cn(
              "transition-all duration-300 ease-in-out overflow-hidden flex-col shrink-0 hidden md:flex",
              isRightSidebarOpen ? "w-80 opacity-100" : "w-0 opacity-0 pointer-events-none"
            )}
          >
            <RightSidebar />
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
