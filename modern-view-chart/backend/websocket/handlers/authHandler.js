import { getBinancePrices } from "../services/binanceTickerService.js";
import { safeSend } from "../wsSend.js";
import { normalizeSymbol, setClientSymbolSubscriptions } from "../subscriptionIndex.js";
import {
    getScopedMt5Prices,
    getScopedMt5State,
    getScopedMt5Symbols,
    resolveClientMt5Scope,
    scopeMetadata,
} from "../mt5Scope.js";
import { resolveRequestedClientMode, WS_CLIENT_MODES } from "../clientMode.js";
import { buildAvailableMt5Accounts, resolveClientMt5Bridge } from "../mt5AccountCatalog.js";

function normalizeOptional(value) {
    const text = String(value || "").trim();
    return text || null;
}

function selectWebMt5Scope(clientData, bridgeRegistry, data) {
    if (!clientData || clientData.isBridgeAuthenticated) return "ok";

    const requestedSource = String(data?.mt5_source || data?.mt5Source || "").trim().toUpperCase();
    const accountLogin = normalizeOptional(data?.account_login || data?.accountLogin);
    const terminalId = normalizeOptional(data?.terminal_id || data?.terminalId);

    if (requestedSource === "MT5") {
        clientData.selectedMt5AccountLogin = null;
        clientData.selectedMt5TerminalId = null;
        clientData.selectedMt5Broker = null;
        return "ok";
    }

    if (!accountLogin && !terminalId && requestedSource !== "MT5_PERSONAL") {
        return "ok";
    }

    if (clientData.authType !== "user" || clientData.accountTier !== "pro") {
        return "forbidden";
    }
    if (!accountLogin) return "forbidden";

    const route = bridgeRegistry?.resolve({
        userId: clientData.userId,
        accountLogin,
        terminalId,
    });
    if (!route?.record || route.record.clientMode !== WS_CLIENT_MODES.PRO_EXTENSION) {
        clientData.selectedMt5AccountLogin = null;
        clientData.selectedMt5TerminalId = null;
        clientData.selectedMt5Broker = null;
        return "unavailable";
    }

    clientData.selectedMt5AccountLogin = route.record.accountLogin;
    clientData.selectedMt5TerminalId = route.record.terminalId;
    clientData.selectedMt5Broker = route.record.broker;
    return "ok";
}

export function handleAuth({ ws, clients, mt5Prices, subscriptionIndex, bridgeRegistry }, data) {
    const clientData = clients.get(ws);
    let requestedSymbols = [];

    if (clientData) {
        if (data.client_mode) {
            const clientMode = resolveRequestedClientMode(data.client_mode, clientData);
            if (!clientMode) {
                safeSend(ws, JSON.stringify({
                    topic: "error",
                    code: "forbidden",
                    detail: "client_mode_not_allowed",
                }));
                return;
            }
            clientData.clientMode = clientMode;

            if (clientMode === WS_CLIENT_MODES.PRO_EXTENSION) {
                const accountLogin = String(data.account_login || data.accountLogin || "").trim();
                const terminalId = String(data.terminal_id || data.terminalId || "").trim();
                const broker = String(data.broker || "").trim();
                if (!accountLogin || !terminalId) {
                    safeSend(ws, JSON.stringify({
                        topic: "error",
                        code: "invalid_request",
                        detail: "pro_extension_requires_account_login_and_terminal_id",
                    }));
                    return;
                }
                clientData.bridgeAccountLogin = accountLogin;
                clientData.bridgeTerminalId = terminalId;
                clientData.bridgeBroker = broker || null;
            }
        }

        const scopeSelection = selectWebMt5Scope(clientData, bridgeRegistry, data);
        if (scopeSelection === "forbidden") {
            safeSend(ws, JSON.stringify({
                topic: "error",
                code: "forbidden",
                detail: "mt5_account_scope_not_allowed",
            }));
            return;
        }
        if (scopeSelection === "unavailable") {
            safeSend(ws, JSON.stringify({
                topic: "error",
                code: "service_unavailable",
                detail: "mt5_account_scope_unavailable_fallback_shared",
            }));
        }

        if (Array.isArray(data.symbols)) {
            const normalized = data.symbols.map((s) => normalizeSymbol(s)).filter(Boolean).slice(0, 300);
            clientData.symbols = setClientSymbolSubscriptions(subscriptionIndex, ws, normalized);
            requestedSymbols = clientData.symbols;
        }

        if (!clientData.isBridgeAuthenticated) {
            const selectedScope = resolveClientMt5Scope(clientData);
            safeSend(ws, JSON.stringify({
                topic: "mt5_accounts_available",
                accounts: buildAvailableMt5Accounts(clientData, bridgeRegistry),
                selected: scopeMetadata(selectedScope),
            }));
            safeSend(ws, JSON.stringify({
                topic: "bridgeStatus",
                online: Boolean(resolveClientMt5Bridge(clientData, bridgeRegistry).record),
                mt5_scope: scopeMetadata(selectedScope),
            }));
        }
    }

    const initialSymbols = requestedSymbols.length > 0
        ? requestedSymbols
        : (subscriptionIndex.coreSymbols || []);
    const symbolSet = new Set(initialSymbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean));
    const binanceData = getBinancePrices(initialSymbols);
    const clientMt5Scope = resolveClientMt5Scope(clientData);
    const mt5Data = getScopedMt5Prices(mt5Prices, clientMt5Scope)
        .filter((item) => symbolSet.size === 0 || symbolSet.has(normalizeSymbol(item?.symbol)));
    const combined = [...binanceData, ...mt5Data];

    if (combined.length > 0) {
        safeSend(ws, JSON.stringify({ topic: "priceUpdate", data: combined }), { nonCritical: true });
    }

    const scopedMt5State = getScopedMt5State(clientMt5Scope);
    if (scopedMt5State) {
        safeSend(ws, JSON.stringify({
            topic: "mt5_positions_update",
            account: scopedMt5State.account,
            positions: scopedMt5State.positions,
            orders: scopedMt5State.orders || [],
            source: clientMt5Scope.source,
            mt5_scope: scopeMetadata(clientMt5Scope),
        }));
    }

    const scopedMt5Symbols = getScopedMt5Symbols(clientMt5Scope);
    if (scopedMt5Symbols.length > 0) {
        safeSend(ws, JSON.stringify({
            topic: "mt5_available_symbols",
            symbols: scopedMt5Symbols,
            source: clientMt5Scope.source,
            mt5_scope: scopeMetadata(clientMt5Scope),
        }));
    }
}
