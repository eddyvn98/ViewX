'use client';

import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { useWebSocket } from "@/hooks/use-websocket";
import { useMarketStore } from "@/lib/store";
import { MarketList } from "@/features/market/MarketList";
import { Terminal } from "@/features/terminal/Terminal";
import { NotificationManager } from "@/features/notifications/NotificationManager";
import { TabContainer } from "@/components/layout/TabContainer";
import { ChartsToolbar } from "@/features/chart/components/ChartsToolbar";
import { ChartGrid } from "@/features/chart/components/ChartGrid";
import { OrderForm } from "@/features/terminal/components/OrderForm";
import { RightSidebar } from "@/features/chart/components/RightSidebar";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  useWebSocket();
  const isTerminalVisible = useMarketStore((state) => state.isTerminalVisible);
  const isTerminalCollapsed = useMarketStore((state) => state.isTerminalCollapsed);
  const terminalHeight = useMarketStore((state) => state.terminalHeight);
  const isLeftSidebarOpen = useMarketStore((state) => state.isLeftSidebarOpen);
  const isRightSidebarOpen = useMarketStore((state) => state.isRightSidebarOpen);
  const toggleLeftSidebar = useMarketStore((state) => state.toggleLeftSidebar);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans select-none">
      <NotificationManager />
      <Header />
      <div className="flex flex-1 pt-0 h-[calc(100vh-48px)] overflow-hidden">
        {/* LEFT BAR: Icons */}
        <Sidebar onToggleMarket={toggleLeftSidebar} />

        {/* BODY AREA */}
        <div className="flex-1 flex overflow-hidden ml-16 relative">
          {/* OPTIONAL LEFT PANEL: Market List */}
          <div
            className={cn(
              "border-r border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden transition-all duration-300 ease-in-out shrink-0",
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
          <main className="flex-1 flex flex-col p-1.5 overflow-hidden relative min-w-0 bg-black/20">
            <div className="flex-1 flex flex-col min-h-0 bg-zinc-900/40 rounded-lg border border-zinc-800/50 overflow-hidden shadow-2xl">
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-1 gap-1">
                <ChartsToolbar />
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  <ChartGrid />
                </div>
              </div>

              <div
                className={cn(
                  "transition-all duration-300 ease-in-out overflow-hidden flex flex-col shrink-0 border-zinc-800",
                  isTerminalVisible ? "border-t opacity-100" : "opacity-0 border-t-0"
                )}
                style={{ height: isTerminalVisible ? (isTerminalCollapsed ? 40 : terminalHeight) : 0 }}
              >
                <Terminal />
              </div>
            </div>
          </main>

          {/* RIGHT SIDEBAR: 3 Tabs (Market, Indicators, Trade) */}
          <div
            className={cn(
              "transition-all duration-300 ease-in-out overflow-hidden flex flex-col shrink-0",
              isRightSidebarOpen ? "w-80 opacity-100" : "w-0 opacity-0 pointer-events-none"
            )}
          >
            <RightSidebar />
          </div>
        </div>
      </div>
    </div>
  );
}

