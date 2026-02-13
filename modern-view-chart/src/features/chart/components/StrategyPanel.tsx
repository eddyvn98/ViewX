import React, { useState } from 'react';
import { Activity, Bot } from 'lucide-react';
import { StrategyList } from '@/features/strategy/components/StrategyList';
import { StrategyBuilder } from '@/features/strategy/components/StrategyBuilder';
import { SignalsView } from '@/features/strategy/components/SignalsView';
import { Strategy } from '@/features/strategy/types';

export function StrategyPanel() {
    const [view, setView] = useState<'build' | 'list' | 'signals'>('signals');
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

    return (
        <div className="flex flex-col h-full bg-[#1e222d] text-[#d1d4dc] overflow-hidden font-sans">
            {/* Tabs Header */}
            <div className="flex items-center border-b border-[#2a2e39] bg-[#131722] h-10 px-1 shrink-0">
                <button
                    onClick={() => setView('signals')}
                    className={`flex items-center gap-1.5 px-3 h-full text-[10px] font-bold transition-all border-b-2 ${view === 'signals' ? 'text-blue-500 border-blue-500 bg-[#1e222d]' : 'text-[#787b86] border-transparent hover:text-[#d1d4dc]'}`}
                >
                    <Activity size={12} /> SIGNALS
                </button>
                <button
                    onClick={() => setView('list')}
                    className={`flex items-center gap-1.5 px-3 h-full text-[10px] font-bold transition-all border-b-2 ${view === 'list' || view === 'build' ? 'text-blue-500 border-blue-500 bg-[#1e222d]' : 'text-[#787b86] border-transparent hover:text-[#d1d4dc]'}`}
                >
                    <Bot size={12} /> MY BOT
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col items-center bg-[#131722]/20">
                <div className="w-full max-w-[800px] flex flex-col gap-5 pb-10">
                    {view === 'signals' && <SignalsView />}

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
