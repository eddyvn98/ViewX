import React, { memo } from 'react';
import { Bell, Search, Settings, PanelRightClose } from 'lucide-react';
import { useMarketStore } from '@/lib/store';
import { TabContainer } from './TabContainer';
import { cn } from '@/lib/utils';
import { MobileAccessButton } from '@/features/chart/components/MobileAccessButton';

export const Header = memo(function Header() {
    const isRightSidebarOpen = useMarketStore((state) => state.isRightSidebarOpen);
    const toggleRightSidebar = useMarketStore((state) => state.toggleRightSidebar);

    return (
        <header className="h-14 border-b border-zinc-800 bg-zinc-950 px-4 flex items-center justify-between shrink-0 sticky top-0 z-30">
            <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <span className="font-black text-white italic">V</span>
                    </div>
                    <span className="text-xl font-black tracking-tighter text-white">
                        VIEW<span className="text-blue-500">X</span>
                    </span>
                </div>

                <div className="hidden lg:block h-full">
                    <TabContainer />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg group focus-within:border-blue-500 transition-all">
                    <Search size={16} className="text-zinc-500 group-focus-within:text-blue-400" />
                    <input
                        type="text"
                        placeholder="Search symbols..."
                        className="bg-transparent border-none outline-none text-sm text-zinc-300 w-48 placeholder-zinc-700"
                    />
                </div>

                <div className="flex items-center gap-1 border-r border-zinc-800 pr-4">
                    <MobileAccessButton />
                    <button className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg transition-all relative">
                        <Bell size={18} />
                        <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full border-2 border-zinc-950" />
                    </button>
                    <button className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg transition-all">
                        <Settings size={18} />
                    </button>
                </div>

                <div className="flex items-center gap-3 pl-1">
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-xs font-bold text-zinc-200">Alex Trading</span>
                        <span className="text-[10px] text-green-500 font-black uppercase">Pro Account</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 border-2 border-zinc-800 shadow-md" />

                    <button
                        onClick={toggleRightSidebar}
                        className={cn(
                            "p-2 ml-1 rounded-lg transition-all",
                            isRightSidebarOpen ? "text-blue-500 bg-blue-500/10" : "text-zinc-500 hover:text-white hover:bg-zinc-900"
                        )}
                    >
                        <PanelRightClose size={18} />
                    </button>
                </div>
            </div>
        </header>
    );
});
