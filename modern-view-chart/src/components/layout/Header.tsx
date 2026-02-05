import { Bell, Search, Settings, PanelRightClose } from 'lucide-react';
import { useMarketStore } from '@/lib/store';
import { TabContainer } from './TabContainer';
import { cn } from '@/lib/utils';

export function Header() {
    const isRightSidebarOpen = useMarketStore((state) => state.isRightSidebarOpen);
    const toggleRightSidebar = useMarketStore((state) => state.toggleRightSidebar);

    return (
        <header className="flex h-12 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 shrink-0 shadow-lg z-30">
            <div className="flex items-center gap-6 h-full">
                {/* Logo */}
                <div className="flex items-center gap-2 font-black text-sm text-white tracking-tighter mr-2">
                    ViewChart
                </div>

                <div className="h-6 w-[1px] bg-zinc-800 hidden md:block" />

                {/* Integrated Tabs */}
                <div className="h-full hidden md:block">
                    <TabContainer />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 mr-2 pr-4 border-r border-zinc-800">
                    <button
                        onClick={toggleRightSidebar}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-all border",
                            isRightSidebarOpen
                                ? "bg-blue-600/10 text-blue-400 border-blue-500/20"
                                : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:bg-zinc-800"
                        )}
                    >
                        <PanelRightClose size={16} className={cn("transition-transform", !isRightSidebarOpen && "rotate-180")} />
                        <span className="hidden sm:inline">PANEL</span>
                    </button>
                    <div className="w-[1px] h-4 bg-zinc-800 mx-1" />
                    <button className="text-zinc-500 hover:text-white transition active:scale-90">
                        <Search size={18} />
                    </button>
                    <button className="text-zinc-500 hover:text-white transition active:scale-90">
                        <Bell size={18} />
                    </button>
                    <button className="text-zinc-500 hover:text-white transition active:scale-90">
                        <Settings size={18} />
                    </button>
                </div>

                <div className="flex items-center gap-2 px-1.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 cursor-pointer hover:bg-zinc-800 transition-all">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-[10px] font-black text-white">
                        UA
                    </div>
                </div>
            </div>
        </header>
    );
}
