import React, { memo, useState, useRef } from "react";
import { BarChart2, List, Menu, ArrowLeftRight, Briefcase, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileSymbolCarousel } from "./MobileSymbolCarousel";

interface MobileBottomNavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    isHidden?: boolean;
}

export const MobileBottomNav = memo(function MobileBottomNav({ activeTab, onTabChange, isHidden = false }: MobileBottomNavProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const touchStartY = useRef<number | null>(null);

    const navItems = [
        { id: 'watchlist', label: 'Watchlist', icon: List },
        { id: 'chart', label: 'Biểu đồ', icon: BarChart2 },
        { id: 'trade', label: 'Trade', icon: ArrowLeftRight },
        { id: 'positions', label: 'Terminal', icon: Briefcase },
        { id: 'menu', label: 'Menu', icon: Menu },
    ];

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartY.current === null) return;
        const touchEndY = e.changedTouches[0].clientY;
        const diff = touchStartY.current - touchEndY;

        if (diff > 50 && !isExpanded) {
            setIsExpanded(true);
        } else if (diff < -50 && isExpanded) {
            setIsExpanded(false);
        }
        touchStartY.current = null;
    };

    if (isHidden) return null;

    return (
        <div className="md:hidden fixed inset-x-0 bottom-0 z-50 pointer-events-none pb-safe">
            {/* 1. PERMANENT SYMBOL CAROUSEL - Slim Floating Pill */}
            <div className="px-5 pb-2 mb-1 pointer-events-auto">
                <div className="bg-zinc-950/40 backdrop-blur-3xl border border-white/5 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-visible">
                    <MobileSymbolCarousel />
                </div>
            </div>

            {/* 2. SLIM REVEALABLE BOTTOM NAV */}
            <div
                className={cn(
                    "bg-zinc-950/90 backdrop-blur-3xl border-t border-white/5 pointer-events-auto transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] transform-gpu flex flex-col shadow-[0_-8px_30px_rgba(0,0,0,0.4)]",
                    isExpanded ? "h-18 rounded-t-[24px]" : "h-2"
                )}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                {/* Slim Trigger Handle */}
                <div
                    className="h-2 flex items-center justify-center cursor-pointer active:bg-white/5 group relative"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className={cn(
                        "w-12 h-[3px] rounded-full transition-all duration-300",
                        isExpanded ? "bg-white/10" : "bg-white/30 group-hover:bg-blue-500/50"
                    )} />
                </div>

                {/* Nav Items (Compact) */}
                <div className={cn(
                    "flex items-center justify-around px-2 overflow-hidden transition-all duration-500",
                    isExpanded ? "h-16 pb-2 opacity-100 translate-y-0" : "h-0 opacity-0 translate-y-2"
                )}>
                    {navItems.map((item) => {
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    onTabChange(item.id);
                                    if (item.id !== 'chart') setIsExpanded(false);
                                }}
                                className={cn(
                                    "relative flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-300 active:scale-90",
                                    isActive ? "text-white" : "text-zinc-500"
                                )}
                            >
                                <div className={cn(
                                    "p-1.5 rounded-lg transition-all",
                                    isActive ? "bg-blue-600/20" : "bg-transparent"
                                )}>
                                    <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                                </div>
                                <span className={cn(
                                    "text-[9px] font-bold uppercase tracking-widest transition-opacity duration-300",
                                    isActive ? "opacity-100" : "opacity-40"
                                )}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});
