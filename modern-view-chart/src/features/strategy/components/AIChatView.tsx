import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Terminal, MessageSquare, BrainCircuit, Loader2, Clock, ShieldCheck, History } from 'lucide-react';

interface ChatMessage {
    id: string;
    source: 'chat' | 'system';
    prompt: string;
    response: string;
    timestamp: number;
}

export function AIChatView() {
    const aiEnabled = false;
    const [mode, setMode] = useState<'chat' | 'logs'>('chat');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const hasAccessToken =
        typeof window !== 'undefined' &&
        Boolean((localStorage.getItem('auth_access_token') || '').trim());

    // Fetch history on mount and when switching to logs
    const fetchHistory = useCallback(async () => {
        if (!hasAccessToken || !aiEnabled) {
            setIsLoading(false);
            return;
        }
        try {
            const res = await fetch('/api/ai/bridge/history');
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (err) {
            console.error('Failed to fetch AI history:', err);
        } finally {
            setIsLoading(false);
        }
    }, [hasAccessToken, aiEnabled]);

    useEffect(() => {
        if (!hasAccessToken) {
            setIsLoading(false);
            return;
        }
        fetchHistory();
        const interval = setInterval(fetchHistory, 5000); // Polling logs
        return () => clearInterval(interval);
    }, [hasAccessToken, fetchHistory]);

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

        try {
            const res = await fetch('/api/ai/bridge/task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, source: 'chat' })
            });

            if (res.ok) {
                await fetchHistory();
            }
        } catch (err) {
            console.error('Chat error:', err);
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
                {/* FORCE DISPLAY FOR MOCKUP SCREENSHOT */}
                {true ? (
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
