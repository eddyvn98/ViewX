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
    rightSidebarWidth: number;
    rightSidebarTabOrder: string[];
    isDrawingToolbarVisible: boolean;
    isChartLegendVisible: boolean;

    setLeftSidebarOpen: (isOpen: boolean) => void;
    toggleLeftSidebar: () => void;
    setRightSidebarOpen: (isOpen: boolean) => void;
    toggleRightSidebar: () => void;
    toggleDrawingToolbar: () => void;
    setDrawingToolbarVisible: (visible: boolean) => void;
    setActiveRightSidebarTab: (tab: RightSidebarTab) => void;
    setActiveMobileTab: (tab: string) => void;
    setInputFocused: (focused: boolean) => void;
    setIsScrollingPanel: (isScrolling: boolean) => void;
    addNotification: (message: string, type?: Notification['type'], alertId?: string) => void;
    removeNotification: (id: string) => void;
    setFocusedTicket: (ticket: number | null) => void;
    setSidebarTopHeight: (height: number) => void;
    setRightSidebarWidth: (width: number) => void;
    setRightSidebarTabOrder: (order: string[]) => void;
    setThemeColor: (color: 'blue' | 'green' | 'amber' | 'red' | 'slate') => void;
    setChartLegendVisible: (visible: boolean) => void;
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
    rightSidebarWidth: 320,
    rightSidebarTabOrder: ['strategy', 'layer', 'trade'],
    themeColor: 'green',
    isDrawingToolbarVisible: false,
    isChartLegendVisible: true,

    setLeftSidebarOpen: (isOpen) => set({ isLeftSidebarOpen: isOpen }),
    toggleLeftSidebar: () => set((state) => ({ isLeftSidebarOpen: !state.isLeftSidebarOpen })),
    setRightSidebarOpen: (isOpen) => set({ isRightSidebarOpen: isOpen }),
    toggleRightSidebar: () => set((state) => ({ isRightSidebarOpen: !state.isRightSidebarOpen })),
    toggleDrawingToolbar: () => set((state) => ({ isDrawingToolbarVisible: !state.isDrawingToolbarVisible })),
    setDrawingToolbarVisible: (visible) => set({ isDrawingToolbarVisible: visible }),
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
    setRightSidebarWidth: (width) => {
        const value = Math.max(280, Math.min(640, Math.round(width)));
        set({ rightSidebarWidth: value });
        if (typeof window !== 'undefined') localStorage.setItem('right-sidebar-width', String(value));
    },
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
    setChartLegendVisible: (visible) => set({ isChartLegendVisible: visible }),
});
