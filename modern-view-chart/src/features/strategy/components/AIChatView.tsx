import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Terminal, MessageSquare, BrainCircuit, Loader2, Clock, ShieldCheck, History } from 'lucide-react';
import { useMarketStore } from '@/lib/store';
import { useStrategyStore } from '../store/strategy-store';
import type { Strategy, VirtualPosition } from '../types';

interface ChatMessage {
    id: string;
    source: 'chat' | 'system';
    prompt: string;
    response: string;
    timestamp: number;
}

export function AIChatView() {
    const aiEnabled = process.env.NEXT_PUBLIC_AI_ENABLED === '1' || process.env.NEXT_PUBLIC_AI_ENABLED === 'true';
    const [mode, setMode] = useState<'chat' | 'logs'>('chat');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [remainingCredits, setRemainingCredits] = useState<number | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [friendlyError, setFriendlyError] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const marketStore = useMarketStore();
    const { strategies, virtualPositions, signals } = useStrategyStore();
    const hasAccessToken =
        typeof window !== 'undefined' &&
        Boolean((localStorage.getItem('auth_access_token') || '').trim());

    const getAuthHeaders = useCallback(() => {
        if (typeof window === 'undefined') return null;
        const token = (localStorage.getItem('auth_access_token') || '').trim();
        if (!token) return null;
        return {
            authorization: `Bearer ${token}`,
        };
    }, []);

    const getAuthUserId = useCallback(() => {
        if (typeof window === 'undefined') return '';
        const raw = localStorage.getItem('auth_user') || '';
        if (!raw) return '';
        try {
            const parsed = JSON.parse(raw);
            return String(parsed?._id || parsed?.id || '').trim();
        } catch {
            return '';
        }
    }, []);

    // Fetch history on mount and when switching to logs
    const fetchHistory = useCallback(async () => {
        if (!hasAccessToken || !aiEnabled) {
            return;
        }
        try {
            const headers = getAuthHeaders();
            if (!headers) return;
            const res = await fetch('/api/ai/bridge/history', { headers, credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (err) {
            console.error('Failed to fetch AI history:', err);
        } finally {
            // no-op
        }
    }, [hasAccessToken, aiEnabled, getAuthHeaders]);

    const fetchCredits = useCallback(async () => {
        if (!hasAccessToken || !aiEnabled) return;
        try {
            const headers = getAuthHeaders();
            if (!headers) return;
            const res = await fetch('/api/user/ai-credits', { headers, credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            if (typeof data?.remainingCredits === 'number') {
                setRemainingCredits(data.remainingCredits);
            }
        } catch (err) {
            console.error('Failed to fetch AI credits:', err);
        }
    }, [hasAccessToken, aiEnabled, getAuthHeaders]);

    useEffect(() => {
        if (!hasAccessToken) {
            return;
        }
        fetchHistory();
        fetchCredits();
        const interval = setInterval(fetchHistory, 5000); // Polling logs
        return () => clearInterval(interval);
    }, [hasAccessToken, fetchHistory, fetchCredits]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, mode]);

    const handleSend = async () => {
        if (!hasAccessToken || !aiEnabled || !inputValue.trim() || isSending) return;

        const prompt = inputValue;
        setInputValue('');
        setIsSending(true);
        setFriendlyError(null);

        try {
            const headers = getAuthHeaders();
            if (!headers) return;
            const userId = getAuthUserId();
            const localContext = buildLocalContextPack(prompt, marketStore, strategies, virtualPositions, signals);
            const contextRes = await fetch('/api/ai/bridge/context', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                credentials: 'include',
                body: JSON.stringify({
                    question: prompt,
                    chart: localContext.chart,
                    strategy: localContext.strategy,
                    latestSignals: localContext.latestSignals,
                    lastTrade: localContext.lastTrade,
                    openPositions: localContext.openPositions,
                    ...(userId ? { userId } : {})
                })
            });
            const serverContext = contextRes.ok ? await contextRes.json().catch(() => null) : null;
            const contextualPrompt = buildContextualPrompt(prompt, serverContext?.context || localContext);
            const res = await fetch('/api/ai/bridge/task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                credentials: 'include',
                body: JSON.stringify({ prompt: contextualPrompt, source: 'chat', ...(userId ? { userId } : {}) })
            });

            if (res.ok) {
                const data = await res.json();
                if (typeof data?.remainingCredits === 'number') {
                    setRemainingCredits(data.remainingCredits);
                }
                await fetchHistory();
            } else {
                const errData = await res.json().catch(() => null);
                const userMessage = String(errData?.user_message || '').trim();
                const msg = String(errData?.msg || '').trim();
                if (userMessage) {
                    setFriendlyError(userMessage);
                } else if (msg === 'prompt_blocked_by_policy' || msg === 'response_blocked_by_policy') {
                    setFriendlyError('Yeu cau khong phu hop chinh sach an toan. Vui long hoi ve giao dich va cach su dung Vivutrade.');
                } else {
                    setFriendlyError('Khong the xu ly yeu cau luc nay. Vui long thu lai sau.');
                }
                await fetchCredits();
            }
        } catch (err) {
            console.error('Chat error:', err);
            setFriendlyError('Ket noi AI tam thoi gian doan. Vui long thu lai sau.');
        } finally {
            setIsSending(false);
        }
    };

    const chatMessages = messages.filter(m => m.source === 'chat');
    const systemLogs = messages.filter(m => m.source === 'system');

    return (
        <div className="flex flex-col h-full bg-secondary/20 rounded-lg border border-border overflow-hidden">
            {/* Inner Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-secondary/60 border-b border-border">
                <div className="flex items-center gap-1.5 shrink-0">
                    <BrainCircuit size={16} className="text-primary animate-pulse" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-foreground whitespace-nowrap">AI Assistant</span>
                    {aiEnabled && remainingCredits !== null && (
                        <span className="ml-2 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                            Credits: {remainingCredits}
                        </span>
                    )}
                </div>
                <div className="flex bg-secondary/80 p-0.5 rounded-md border border-border">
                    <button
                        onClick={() => setMode('chat')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-bold transition-all ${mode === 'chat' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <MessageSquare size={12} /> CHAT
                    </button>
                    <button
                        onClick={() => setMode('logs')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-bold transition-all ${mode === 'logs' ? 'bg-secondary-foreground/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Terminal size={12} /> LOGS
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar" ref={scrollRef}>
                {friendlyError && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-300">
                        {friendlyError}
                    </div>
                )}
                {/* FORCE DISPLAY FOR MOCKUP SCREENSHOT */}
                {!aiEnabled ? (
                    <div className="flex-1 flex flex-col p-4 relative overflow-hidden group">
                        {/* Background glow */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
                        
                        {/* Vision Active Status */}
                        <div className="flex items-center justify-between mb-6 relative z-10">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                                <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_var(--glow-primary)]" />
                                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Vision Active</span>
                            </div>
                            <ShieldCheck size={16} className="text-primary/50" />
                        </div>

                        {/* Chat Messages Mock */}
                        <div className="flex-1 flex flex-col gap-4 relative z-10">
                            {/* User Request */}
                            <div className="self-end max-w-[85%] bg-primary/10 backdrop-blur-md border border-primary/20 rounded-2xl rounded-tr-sm p-3 shadow-sm">
                                <p className="text-[12px] text-foreground">Phân tích giúp tôi setup XAUUSD hiện tại trên màn hình. Có nên Long không?</p>
                            </div>

                            {/* AI Response with Vision Context */}
                            <div className="self-start max-w-[95%] bg-card/90 backdrop-blur-xl border border-border rounded-2xl rounded-tl-sm p-5 shadow-lg ring-1 ring-border/50">
                                <div className="flex items-center gap-2 mb-4 drop-shadow-sm">
                                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                        <BrainCircuit size={16} />
                                    </div>
                                    <span className="text-[12px] font-black uppercase tracking-widest text-primary">Premium AI</span>
                                </div>
                                
                                <div className="space-y-4 text-[13px] text-muted-foreground leading-relaxed">
                                    <p>Tôi đã phân tích hình ảnh biểu đồ XAUUSD khung 15m của bạn.</p>
                                    
                                    <div className="pl-3 border-l-2 border-primary/40 space-y-2">
                                        <p className="flex items-start gap-2">
                                            <span className="text-primary font-bold mt-0.5">•</span>
                                            <span><strong className="text-foreground">Hành vi giá:</strong> Cây nến hiện tại vừa tạo một cụm Pinbar rút râu mạnh tại vùng cản 2345.0.</span>
                                        </p>
                                        <p className="flex items-start gap-2">
                                            <span className="text-cyan-600 dark:text-cyan-400 font-bold mt-0.5">•</span>
                                            <span><strong className="text-foreground">Chỉ báo RSI:</strong> Phân kỳ đáy rsi (đường màu tím) đang hình thành ở mức 32.</span>
                                        </p>
                                    </div>

                                    <div className="p-3 mt-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400">
                                        <p className="font-bold text-[12px] uppercase mb-1">💡 Đề xuất giao dịch</p>
                                        <p className="text-[12px] opacity-90">Có thể mở vị thế Long quanh 2346. Stoploss an toàn đặt dưới râu nến tại 2342.</p>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Demo Overlay for article link */}
                             <div className="mt-auto pt-6 w-full flex justify-center pb-2">
                                <a 
                                    href="/en/premium-ai" 
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-2"
                                >
                                    Đọc Chi Tiết Thiết Kế
                                </a>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {mode === 'chat' && (
                            chatMessages.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center opacity-10 gap-2 text-center">
                                    <MessageSquare size={48} />
                                    <span className="text-[11px] uppercase font-black max-w-[200px]">Start a conversation with Gemini Flash 2.5</span>
                                </div>
                            ) : (
                                chatMessages.map((msg) => (
                                    <div key={msg.id} className="flex flex-col gap-3">
                                        <div className="self-end max-w-[85%] bg-blue-600/10 border border-blue-500/20 rounded-2xl rounded-tr-none p-3 text-[13px] text-foreground leading-relaxed shadow-sm">
                                            {msg.prompt}
                                        </div>
                                        <div className="self-start max-w-[90%] bg-secondary/40 border border-border rounded-2xl rounded-tl-none p-4 text-[13px] text-foreground leading-relaxed shadow-lg flex flex-col gap-2">
                                            <div className="flex items-center gap-2 mb-1 opacity-50">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                <span className="text-[11px] font-black uppercase tracking-tight">Gemini AI</span>
                                            </div>
                                            {msg.response}
                                        </div>
                                    </div>
                                ))
                            )
                        )}

                        {mode === 'logs' && (
                            systemLogs.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center opacity-10 gap-2 text-center">
                                    <History size={48} />
                                    <span className="text-[11px] uppercase font-black">No system communication logs yet</span>
                                </div>
                            ) : (
                                systemLogs.map((msg) => (
                                    <div key={msg.id} className="bg-secondary/20 rounded border border-border p-3 flex flex-col gap-2 group hover:bg-secondary/30 transition-colors">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2 text-cyan-500/80">
                                                <ShieldCheck size={12} />
                                                <span className="text-[11px] font-black uppercase tracking-tighter">System Audit Log</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-mono">
                                                <Clock size={10} />
                                                {new Date(msg.timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                        <div className="text-[11px] text-muted-foreground font-medium pl-2 border-l border-border italic">
                                            &quot;{msg.prompt.substring(0, 100)}...&quot;
                                        </div>
                                        <div className="text-[11px] text-blue-400/80 bg-blue-500/5 p-2 rounded border border-blue-500/10 font-mono leading-tight">
                                            {msg.response.substring(0, 200)}...
                                        </div>
                                    </div>
                                ))
                            )
                        )}
                    </>
                )}
            </div>

            {/* Input - Only for Chat Mode */}
            {mode === 'chat' && (
                <div className="p-3 bg-secondary/80 border-t border-border">
                    <div className="relative flex items-center gap-2">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Ask anything..."
                            className="flex-1 bg-secondary border border-border rounded-full py-2.5 px-5 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-blue-500/50 transition-all pr-12"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!hasAccessToken || !aiEnabled || isSending || !inputValue.trim()}
                            className="absolute right-1 w-9 h-9 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-30 disabled:hover:bg-blue-600 transition-all shadow-lg active:scale-90"
                        >
                            {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

type MarketStoreSnapshot = ReturnType<typeof useMarketStore.getState>;

function detectIntent(prompt: string): 'entry' | 'strategy_tuning' | 'trade_review' | 'general' {
    const text = prompt.toLowerCase();
    if (/(vao lenh|vào lệnh|buy|sell|co nen mua|có nên mua|co nen ban|có nên bán|entry)/i.test(text)) return 'entry';
    if (/(chien luoc|chiến lược|toi uu|tối ưu|thay doi gi|thay đổi gì|optimize|improve)/i.test(text)) return 'strategy_tuning';
    if (/(lenh vua|lệnh vừa|thang|thắng|thua|hoa von|hòa vốn|exit|dong lenh|đóng lệnh)/i.test(text)) return 'trade_review';
    return 'general';
}

function pickTargetStrategy(prompt: string, strategies: Strategy[]): Strategy | null {
    if (!strategies.length) return null;
    const text = prompt.toLowerCase();
    const exact = strategies.find((s) => text.includes((s.name || '').toLowerCase()));
    if (exact) return exact;
    return strategies.find((s) => s.active && s.aiGuard) || strategies.find((s) => s.active) || strategies[0] || null;
}

function getActiveChartContext(state: MarketStoreSnapshot) {
    const activeTab = state.tabs[state.activeTabId];
    if (!activeTab || !activeTab.activeChartId) return null;
    const chart = activeTab.charts[activeTab.activeChartId];
    if (!chart) return null;
    const key = `${chart.source}:${chart.symbol}:${chart.interval}`;
    const candles = state.candleData[key] || [];
    const recentCandles = candles.slice(-20).map((c) => ({
        t: c.time,
        o: Number(c.open),
        h: Number(c.high),
        l: Number(c.low),
        c: Number(c.close),
        v: Number(c.volume || 0),
    }));
    const runtime = state.chartIndicatorRuntime[chart.id] || [];
    const indicatorRuntime = runtime.map((ind) => {
        const r = ind.results;
        if (Array.isArray(r)) {
            return { type: ind.type, params: ind.params || {}, last: Number(r[r.length - 1] || 0) };
        }
        const compact = Object.fromEntries(
            Object.entries(r || {}).map(([k, arr]) => [k, Number((Array.isArray(arr) ? arr[arr.length - 1] : 0) || 0)])
        );
        return { type: ind.type, params: ind.params || {}, last: compact };
    });

    return {
        symbol: chart.symbol,
        timeframe: chart.interval,
        source: chart.source,
        candlesCount: candles.length,
        lastPrice: recentCandles.length ? recentCandles[recentCandles.length - 1].c : null,
        recentOhlc: recentCandles,
        indicators: indicatorRuntime,
    };
}

function summarizePosition(pos: VirtualPosition) {
    return {
        strategyId: pos.strategyId,
        symbol: pos.symbol,
        side: pos.type,
        status: pos.status,
        entryPrice: pos.entryPrice,
        exitPrice: pos.exitPrice ?? null,
        pnl: pos.pnl ?? null,
        confidence: pos.confidence ?? null,
        entryTime: pos.timestamp,
        exitTime: pos.exitTimestamp ?? null,
        metadata: pos.metadata || null,
    };
}

function buildLocalContextPack(
    userPrompt: string,
    marketState: MarketStoreSnapshot,
    strategies: Strategy[],
    virtualPositions: VirtualPosition[],
    signals: Array<{ strategyId: string; symbol: string; type: string; timestamp: number; price: number }>
) {
    const intent = detectIntent(userPrompt);
    const chartContext = getActiveChartContext(marketState);
    const strategy = pickTargetStrategy(userPrompt, strategies);
    const lastPosition = [...virtualPositions].sort((a, b) => b.timestamp - a.timestamp)[0];
    const latestSignals = [...signals]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5)
        .map((s) => ({ strategyId: s.strategyId, symbol: s.symbol, type: s.type, timestamp: s.timestamp, price: s.price }));

    const strategyContext = strategy
        ? {
            id: strategy.id,
            name: strategy.name,
            active: strategy.active,
            aiGuard: !!strategy.aiGuard,
            symbol: strategy.symbol || null,
            timeframe: strategy.timeframe || null,
            executionMode: strategy.executionMode,
            entryType: strategy.entryType,
            positionMode: strategy.positionMode,
            buyRules: strategy.buy?.entry || strategy.entry || null,
            sellRules: strategy.sell?.entry || strategy.entry || null,
            riskBuy: strategy.buy?.risk || strategy.risk || null,
            riskSell: strategy.sell?.risk || strategy.risk || null,
        }
        : null;

    return {
        intent,
        chart: chartContext,
        strategy: strategyContext,
        latestSignals,
        lastTrade: lastPosition ? summarizePosition(lastPosition) : null,
        openPositions: virtualPositions.filter((p) => p.status === 'open').slice(-5).map(summarizePosition),
        now: new Date().toISOString(),
    };
}

function buildContextualPrompt(userPrompt: string, contextPack: unknown) {
    return [
        'You are Vivutrade Trading AI. Use only CONTEXT_JSON for concrete analysis and avoid generic advice.',
        'If context is missing, explicitly state what data is missing and do not fabricate.',
        'Answer in Vietnamese, concise and practical.',
        'Required output sections:',
        '1) Ket luan',
        '2) Do tu tin (0-100) + ly do du lieu',
        '3) Muc vao/SL/TP tham khao (neu co du lieu)',
        '4) Rui ro chinh',
        '5) Dieu can bo sung neu chua du du lieu',
        '',
        'CONTEXT_JSON:',
        JSON.stringify(contextPack),
        '',
        'USER_QUESTION:',
        userPrompt,
    ].join('\n');
}
