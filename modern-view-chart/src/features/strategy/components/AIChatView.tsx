import React, { useState, useEffect, useRef } from 'react';
import { Send, Terminal, MessageSquare, BrainCircuit, Loader2, Clock, ShieldCheck, History } from 'lucide-react';

interface ChatMessage {
    id: string;
    source: 'chat' | 'system';
    prompt: string;
    response: string;
    timestamp: number;
}

export function AIChatView() {
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
    const fetchHistory = async () => {
        if (!hasAccessToken) {
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
    };

    useEffect(() => {
        if (!hasAccessToken) {
            setIsLoading(false);
            return;
        }
        fetchHistory();
        const interval = setInterval(fetchHistory, 5000); // Polling logs
        return () => clearInterval(interval);
    }, [hasAccessToken]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, mode]);

    const handleSend = async () => {
        if (!hasAccessToken || !inputValue.trim() || isSending) return;

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
                <div className="flex items-center gap-2">
                    <BrainCircuit size={16} className="text-blue-500 animate-pulse" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-foreground">AI Assistant</span>
                </div>
                <div className="flex bg-secondary/80 p-0.5 rounded-md border border-border">
                    <button
                        onClick={() => setMode('chat')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold transition-all ${mode === 'chat' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <MessageSquare size={12} /> CHAT
                    </button>
                    <button
                        onClick={() => setMode('logs')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold transition-all ${mode === 'logs' ? 'bg-secondary-foreground/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Terminal size={12} /> LOGS
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar" ref={scrollRef}>
                {isLoading && messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-20 gap-3">
                        <Loader2 size={32} className="animate-spin" />
                        <span className="text-xs uppercase font-black">Connecting to Gemini...</span>
                    </div>
                ) : !hasAccessToken ? (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-40 gap-3 text-center">
                        <ShieldCheck size={36} />
                        <span className="text-[11px] uppercase font-black max-w-[220px]">Sign in to use AI Assistant</span>
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
                                                <span className="text-[10px] font-black uppercase tracking-tight">Gemini AI</span>
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
                                                <span className="text-[9px] font-black uppercase tracking-tighter">System Audit Log</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-muted-foreground text-[9px] font-mono">
                                                <Clock size={10} />
                                                {new Date(msg.timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                        <div className="text-[11px] text-muted-foreground font-medium pl-2 border-l border-border italic">
                                            "{msg.prompt.substring(0, 100)}..."
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
                            disabled={!hasAccessToken || isSending || !inputValue.trim()}
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
