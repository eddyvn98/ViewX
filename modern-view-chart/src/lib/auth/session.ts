'use client';

import {
    clearStoredAuthSession as clearStoredAuthSessionInternal,
    getAuthChangedEventName,
    getStoredAccessToken,
    getStoredAuthUser,
    refreshAccessToken,
    updateStoredSession,
} from './client-session';

export function readStoredAccessToken(): string {
    return getStoredAccessToken();
}

export function readStoredAuthUser(): string {
    return getStoredAuthUser();
}

export function writeStoredAuthSession(accessToken: string, user?: unknown) {
    updateStoredSession(accessToken, user);
}

export function clearStoredAuthSession() {
    clearStoredAuthSessionInternal();
}

export function refreshStoredAccessToken(): Promise<string> {
    return refreshAccessToken();
}

export function getStoredAuthChangedEventName(): string {
    return getAuthChangedEventName();
}
