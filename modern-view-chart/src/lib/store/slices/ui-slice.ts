import { StateCreator } from 'zustand';
import { RootState } from '../index';
import { RightSidebarTab } from '../types';

export interface Notification {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    alertId?: string; // For click-to-edit
}

export interface UISlice {
    isLeftSidebarOpen: boolean;
    isRightSidebarOpen: boolean;
    activeRightSidebarTab: RightSidebarTab;
    notifications: Notification[];

    setLeftSidebarOpen: (isOpen: boolean) => void;
    toggleLeftSidebar: () => void;
    setRightSidebarOpen: (isOpen: boolean) => void;
    toggleRightSidebar: () => void;
    setActiveRightSidebarTab: (tab: RightSidebarTab) => void;
    addNotification: (message: string, type?: Notification['type'], alertId?: string) => void;
    removeNotification: (id: string) => void;
}

export const createUISlice: StateCreator<RootState, [], [], UISlice> = (set) => ({
    isLeftSidebarOpen: false,
    isRightSidebarOpen: true,
    activeRightSidebarTab: 'market',
    notifications: [],

    setLeftSidebarOpen: (isOpen) => set({ isLeftSidebarOpen: isOpen }),
    toggleLeftSidebar: () => set((state) => ({ isLeftSidebarOpen: !state.isLeftSidebarOpen })),
    setRightSidebarOpen: (isOpen) => set({ isRightSidebarOpen: isOpen }),
    toggleRightSidebar: () => set((state) => ({ isRightSidebarOpen: !state.isRightSidebarOpen })),
    setActiveRightSidebarTab: (tab) => set({ activeRightSidebarTab: tab }),
    addNotification: (message, type = 'info', alertId) => set((state) => ({
        notifications: [...state.notifications, { id: crypto.randomUUID(), message, type, alertId }]
    })),
    removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id)
    })),
});
