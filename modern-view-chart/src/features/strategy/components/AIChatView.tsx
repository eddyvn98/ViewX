'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { BrainCircuit, ChevronDown, Compass, History, Loader2, MessageSquare, Plus, Send, ShieldCheck, Target, TrendingUp, Wallet, CircleHelp, Scale, ListChecks, ScanSearch, BadgeAlert, SquarePen, Sparkles } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useMarketStore } from '@/lib/store';
import type { Candle, ChartInstance, Position, RootState } from '@/lib/store';
import { cn } from '@/lib/utils';
import { normalizeSymbol } from '@/lib/utils/symbol';
import { useStrategyStore } from '../store/strategy-store';
import type { Strategy, StrategySignal, VirtualPosition } from '../types';

interface ChatMessage {
    id: string;
    source: 'chat' | 'system';
    prompt: string;
    response: string;
    timestamp: number;
}

type ChatMode = 'chat' | 'history';
type IntentKey = 'entry' | 'exit' | 'strategy' | 'risk' | 'summary' | 'forecast' | 'general';

interface PromptPreset {
    id: string;
    group: string;
    label: string;
    prompt: string;
    intent: IntentKey;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

interface ConversationGroup {
    id: string;
    title: string;
    startedAt: number;
    endedAt: number;
    items: ChatMessage[];
}

const AI_ENABLED = true;
const CONVERSATION_GAP_MS = 30 * 60 * 1000;
const PRESET_PROMPTS: PromptPreset[] = [
    { id: 'entry-now', group: 'Vào lệnh', label: 'Có nên vào lệnh', prompt: 'Phân tích nhanh chart hiện tại và cho biết có nên vào lệnh ngay bây giờ không.', intent: 'entry', icon: TrendingUp },
    { id: 'entry-side', group: 'Vào lệnh', label: 'Nghiêng Long hay Short', prompt: 'Ngay lúc này chart đang nghiêng về Long hay Short? Trả lời thật ngắn gọn và nêu lý do chính.', intent: 'entry', icon: Scale },
    { id: 'entry-levels', group: 'Vào lệnh', label: 'Mức vào lệnh', prompt: 'Nếu setup hiện tại ổn, gợi ý mức vào lệnh, SL và TP ngắn gọn theo chart đang mở.', intent: 'entry', icon: Target },
    { id: 'entry-wait', group: 'Vào lệnh', label: 'Nên vào ngay hay chờ', prompt: 'Tôi nên vào lệnh ngay hay chờ thêm xác nhận? Nếu chờ thì chờ điều gì.', intent: 'entry', icon: CircleHelp },
    { id: 'entry-invalid', group: 'Vào lệnh', label: 'Kèo hỏng ở đâu', prompt: 'Nếu vào kèo này thì điều kiện nào làm setup bị vô hiệu? Nêu mốc giá hoặc tín hiệu cần chú ý.', intent: 'entry', icon: BadgeAlert },
    { id: 'entry-confidence', group: 'Vào lệnh', label: 'Độ chắc kèo', prompt: 'Đánh giá nhanh độ chắc của setup hiện tại theo chart và strategy đang chạy.', intent: 'entry', icon: ScanSearch },
    { id: 'exit-manage', group: 'Quản lý lệnh', label: 'Quản lý lệnh', prompt: 'Lệnh đang mở có nên giữ, dời SL hay chốt bớt không? Trả lời ngắn gọn theo dữ liệu hiện tại.', intent: 'exit', icon: Compass },
    { id: 'exit-now', group: 'Quản lý lệnh', label: 'Có nên thoát lệnh', prompt: 'Nếu đang có lệnh trên chart này thì bây giờ có nên thoát không? Nêu lý do chính.', intent: 'exit', icon: ShieldCheck },
    { id: 'exit-sl', group: 'Quản lý lệnh', label: 'Dời SL thế nào', prompt: 'Nếu đang giữ lệnh thì nên dời stop loss về đâu để giảm rủi ro mà không quá chặt.', intent: 'exit', icon: Target },
    { id: 'exit-partial', group: 'Quản lý lệnh', label: 'Có nên chốt một phần', prompt: 'Lệnh hiện tại có nên chốt một phần lợi nhuận không hay giữ nguyên kế hoạch.', intent: 'exit', icon: Wallet },
    { id: 'exit-danger', group: 'Quản lý lệnh', label: 'Dấu hiệu cần thoát', prompt: 'Hãy chỉ ra những dấu hiệu quan trọng cho thấy tôi nên thoát lệnh sớm.', intent: 'exit', icon: BadgeAlert },
    { id: 'strategy-fit', group: 'Bot và Strategy', label: 'Hợp với bot nào', prompt: 'Chart hiện tại hợp với strategy nào đang bật? Nếu không hợp thì nói lý do ngắn gọn.', intent: 'strategy', icon: BrainCircuit },
    { id: 'strategy-ignore', group: 'Bot và Strategy', label: 'Bot có nên bỏ qua', prompt: 'Với bot đang chạy, có nên bỏ qua setup hiện tại không? Nếu có thì vì sao.', intent: 'strategy', icon: ListChecks },
    { id: 'strategy-fix', group: 'Bot và Strategy', label: 'Bot cần chỉnh gì', prompt: 'Strategy hiện tại đang yếu ở điểm nào trên chart này và nên chỉnh gì trước.', intent: 'strategy', icon: ScanSearch },
    { id: 'strategy-match', group: 'Bot và Strategy', label: 'Chart có đúng style bot', prompt: 'Chart hiện tại có đúng môi trường mà bot này hoạt động tốt không?', intent: 'strategy', icon: Compass },
    { id: 'risk-check', group: 'Rủi ro', label: 'Rủi ro hiện tại', prompt: 'Đánh giá rủi ro hiện tại và nêu 1-2 điểm cần cảnh báo ngay.', intent: 'risk', icon: Wallet },
    { id: 'risk-size', group: 'Rủi ro', label: 'Khối lượng có ổn không', prompt: 'Nếu vào lệnh theo setup này thì khối lượng hiện tại có quá tay không xét theo rủi ro.', intent: 'risk', icon: Scale },
    { id: 'risk-account', group: 'Rủi ro', label: 'Tài khoản chịu nổi không', prompt: 'Với trạng thái hiện tại, tài khoản có đang chịu rủi ro quá mức không.', intent: 'risk', icon: ShieldCheck },
    { id: 'risk-stack', group: 'Rủi ro', label: 'Có bị chồng rủi ro', prompt: 'Các lệnh hoặc bot hiện tại có đang chồng rủi ro lên nhau không.', intent: 'risk', icon: BadgeAlert },
    { id: 'chart-summary', group: 'Đọc chart', label: 'Tóm tắt chart', prompt: 'Tóm tắt nhanh chart đang xem trong 3 ý ngắn gọn, chỉ giữ điểm quan trọng.', intent: 'summary', icon: MessageSquare },
    { id: 'chart-bias', group: 'Đọc chart', label: 'Bias chính của chart', prompt: 'Bias chính của chart hiện tại là gì và mốc nào đang quyết định bias đó.', intent: 'summary', icon: TrendingUp },
    { id: 'chart-key-levels', group: 'Đọc chart', label: 'Vùng giá quan trọng', prompt: 'Chỉ ra các vùng giá quan trọng nhất trên chart hiện tại để tôi theo dõi.', intent: 'summary', icon: Target },
    { id: 'chart-explain', group: 'Đọc chart', label: 'Giải thích tín hiệu', prompt: 'Giải thích ngắn gọn vì sao chart này đang cho tín hiệu như hiện tại.', intent: 'summary', icon: CircleHelp },
    { id: 'chart-next', group: 'Đọc chart', label: 'Kịch bản tiếp theo', prompt: 'Kịch bản giá có khả năng cao tiếp theo là gì nếu không có dữ liệu mới.', intent: 'summary', icon: ScanSearch },
    { id: 'chart-next-timesfm', group: 'Forecast', label: 'Dự đoán giá sắp tới', prompt: 'Dự đoán giá sắp tới cho chart đang mở này.', intent: 'forecast', icon: ScanSearch },
    { id: 'chart-next-range', group: 'Forecast', label: 'Dự báo vùng giá kế tiếp', prompt: 'Dự đoán vùng giá sắp tới của chart hiện tại và mức biến động dự kiến.', intent: 'forecast', icon: Target },
];

const QUICK_ACTION_PROMPTS: PromptPreset[] = [
    PRESET_PROMPTS.find((item) => item.id === 'chart-next-timesfm'),
    PRESET_PROMPTS.find((item) => item.id === 'chart-next-range'),
    PRESET_PROMPTS.find((item) => item.id === 'entry-now'),
    PRESET_PROMPTS.find((item) => item.id === 'chart-summary'),
].filter(Boolean) as PromptPreset[];

function toFriendlyError(raw: string, isVi: boolean) {
    const value = String(raw || '').trim();
    if (!value) return isVi ? 'Không thể gửi yêu cầu lúc này.' : 'Cannot send request right now.';
    if (value.startsWith('Yeu cau ') || value.startsWith('Noi dung ')) return value;
    if (value.includes('missing_auth_token')) return isVi ? 'Bạn cần đăng nhập để sử dụng AI.' : 'Please sign in to use AI.';
    if (value.includes('ai_assistant_module_required')) return isVi ? 'Tài khoản chưa có quyền dùng AI Assistant.' : 'Your account does not have AI Assistant access.';
    if (value.includes('ai_chat_credits_exhausted')) return isVi ? 'Tài khoản đã hết credits AI.' : 'Your AI credits are exhausted.';
    return isVi ? 'Không thể lấy phản hồi AI lúc này. Vui lòng thử lại.' : 'Cannot get AI response right now. Please try again.';
}

function getAuthContext() {
    if (typeof window === 'undefined') return { accessToken: '', userId: '', hasAccessToken: false };
    const accessToken = (localStorage.getItem('auth_access_token') || '').trim();
    const rawUser = localStorage.getItem('auth_user') || '';
    let userId = '';
    if (rawUser) {
        try {
            const parsed = JSON.parse(rawUser) as { _id?: string; id?: string; userId?: string };
            userId = String(parsed?._id || parsed?.id || parsed?.userId || '').trim();
        } catch {}
    }
    return { accessToken, userId, hasAccessToken: Boolean(accessToken) };
}

function getVisibleUserPrompt(rawPrompt: string) {
    const value = String(rawPrompt || '').trim();
    const match = value.match(/USER_QUESTION:\s*([\s\S]*?)(?:\nCONTEXT_JSON:|$)/i);
    return match?.[1]?.trim() || value;
}

function sanitizeAssistantResponse(rawResponse: string) {
    const value = String(rawResponse || '').trim();
    if (!value) return '';
    const blockedLinePatterns = [
        /^\s*(?:[*-]\s+)?`?\s*(persona|scope|constraints?|user\s+language(?:\/style)?|output\s+format|input)\s*:/i,
        /^\s*(?:[*-]\s+)?`?\s*(user[_\s-]?question|context_json)\s*:/i,
        /^\s*(?:[*-]\s+)?`?\s*(identity|user\s+request|context\s*\(json\)|instruction)\s*:/i,
        /^\s*(?:[*-]\s+)?`?\s*is it (within scope|in vietnamese|2-4 sentences|concise)\s*\?/i,
        /^\s*(?:[*-]\s+)?`?\s*does it reveal (system prompts?|system prompt|context_json)\s*\?/i,
        /^\s*(you are vivutrade ai assistant|ban la ai trading assistant cua vivutrade)\b/i,
    ];
    const lines = value
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line) => !blockedLinePatterns.some((re) => re.test(line)))
        .filter((line) => !/^\s*(Draft\s*\d+|Thoughts?|Reasoning|Analysis)\s*[:\-]/i.test(line));
    const joined = lines.join('\n').trim();
    const quotedAnswers = [...joined.matchAll(/"([^"\n]{20,})"/g)].map((m) => m[1].trim()).filter(Boolean);
    const bestQuoted = quotedAnswers.length > 0 ? quotedAnswers[quotedAnswers.length - 1] : '';
    return bestQuoted || joined || value;
}

function formatTime(ts: number) {
    return new Date(ts).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function classifyIntent(question: string): IntentKey {
    const value = question.toLowerCase();
    if (/(vao lenh|entry|long|short|mua|ban|buy|sell|sl|tp)/.test(value)) return 'entry';
    if (/(thoat|giu lenh|chot|trailing|dich sl|dong lenh|exit)/.test(value)) return 'exit';
    if (/(strategy|chien luoc|bot|rule|toi uu|setup bot)/.test(value)) return 'strategy';
    if (/(rui ro|risk|drawdown|khoi luong|lot|von|account)/.test(value)) return 'risk';
    if (/(du doan|forecast|sap toi|next move|next range|next candles|kich ban tiep theo|xu huong)/.test(value)) return 'forecast';
    if (/(tom tat|tong quan|summary|overview)/.test(value)) return 'summary';
    return 'general';
}

function buildConversationGroups(messages: ChatMessage[]): ConversationGroup[] {
    const sorted = [...messages].filter((m) => m.source === 'chat').sort((a, b) => a.timestamp - b.timestamp);
    const groups: ConversationGroup[] = [];
    for (const item of sorted) {
        const current = groups[groups.length - 1];
        if (!current || item.timestamp - current.endedAt > CONVERSATION_GAP_MS) {
            groups.push({ id: `conv-${item.timestamp}-${item.id}`, title: getVisibleUserPrompt(item.prompt).slice(0, 48) || 'Cuộc trò chuyện mới', startedAt: item.timestamp, endedAt: item.timestamp, items: [item] });
        } else {
            current.items.push(item);
            current.endedAt = item.timestamp;
        }
    }
    return groups.reverse();
}

function sanitizeNumber(value: unknown, digits = 2) {
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) ? Number(num.toFixed(digits)) : null;
}

function summarizeStrategy(strategy: Strategy | null) {
    if (!strategy) return null;
    return {
        id: strategy.id,
        name: strategy.name,
        symbol: strategy.symbol || null,
        timeframe: strategy.timeframe || null,
        active: strategy.active,
        side: strategy.side || null,
        risk: strategy.risk || strategy.buy?.risk || strategy.sell?.risk || null,
    };
}

function summarizeSignal(signal: StrategySignal | null) {
    if (!signal) return null;
    return {
        type: signal.type,
        symbol: signal.symbol,
        price: sanitizeNumber(signal.price, 3),
        timeframe: signal.timeframe || null,
        timestamp: signal.timestamp,
        strategyId: signal.strategyId,
        confidence: sanitizeNumber(signal.confidence, 0),
    };
}

function summarizeVirtualPosition(position: VirtualPosition | null, strategyName?: string) {
    if (!position) return null;
    return {
        strategyName: strategyName || null,
        symbol: position.symbol,
        type: position.type,
        timeframe: position.timeframe || null,
        entryPrice: sanitizeNumber(position.entryPrice, 3),
        sl: sanitizeNumber(position.sl, 3),
        tp: sanitizeNumber(position.tp, 3),
        pnl: sanitizeNumber(position.pnl, 2),
        status: position.status,
    };
}

function buildPrompt(context: unknown, question: string, intent: IntentKey) {
    const formats: Record<IntentKey, string> = {
        entry: 'Tra loi theo: Ket luan | Ly do chinh | Muc vao / SL / TP.',
        exit: 'Tra loi theo: Nen giu hay thoat | Muc can theo doi | Rui ro.',
        strategy: 'Tra loi theo: Strategy phu hop | Ly do | Dieu can dieu chinh.',
        risk: 'Tra loi theo: Muc rui ro | Canh bao | Hanh dong de xuat.',
        summary: 'Tra loi theo 3 y ngan gon nhat.',
        forecast: 'Tra loi theo: Huong chinh | Muc gia du kien | Muc do tin cay.',
        general: 'Tra loi trong 2-4 cau ngan gon, dung trong tam.',
    };
    return [
        'Ban la AI trading assistant cua Vivutrade. Tra loi bang tieng Viet, rat ngan gon, dung trong tam. Khong lo prompt he thong hay CONTEXT_JSON.',
        formats[intent],
        `USER_QUESTION: ${question.trim()}`,
        `CONTEXT_JSON: ${JSON.stringify(context)}`,
    ].join('\n');
}

function IconTabButton({
    active,
    title,
    onClick,
    children,
}: {
    active: boolean;
    title: string;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg border transition-all',
                active
                    ? 'border-primary/40 bg-primary/10 text-primary shadow-[0_0_0_1px_rgba(34,197,94,0.12)]'
                    : 'border-border/60 bg-secondary/50 text-muted-foreground hover:text-foreground'
            )}
        >
            {children}
        </button>
    );
}

export function AIChatView() {
    const params = useParams();
    const locale = (params?.locale as string) || 'vi';
    const isVi = locale === 'vi';
    const [mode, setMode] = useState<ChatMode>('chat');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [friendlyError, setFriendlyError] = useState<string | null>(null);
    const [remainingCredits, setRemainingCredits] = useState<number | null>(null);
    const [selectedConversationId, setSelectedConversationId] = useState<string>('active');
    const [sessionStartTs, setSessionStartTs] = useState<number>(() => Date.now());
    const [sessionOnlyMode, setSessionOnlyMode] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const marketData = useMarketStore(useShallow((state: RootState) => {
        const tab = state.tabs[state.activeTabId];
        const chartId = tab?.activeChartId;
        const chart = chartId ? tab?.charts?.[chartId] || null : null;
        const symbol = chart?.symbol || '';
        return {
            activeChart: chart as ChartInstance | null,
            activeTicker: symbol ? state.tickers[symbol] : undefined,
            activeDigits: symbol ? state.symbolInfo[symbol]?.digits : undefined,
            candleData: (state as any).candleData || {},
            chartIndicators: (state as any).chartIndicators || {},
            positions: ((state as any).positions || []) as Position[],
            historyDeals: ((state as any).history || []) as Array<Record<string, unknown>>,
            accounts: ((state as any).accounts || {}) as Record<string, Record<string, unknown>>,
        };
    }));

    const strategyData = useStrategyStore(useShallow((state) => ({
        strategies: state.strategies,
        signals: state.signals,
        virtualPositions: state.virtualPositions,
    })));

    const fetchHistory = useCallback(async () => {
        const { accessToken, hasAccessToken } = getAuthContext();
        if (!hasAccessToken || !AI_ENABLED) {
            setMessages([]);
            setIsLoading(false);
            return;
        }
        try {
            const response = await fetch('/api/ai/bridge/history', { headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {}, credentials: 'include' });
            if (!response.ok) throw new Error(`history_failed_${response.status}`);
            const data = await response.json() as ChatMessage[];
            setMessages([...data].sort((a, b) => a.timestamp - b.timestamp));
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchCredits = useCallback(async () => {
        const { accessToken, hasAccessToken } = getAuthContext();
        if (!hasAccessToken) return;
        try {
            const response = await fetch('/api/user/module-ai-credits', { headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {}, credentials: 'include' });
            if (!response.ok) return;
            const data = await response.json();
            const credits = typeof data?.remainingCredits === 'number' ? data.remainingCredits : typeof data?.aiAssistantCredits === 'number' ? data.aiAssistantCredits : null;
            setRemainingCredits(credits);
        } catch {}
    }, []);

    useEffect(() => {
        fetchHistory();
        fetchCredits();
        const interval = window.setInterval(fetchHistory, 10000);
        return () => window.clearInterval(interval);
    }, [fetchCredits, fetchHistory]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, selectedConversationId, mode]);

    const conversations = useMemo(() => buildConversationGroups(messages), [messages]);
    const normalizedInput = inputValue.trim().toLowerCase();
    const filteredPresetItems = useMemo(() => {
        if (!normalizedInput) return [];
        return PRESET_PROMPTS.filter((item) => {
            const haystack = `${item.group} ${item.label} ${item.prompt}`.toLowerCase();
            return haystack.includes(normalizedInput);
        }).slice(0, 8);
    }, [normalizedInput]);
    const isFilteringSuggestions = normalizedInput.length > 0;
    const activeStrategy = useMemo(() => {
        const symbol = marketData.activeChart?.symbol;
        return strategyData.strategies.find((s) => s.active && s.symbol === symbol) || strategyData.strategies.find((s) => s.active) || null;
    }, [marketData.activeChart?.symbol, strategyData.strategies]);

    const chartKey = useMemo(() => {
        if (!marketData.activeChart?.symbol || !marketData.activeChart?.interval || !marketData.activeChart?.source) return '';
        return `${marketData.activeChart.source}:${normalizeSymbol(marketData.activeChart.symbol)}:${marketData.activeChart.interval}`;
    }, [marketData.activeChart?.interval, marketData.activeChart?.source, marketData.activeChart?.symbol]);
    const recentCandles = useMemo(() => {
        if (!marketData.activeChart?.symbol || !marketData.activeChart?.interval) return [];
        const candleMap = marketData.candleData as Record<string, Candle[]>;
        const fallbackKey = `${marketData.activeChart.symbol}:${marketData.activeChart.interval}`;
        const candles = (chartKey ? candleMap[chartKey] : undefined) || candleMap[fallbackKey] || [];
        return candles.slice(-80);
    }, [chartKey, marketData.activeChart?.interval, marketData.activeChart?.symbol, marketData.candleData]);
    const indicatorSnapshot = useMemo(() => marketData.activeChart?.id ? (((marketData.chartIndicators as Record<string, Array<Record<string, unknown>>>)[marketData.activeChart.id] || []).slice(0, 8).map((it) => ({ type: it.type || 'unknown', params: it.params || {}, visible: it.visible !== false, pane: it.pane || 'main' }))) : [], [marketData.activeChart?.id, marketData.chartIndicators]);
    const latestSignal = useMemo(() => strategyData.signals.find((s) => s.symbol === marketData.activeChart?.symbol) || strategyData.signals[0] || null, [marketData.activeChart?.symbol, strategyData.signals]);
    const openVirtualPositions = useMemo(() => strategyData.virtualPositions.filter((p) => p.status !== 'closed'), [strategyData.virtualPositions]);
    const relevantVirtualPosition = useMemo(() => openVirtualPositions.find((p) => p.symbol === marketData.activeChart?.symbol) || openVirtualPositions.find((p) => p.strategyId === activeStrategy?.id) || openVirtualPositions[0] || null, [activeStrategy?.id, marketData.activeChart?.symbol, openVirtualPositions]);
    const liveTerminalPosition = useMemo(() => marketData.positions.find((p) => p.symbol === marketData.activeChart?.symbol) || marketData.positions[0] || null, [marketData.activeChart?.symbol, marketData.positions]);
    const lastHistoryDeal = useMemo(() => marketData.historyDeals.find((d) => d.symbol === marketData.activeChart?.symbol) || marketData.historyDeals[0] || null, [marketData.activeChart?.symbol, marketData.historyDeals]);
    const strategyById = useMemo(() => Object.fromEntries(strategyData.strategies.map((s) => [s.id, s])), [strategyData.strategies]);
    const quickActionLabel = useCallback((id: string, fallback: string) => {
        if (id === 'chart-next-timesfm') return isVi ? 'Dự đoán giá sắp tới' : 'Forecast Next Move';
        if (id === 'chart-next-range') return isVi ? 'Dự báo vùng giá kế tiếp' : 'Forecast Next Range';
        if (id === 'entry-now') return isVi ? 'Có nên vào lệnh' : 'Should I Enter Now';
        if (id === 'chart-summary') return isVi ? 'Tóm tắt chart' : 'Chart Summary';
        return fallback;
    }, [isVi]);
    const quickActionPrompt = useCallback((id: string, fallback: string) => {
        if (id === 'chart-next-timesfm') return isVi ? 'Dự đoán giá sắp tới cho chart đang mở.' : 'Forecast the next move for the current chart.';
        if (id === 'chart-next-range') return isVi ? 'Dự báo vùng giá kế tiếp và biên độ dự kiến của chart hiện tại.' : 'Forecast the next price range and expected volatility for the current chart.';
        if (id === 'entry-now') return isVi ? 'Phân tích nhanh chart hiện tại và cho biết có nên vào lệnh ngay bây giờ không.' : 'Quickly analyze the current chart and tell me whether I should enter now.';
        if (id === 'chart-summary') return isVi ? 'Tóm tắt nhanh chart đang xem trong 3 ý ngắn gọn.' : 'Summarize the current chart in 3 concise points.';
        return fallback;
    }, [isVi]);

    const visibleChatMessages = useMemo(() => {
        const chat = messages
            .filter((m) => m.source === 'chat')
            .filter((m) => {
                const safePrompt = getVisibleUserPrompt(m.prompt).trim();
                const safeResponse = sanitizeAssistantResponse(m.response).trim();
                return Boolean(safePrompt || safeResponse);
            });
        if (selectedConversationId === 'active') {
            if (!sessionOnlyMode) return chat;
            return chat.filter((m) => m.timestamp >= sessionStartTs);
        }
        return conversations.find((item) => item.id === selectedConversationId)?.items || [];
    }, [conversations, messages, selectedConversationId, sessionOnlyMode, sessionStartTs]);
    const systemLogs = useMemo(() => messages.filter((m) => m.source === 'system').slice().reverse(), [messages]);

    const buildLocalContextPack = useCallback((question: string, intent: IntentKey) => {
        const latest = recentCandles[recentCandles.length - 1] || null;
        const prev = recentCandles[recentCandles.length - 2] || null;
        const chart = marketData.activeChart ? {
            symbol: marketData.activeChart.symbol,
            timeframe: marketData.activeChart.interval,
            source: marketData.activeChart.source,
            lastPrice: sanitizeNumber(marketData.activeTicker?.price, marketData.activeDigits ?? 2),
            changePercent: sanitizeNumber(marketData.activeTicker?.change, 2),
            latestCandle: latest ? { t: latest.time, o: sanitizeNumber(latest.open, marketData.activeDigits ?? 2), h: sanitizeNumber(latest.high, marketData.activeDigits ?? 2), l: sanitizeNumber(latest.low, marketData.activeDigits ?? 2), c: sanitizeNumber(latest.close, marketData.activeDigits ?? 2) } : null,
            previousCandle: prev ? { t: prev.time, o: sanitizeNumber(prev.open, marketData.activeDigits ?? 2), h: sanitizeNumber(prev.high, marketData.activeDigits ?? 2), l: sanitizeNumber(prev.low, marketData.activeDigits ?? 2), c: sanitizeNumber(prev.close, marketData.activeDigits ?? 2) } : null,
            indicators: indicatorSnapshot,
        } : null;
        const base = { question, intent, generatedAt: new Date().toISOString(), chart };
        if (intent === 'entry') return { ...base, strategy: summarizeStrategy(activeStrategy), latestSignal: summarizeSignal(latestSignal), openPosition: summarizeVirtualPosition(relevantVirtualPosition, relevantVirtualPosition ? strategyById[relevantVirtualPosition.strategyId]?.name : undefined) };
        if (intent === 'exit') return { ...base, latestSignal: summarizeSignal(latestSignal), openPosition: summarizeVirtualPosition(relevantVirtualPosition, relevantVirtualPosition ? strategyById[relevantVirtualPosition.strategyId]?.name : undefined), terminalPosition: liveTerminalPosition ? { symbol: liveTerminalPosition.symbol, type: liveTerminalPosition.type, volume: sanitizeNumber(liveTerminalPosition.volume, 2), openPrice: sanitizeNumber(liveTerminalPosition.open_price, marketData.activeDigits ?? 2), currentPrice: sanitizeNumber(liveTerminalPosition.current_price, marketData.activeDigits ?? 2), sl: sanitizeNumber(liveTerminalPosition.sl, marketData.activeDigits ?? 2), tp: sanitizeNumber(liveTerminalPosition.tp, marketData.activeDigits ?? 2), profit: sanitizeNumber(liveTerminalPosition.profit, 2) } : null, lastTrade: lastHistoryDeal };
        if (intent === 'strategy') return { ...base, activeStrategy: summarizeStrategy(activeStrategy), otherStrategies: strategyData.strategies.filter((s) => s.active).slice(0, 4).map((s) => summarizeStrategy(s)), latestSignal: summarizeSignal(latestSignal) };
        if (intent === 'risk') return { ...base, strategy: summarizeStrategy(activeStrategy), account: Object.values(marketData.accounts || {})[0] || null, openPositions: openVirtualPositions.slice(0, 3).map((p) => summarizeVirtualPosition(p, strategyById[p.strategyId]?.name)), terminalPosition: liveTerminalPosition ? { symbol: liveTerminalPosition.symbol, type: liveTerminalPosition.type, volume: sanitizeNumber(liveTerminalPosition.volume, 2), profit: sanitizeNumber(liveTerminalPosition.profit, 2) } : null };
        if (intent === 'summary') return { ...base, chart: { ...chart, recentCandles: recentCandles.slice(-6).map((c) => ({ t: c.time, o: sanitizeNumber(c.open, marketData.activeDigits ?? 2), h: sanitizeNumber(c.high, marketData.activeDigits ?? 2), l: sanitizeNumber(c.low, marketData.activeDigits ?? 2), c: sanitizeNumber(c.close, marketData.activeDigits ?? 2) })) }, latestSignal: summarizeSignal(latestSignal) };
        return { ...base, strategy: summarizeStrategy(activeStrategy), latestSignal: summarizeSignal(latestSignal) };
    }, [activeStrategy, indicatorSnapshot, lastHistoryDeal, latestSignal, liveTerminalPosition, marketData.accounts, marketData.activeChart, marketData.activeDigits, marketData.activeTicker?.change, marketData.activeTicker?.price, openVirtualPositions, recentCandles, relevantVirtualPosition, strategyById, strategyData.strategies]);

    const sendForecast = useCallback(async (question: string) => {
        const { accessToken, userId, hasAccessToken } = getAuthContext();
        if (isSending) return;
        if (!hasAccessToken) {
            setFriendlyError(isVi ? 'Bạn cần đăng nhập để sử dụng AI.' : 'Please sign in to use AI.');
            return;
        }
        if (!marketData.activeChart) {
            setFriendlyError(isVi ? 'Không có chart đang được chọn để dự báo.' : 'No active chart selected for forecasting.');
            return;
        }
        if (recentCandles.length < 20) {
            setFriendlyError(isVi ? 'Chart chưa đủ dữ liệu nến để dự báo.' : 'Not enough candle data to run forecast.');
            return;
        }

        setFriendlyError(null);
        setIsSending(true);
        try {
            const payload: {
                question: string;
                chart: { chartId: string; symbol: string; timeframe: string; source: string };
                candles: Candle[];
                source: 'chat';
                userId?: string;
            } = {
                question,
                chart: {
                    chartId: marketData.activeChart.id,
                    symbol: marketData.activeChart.symbol,
                    timeframe: marketData.activeChart.interval,
                    source: marketData.activeChart.source,
                },
                candles: recentCandles,
                source: 'chat',
            };
            if (userId) payload.userId = userId;

            const response = await fetch('/api/ai/bridge/forecast', {
                method: 'POST',
                headers: { 'content-type': 'application/json', ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            const data = await response.json().catch(() => null);
            if (!response.ok || !data) throw new Error(String(data?.user_message || data?.msg || data?.error || `request_failed_${response.status}`));
            if (typeof data?.remainingCredits === 'number') setRemainingCredits(data.remainingCredits);

            const nowTs = Date.now();
            setMessages((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    source: 'chat',
                    prompt: question,
                    response: sanitizeAssistantResponse(String(data?.response || '')),
                    timestamp: nowTs,
                },
            ]);
        } catch (error) {
            setFriendlyError(toFriendlyError(error instanceof Error ? error.message : 'ai_forecast_failed', isVi));
        } finally {
            setIsSending(false);
        }
    }, [isSending, isVi, marketData.activeChart, recentCandles]);

    const sendPrompt = useCallback(async (rawQuestion: string) => {
        const question = rawQuestion.trim();
        const { accessToken, userId, hasAccessToken } = getAuthContext();
        if (!question || !AI_ENABLED || isSending) return;
        if (!hasAccessToken) {
            setFriendlyError(isVi ? 'Bạn cần đăng nhập để sử dụng AI.' : 'Please sign in to use AI.');
            return;
        }
        setFriendlyError(null);
        setIsSending(true);
        try {
            const intent = classifyIntent(question);
            const prompt = buildPrompt(buildLocalContextPack(question, intent), question, intent);
            const payload: { prompt: string; source: 'chat'; userId?: string } = { prompt, source: 'chat' };
            if (userId) payload.userId = userId;
            const response = await fetch('/api/ai/bridge/task', {
                method: 'POST',
                headers: { 'content-type': 'application/json', ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            const data = await response.json().catch(() => null);
            if (!response.ok || !data) throw new Error(String(data?.user_message || data?.msg || data?.error || `request_failed_${response.status}`));
            if (typeof data?.remainingCredits === 'number') setRemainingCredits(data.remainingCredits);
            if (selectedConversationId !== 'active') {
                setSelectedConversationId('active');
                setSessionStartTs(Date.now());
                setSessionOnlyMode(true);
            }
            const nowTs = Date.now();
            setMessages((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    source: 'chat',
                    prompt,
                    response: sanitizeAssistantResponse(String(data?.response || '')),
                    timestamp: nowTs,
                },
            ]);
            await fetchHistory();
        } catch (error) {
            setFriendlyError(toFriendlyError(error instanceof Error ? error.message : 'ai_request_failed', isVi));
        } finally {
            setIsSending(false);
        }
    }, [buildLocalContextPack, fetchHistory, isSending, isVi, selectedConversationId]);

    const handleSend = useCallback(async () => {
        const question = inputValue.trim();
        if (!question) return;
        setInputValue('');
        await sendPrompt(question);
    }, [inputValue, sendPrompt]);

    const handleNewConversation = useCallback(() => {
        setSelectedConversationId('active');
        setSessionStartTs(Date.now());
        setSessionOnlyMode(true);
        setInputValue('');
        setFriendlyError(null);
    }, []);

    return (
        <div className="flex h-full min-h-0 overflow-hidden rounded-lg border border-border bg-secondary/20">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="border-b border-border bg-secondary/60 px-3 py-1.5">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            {remainingCredits !== null && (
                                <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-primary">
                                    Credits: {remainingCredits}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <IconTabButton active={mode === 'history'} title={isVi ? 'Lịch sử' : 'History'} onClick={() => setMode('history')}>
                                <History size={15} />
                            </IconTabButton>
                            <IconTabButton active={mode === 'chat'} title={isVi ? 'Cuộc trò chuyện mới' : 'New chat'} onClick={() => { handleNewConversation(); setMode('chat'); }}>
                                <SquarePen size={15} />
                            </IconTabButton>
                        </div>
                    </div>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex h-full items-center justify-center">
                            <Loader2 size={24} className="animate-spin text-primary" />
                        </div>
                    ) : mode === 'chat' ? (
                        visibleChatMessages.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center gap-3 text-center opacity-60">
                                <div className="max-w-[320px] text-[12px] leading-relaxed text-muted-foreground">
                                    {isVi
                                        ? 'Hỏi ngắn gọn về chart, lệnh đang mở, chiến lược đang chạy hoặc rủi ro hiện tại. AI sẽ chỉ lấy dữ liệu phù hợp với câu hỏi.'
                                        : 'Ask briefly about the chart, open trades, running strategy, or current risk. AI only uses relevant data for your question.'}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {visibleChatMessages.map((msg) => (
                                    <div key={msg.id} className="flex flex-col gap-3">
                                        <div className="self-end max-w-[88%] select-text rounded-2xl rounded-tr-sm border border-primary/20 bg-primary/10 p-3 text-[13px] leading-relaxed text-foreground shadow-sm" style={{ userSelect: 'text' }}>
                                            {getVisibleUserPrompt(msg.prompt)}
                                        </div>
                                        <div className="self-start max-w-[92%] select-text rounded-2xl rounded-tl-sm border border-border bg-card/80 p-4 shadow-lg">
                                            <div className="mb-2 flex items-center gap-2">
                                                <span className="text-[11px] font-black uppercase tracking-wider text-primary">Premium AI</span>
                                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{formatTime(msg.timestamp)}</span>
                                            </div>
                                            <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground" style={{ userSelect: 'text' }}>{sanitizeAssistantResponse(msg.response)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : mode === 'history' ? (
                        <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">{isVi ? 'Lịch sử' : 'History'}</div>
                                    <div className="mt-1 text-sm font-bold text-foreground">{isVi ? 'Chọn lại cuộc trò chuyện gần đây' : 'Reopen recent conversations'}</div>
                                </div>
                                <button
                                    onClick={() => {
                                        handleNewConversation();
                                        setMode('chat');
                                    }}
                                    className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-primary transition hover:bg-primary/15"
                                >
                                    <Plus size={13} />
                                    {isVi ? 'Mới' : 'New'}
                                </button>
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedConversationId('active');
                                    setSessionOnlyMode(false);
                                    setMode('chat');
                                }}
                                className={cn(
                                    'rounded-2xl border p-4 text-left transition',
                                    selectedConversationId === 'active'
                                        ? 'border-primary/40 bg-primary/10'
                                        : 'border-border/60 bg-card/60 hover:border-primary/20'
                                )}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="text-[11px] font-black uppercase tracking-wide text-foreground">{isVi ? 'Cuộc trò chuyện hiện tại' : 'Current conversation'}</div>
                                    <SquarePen size={14} className="text-primary" />
                                </div>
                                <div className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                                    {isVi ? 'Tiếp tục hỏi thêm trên phiên hiện tại hoặc bắt đầu lại từ đầu.' : 'Continue this session or start over from scratch.'}
                                </div>
                            </button>
                            {conversations.length === 0 ? (
                                <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/40 p-6 text-center text-[12px] text-muted-foreground">
                                    {isVi ? 'Chưa có lịch sử hội thoại để hiển thị.' : 'No chat history to display yet.'}
                                </div>
                            ) : (
                                conversations.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            setSelectedConversationId(item.id);
                                            setMode('chat');
                                        }}
                                        className={cn(
                                            'rounded-2xl border p-4 text-left transition',
                                            selectedConversationId === item.id
                                                ? 'border-primary/40 bg-primary/10'
                                                : 'border-border/60 bg-card/60 hover:border-primary/20'
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="line-clamp-2 text-[13px] font-bold leading-relaxed text-foreground">{item.title}</div>
                                                <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{formatTime(item.startedAt)}</div>
                                            </div>
                                            <History size={14} className="mt-0.5 text-primary/80" />
                                        </div>
                                        <div className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                                            {item.items.length} {isVi ? 'tin nhắn' : 'messages'}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    ) : systemLogs.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center gap-3 text-center opacity-50">
                            <History size={40} />
                            <span className="text-[11px] font-black uppercase tracking-wider">{isVi ? 'Chưa có log hệ thống' : 'No system logs yet'}</span>
                        </div>
                    ) : (
                        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
                            {systemLogs.map((msg) => (
                                <div key={msg.id} className="rounded-xl border border-border/70 bg-card/60 p-3">
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-cyan-400">
                                            <ShieldCheck size={12} />
                                            System Audit Log
                                        </div>
                                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{formatTime(msg.timestamp)}</div>
                                    </div>
                                    <div className="line-clamp-2 text-[11px] text-muted-foreground">{getVisibleUserPrompt(msg.prompt)}</div>
                                    <div className="mt-2 line-clamp-3 text-[11px] text-foreground/85">{msg.response}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {mode === 'chat' && (
                    <div className="border-t border-border bg-secondary/80 p-3">
                        {friendlyError && (
                            <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] font-bold text-red-300">
                                {friendlyError}
                            </div>
                        )}
                        <div className="mb-3 flex items-center gap-2 overflow-x-auto no-scrollbar whitespace-nowrap">
                            {QUICK_ACTION_PROMPTS.map((item) => {
                                const Icon = item.icon as any;
                                const isForecastPrimary = item.id === 'chart-next-timesfm';
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            const promptText = quickActionPrompt(item.id, item.prompt);
                                            void (item.intent === 'forecast' ? sendForecast(promptText) : sendPrompt(promptText));
                                        }}
                                        disabled={isSending || (item.intent === 'forecast' && !marketData.activeChart)}
                                        className={cn(
                                            'flex h-8 w-[164px] shrink-0 items-center justify-center gap-1.5 rounded-full border px-2 text-[10px] font-bold uppercase tracking-wide transition disabled:opacity-40',
                                            isForecastPrimary
                                                ? 'border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                                                : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
                                        )}
                                    >
                                        {isForecastPrimary ? <Sparkles size={12} className="animate-pulse" /> : <Icon size={12} />}
                                        <span className="truncate">{quickActionLabel(item.id, item.label)}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="relative flex items-center gap-2">
                            {isFilteringSuggestions && (
                                <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-20 overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-2xl backdrop-blur">
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar p-2">
                                        {filteredPresetItems.length === 0 ? (
                                            <div className="px-3 py-2 text-[11px] text-muted-foreground">{isVi ? 'Không có gợi ý phù hợp.' : 'No matching suggestions.'}</div>
                                        ) : (
                                            filteredPresetItems.map((item) => {
                                                const Icon = item.icon as any;
                                                return (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => {
                                                            const promptText = quickActionPrompt(item.id, item.prompt);
                                                            setInputValue(promptText);
                                                            void (item.intent === 'forecast' ? sendForecast(promptText) : sendPrompt(promptText));
                                                        }}
                                                        disabled={isSending}
                                                        className="flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-primary/5 disabled:opacity-60"
                                                    >
                                                        <Icon size={13} className="mt-0.5 shrink-0 text-primary" />
                                                        <div className="min-w-0">
                                                            <div className="truncate text-[11px] font-black uppercase tracking-wide text-foreground">{quickActionLabel(item.id, item.label)}</div>
                                                            <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{quickActionPrompt(item.id, item.prompt)}</div>
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') void handleSend();
                                }}
                                placeholder={isVi ? 'Hỏi về chart, lệnh đang mở, chiến lược, SL/TP...' : 'Ask about chart, open trades, strategy, SL/TP...'}
                                className="w-full rounded-full border border-border bg-secondary px-5 py-3 pr-12 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:border-blue-500/50 focus:outline-none"
                            />
                            <button
                                onClick={() => void handleSend()}
                                disabled={!AI_ENABLED || isSending || !inputValue.trim()}
                                className="absolute right-1 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-500 disabled:opacity-40"
                            >
                                {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

