'use client';

import { HistoryDeal } from "@/lib/store/types";
import React from "react";
import { useMarketStore } from "@/lib/store";
import { Bot, Target, Calendar, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileHistoryTableProps {
    history: HistoryDeal[];
    onSymbolClick: (symbol: string) => void;
    onAnalyze?: (deal: HistoryDeal) => void;
    analyzeEnabled?: boolean;
}

export function MobileHistoryTable({ history, onSymbolClick, onAnalyze, analyzeEnabled = true }: MobileHistoryTableProps) {
    if (!history || history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <p className="text-sm italic">No history deals found</p>
            </div>
        );
    }

    return (
        <div className="space-y-2 pb-20">
            {history.map((deal) => (
                <HistoryCard
                    key={`${deal.ticket}-${deal.time}`}
                    deal={deal}
                    onSymbolClick={onSymbolClick}
                    onAnalyze={onAnalyze}
                    analyzeEnabled={analyzeEnabled}
                />
            ))}
        </div>
    );
}

function HistoryCard({ deal, onSymbolClick, onAnalyze, analyzeEnabled = true }: {
    deal: HistoryDeal;
    onSymbolClick: (s: string) => void;
    onAnalyze?: (deal: HistoryDeal) => void;
    analyzeEnabled?: boolean;
}) {
    const analysisResult = useMarketStore((state) => state.analysisResults[deal.ticket]);
    const isProfitable = deal.profit >= 0;
    const isBuy = (deal.type || '').toLowerCase().includes('buy');

    const handleFocus = () => {
        if (deal.symbol) {
            onSymbolClick(deal.symbol);
        }
    };

    return (
        <div className="bg-secondary/40 border border-border/50 rounded-lg overflow-hidden shadow-sm transition-colors mb-2">
            {/* Header: Type & Profit */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "w-5 h-5 rounded flex items-center justify-center",
                        isBuy ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                    )}>
                        {isBuy ? <Target size={12} /> : <Target size={12} className="rotate-180" />}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-black text-foreground">{deal.symbol || '---'}</span>
                        <span className="text-[9px] text-muted-foreground/60 font-mono">#{deal.ticket}</span>
                    </div>
                </div>
                <div className={cn(
                    "text-sm font-black font-mono",
                    isProfitable ? "text-green-500" : "text-red-500"
                )}>
                    {deal.profit > 0 ? '+' : ''}{deal.profit.toFixed(2)}
                </div>
            </div>

            {/* Deal Details */}
            <div className="px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                        <span className="text-[8px] text-muted-foreground/60 uppercase font-black">Volume</span>
                        <span className="text-xs font-mono text-foreground/80 font-bold">{deal.volume.toFixed(2)}</span>
                    </div>
                    <div className="w-px h-6 bg-border/50" />
                    <div className="flex flex-col">
                        <span className="text-[8px] text-muted-foreground/60 uppercase font-black">Exit Price</span>
                        <span className="text-xs font-mono text-foreground/80 font-bold">{deal.price.toFixed(5)}</span>
                    </div>
                </div>

                <div className="text-right">
                    <div className="text-[8px] text-muted-foreground/60 uppercase font-black flex items-center gap-1 justify-end">
                        <Calendar size={8} />
                        {new Date(deal.time * 1000).toLocaleDateString()}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                        {new Date(deal.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>

            {/* Footer: AI & Focus */}
            <div className="flex items-center border-t border-border/30">
                <button onClick={handleFocus} className="flex-1 py-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground border-r border-border/30 uppercase tracking-tighter flex items-center justify-center gap-1">
                    <Target size={12} />
                    View Chart
                </button>
                <button
                    onClick={() => onAnalyze?.(deal)}
                    disabled={!analyzeEnabled}
                    className={cn(
                        "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-tighter flex items-center justify-center gap-1",
                        analysisResult
                            ? "text-blue-400 bg-blue-500/5"
                            : analyzeEnabled
                                ? "text-muted-foreground hover:text-blue-400"
                                : "text-muted-foreground/40 cursor-not-allowed"
                    )}
                    title={analyzeEnabled ? "AI Analyze" : "Disabled in this release"}
                >
                    <Bot size={12} />
                    {analysisResult ? "Analyzed" : analyzeEnabled ? "AI Analyze" : "Disabled"}
                </button>
            </div>
        </div>
    );
}
