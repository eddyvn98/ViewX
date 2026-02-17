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
    activeMobileTab: string;
    isInputFocused: boolean;
    isScrollingPanel: boolean;
    notifications: Notification[];
    focusedTicket: number | null;
    themeColor: 'blue' | 'green' | 'amber' | 'red' | 'slate';
    sidebarTopHeight: number;
    rightSidebarTabOrder: string[];

    setLeftSidebarOpen: (isOpen: boolean) => void;
    toggleLeftSidebar: () => void;
    setRightSidebarOpen: (isOpen: boolean) => void;
    toggleRightSidebar: () => void;
    setActiveRightSidebarTab: (tab: RightSidebarTab) => void;
    setActiveMobileTab: (tab: string) => void;
    setInputFocused: (focused: boolean) => void;
    setIsScrollingPanel: (isScrolling: boolean) => void;
    addNotification: (message: string, type?: Notification['type'], alertId?: string) => void;
    removeNotification: (id: string) => void;
    setFocusedTicket: (ticket: number | null) => void;
    setSidebarTopHeight: (height: number) => void;
    setRightSidebarTabOrder: (order: string[]) => void;
    setThemeColor: (color: 'blue' | 'green' | 'amber' | 'red' | 'slate') => void;
}

export const createUISlice: StateCreator<RootState, [], [], UISlice> = (set) => ({
    isLeftSidebarOpen: false,
    isRightSidebarOpen: true,
    activeRightSidebarTab: 'strategy',
    activeMobileTab: 'chart',
    isInputFocused: false,
    isScrollingPanel: false,
    notifications: [],
    focusedTicket: null,
    sidebarTopHeight: 40,
    rightSidebarTabOrder: ['strategy', 'layer', 'trade'],
    themeColor: 'green',

    setLeftSidebarOpen: (isOpen) => set({ isLeftSidebarOpen: isOpen }),
    toggleLeftSidebar: () => set((state) => ({ isLeftSidebarOpen: !state.isLeftSidebarOpen })),
    setRightSidebarOpen: (isOpen) => set({ isRightSidebarOpen: isOpen }),
    toggleRightSidebar: () => set((state) => ({ isRightSidebarOpen: !state.isRightSidebarOpen })),
    setActiveRightSidebarTab: (tab) => set({ activeRightSidebarTab: tab }),
    setActiveMobileTab: (tab) => set({ activeMobileTab: tab }),
    setInputFocused: (focused) => set({ isInputFocused: focused }),
    setIsScrollingPanel: (isScrolling) => set((state) => state.isScrollingPanel === isScrolling ? state : { isScrollingPanel: isScrolling }),
    addNotification: (message, type = 'info', alertId) => set((state) => ({
        notifications: [...state.notifications, { id: crypto.randomUUID(), message, type, alertId }]
    })),
    removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id)
    })),
    setFocusedTicket: (ticket) => set({ focusedTicket: ticket }),
    setSidebarTopHeight: (height) => set({ sidebarTopHeight: height }),
    setRightSidebarTabOrder: (order) => set({ rightSidebarTabOrder: order }),
    setThemeColor: (color) => {
        set({ themeColor: color });
        // Handle persistent storage and DOM update
        if (typeof window !== 'undefined') {
            localStorage.setItem('theme-color', color);
            // Remove old theme classes
            document.documentElement.classList.remove('theme-blue', 'theme-green', 'theme-amber', 'theme-red', 'theme-slate');
            // Add new theme class
            document.documentElement.classList.add(`theme-${color}`);
        }
    },
});
