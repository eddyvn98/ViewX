import React, { memo, useState, useRef, useCallback } from "react";
import { BarChart2, List, Menu, ArrowLeftRight, Briefcase, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileSymbolCarousel } from "./MobileSymbolCarousel";
import { MobileTimeframeSlide } from "./MobileTimeframeSlide";
import { MobileDrawingToolbar } from "./MobileDrawingToolbar";

import { useOrderFormLogic } from "@/features/terminal/components/OrderForm";
import { MobileTradeFlow } from "@/features/terminal/components/OrderForm/MobileTradeFlow";

interface MobileBottomNavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    isHidden?: boolean;
}

type NavMode = 'symbol' | 'drawing' | 'actions' | 'timeframe';

export const MobileBottomNav = memo(function MobileBottomNav({ activeTab, onTabChange, isHidden = false }: MobileBottomNavProps) {
    // Thứ tự modes: Actions (up) -> Symbol (center, default) -> Drawing (down)
    const MODES: NavMode[] = ['actions', 'symbol', 'drawing'];
    const ITEM_HEIGHT = 48;

    const [mode, setMode] = useState<NavMode>('symbol');
    const [isTimeframe, setIsTimeframe] = useState(false);

    const wheelRef = useRef<HTMLDivElement>(null);
    const touchState = useRef({
        startY: 0,
        startX: 0,
        currentTranslate: 0,
        lastTranslate: 0,
        isDragging: false,
        lockDirection: 'none' as 'horizontal' | 'vertical' | 'none',
    });

    const orderLogic = useOrderFormLogic();

    const navItems = [
        { id: 'watchlist', label: 'Watchlist', icon: List },
        { id: 'trade', label: 'Trade', icon: ArrowLeftRight },
        { id: 'strategy', label: 'Strategy', icon: Brain },
        { id: 'positions', label: 'Terminal', icon: Briefcase },
        { id: 'menu', label: 'Menu', icon: Menu },
    ];

    // Apply translate to wheel
    const applyTranslate = useCallback((translateY: number, animate = false) => {
        if (!wheelRef.current) return;
        wheelRef.current.style.transition = animate ? 'transform 300ms ease-out' : 'none';
        wheelRef.current.style.transform = `translateY(${translateY}px)`;
    }, []);

    // Snap to nearest position
    const snapToNearest = useCallback((currentY: number) => {
        const steps = Math.round(currentY / ITEM_HEIGHT);
        return steps * ITEM_HEIGHT;
    }, []);

    // Get mode from translate position
    const getModeFromTranslate = useCallback((translateY: number) => {
        const steps = Math.round(translateY / ITEM_HEIGHT);
        const currentModeIndex = MODES.indexOf(mode);
        const newIndex = ((currentModeIndex + steps) % MODES.length + MODES.length) % MODES.length;
        return MODES[newIndex];
    }, [mode]);

    // Touch handlers
    const [isAnimating, setIsAnimating] = useState(false);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (isTimeframe || isAnimating) return;
        touchState.current.startY = e.touches[0].clientY;
        touchState.current.startX = e.touches[0].clientX;
        touchState.current.isDragging = true;
        touchState.current.lockDirection = 'none';
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchState.current.isDragging || isTimeframe || isAnimating) return;

        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const deltaX = currentX - touchState.current.startX;
        const deltaY = currentY - touchState.current.startY;

        // Determine or enforce direction lock
        if (touchState.current.lockDirection === 'none') {
            if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
                touchState.current.lockDirection = 'horizontal';
                return;
            } else if (Math.abs(deltaY) > 5) {
                touchState.current.lockDirection = 'vertical';
            }
        }

        if (touchState.current.lockDirection === 'horizontal') return;

        const newTranslate = touchState.current.lastTranslate + deltaY;
        touchState.current.currentTranslate = newTranslate;
        applyTranslate(newTranslate);
    };

    const handleTouchEnd = () => {
        if (!touchState.current.isDragging || isTimeframe || isAnimating) return;

        const wasVertical = touchState.current.lockDirection === 'vertical';
        touchState.current.isDragging = false;
        touchState.current.lockDirection = 'none';

        if (!wasVertical) {
            // If it wasn't a vertical swipe, reset any minor vertical shift
            applyTranslate(0, true);
            touchState.current.currentTranslate = 0;
            touchState.current.lastTranslate = 0;
            return;
        }

        // Snap to nearest position
        const snapped = snapToNearest(touchState.current.currentTranslate);
        const newMode = getModeFromTranslate(snapped);

        if (newMode !== mode) {
            setIsAnimating(true);
            applyTranslate(snapped, true);

            // ATOMIC SWAP: Wait for animation to finish, then swap state and reset translate
            setTimeout(() => {
                if (window.navigator.vibrate) window.navigator.vibrate(10);

                // 1. Update mode state (this triggers re-centering visually)
                setMode(newMode);

                // 2. Intelligent Navigation: Auto-switch to chart tab
                if ((newMode === 'symbol' || newMode === 'drawing') && activeTab !== 'chart') {
                    onTabChange('chart');
                }

                // 3. Immediately reset translate to 0 without transition
                // This must happen after or during the same render cycle as setMode
                applyTranslate(0, false);
                touchState.current.currentTranslate = 0;
                touchState.current.lastTranslate = 0;

                setIsAnimating(false);
            }, 300);
        } else {
            // If mode didn't change, snap back to center
            applyTranslate(0, true);
            touchState.current.currentTranslate = 0;
            touchState.current.lastTranslate = 0;
        }
    };

    // Symbol tap handler
    const handleSymbolTap = useCallback(() => {
        setIsTimeframe(true);
    }, []);

    // Timeframe select handler
    const handleTimeframeSelect = useCallback(() => {
        setIsTimeframe(false);
    }, []);

    if (isHidden) return null;

    const isTradeActive = activeTab === 'trade';

    // Render mode content
    const renderModeContent = (targetMode: NavMode) => {
        const itemStyle = {
            height: `${ITEM_HEIGHT}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            flexShrink: 0,
        };

        switch (targetMode) {
            case 'symbol':
                return (
                    <div style={itemStyle}>
                        <MobileSymbolCarousel onSymbolTap={handleSymbolTap} />
                    </div>
                );
            case 'drawing':
                return (
                    <div style={itemStyle}>
                        <MobileDrawingToolbar onToolSelect={(toolId) => console.log('Tool selected:', toolId)} />
                    </div>
                );
            case 'actions':
                return (
                    <div style={itemStyle}>
                        {isTradeActive ? (
                            <div className="w-full h-full overflow-hidden">
                                <MobileTradeFlow
                                    {...orderLogic}
                                    formatPrice={orderLogic.formatPrice}
                                    onClose={() => onTabChange('chart')}
                                />
                            </div>
                        ) : (
                            <div className="w-full h-full flex items-center justify-around px-2">
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
                                                "relative flex flex-row items-center justify-center px-2 py-1 gap-1.5 transition-all duration-300 active:scale-90",
                                                isActive ? "text-white" : "text-zinc-500"
                                            )}
                                        >
                                            <div className={cn(
                                                "p-1 rounded-lg transition-all",
                                                isActive ? "bg-blue-600/20 text-blue-400 shadow-lg shadow-blue-500/10" : "bg-transparent"
                                            )}>
                                                <item.icon size={14} strokeWidth={isActive ? 2.5 : 2} />
                                            </div>
                                            <span className={cn(
                                                "text-[10px] font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap",
                                                isActive ? "opacity-100 scale-105" : "opacity-40"
                                            )}>
                                                {item.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="md:hidden w-full z-[99] flex flex-col items-center pointer-events-auto shrink-0 relative bg-[#0b0e14] overflow-x-hidden">
            <div
                className={cn(
                    "w-full z-[100] transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
                    "backdrop-blur-2xl border-t border-white/5 shadow-[0_-8px_24px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center",
                    "touch-pan-x pb-safe",
                    "bg-[#0b0e14]/98 h-auto overflow-hidden"
                )}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Vertical Wheel Container */}
                <div className="w-full relative overflow-hidden flex items-center shrink-0" style={{ height: `${ITEM_HEIGHT}px` }}>
                    {!isTimeframe ? (
                        <div
                            ref={wheelRef}
                            className="w-full flex flex-col will-change-transform"
                            style={{ transform: `translateY(${touchState.current.currentTranslate}px)` }}
                        >
                            {/* Render infinite scroll: 5 items visible */}
                            {[-2, -1, 0, 1, 2].map((offset) => {
                                const currentModeIndex = MODES.indexOf(mode);
                                const targetIndex = ((currentModeIndex - offset) % MODES.length + MODES.length) % MODES.length;
                                const targetMode = MODES[targetIndex];
                                return <div key={offset}>{renderModeContent(targetMode)}</div>;
                            })}
                        </div>
                    ) : (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-md animate-in fade-in zoom-in duration-200">
                            <MobileTimeframeSlide onSelect={handleTimeframeSelect} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});
