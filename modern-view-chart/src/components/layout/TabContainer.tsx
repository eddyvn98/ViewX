'use client';

import React, { useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { Plus, X, Edit2, Layout } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TabContainer() {
    const tabs = useMarketStore((state) => state.tabs);
    const activeTabId = useMarketStore((state) => state.activeTabId);
    const setActiveTab = useMarketStore((state) => state.setActiveTab);
    const addTab = useMarketStore((state) => state.addTab);
    const removeTab = useMarketStore((state) => state.removeTab);
    const renameTab = useMarketStore((state) => state.renameTab);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    const handleRename = (id: string, currentName: string) => {
        setEditingId(id);
        setEditValue(currentName);
    };

    const submitRename = (id: string) => {
        if (editValue.trim()) {
            renameTab(id, editValue.trim());
        }
        setEditingId(null);
    };

    return (
        <div className="flex items-center h-full">
            {Object.values(tabs).map((tab) => (
                <div
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    onDoubleClick={() => handleRename(tab.id, tab.name)}
                    className={cn(
                        "group relative flex items-center gap-2 px-2 h-full transition-all cursor-pointer min-w-[70px] max-w-[120px]",
                        activeTabId === tab.id
                            ? "text-primary bg-primary/5"
                            : "text-muted-foreground/60 hover:text-foreground hover:bg-secondary/10"
                    )}
                >
                    <Layout size={12} className={activeTabId === tab.id ? "text-primary glow-primary" : "text-muted-foreground/40"} />

                    {editingId === tab.id ? (
                        <input
                            autoFocus
                            className="bg-secondary/40 text-foreground text-[9px] px-1 py-0.5 rounded border border-primary/30 outline-none w-full shadow-inner"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => submitRename(tab.id)}
                            onKeyDown={(e) => e.key === 'Enter' && submitRename(tab.id)}
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <span className="text-[9px] font-black uppercase tracking-wider truncate select-none leading-none">
                            {tab.name}
                        </span>
                    )}

                    {Object.keys(tabs).length > 1 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                removeTab(tab.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-all"
                        >
                            <X size={10} />
                        </button>
                    )}

                    {/* Active Indicator Line - Extra Slim */}
                    {activeTabId === tab.id && (
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full shadow-glow" />
                    )}
                </div>
            ))}

            <button
                onClick={() => addTab()}
                className="p-2 rounded-xl text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-all ml-2 active:scale-90"
                title="Add Workspace"
            >
                <Plus size={16} />
            </button>
        </div>
    );
}
