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
                        "group relative flex items-center gap-2 px-4 h-full transition-all cursor-pointer min-w-[100px] max-w-[160px]",
                        activeTabId === tab.id
                            ? "text-blue-400"
                            : "text-zinc-500 hover:text-zinc-300"
                    )}
                >
                    <Layout size={12} className={activeTabId === tab.id ? "text-blue-500" : "text-zinc-600"} />

                    {editingId === tab.id ? (
                        <input
                            autoFocus
                            className="bg-zinc-800 text-white text-[11px] px-1 rounded outline-none w-full"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => submitRename(tab.id)}
                            onKeyDown={(e) => e.key === 'Enter' && submitRename(tab.id)}
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <span className="text-[11px] font-bold truncate select-none tracking-tight">
                            {tab.name}
                        </span>
                    )}

                    {Object.keys(tabs).length > 1 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                removeTab(tab.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-zinc-800 rounded transition-opacity"
                        >
                            <X size={10} className="text-zinc-500 hover:text-red-400" />
                        </button>
                    )}

                    {/* Active Indicator Line */}
                    {activeTabId === tab.id && (
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500" />
                    )}
                </div>
            ))}

            <button
                onClick={() => addTab()}
                className="p-1 px-2 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-white transition-all ml-1"
                title="Add Workspace"
            >
                <Plus size={14} />
            </button>
        </div>
    );
}
