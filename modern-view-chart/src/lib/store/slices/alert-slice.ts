import { StateCreator } from 'zustand';
import { Alert } from '../types';

export interface AlertSlice {
    alerts: Alert[];
    addAlert: (alert: Omit<Alert, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => void;
    removeAlert: (id: string) => void;
    updateAlert: (id: string, updates: Partial<Alert>) => void;
    setAlerts: (alerts: Alert[]) => void;
}

export const createAlertSlice: StateCreator<
    AlertSlice,
    [],
    [],
    AlertSlice
> = (set) => ({
    alerts: [],
    addAlert: (alert) => set((state) => ({
        alerts: [...state.alerts, {
            ...alert,
            id: alert.id || crypto.randomUUID(),
            createdAt: alert.createdAt || Date.now()
        }]
    })),
    removeAlert: (id) => set((state) => ({
        alerts: state.alerts.filter((a) => a.id !== id)
    })),
    updateAlert: (id, updates) => set((state) => ({
        alerts: state.alerts.map((a) =>
            a.id === id ? { ...a, ...updates } : a
        )
    })),
    setAlerts: (alerts) => set({ alerts })
});
