import React, { memo } from "react";
import { BarChart2, List, Menu, ArrowLeftRight, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileSymbolCarousel } from "./MobileSymbolCarousel";

interface MobileBottomNavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    isHidden?: boolean;
}

export const MobileBottomNav = memo(function MobileBottomNav({ activeTab, onTabChange, isHidden = false }: MobileBottomNavProps) {
    const navItems = [
        { id: 'watchlist', label: 'Watchlist', icon: List },
        { id: 'chart', label: 'Biểu đồ', icon: BarChart2 },
        { id: 'trade', label: 'Trade', icon: ArrowLeftRight },
        { id: 'positions', label: 'Terminal', icon: Briefcase },
        { id: 'menu', label: 'Menu', icon: Menu },
    ];

    return (
        <div className={cn(
            "md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-900 z-50 transition-all duration-300 ease-in-out transform-gpu",
            isHidden ? "translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
        )}>
            {/* Symbol Switcher Wheel */}
            <MobileSymbolCarousel />

            {/* Navigation Icons */}
            <div className="flex items-center justify-around h-16 pb-2">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={cn(
                            "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors active:scale-95",
                            activeTab === item.id
                                ? "text-blue-500"
                                : "text-zinc-500 hover:text-zinc-400"
                        )}
                    >
                        <item.icon size={22} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                        <span className="text-[11px] font-bold tracking-tight">{item.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
});
