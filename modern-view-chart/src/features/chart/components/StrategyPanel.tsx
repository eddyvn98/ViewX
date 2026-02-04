
import React, { useState } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { useMarketStore } from '@/lib/store';
import { Bot, Sparkles, TrendingUp, ArrowRight, Play, CheckCircle } from 'lucide-react';

export function StrategyPanel() {
    const { sendMessage } = useWebSocket();
    const activeTab = useMarketStore(state => state.activeTabId);
    const tabs = useMarketStore(state => state.tabs);
    const optimizationResult = useMarketStore(state => state.optimizationResult);

    const [isOptimizing, setIsOptimizing] = useState(false);

    const activeSymbol = activeTab ? tabs[activeTab]?.activeChartId ? tabs[activeTab].charts[tabs[activeTab].activeChartId].symbol : 'XAUUSDm' : 'XAUUSDm';

    const handleOptimize = () => {
        setIsOptimizing(true);
        // Reset previous result? Maybe not needed if we want to compare.
        // But for UX, set loading state.

        sendMessage({
            topic: "request_optimization",
            symbol: activeSymbol,
            timeframe: "1m"
        });

        // Timeout to stop loading if no response
        setTimeout(() => setIsOptimizing(false), 5000); // 5s timeout safety
    };

    // Auto-stop loading when result arrives
    React.useEffect(() => {
        if (optimizationResult && isOptimizing) {
            setIsOptimizing(false);
        }
    }, [optimizationResult]);

    return (
        <div className="flex flex-col h-full bg-[#1e222d] text-[#d1d4dc] p-4 gap-4">
            <div className="flex items-center gap-2 border-b border-[#2a2e39] pb-3">
                <Bot className="text-blue-500" size={20} />
                <h2 className="font-bold text-sm tracking-wide">AI Strategy Optimizer</h2>
            </div>

            <div className="flex flex-col gap-2">
                <span className="text-xs text-[#787b86]">Target Symbol</span>
                <div className="bg-[#2a2e39] p-2 rounded text-sm font-bold flex justify-between items-center">
                    {activeSymbol}
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">M1</span>
                </div>
            </div>

            {/* Current Strategy Info (Mocked/Default) */}
            <div className="flex flex-col gap-2">
                <span className="text-xs text-[#787b86]">Current Parameters</span>
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#2a2e39] p-2 rounded flex flex-col items-center">
                        <span className="text-[10px] text-[#787b86]">RSI Buy</span>
                        <span className="font-bold text-red-400">30</span>
                    </div>
                    <div className="bg-[#2a2e39] p-2 rounded flex flex-col items-center">
                        <span className="text-[10px] text-[#787b86]">RSI Sell</span>
                        <span className="font-bold text-green-400">70</span>
                    </div>
                </div>
            </div>

            <div className="h-px bg-[#2a2e39] my-2" />

            {/* Results Area */}
            {optimizationResult ? (
                <div className="flex flex-col gap-3 animate-in fade-in zoom-in duration-300">
                    <div className="flex items-center gap-2 text-green-400">
                        <Sparkles size={16} />
                        <span className="text-xs font-bold uppercase">Optimization Complete</span>
                    </div>

                    <div className="bg-green-500/10 border border-green-500/30 rounded p-3 flex flex-col gap-2">
                        <div className="flex justify-between items-end border-b border-green-500/20 pb-2">
                            <span className="text-xs text-green-300">Winrate Improvement</span>
                            <span className="text-lg font-bold text-green-400">{optimizationResult.improvement}</span>
                        </div>

                        <div className="flex justify-between items-center">
                            <span className="text-xs text-[#787b86]">PnL (Simulated)</span>
                            <span className={`text-sm font-bold ${optimizationResult.metrics.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {optimizationResult.metrics.pnl.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-[#787b86]">Total Trades</span>
                            <span className="text-sm font-bold">{optimizationResult.metrics.trades}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <span className="text-xs text-[#787b86]">Recommended Parameters</span>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-[#2a2e39] border border-green-500/50 p-2 rounded flex flex-col items-center relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-green-500/50" />
                                <span className="text-[10px] text-[#787b86]">RSI Buy</span>
                                <span className="font-bold text-white text-lg">{optimizationResult.best_params.rsi_buy}</span>
                            </div>
                            <div className="bg-[#2a2e39] border border-green-500/50 p-2 rounded flex flex-col items-center relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-green-500/50" />
                                <span className="text-[10px] text-[#787b86]">RSI Sell</span>
                                <span className="font-bold text-white text-lg">{optimizationResult.best_params.rsi_sell}</span>
                            </div>
                        </div>
                    </div>

                    <button className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded font-bold text-xs flex items-center justify-center gap-2 mt-2 transition-colors">
                        <CheckCircle size={14} />
                        Apply New Parameters
                    </button>
                    <span className="text-[10px] text-zinc-500 text-center">Applies to auto-trading bot immediately</span>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center opacity-50 py-10">
                    <TrendingUp size={40} className="text-[#363a45]" />
                    <span className="text-xs max-w-[200px]">Run AI to analyze recent price action and find optimal parameters.</span>
                </div>
            )}

            <button
                onClick={handleOptimize}
                disabled={isOptimizing}
                className={`mt-auto w-full p-3 rounded font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all ${isOptimizing ? 'bg-[#2a2e39] text-[#787b86] cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20'}`}
            >
                {isOptimizing ? (
                    <>
                        <div className="w-4 h-4 border-2 border-[#787b86] border-t-transparent rounded-full animate-spin" />
                        Analyzing...
                    </>
                ) : (
                    <>
                        <Play size={16} fill="currentColor" />
                        Run Optimizer
                    </>
                )}
            </button>
        </div>
    );
}
