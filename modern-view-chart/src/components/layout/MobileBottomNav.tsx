import React, { memo, useState, useRef, useCallback } from "react";
import { useMarketStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { DrawingTool } from "@/lib/store/types";
import { List, Menu, ArrowLeftRight, Briefcase, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { MobileSymbolCarousel } from "./MobileSymbolCarousel";
import { MobileTimeframeSlide } from "./MobileTimeframeSlide";
import { MobileDrawingToolbar } from "./MobileDrawingToolbar";

import { useOrderFormLogic } from "@/features/terminal/components/OrderForm";
import { MobileTradeFlow } from "@/features/terminal/components/OrderForm/MobileTradeFlow";

interface MobileBottomNavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    isHidden?: boolean;
    className?: string;
    compact?: boolean;
    mini?: boolean;
}

type NavMode = 'symbol' | 'drawing' | 'actions' | 'timeframe';

const MODES: NavMode[] = ['actions', 'symbol', 'drawing'];
const DEFAULT_ITEM_HEIGHT = 62;
const COMPACT_ITEM_HEIGHT = 52;
const MINI_ITEM_HEIGHT = 44;

const NAV_ITEMS = [
    { id: 'watchlist', label: 'Watchlist', icon: List },
    { id: 'trade', label: 'Trade', icon: ArrowLeftRight },
    { id: 'strategy', label: 'Strategy', icon: Brain },
    { id: 'positions', label: 'Terminal', icon: Briefcase },
    { id: 'menu', label: 'Menu', icon: Menu },
];

export const MobileBottomNav = memo(function MobileBottomNav({
    activeTab,
    onTabChange,
    isHidden = false,
    className,
    compact = false,
    mini = false
}: MobileBottomNavProps) {
    const itemHeight = mini ? MINI_ITEM_HEIGHT : compact ? COMPACT_ITEM_HEIGHT : DEFAULT_ITEM_HEIGHT;
    const [mode, setMode] = useState<NavMode>('symbol');
    const [isTimeframe, setIsTimeframe] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    const touchState = useRef({
        startY: 0,
        startX: 0,
        currentTranslate: 0,
        isDragging: false,
        lockDirection: 'none' as 'horizontal' | 'vertical' | 'none',
    });

    const orderLogic = useOrderFormLogic();

    const startDrawing = useMarketStore(state => state.startDrawing);
    const cancelDrawing = useMarketStore(state => state.cancelDrawing);
    const clearDrawings = useMarketStore(state => state.clearDrawings);
    const chartId = useMarketStore(state => state.tabs[activeTab]?.activeChartId || '');

    const handleToolSelect = useCallback((toolId: string) => {
        if (toolId === 'cursor') {
            cancelDrawing();
        } else if (toolId === 'clear') {
            if (chartId) clearDrawings(chartId);
        } else {
            startDrawing(toolId as DrawingTool);
        }
    }, [startDrawing, cancelDrawing, clearDrawings, chartId]);

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

        if (touchState.current.lockDirection === 'none') {
            if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
                touchState.current.lockDirection = 'horizontal';
                return;
            } else if (Math.abs(deltaY) > 5) {
                touchState.current.lockDirection = 'vertical';
            }
        }

        if (touchState.current.lockDirection === 'horizontal') return;
        touchState.current.currentTranslate = deltaY;
    };

    const handleTouchEnd = () => {
        if (isTimeframe || isAnimating) return;

        const deltaY = touchState.current.currentTranslate;
        const wasVertical = touchState.current.lockDirection === 'vertical';

        touchState.current.isDragging = false;
        touchState.current.lockDirection = 'none';
        touchState.current.currentTranslate = 0;

        if (!wasVertical || Math.abs(deltaY) < 30) return;

        const direction = deltaY > 0 ? -1 : 1;
        const currentIndex = MODES.indexOf(mode);
        const nextIndex = (currentIndex + direction + MODES.length) % MODES.length;

        const newMode = MODES[nextIndex];
        if (window.navigator.vibrate) window.navigator.vibrate(10);
        setMode(newMode);

        if ((newMode === 'symbol' || newMode === 'drawing') && activeTab !== 'chart') {
            onTabChange('chart');
        }
    };

    const handleSymbolTap = useCallback(() => setIsTimeframe(true), []);
    const handleTimeframeSelect = useCallback(() => setIsTimeframe(false), []);

    if (isHidden) return null;

    const renderModeContent = (targetMode: NavMode, isActive: boolean) => {
        const itemStyle = { height: `${itemHeight}px` };
        const isTradeActive = activeTab === 'trade';

        // Lazy Rendering: Only render heavy components if isActive
        if (!isActive) {
            const modeInfo = {
                symbol: { label: 'Symbols', icon: List },
                drawing: { label: 'Drawings', icon: Menu },
                actions: { label: 'Actions', icon: ArrowLeftRight },
            }[targetMode as Exclude<NavMode, 'timeframe'>] || { label: '', icon: Menu };

            return (
                <div className="w-full flex items-center justify-center gap-2 text-muted-foreground/30 px-2" style={itemStyle}>
                    <modeInfo.icon size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{modeInfo.label}</span>
                </div>
            );
        }

        switch (targetMode) {
            case 'symbol':
                return <div className="w-full flex items-center justify-center" style={itemStyle}>
                    <MobileSymbolCarousel onSymbolTap={handleSymbolTap} />
                </div>;
            case 'drawing':
                return <div className="w-full flex items-center justify-center" style={itemStyle}>
                    <MobileDrawingToolbar onToolSelect={handleToolSelect} />
                </div>;
            case 'actions':
                return <div className="w-full flex items-center justify-center" style={itemStyle}>
                    {isTradeActive ? (
                        <div className="w-full h-full overflow-hidden">
                            <MobileTradeFlow {...orderLogic} formatPrice={orderLogic.formatPrice} onClose={() => onTabChange('chart')} />
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-around px-2">
                            {NAV_ITEMS.map((item) => {
                                const isItemActive = activeTab === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={(e) => { e.stopPropagation(); onTabChange(item.id); }}
                                        className={cn("flex flex-row items-center gap-1.5", isItemActive ? "text-foreground font-medium" : "text-muted-foreground")}
                                    >
                                        <div className={cn("p-1 rounded-lg", isItemActive ? "bg-primary/20 text-primary" : "bg-transparent")}>
                                            <item.icon size={14} strokeWidth={isItemActive ? 2.5 : 2} />
                                        </div>
                                        <span className={cn("font-black uppercase tracking-widest", compact ? "text-[9px]" : "text-[10px]", isItemActive ? "opacity-100" : "opacity-40")}>
                                            {item.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>;
            default: return null;
        }
    };

    return (
        <div className={cn("w-full z-[99] flex flex-col items-center pointer-events-auto shrink-0 relative bg-background overflow-x-hidden", className)}>
            <div
                className="w-full z-[100] backdrop-blur-2xl border-t border-border/10 bg-background/95 supports-[backdrop-filter]:bg-background/80 h-auto overflow-hidden touch-pan-x pb-safe shadow-[0_-8px_24px_rgba(0,0,0,0.1)]"
                onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
            >
                <div className="w-full relative overflow-hidden flex flex-col items-center shrink-0" style={{ height: `${itemHeight}px` }}>
                    {!isTimeframe ? (
                        <motion.div
                            className="w-full flex flex-col items-center will-change-transform"
                            animate={{ y: -itemHeight }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            key={mode}
                        >
                            {/* Render Previous, Current, Next for infinite vertical loop feel */}
                            {[-1, 0, 1].map((offset) => {
                                const currentIndex = MODES.indexOf(mode);
                                const targetIndex = (currentIndex + offset + MODES.length) % MODES.length;
                                const targetMode = MODES[targetIndex];
                                const isActive = offset === 0;
                                return (
                                    <div key={offset} className="w-full shrink-0">
                                        {renderModeContent(targetMode, isActive)}
                                    </div>
                                );
                            })}
                        </motion.div>
                    ) : (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md animate-in fade-in zoom-in duration-200">
                            <MobileTimeframeSlide onSelect={handleTimeframeSelect} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});
