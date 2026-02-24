export const runtimeState = {
    bridgeOnline: false,
    wsClients: 0,
};

export function setBridgeOnline(online) {
    runtimeState.bridgeOnline = Boolean(online);
}

export function setWsClients(count) {
    runtimeState.wsClients = Number.isFinite(count) ? count : 0;
}
