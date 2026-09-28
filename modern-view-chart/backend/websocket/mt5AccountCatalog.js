import { WS_CLIENT_MODES } from "./clientMode.js";

export function buildAvailableMt5Accounts(clientData, bridgeRegistry) {
    const accounts = [];
    const userId = clientData?.userId ? String(clientData.userId) : null;

    if (userId && bridgeRegistry) {
        for (const record of bridgeRegistry.listForUser(userId)) {
            if (record.clientMode !== WS_CLIENT_MODES.PRO_EXTENSION) continue;
            if (!record.accountLogin) continue;
            accounts.push({
                source: "MT5_PERSONAL",
                account_login: record.accountLogin,
                terminal_id: record.terminalId,
                broker: record.broker,
                connected_at: record.connectedAt,
            });
        }
    }

    if (bridgeRegistry) {
        const shared = bridgeRegistry.listForUser(null).find((record) =>
            record.clientMode === WS_CLIENT_MODES.SERVICE_BRIDGE &&
            !record.accountLogin &&
            !record.terminalId
        );
        if (shared) {
            accounts.push({
                source: "MT5",
                account_login: null,
                terminal_id: null,
                broker: shared.broker,
                connected_at: shared.connectedAt,
            });
        }
    }

    return accounts;
}

export function resolveClientMt5Bridge(clientData, bridgeRegistry) {
    if (!bridgeRegistry) return { record: null, reason: "registry_unavailable", candidateCount: 0 };

    const accountLogin = String(clientData?.selectedMt5AccountLogin || "").trim() || null;
    const terminalId = String(clientData?.selectedMt5TerminalId || "").trim() || null;
    if (accountLogin && clientData?.userId) {
        return bridgeRegistry.resolve({
            userId: String(clientData.userId),
            accountLogin,
            terminalId,
        });
    }

    return bridgeRegistry.resolve({ userId: null });
}
