import { buildSocketConfig, fetchWsTicketFromApi } from './socket-config';
import { wsRuntime } from './runtime';
import { collectActiveSymbolsFromStore } from './symbol-utils';
import { handleSocketMessage, MessageHandlerDeps } from './message-handler';
import { getClientEntitlements } from '@/lib/auth/entitlements';
import { readStoredAccessToken } from '@/lib/auth/session';

export interface ConnectionDeps extends MessageHandlerDeps {
    setConnected: (connected: boolean) => void;
    setBridgeOnline: (online: boolean) => void;
}

export async function connectSocket(deps: ConnectionDeps): Promise<void> {
    const mustRefreshTicket = wsRuntime.forceFreshTicketOnReconnect;
    const socketConfig = buildSocketConfig({ ignoreUrlCredential: mustRefreshTicket });
    if (mustRefreshTicket) {
        wsRuntime.wsTicketCache = '';
        wsRuntime.wsTicketExpiresAt = 0;
    }
    const storedAccessToken = readStoredAccessToken();
    if (storedAccessToken) {
        socketConfig.protocols = [`bearer.${storedAccessToken}`];
    } else if (socketConfig.protocols.length === 0 || mustRefreshTicket) {
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
        let userId: string | null = null;
        if (typeof window !== 'undefined') {
            const rawUser = String(localStorage.getItem('auth_user') || '').trim();
            if (rawUser) {
                try {
                    const parsed = JSON.parse(rawUser) as {
                        id?: string | number;
                        _id?: string | number;
                        userId?: string | number;
                    };
                    const candidate = parsed.id ?? parsed._id ?? parsed.userId;
                    if (candidate !== undefined && candidate !== null) {
                        const normalized = String(candidate).trim();
                        userId = normalized || null;
                    }
                } catch {
                    userId = null;
                }
            }
        }
        const symbols = collectActiveSymbolsFromStore();
        const entitlements = getClientEntitlements();
        socket.send(JSON.stringify({
            topic: 'auth',
            ...(userId ? { userId } : {}),
            symbols,
            plan: entitlements.plan,
            modules: entitlements.modules,
            subscription: {
                plan: entitlements.plan,
                modules: entitlements.modules,
            },
        }));
        socket.send(JSON.stringify({ topic: 'subscribeSymbols', symbols }));
    };

    socket.onmessage = (event) => {
        handleSocketMessage(event, socket, deps);
    };

    socket.onclose = (closeEvent) => {
        deps.setConnected(false);
        deps.setBridgeOnline(false);
        if (wsRuntime.globalSocket === socket) {
            wsRuntime.globalSocket = null;
        }
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
        setTimeout(() => {
            void connectSocket(deps);
        }, delay);
    };

    socket.onerror = () => {
        socket.close();
    };
}
