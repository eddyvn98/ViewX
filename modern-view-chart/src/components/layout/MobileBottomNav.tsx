import React, { memo, useState, useRef, useCallback } from "react";
import { BarChart2, List, Menu, ArrowLeftRight, Briefcase, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileSymbolCarousel } from "./MobileSymbolCarousel";
import { MobileTimeframeSlide } from "./MobileTimeframeSlide";

import { useOrderFormLogic } from "@/features/terminal/components/OrderForm";
import { MobileTradeFlow } from "@/features/terminal/components/OrderForm/MobileTradeFlow";

interface MobileBottomNavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    isHidden?: boolean;
}

type NavMode = 'symbol' | 'actions' | 'timeframe';

export const MobileBottomNav = memo(function MobileBottomNav({ activeTab, onTabChange, isHidden = false }: MobileBottomNavProps) {
    const [mode, setMode] = useState<NavMode>('symbol');
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [prevMode, setPrevMode] = useState<NavMode | null>(null);
    const [direction, setDirection] = useState<'up' | 'down'>('up');
    const touchStartY = useRef<number | null>(null);
    const touchStartX = useRef<number | null>(null);

    const orderLogic = useOrderFormLogic();

    const navItems = [
        { id: 'watchlist', label: 'Watchlist', icon: List },
        { id: 'chart', label: 'Biểu đồ', icon: BarChart2 },
        { id: 'trade', label: 'Trade', icon: ArrowLeftRight },
        { id: 'positions', label: 'Terminal', icon: Briefcase },
        { id: 'menu', label: 'Menu', icon: Menu },
    ];

    const transition = (newMode: NavMode, dir: 'up' | 'down') => {
        if (newMode === mode || isTransitioning) return;
        setPrevMode(mode);
        setMode(newMode);
        setDirection(dir);
        setIsTransitioning(true);
        if (window.navigator.vibrate) window.navigator.vibrate(10);

        setTimeout(() => {
            setIsTransitioning(false);
            setPrevMode(null);
        }, 300); // Perfect sync with 3D animation
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY;
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartY.current === null || touchStartX.current === null) return;
        const touchEndY = e.changedTouches[0].clientY;
        const touchEndX = e.changedTouches[0].clientX;
        const diffY = touchStartY.current - touchEndY;
        const diffX = touchStartX.current - touchEndX;

        if (Math.abs(diffY) > 30 && Math.abs(diffY) > Math.abs(diffX)) {
            const dir = diffY > 0 ? 'up' : 'down';
            if (activeTab === 'trade') return; // Disable swipe while in trade flow

            if (mode === 'symbol') {
                transition('actions', dir);
            } else if (mode === 'actions') {
                transition('symbol', dir);
            }
        }

        touchStartY.current = null;
        touchStartX.current = null;
    };

    const handleSymbolTap = useCallback(() => {
        transition('timeframe', 'up');
    }, [mode, isTransitioning]);

    const handleTimeframeSelect = useCallback(() => {
        transition('symbol', 'down');
    }, [mode, isTransitioning]);

    if (isHidden) return null;

    const isTradeActive = activeTab === 'trade';
    const isEnteringActions = mode === 'actions' || (isTransitioning && prevMode === 'actions') || isTradeActive;

    const renderContent = (targetMode: NavMode, isOld: boolean) => {
        const animClass = isOld
            ? (direction === 'up' ? "animate-wheel-up-out" : "animate-wheel-down-out")
            : (direction === 'up' ? "animate-wheel-up-in" : "animate-wheel-down-in");

        const contentStyle = {
            backfaceVisibility: 'hidden' as const,
            transformStyle: 'preserve-3d' as const,
        };

        switch (targetMode) {
            case 'symbol':
                return (
                    <div key="symbol" className={cn("absolute inset-0 flex items-center justify-center", animClass, isOld ? "z-0" : "z-10")} style={contentStyle}>
                        <MobileSymbolCarousel onSymbolTap={handleSymbolTap} />
                    </div>
                );
            case 'timeframe':
                return (
                    <div key="timeframe" className={cn("absolute inset-0 flex items-center justify-center bg-zinc-950/40 backdrop-blur-md", animClass, isOld ? "z-0" : "z-10")} style={contentStyle}>
                        <MobileTimeframeSlide onSelect={handleTimeframeSelect} />
                    </div>
                );
            case 'actions':
                return (
                    <div key="actions" className={cn("absolute inset-0 flex flex-col", animClass, isOld ? "z-0" : "z-10")} style={contentStyle}>
                        {isTradeActive ? (
                            <div className="flex-1 overflow-hidden">
                                <MobileTradeFlow
                                    {...orderLogic}
                                    formatPrice={orderLogic.formatPrice}
                                    onClose={() => onTabChange('chart')}
                                />
                            </div>
                        ) : (
                            <>
                                <div className="h-4 flex items-center justify-center pt-2">
                                    <div className="w-10 h-1 bg-white/20 rounded-full" />
                                </div>
                                <div className="flex-1 flex items-center justify-around px-2 pb-2">
                                    {navItems.map((item) => {
                                        const isActive = activeTab === item.id;
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onTabChange(item.id);
                                                }}
                                                className={cn(
                                                    "relative flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-300 active:scale-90",
                                                    isActive ? "text-white" : "text-zinc-500"
                                                )}
                                            >
                                                <div className={cn(
                                                    "p-1.5 rounded-lg transition-all",
                                                    isActive ? "bg-blue-600/20 text-blue-400" : "bg-transparent text-zinc-500"
                                                )}>
                                                    <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                                                </div>
                                                <span className={cn(
                                                    "text-[8px] font-bold uppercase tracking-widest transition-opacity duration-300",
                                                    isActive ? "opacity-100" : "opacity-40"
                                                )}>
                                                    {item.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                );
        }
    };

    return (
        <div className="md:hidden fixed inset-x-0 bottom-0 z-[99] flex flex-col items-center pointer-events-none">
            <div
                className={cn(
                    "relative w-[92%] mb-8 pointer-events-auto transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] transform-gpu",
                    "backdrop-blur-2xl border border-white/10 shadow-[0_12px_48px_rgba(0,0,0,0.7)] flex flex-col",
                    "rounded-[28px] touch-pan-x",
                    "bg-zinc-950/60 h-[48px]"
                )}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                style={{ perspective: '1200px' }}
            >

                {/* 
                   Gesture Hotspot: 
                   Expands hit area 40px below the bar to catch swipes starting from the edge.
                */}
                <div className="absolute inset-x-0 -bottom-10 h-10 pointer-events-auto bg-transparent" />

                {/* Content Area with Overflow Hidden and 3D Support */}
                <div className="relative flex-1 w-full overflow-hidden" style={{ transformStyle: 'preserve-3d' }}>
                    {prevMode && renderContent(prevMode, true)}
                    {renderContent(mode, false)}
                </div>

                {/* Optional bounce indicator */}
                {!isEnteringActions && mode === 'symbol' && !isTransitioning && (
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-30 animate-bounce pointer-events-none">
                        <ChevronUp size={14} className="text-white" />
                    </div>
                )}
            </div>
        </div>
    );
});
