import React, { memo, useState, useRef, useCallback } from "react";
import { useMarketStore } from "@/lib/store";
import { List, Menu, ArrowLeftRight, Briefcase, Brain, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { MobileSymbolCarousel } from "./MobileSymbolCarousel";
import { MobileTimeframeSlide } from "./MobileTimeframeSlide";

import { useOrderFormLogic } from "@/features/terminal/components/OrderForm";
import { MobileTradeFlow } from "@/features/terminal/components/OrderForm/MobileTradeFlow";

const MobileMarketPickerContent = dynamic(
    () => import("@/features/market/MarketList").then((m) => m.MobileMarketPickerContent),
    { ssr: false }
);

interface MobileBottomNavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    isHidden?: boolean;
    className?: string;
    compact?: boolean;
    mini?: boolean;
}

type NavMode = 'symbol' | 'actions' | 'timeframe';

const MODES: NavMode[] = ['actions', 'symbol'];
const DEFAULT_ITEM_HEIGHT = 62;
const COMPACT_ITEM_HEIGHT = 52;
const MINI_ITEM_HEIGHT = 44;

const NAV_ITEMS = [
    { id: 'trade', label: 'Trade', icon: ArrowLeftRight },
    { id: 'strategy', label: 'Strategy', icon: Brain },
    { id: 'positions', label: 'Terminal', icon: Briefcase },
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
    const isAnimating = false;
    const [isSymbolPickerOpen, setIsSymbolPickerOpen] = useState(false);

    const touchState = useRef({
        startY: 0,
        startX: 0,
        currentTranslate: 0,
        isDragging: false,
        lockDirection: 'none' as 'horizontal' | 'vertical' | 'none',
    });

    const orderLogic = useOrderFormLogic();

    const marketSearchQuery = useMarketStore((state) => state.marketListSearchQuery);
    const setMarketSearchQuery = useMarketStore((state) => state.setMarketListSearchQuery);

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

        if (newMode === 'symbol' && activeTab !== 'chart') {
            onTabChange('chart');
        }
    };

    const handleSymbolTap = useCallback(() => setIsTimeframe(true), []);
    const handleTimeframeSelect = useCallback(() => setIsTimeframe(false), []);
    const handleSymbolLongPress = useCallback(() => {
        setIsSymbolPickerOpen(true);
    }, []);

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
                    <span className="text-[11px] font-bold uppercase tracking-widest">{modeInfo.label}</span>
                </div>
            );
        }

        switch (targetMode) {
            case 'symbol':
                return <div className="w-full flex items-center justify-center px-2" style={itemStyle}>
                    <MobileSymbolCarousel onSymbolTap={handleSymbolTap} onSymbolLongPress={handleSymbolLongPress} />
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
                                        data-testid={`mobile-nav-${item.id}`}
                                        className={cn("flex flex-row items-center gap-1.5", isItemActive ? "text-foreground font-medium" : "text-muted-foreground")}
                                    >
                                        <div className={cn("p-1 rounded-lg", isItemActive ? "bg-primary/20 text-primary" : "bg-transparent")}>
                                            <item.icon size={14} strokeWidth={isItemActive ? 2.5 : 2} />
                                        </div>
                                        <span className={cn("font-black uppercase tracking-widest", compact ? "text-[11px]" : "text-[11px]", isItemActive ? "opacity-100" : "opacity-40")}>
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
        <div className={cn("w-full z-[99] flex flex-col items-center pointer-events-auto shrink-0 relative bg-background overflow-x-hidden", className)} data-testid="mobile-bottom-nav-root">
            <AnimatePresence>
                {isSymbolPickerOpen && (
                    <motion.div
                        className="fixed inset-0 z-[160] flex items-center justify-center p-3"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <button
                            type="button"
                            aria-label="Close symbol picker"
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsSymbolPickerOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 16, scale: 0.97 }}
                            transition={{ duration: 0.18 }}
                            className="relative z-10 w-full max-w-md h-[min(78vh,680px)] rounded-[28px] border border-white/10 bg-background/95 shadow-2xl overflow-hidden flex flex-col"
                        >
                            <div className="px-4 py-3 border-b border-border/60 bg-secondary/30 flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 text-foreground">
                                        <Search size={15} className="text-primary shrink-0" />
                                        <h2 className="text-sm font-black uppercase tracking-[0.18em]">Find Symbols</h2>
                                    </div>
                                    <p className="mt-1 text-[11px] text-muted-foreground">
                                        Search in watchlist and market list, tap star to add multiple symbols, tap X to close.
                                    </p>
                                    <input
                                        data-testid="mobile-symbol-search-input"
                                        type="text"
                                        value={marketSearchQuery}
                                        onChange={(e) => setMarketSearchQuery(e.target.value)}
                                        placeholder="Search symbols..."
                                        className="mt-2 h-8 w-full rounded-lg border border-border bg-background/80 px-3 text-xs text-foreground outline-none focus:border-primary/40"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsSymbolPickerOpen(false)}
                                    className="h-9 w-9 shrink-0 rounded-xl border border-border bg-background/70 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all flex items-center justify-center"
                                    aria-label="Close symbol picker dialog"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="flex-1 min-h-0">
                                <MobileMarketPickerContent />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div
                className="w-full z-[100] backdrop-blur-2xl border-t border-border/10 bg-background/95 supports-[backdrop-filter]:bg-background/80 h-auto overflow-hidden touch-pan-x pb-safe shadow-[0_-8px_24px_rgba(0,0,0,0.1)]"
                onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
                data-testid="mobile-bottom-nav-surface"
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
