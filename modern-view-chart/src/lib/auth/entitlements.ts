'use client';

export type ClientPlan = 'free' | 'pro' | 'pro_plus';
export type ClientModule =
    | 'your_mt5'
    | 'mt5_trade'
    | 'binance_trade'
    | 'vn_gold'
    | 'voice_alerts'
    | 'telegram_notify'
    | 'telegram_control'
    | 'discord_bot'
    | 'ai_assistant';

export type ClientEntitlements = {
    plan: ClientPlan;
    modules: ClientModule[];
    isAuthenticated: boolean;
    isFree: boolean;
    isPro: boolean;
    isProPlus: boolean;
    hasYourMt5: boolean;
    hasMt5Trade: boolean;
    hasBinanceTrade: boolean;
    hasTelegramNotify: boolean;
    hasTelegramControl: boolean;
    hasAiAssistant: boolean;
};

const PRO_MODULES: ClientModule[] = ['your_mt5', 'binance_trade', 'telegram_notify', 'telegram_control'];
const PRO_PLUS_MODULES: ClientModule[] = [...PRO_MODULES, 'ai_assistant'];

function normalizeModules(value: unknown): ClientModule[] {
    if (!Array.isArray(value)) return [];
    const allowed = new Set<ClientModule>([
        'your_mt5',
        'mt5_trade',
        'binance_trade',
        'vn_gold',
        'voice_alerts',
        'telegram_notify',
        'telegram_control',
        'discord_bot',
        'ai_assistant',
    ]);
    const output: ClientModule[] = [];
    for (const item of value) {
        let key = String(item || '').trim().toLowerCase() as ClientModule;
        if (key === 'mt5_trade') key = 'your_mt5';
        if (!allowed.has(key) || output.includes(key)) continue;
        output.push(key);
    }
    return output;
}

function inferModulesFromPlan(plan: ClientPlan): ClientModule[] {
    if (plan === 'pro_plus') return [...PRO_PLUS_MODULES];
    if (plan === 'pro') return [...PRO_MODULES];
    return [];
}

function readAuthUserObject(): Record<string, unknown> {
    const raw = localStorage.getItem('auth_user') || '';
    if (!raw) return {};
    try {
        return JSON.parse(raw) as Record<string, unknown>;
    } catch {
        return {};
    }
}

export function setClientModulesLocal(modules: ClientModule[]): void {
    if (typeof window === 'undefined') return;
    const user = readAuthUserObject();
    const normalizedModules = normalizeModules(modules);
    const nextPlan: ClientPlan = normalizedModules.includes('ai_assistant')
        ? 'pro_plus'
        : normalizedModules.length > 0
            ? 'pro'
            : 'free';
    const subscription =
        user.subscription && typeof user.subscription === 'object'
            ? (user.subscription as Record<string, unknown>)
            : {};

    const nextUser = {
        ...user,
        plan: nextPlan,
        modules: normalizedModules,
        subscription: {
            ...subscription,
            plan: nextPlan,
            modules: normalizedModules,
            validUntil: normalizedModules.length > 0 ? '2099-12-31T23:59:59.000Z' : null,
        },
    };
    localStorage.setItem('auth_user', JSON.stringify(nextUser));
}

export function setClientPlanLocal(plan: ClientPlan): void {
    if (typeof window === 'undefined') return;
    const user = readAuthUserObject();

    const subscription =
        user.subscription && typeof user.subscription === 'object'
            ? (user.subscription as Record<string, unknown>)
            : {};
    const modules = inferModulesFromPlan(plan);

    const nextUser = {
        ...user,
        plan,
        modules,
        subscription: {
            ...subscription,
            plan,
            modules,
            validUntil: '2099-12-31T23:59:59.000Z',
        },
    };

    localStorage.setItem('auth_user', JSON.stringify(nextUser));
}

export function startClientProTrialLocal(days = 7): void {
    if (typeof window === 'undefined') return;
    const user = readAuthUserObject();

    const subscription =
        user.subscription && typeof user.subscription === 'object'
            ? (user.subscription as Record<string, unknown>)
            : {};

    const trialEnd = new Date(Date.now() + Math.max(1, days) * 24 * 60 * 60 * 1000).toISOString();
    const nextUser = {
        ...user,
        plan: 'pro',
        modules: [...PRO_MODULES],
        subscription: {
            ...subscription,
            plan: 'pro',
            modules: [...PRO_MODULES],
            status: 'trialing',
            validUntil: trialEnd,
            trialEndsAt: trialEnd,
        },
    };

    localStorage.setItem('auth_user', JSON.stringify(nextUser));
}

export function getClientEntitlements(): ClientEntitlements {
    if (typeof window === 'undefined') {
        return {
            plan: 'free',
            modules: [],
            isAuthenticated: false,
            isFree: true,
            isPro: false,
            isProPlus: false,
            hasYourMt5: false,
            hasMt5Trade: false,
            hasBinanceTrade: false,
            hasTelegramNotify: false,
            hasTelegramControl: false,
            hasAiAssistant: false,
        };
    }

    const raw = localStorage.getItem('auth_user') || '';
    const token = localStorage.getItem('auth_access_token');

    let plan: ClientPlan = 'free';
    let modules: ClientModule[] = [];

    if (raw) {
        try {
            const user = JSON.parse(raw);
            const userPlan = user?.subscription?.plan || user?.plan || 'free';
            const validUntilRaw = user?.subscription?.validUntil;
            const validUntilMs = typeof validUntilRaw === 'string' ? Date.parse(validUntilRaw) : NaN;
            const isExpired = Number.isFinite(validUntilMs) ? validUntilMs < Date.now() : false;
            if (userPlan === 'pro' || userPlan === 'pro_plus') {
                plan = isExpired ? 'free' : userPlan;
            }
            modules = isExpired
                ? []
                : normalizeModules(user?.subscription?.modules || user?.modules || inferModulesFromPlan(plan));
        } catch {
            plan = 'free';
            modules = [];
        }
    }

    return {
        plan,
        modules,
        isAuthenticated: Boolean(token),
        isFree: plan === 'free',
        isPro: plan === 'pro' || plan === 'pro_plus',
        isProPlus: plan === 'pro_plus',
        hasYourMt5: modules.includes('your_mt5'),
        hasMt5Trade: modules.includes('your_mt5'),
        hasBinanceTrade: modules.includes('binance_trade'),
        hasTelegramNotify: modules.includes('telegram_notify'),
        hasTelegramControl: modules.includes('telegram_control'),
        hasAiAssistant: modules.includes('ai_assistant'),
    };
}
