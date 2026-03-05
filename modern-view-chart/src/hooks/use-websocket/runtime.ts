import { WS_URL_FROM_ENV } from './constants';

export type WsTicketPromise = Promise<string> | null;

export const wsRuntime = {
    socketUrl: WS_URL_FROM_ENV || '',
    globalSocket: null as WebSocket | null,
    historyFetched: false,
    reconnectAttempts: 0,

    tickerUpdateBuffer: {} as Record<string, any>,
    tickerUpdateTimer: null as NodeJS.Timeout | null,
    candleUpdateBuffer: {} as Record<string, any>,
    candleUpdateTimer: null as NodeJS.Timeout | null,
    positionUpdateTimer: null as NodeJS.Timeout | null,
    positionUpdateBuffer: null as any,

    subscribeSymbolsTimer: null as NodeJS.Timeout | null,
    foregroundResyncTimer: null as NodeJS.Timeout | null,
    lastForegroundResyncAtByKey: {} as Record<string, number>,

    wsTicketCache: '',
    wsTicketExpiresAt: 0,
    wsTicketPromise: null as WsTicketPromise,

    forceFreshTicketOnReconnect: false,
    unauthorizedFrameReceived: false,

    initialResyncEffectRefCount: 0,
    backfillEventEffectRefCount: 0,
    symbolInterestEffectRefCount: 0,
    initialResyncEffectTeardown: null as (() => void) | null,
    backfillEventEffectTeardown: null as (() => void) | null,
    symbolInterestEffectTeardown: null as (() => void) | null,
};
