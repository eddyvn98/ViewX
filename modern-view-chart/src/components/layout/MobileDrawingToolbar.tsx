'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
    MousePointer2,
    TrendingUp,
    Minus,
    ArrowUpRight,
    Square,
    GitCommit,
    Type,
    Eraser,
    Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DRAWING_TOOLS = [
    { id: 'cursor', label: 'Cursor', icon: MousePointer2 },
    { id: 'trendline', label: 'Trendline', icon: TrendingUp },
    { id: 'h-line', label: 'H-Line', icon: Minus },
    { id: 'ray', label: 'Ray', icon: ArrowUpRight },
    { id: 'rect', label: 'Rect', icon: Square },
    { id: 'fib', label: 'Fib', icon: GitCommit },
    { id: 'text', label: 'Text', icon: Type },
    { id: 'eraser', label: 'Eraser', icon: Eraser },
    { id: 'clear', label: 'Clear', icon: Trash2 },
];

interface MobileDrawingToolbarProps {
    onToolSelect?: (toolId: string) => void;
    isDimmed?: boolean;
}

export function MobileDrawingToolbar({ onToolSelect, isDimmed = false }: MobileDrawingToolbarProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeTool, setActiveTool] = useState('cursor');
    const [centerTool, setCenterTool] = useState('cursor');
    const initialCentered = useRef(false);

    const infiniteTools = [...DRAWING_TOOLS, ...DRAWING_TOOLS, ...DRAWING_TOOLS];

    // Effect to handle visual updates and infinite loop jumping
    useEffect(() => {
        const container = scrollRef.current;
        if (!container) return;

        const updateVisuals = () => {
            const center = container.scrollLeft + container.clientWidth / 2;
            const items = container.children;
            let closestId = '';
            let minDistance = Infinity;

            // 1. Handle Infinite Jumping (Invisible to user)
            const singleSetWidth = container.scrollWidth / 3;
            if (container.scrollLeft < singleSetWidth * 0.5) {
                container.scrollLeft += singleSetWidth;
            } else if (container.scrollLeft > singleSetWidth * 1.5) {
                container.scrollLeft -= singleSetWidth;
            }

            // 2. Update Scales and Find Center Tool
            for (let i = 0; i < items.length; i++) {
                const item = items[i] as HTMLElement;
                const itemCenter = item.offsetLeft + item.clientWidth / 2;
                const distance = Math.abs(itemCenter - center);

                // Emphasis transformation
                const normalizedDistance = Math.min(distance / 120, 1);
                const scale = 1.25 - (normalizedDistance * 0.25);

                item.style.opacity = '1';
                item.style.transform = `scale(${scale})`;
                item.style.filter = 'none';

                if (distance < minDistance) {
                    minDistance = distance;
                    closestId = item.getAttribute('data-tool') || '';
                }
            }

            if (closestId && closestId !== centerTool) {
                setCenterTool(closestId);
            }
        };

        container.addEventListener('scroll', updateVisuals);
        updateVisuals();
        return () => container.removeEventListener('scroll', updateVisuals);
    }, [centerTool]);

    // Initial sync - Center the middle copy
    useEffect(() => {
        if (scrollRef.current && !initialCentered.current) {
            const container = scrollRef.current;
            const cursorIndex = DRAWING_TOOLS.findIndex(t => t.id === 'cursor');
            if (cursorIndex !== -1) {
                const middleIndex = cursorIndex + DRAWING_TOOLS.length;
                setTimeout(() => {
                    const item = container.children[middleIndex] as HTMLElement;
                    if (item) {
                        const targetScroll = item.offsetLeft - (container.clientWidth / 2) + (item.clientWidth / 2);
                        container.scrollTo({ left: targetScroll, behavior: 'auto' });
                        initialCentered.current = true;
                    }
                }, 50);
            }
        }
    }, []);

    const handleToolClick = (toolId: string, element: HTMLElement) => {
        if (toolId === centerTool) {
            setActiveTool(toolId);
            onToolSelect?.(toolId);
            if (window.navigator.vibrate) window.navigator.vibrate(15);
            return;
        }

        const container = scrollRef.current;
        if (container) {
            const targetScroll = element.offsetLeft - (container.clientWidth / 2) + (element.clientWidth / 2);
            container.scrollTo({ left: targetScroll, behavior: 'smooth' });
        }
    };

    return (
        <div className={cn(
            "relative w-full h-full bg-transparent flex items-center transition-all duration-300",
            isDimmed ? "opacity-10 scale-95 pointer-events-none" : "opacity-100 scale-100"
        )}>
            <div
                ref={scrollRef}
                className="flex items-center gap-10 overflow-x-auto no-scrollbar snap-x snap-mandatory h-full touch-horizontal"
            >
                {infiniteTools.map((tool, idx) => {
                    const isActive = centerTool === tool.id;
                    const isSelected = activeTool === tool.id;

                    return (
                        <div
                            key={`${tool.id}-${idx}`}
                            data-tool={tool.id}
                            className="flex-shrink-0 w-max px-3 flex items-center justify-center transition-all duration-300 select-none active:scale-95"
                            style={{ scrollSnapAlign: 'center' }}
                            onClick={(e) => handleToolClick(tool.id, e.currentTarget)}
                        >
                            <div className={cn(
                                "flex flex-row items-center gap-1.5 transition-all duration-300",
                                isActive ? "text-white" : "text-zinc-500"
                            )}>
                                <div className={cn(
                                    "p-1 rounded-lg transition-all",
                                    isSelected && isActive ? "bg-blue-600/20 text-blue-400 shadow-lg shadow-blue-500/10" : "bg-transparent"
                                )}>
                                    <tool.icon size={14} strokeWidth={isActive ? 2.5 : 2} />
                                </div>
                                {isActive && (
                                    <span className={cn(
                                        "text-[10px] font-black uppercase tracking-widest whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300"
                                    )}>
                                        {tool.label}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#0b0e14]/20 to-transparent pointer-events-none z-10" />
            <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#0b0e14]/20 to-transparent pointer-events-none z-10" />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-0.5 w-4 h-0.5 bg-blue-500/50 rounded-full pointer-events-none z-20" />
        </div>
    );
}
