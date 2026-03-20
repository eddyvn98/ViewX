import type { SignalStats } from "../types";

type TradeLogCreatePayload = {
    strategy_id: string;
    symbol: string;
    type: "BUY" | "SELL";
    entry_price: number;
    lot_size: number;
    volatility: string;
    session: string;
    indicators: Record<string, unknown>;
    timestamp: string;
};

type TradeExitPayload = {
    strategy_id: string;
    symbol: string;
    exit_price: number;
    metadata?: Record<string, unknown>;
};

export class TradeLogApiError extends Error {
    status: number;
    code?: string;

    constructor(message: string, status: number, code?: string) {
        super(message);
        this.name = "TradeLogApiError";
        this.status = status;
        this.code = code;
    }
}

async function readJsonSafe(response: Response) {
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    const response = await fetch(input, {
        ...init,
        headers: {
            "content-type": "application/json",
            ...(init?.headers || {}),
        },
    });

    if (!response.ok) {
        const payload = await readJsonSafe(response);
        const code = typeof payload === "object" && payload && "error" in payload
            ? String((payload as { error?: unknown }).error || "") || undefined
            : undefined;
        const message = typeof payload === "string" ? payload : code || `Request failed: ${response.status}`;
        throw new TradeLogApiError(message, response.status, code);
    }

    return (await readJsonSafe(response)) as T;
}

export async function createTradeLog(payload: TradeLogCreatePayload) {
    return requestJson("/api/user/trade-logs/public", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function updateTradeExit(payload: TradeExitPayload) {
    return requestJson("/api/user/trade-logs/public", {
        method: "PATCH",
        body: JSON.stringify(payload),
    });
}

export async function fetchTradeStats(strategyId: string): Promise<SignalStats> {
    const query = new URLSearchParams({ strategy_id: strategyId });
    return requestJson<SignalStats>(`/api/user/trade-stats/public?${query.toString()}`, {
        method: "GET",
    });
}
