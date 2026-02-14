'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';
import { useMarketStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const themes = [
    { id: 'slate', color: 'bg-slate-500', label: 'Kim (Metal)' },
    { id: 'green', color: 'bg-emerald-500', label: 'Mộc (Wood)' },
    { id: 'blue', color: 'bg-blue-500', label: 'Thủy (Water)' },
    { id: 'red', color: 'bg-red-500', label: 'Hỏa (Fire)' },
    { id: 'amber', color: 'bg-amber-500', label: 'Thổ (Earth)' },
] as const;

export function ThemeColorSwitcher() {
    const [isOpen, setIsOpen] = useState(false);
    const themeColor = useMarketStore(state => state.themeColor);
    const setThemeColor = useMarketStore(state => state.setThemeColor);
    const ref = useRef<HTMLDivElement>(null);

    // Initial load sync
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme-color') as any;
        if (savedTheme && themes.some(t => t.id === savedTheme)) {
            setThemeColor(savedTheme);
        }
    }, [setThemeColor]);

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-7 h-7 rounded-full transition-all active:scale-95 flex items-center justify-center border",
                    isOpen
                        ? "bg-primary/10 text-primary border-primary/20 shadow-[0_0_10px_var(--glow-primary)]"
                        : "bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary border-border/50"
                )}
                title="Change Theme Color"
            >
                <Palette size={14} className={cn(isOpen && "text-primary")} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 5 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-9 right-0 p-3 bg-popover/95 backdrop-blur-xl border border-border/50 shadow-xl rounded-xl z-50 w-auto min-w-[180px]"
                    >
                        <div className="text-[10px] uppercase font-bold text-muted-foreground px-1 mb-2 tracking-wider text-center">
                            Ngũ Hành (Elements)
                        </div>
                        <div className="flex items-center justify-center gap-2">
                            {themes.map((theme) => (
                                <button
                                    key={theme.id}
                                    onClick={() => {
                                        setThemeColor(theme.id);
                                        setIsOpen(false);
                                    }}
                                    className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 relative group border-2",
                                        themeColor === theme.id ? "border-foreground/20 scale-105 shadow-md" : "border-transparent"
                                    )}
                                    title={theme.label}
                                >
                                    <span className={cn("w-full h-full rounded-full", theme.color)} />
                                    {themeColor === theme.id && (
                                        <Check size={12} className="absolute text-white drop-shadow-md stroke-[3px]" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
