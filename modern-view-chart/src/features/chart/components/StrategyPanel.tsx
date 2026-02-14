'use client';

import React, { useState } from 'react';
import { Activity, Bot, MessageSquare } from 'lucide-react';
import { StrategyList } from '@/features/strategy/components/StrategyList';
import { StrategyBuilder } from '@/features/strategy/components/StrategyBuilder';
import { cn } from '@/lib/utils';
import { SignalsView } from '@/features/strategy/components/SignalsView';
import { AIChatView } from '@/features/strategy/components/AIChatView';
import { Strategy } from '@/features/strategy/types';

import { motion, LayoutGroup } from 'framer-motion';

export function StrategyPanel() {
    const [view, setView] = useState<'build' | 'list' | 'signals' | 'ai_chat'>('signals');
    const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);

    const handleEdit = (strategy: Strategy) => {
        setEditingStrategy(strategy);
        setView('build');
    };

    const handleAdd = () => {
        setEditingStrategy(null);
        setView('build');
    };

    const handleCloseBuilder = () => {
        setEditingStrategy(null);
        setView('list');
    };

    const tabs = [
        { id: 'signals', label: 'Signals', icon: Activity },
        { id: 'list', label: 'My bot', icon: Bot, matches: ['list', 'build'] },
        { id: 'ai_chat', label: 'Ai chat', icon: MessageSquare }
    ];

    return (
        <div className="flex flex-col h-full bg-background text-foreground overflow-hidden font-sans">
            {/* Tabs Header (Child Navigation - Differentiated Hierarchy) */}
            <LayoutGroup id="strategy-panel-tabs">
                <div className="flex bg-secondary/30 dark:bg-white/[0.02] p-0.5 gap-1 mx-4 mt-0.5 mb-2 rounded-lg shrink-0 relative z-0">
                    {tabs.map((tab) => {
                        const isActive = tab.matches ? tab.matches.includes(view) : view === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setView(tab.id as any)}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md transition-colors duration-300 text-[9.5px] font-bold uppercase border border-transparent relative outline-none",
                                    isActive
                                        ? "text-primary"
                                        : "text-muted-foreground/40 hover:text-foreground/60"
                                )}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="active-strategy-tab"
                                        className="absolute inset-0 bg-primary/10 rounded-md shadow-sm border border-primary/5"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                <div className="relative z-10 flex items-center gap-1.5">
                                    <tab.icon size={10} /> {tab.label}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </LayoutGroup>

            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar flex flex-col items-center bg-transparent">
                <div className="w-full max-w-[800px] flex flex-col gap-2 pb-4 h-full">
                    {view === 'signals' && <SignalsView />}

                    {view === 'ai_chat' && <AIChatView />}

                    {view === 'list' && (
                        <StrategyList onEdit={handleEdit} onAdd={handleAdd} />
                    )}

                    {view === 'build' && (
                        <StrategyBuilder editingStrategy={editingStrategy} onClose={handleCloseBuilder} />
                    )}
                </div>
            </div>
        </div>
    );
}
