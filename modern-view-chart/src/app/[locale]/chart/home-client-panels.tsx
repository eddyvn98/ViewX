'use client';

import { X } from "lucide-react";
import React from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const AIChatView = dynamic(
  () => import("@/features/strategy/components/AIChatView").then((m) => m.AIChatView),
  { ssr: false }
);

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
  void showDesktopLayout;
  void showDesktopLeftPanel;
  void toggleLeftSidebar;
  void MarketList;
  return null;
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
  isMobileLandscape,
  activeMobileTab,
  isInputFocused,
  handleClosePanel,
  handleScroll,
  setActiveMobileTab,
  panelTouchStartYRef,
  Terminal,
  StrategyPanel,
  MobileMenu,
  LayerManager,
}: {
  showMobileLayout: boolean;
  isMobileLandscape: boolean;
  activeMobileTab: string;
  isInputFocused: boolean;
  handleClosePanel: () => void;
  handleScroll: () => void;
  setActiveMobileTab: (tab: string) => void;
  panelTouchStartYRef: React.RefObject<number | null>;
  Terminal: React.ComponentType<{ forceExpanded?: boolean }>;
  StrategyPanel: React.ComponentType<{ hideAiTab?: boolean }>;
  MobileMenu: React.ComponentType<{ compact?: boolean }>;
  LayerManager: React.ComponentType;
}) {
  return (
    <>
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
              <StrategyPanel hideAiTab />
            </React.Suspense>
          </div>
        </div>
      )}

      {showMobileLayout && activeMobileTab === "ai_overlay" && (
        <div className="absolute inset-0 z-[70] bg-background flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-border bg-secondary/10">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/80">AI Assistant</h2>
            <button onClick={handleClosePanel} className="p-1.5 text-muted-foreground hover:text-foreground bg-secondary/40 rounded-md transition-all">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden p-2">
            <AIChatView />
          </div>
        </div>
      )}

      {showMobileLayout && activeMobileTab === "menu" && (
        <div
          className={cn(
            "bg-background overflow-y-auto min-h-0",
            isMobileLandscape
              ? "absolute left-0 top-0 bottom-0 z-[65] border-r border-border/70 bg-background/95 backdrop-blur-sm shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
              : "flex-1"
          )}
          style={isMobileLandscape ? { width: "min(320px, calc(100% - 3rem))" } : undefined}
        >
          <MobileMenu compact={isMobileLandscape} />
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
