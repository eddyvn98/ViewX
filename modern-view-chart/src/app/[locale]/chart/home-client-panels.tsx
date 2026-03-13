'use client';

import { Plus, X } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";

function PanelFallback({ className = "" }: { className?: string }) {
  return <div className={cn("h-full w-full animate-pulse bg-secondary/20", className)} />;
}

export function DesktopLeftPanel({
  showDesktopLayout,
  showDesktopLeftPanel,
  toggleLeftSidebar,
  MarketList,
}: {
  showDesktopLayout: boolean;
  showDesktopLeftPanel: boolean;
  toggleLeftSidebar: () => void;
  MarketList: React.ComponentType<{ mode?: "discovery" | "watchlist" }>;
}) {
  return (
    <div
      className={cn(
        "border-r border-border bg-background flex-col overflow-hidden transition-all duration-300 ease-in-out shrink-0",
        showDesktopLayout ? "flex" : "hidden",
        showDesktopLeftPanel ? "w-72 opacity-100" : "w-0 opacity-0 pointer-events-none"
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
          {showDesktopLeftPanel ? <MarketList mode="discovery" /> : null}
        </div>
      </div>
    </div>
  );
}

export function ChartCenterPane({
  showDesktopLayout,
  activeMobileTab,
  showDesktopTerminal,
  isTerminalCollapsed,
  terminalHeight,
  ChartsToolbarMemo,
  ChartGrid,
  Terminal,
}: {
  showDesktopLayout: boolean;
  activeMobileTab: string;
  showDesktopTerminal: boolean;
  isTerminalCollapsed: boolean;
  terminalHeight: number;
  ChartsToolbarMemo: React.ComponentType;
  ChartGrid: React.ComponentType;
  Terminal: React.ComponentType<{ forceExpanded?: boolean }>;
}) {
  return (
    <div
      className={cn(
        "flex-1 flex flex-col min-h-0 bg-card border-border/50 overflow-hidden shadow-2xl",
        showDesktopLayout ? "rounded-lg border" : "rounded-none border-0",
        showDesktopLayout || activeMobileTab === "chart" || activeMobileTab === "trade" || activeMobileTab === "positions" || activeMobileTab === "strategy" || activeMobileTab === "indicators"
          ? "flex"
          : "hidden"
      )}
    >
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-0">
        <div className={cn(showDesktopLayout ? "block" : "hidden")}>
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

      {showDesktopTerminal && (
        <div
          className={cn(
            "transition-all duration-300 ease-in-out overflow-hidden flex-col shrink-0 border-border border-t opacity-100",
            showDesktopLayout ? "flex" : "hidden"
          )}
          style={{ height: isTerminalCollapsed ? 40 : terminalHeight }}
        >
          <Terminal />
        </div>
      )}
    </div>
  );
}

export function MobilePanels({
  showMobileLayout,
  activeMobileTab,
  isMobileWatchlistAddMode,
  setIsMobileWatchlistAddMode,
  isInputFocused,
  handleClosePanel,
  handleScroll,
  setActiveMobileTab,
  panelTouchStartYRef,
  MarketList,
  Terminal,
  StrategyPanel,
  MobileMenu,
  LayerManager,
}: {
  showMobileLayout: boolean;
  activeMobileTab: string;
  isMobileWatchlistAddMode: boolean;
  setIsMobileWatchlistAddMode: React.Dispatch<React.SetStateAction<boolean>>;
  isInputFocused: boolean;
  handleClosePanel: () => void;
  handleScroll: () => void;
  setActiveMobileTab: (tab: string) => void;
  panelTouchStartYRef: React.RefObject<number | null>;
  MarketList: React.ComponentType<{ mode?: "discovery" | "watchlist" }>;
  Terminal: React.ComponentType<{ forceExpanded?: boolean }>;
  StrategyPanel: React.ComponentType;
  MobileMenu: React.ComponentType;
  LayerManager: React.ComponentType;
}) {
  return (
    <>
      {showMobileLayout && activeMobileTab === "watchlist" && (
        <div className="flex-1 flex flex-col bg-background h-full min-h-0">
          <div className="flex items-center justify-between p-3 border-b border-border bg-secondary/20">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/80">
              {isMobileWatchlistAddMode ? "Add Symbols" : "My Watchlist"}
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
              <MarketList mode={isMobileWatchlistAddMode ? "discovery" : "watchlist"} />
            </React.Suspense>
          </div>
        </div>
      )}

      {showMobileLayout && activeMobileTab === "positions" && (
        <div
          className={cn(
            "absolute left-0 right-0 bg-background border-t border-border flex flex-col shadow-[0_-15px_40px_rgba(0,0,0,0.2)] z-[60] transition-all duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] transform-gpu will-change-transform translate-y-0 opacity-100",
            "bottom-[calc(48px+env(safe-area-inset-bottom))]",
            isInputFocused ? "h-[80%]" : "h-[29%]"
          )}
        >
          <div
            className="h-6 flex items-center justify-center cursor-row-resize active:bg-secondary/20 touch-none shrink-0"
            onClick={handleClosePanel}
            onTouchStart={(e) => {
              panelTouchStartYRef.current = e.touches[0].clientY;
            }}
            onTouchEnd={(e) => {
              const startY = panelTouchStartYRef.current;
              if (startY == null) return;
              if (e.changedTouches[0].clientY - startY > 30) handleClosePanel();
              panelTouchStartYRef.current = null;
            }}
          >
            <div className="w-12 h-1 bg-border rounded-full" />
          </div>
          <div onScroll={handleScroll} className="flex-1 overflow-y-auto flex flex-col custom-scrollbar">
            <Terminal forceExpanded={true} />
          </div>
        </div>
      )}

      {showMobileLayout && activeMobileTab === "strategy" && (
        <div className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-border bg-secondary/10">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/80">Strategy Manager</h2>
            <button onClick={handleClosePanel} className="p-1.5 text-muted-foreground hover:text-foreground bg-secondary/40 rounded-md transition-all">
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

      {showMobileLayout && activeMobileTab === "menu" && (
        <div className="flex-1 bg-background overflow-y-auto min-h-0">
          <MobileMenu />
        </div>
      )}

      {showMobileLayout && activeMobileTab === "indicators" && (
        <div className="absolute inset-0 z-[60] bg-background flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-border bg-secondary/10">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/80">Active Indicators</h2>
            <button onClick={() => setActiveMobileTab("chart")} className="p-1.5 text-muted-foreground hover:text-foreground bg-secondary/40 rounded-md transition-all">
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
    </>
  );
}

export function DesktopRightPanel({
  showDesktopLayout,
  showDesktopRightPanel,
  rightSidebarWidth,
  RightSidebar,
}: {
  showDesktopLayout: boolean;
  showDesktopRightPanel: boolean;
  rightSidebarWidth: number;
  RightSidebar: React.ComponentType;
}) {
  return (
    <div
      className={cn(
        "transition-all duration-300 ease-in-out overflow-hidden flex-col shrink-0",
        showDesktopLayout ? "flex" : "hidden",
        showDesktopRightPanel ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      style={{ width: showDesktopRightPanel ? `${rightSidebarWidth}px` : "0px" }}
    >
      {showDesktopRightPanel ? <RightSidebar /> : null}
    </div>
  );
}
