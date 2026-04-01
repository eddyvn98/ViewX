import { getBinancePrices } from "../services/binanceTickerService.js";
import { safeSend } from "../wsSend.js";
import { normalizeSymbol, setClientSymbolSubscriptions } from "../subscriptionIndex.js";
import { bridgeRegistry, resolveBridgeKey } from "../bridgeRegistry.js";
import { normalizeProPlan } from "../services/proEntitlementGuard.js";

function pickValue(...values) {
    for (const value of values) {
        if (value === undefined || value === null) continue;
        const normalized = String(value).trim();
        if (normalized) return normalized;
    }
    return null;
}

function applyConsentMetadata(target, data = {}) {
    if (!target || !data || typeof data !== "object") return;

    const termsVersion = pickValue(data.termsVersion, data.terms_version);
    const termsAcceptedAt = pickValue(data.termsAcceptedAt, data.terms_accepted_at);
    const privacyVersion = pickValue(data.privacyVersion, data.privacy_version);
    const privacyAcceptedAt = pickValue(data.privacyAcceptedAt, data.privacy_accepted_at);
    const proPolicyVersion = pickValue(data.proPolicyVersion, data.pro_policy_version);
    const proPolicyAcceptedAt = pickValue(data.proPolicyAcceptedAt, data.pro_policy_accepted_at);

    if (termsVersion) target.termsVersion = termsVersion;
    if (termsAcceptedAt) target.termsAcceptedAt = termsAcceptedAt;
    if (privacyVersion) target.privacyVersion = privacyVersion;
    if (privacyAcceptedAt) target.privacyAcceptedAt = privacyAcceptedAt;
    if (proPolicyVersion) target.proPolicyVersion = proPolicyVersion;
    if (proPolicyAcceptedAt) target.proPolicyAcceptedAt = proPolicyAcceptedAt;
}

export function handleAuth({ ws, clients, mt5Prices, subscriptionIndex }, data) {
    const clientData = clients.get(ws);
    let requestedSymbols = [];
    if (clientData) {
        const incomingUserId = String(data.userId || "").trim();
        clientData.userId = incomingUserId && incomingUserId !== "user_123" ? incomingUserId : null;
        clientData.role = data.role || data.user?.role || clientData.role || null;
        clientData.accountId =
            data.accountId ||
            data.account_id ||
            data.accountLogin ||
            data.account_login ||
            clientData.accountId ||
            null;
        clientData.accountLogin = data.accountLogin || data.account_login || clientData.accountLogin || null;
        clientData.terminalId =
            data.terminalId ||
            data.terminal_id ||
            data.terminal ||
            data.bridgeId ||
            data.bridge_id ||
            clientData.terminalId ||
            null;
        clientData.extensionVersion =
            data.extensionVersion ||
            data.extension_version ||
            data.bridgeVersion ||
            data.bridge_version ||
            clientData.extensionVersion ||
            null;
        clientData.bridgeVersion =
            data.bridgeVersion ||
            data.bridge_version ||
            data.extensionVersion ||
            data.extension_version ||
            clientData.bridgeVersion ||
            null;
        clientData.protocolVersion =
            data.protocolVersion ||
            data.protocol_version ||
            clientData.protocolVersion ||
            null;
        if (clientData.authType !== "user") {
            const nextPlan = normalizeProPlan(
                data.plan ||
                    data.subscription?.plan ||
                    data.session?.plan ||
                    data.user?.subscription?.plan ||
                    clientData.plan ||
                    "",
            );
            if (nextPlan) {
                clientData.plan = nextPlan;
            }
            const nextModules = Array.isArray(data.modules)
                ? data.modules
                : Array.isArray(data.subscription?.modules)
                    ? data.subscription.modules
                    : null;
            if (nextModules) {
                clientData.modules = nextModules;
            }
        }
        const nextValidUntil =
            data.subscription?.validUntil ||
            data.session?.subscription?.validUntil ||
            data.session?.validUntil ||
            data.user?.subscription?.validUntil ||
            null;
        if (nextValidUntil) {
            clientData.subscription = {
                ...(clientData.subscription || {}),
                plan: clientData.plan || null,
                modules: clientData.modules || null,
                validUntil: nextValidUntil,
            };
        }
        applyConsentMetadata(clientData, data);
        bridgeRegistry.register(ws, clientData);
        if (Array.isArray(data.symbols)) {
            const normalized = data.symbols.map((s) => normalizeSymbol(s)).filter(Boolean).slice(0, 300);
            clientData.symbols = setClientSymbolSubscriptions(subscriptionIndex, ws, normalized);
            requestedSymbols = clientData.symbols;
        }
    }

    // Immediately send current prices so the UI isn't empty on load
    const binanceData = getBinancePrices();
    const mt5Data = Array.from(mt5Prices.values());
    let combined = [...binanceData, ...mt5Data];

    if (requestedSymbols.length > 0) {
        const symbolSet = new Set(requestedSymbols);
        combined = combined.filter((item) => symbolSet.has(item.symbol));
    }

    if (combined.length > 0) {
        safeSend(ws, JSON.stringify({ topic: "priceUpdate", data: combined }), { nonCritical: true });
    }

    const routeKey = resolveBridgeKey(clientData || {});
    if (routeKey) {
        const storageKey = `${routeKey.userId}::${routeKey.accountId}::${routeKey.terminalId}`;

        if (global.mt5StateByRoute) {
            const scopedMt5State = global.mt5StateByRoute.get(storageKey);
            if (scopedMt5State) {
                safeSend(ws, JSON.stringify({
                    topic: "mt5_positions_update",
                    account: scopedMt5State.account,
                    positions: scopedMt5State.positions,
                    orders: scopedMt5State.orders || [],
                    mt5_source: scopedMt5State.mt5_source || "MT5",
                }));
            }
        }

        if (global.mt5AvailableSymbolsByRoute) {
            const availableSymbols = global.mt5AvailableSymbolsByRoute.get(storageKey);
            if (Array.isArray(availableSymbols) && availableSymbols.length > 0) {
                safeSend(ws, JSON.stringify({
                    topic: "mt5_available_symbols",
                    symbols: availableSymbols
                }));
            }
        }
    }
}
