import { buildSocketConfig, fetchWsTicketFromApi } from './socket-config';
import { wsRuntime } from './runtime';
import { collectActiveSymbolsFromStore } from './symbol-utils';
import { handleSocketMessage, MessageHandlerDeps } from './message-handler';

export interface ConnectionDeps extends MessageHandlerDeps {
    setConnected: (connected: boolean) => void;
    setBridgeOnline: (online: boolean) => void;
}

async function openSocket(deps: ConnectionDeps): Promise<void> {
    const current = wsRuntime.globalSocket;
    if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) return;

    const mustRefreshTicket = wsRuntime.forceFreshTicketOnReconnect;
    const socketConfig = buildSocketConfig({ ignoreUrlCredential: mustRefreshTicket });
    if (mustRefreshTicket) {
        wsRuntime.wsTicketCache = '';
        wsRuntime.wsTicketExpiresAt = 0;
    }
    if (socketConfig.protocols.length === 0 || mustRefreshTicket) {
        const fetchedTicket = await fetchWsTicketFromApi();
        if (fetchedTicket) {
            socketConfig.protocols = [`bearer.${fetchedTicket}`];
        }
    }
    wsRuntime.forceFreshTicketOnReconnect = false;
    wsRuntime.socketUrl = socketConfig.url;

    const socket = socketConfig.protocols.length > 0
        ? new WebSocket(socketConfig.url, socketConfig.protocols)
        : new WebSocket(socketConfig.url);
    wsRuntime.globalSocket = socket;

    socket.onopen = () => {
        wsRuntime.reconnectAttempts = 0;
        wsRuntime.lastMessageAt = Date.now();
        wsRuntime.lastAppPongAt = Date.now();
        deps.setConnected(true);
        const userId = 'user_123';
        const symbols = collectActiveSymbolsFromStore();
        socket.send(JSON.stringify({ topic: 'auth', userId, symbols }));
        socket.send(JSON.stringify({ topic: 'subscribeSymbols', symbols }));
    };

    socket.onmessage = (event) => {
        handleSocketMessage(event, socket, deps);
    };

    socket.onclose = (closeEvent) => {
        // Ignore stale sockets. A superseded socket must never mark the live
        // connection offline or schedule a competing reconnect.
        if (wsRuntime.globalSocket !== socket) return;

        deps.setConnected(false);
        deps.setBridgeOnline(false);
        wsRuntime.globalSocket = null;
        if (wsRuntime.resumeHealthCheckTimer) {
            clearTimeout(wsRuntime.resumeHealthCheckTimer);
            wsRuntime.resumeHealthCheckTimer = null;
        }
        if (wsRuntime.heartbeatTimer) {
            clearInterval(wsRuntime.heartbeatTimer);
            wsRuntime.heartbeatTimer = null;
        }
        wsRuntime.historyFetched = false;
        const closeReason = String(closeEvent?.reason || '').toLowerCase();
        const unauthorizedClose = Boolean(
            wsRuntime.unauthorizedFrameReceived ||
            closeEvent?.code === 1008 ||
            closeReason.includes('unauthorized'),
        );
        wsRuntime.unauthorizedFrameReceived = false;
        if (unauthorizedClose) {
            wsRuntime.forceFreshTicketOnReconnect = true;
            wsRuntime.wsTicketCache = '';
            wsRuntime.wsTicketExpiresAt = 0;
        }

        wsRuntime.reconnectAttempts += 1;
        const delay = Math.min(3000 * Math.pow(2, wsRuntime.reconnectAttempts - 1), 30000);
        if (wsRuntime.reconnectTimer) clearTimeout(wsRuntime.reconnectTimer);
        wsRuntime.reconnectTimer = setTimeout(() => {
            wsRuntime.reconnectTimer = null;
            void connectSocket(wsRuntime.connectionDeps ?? deps);
        }, delay);
    };

    socket.onerror = () => {
        socket.close();
    };
}


export function connectSocket(deps: ConnectionDeps): Promise<void> {
    wsRuntime.connectionDeps = deps;

    const current = wsRuntime.globalSocket;
    if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) {
        return Promise.resolve();
    }
    if (wsRuntime.connectPromise) return wsRuntime.connectPromise;

    const pending = openSocket(deps).finally(() => {
        if (wsRuntime.connectPromise === pending) wsRuntime.connectPromise = null;
    });
    wsRuntime.connectPromise = pending;
    return pending;
}

export function reconnectSocketNow(reason = 'manual_reconnect'): void {
    const deps = wsRuntime.connectionDeps;
    if (!deps) return;

    if (wsRuntime.reconnectTimer) {
        clearTimeout(wsRuntime.reconnectTimer);
        wsRuntime.reconnectTimer = null;
    }

    const socket = wsRuntime.globalSocket;
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        try {
            socket.close(4006, reason);
        } catch {
            // Fall through and reconnect below.
        }
        return;
    }

    void connectSocket(deps);
}
