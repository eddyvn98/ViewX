'use client';

import React, { useEffect, useState } from 'react';
import { useMarketStore } from '@/lib/store';
import { Clock } from 'lucide-react';

export function ChartClock() {
    const [time, setTime] = useState<string>('');
    const timezone = useMarketStore(state => {
        const activeTab = state.tabs[state.activeTabId];
        const activeChart = activeTab?.charts[activeTab.activeChartId || ''];
        return activeChart?.timezone || 'Asia/Ho_Chi_Minh';
    });

    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            const timeStr = new Intl.DateTimeFormat('en-GB', {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            }).format(now);
            setTime(timeStr);
        };

        const timer = setInterval(updateClock, 1000);
        updateClock();

        return () => clearInterval(timer);
    }, [timezone]);

    return (
        <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900/50 rounded-md border border-zinc-800 hover:border-zinc-700 transition-colors group">
            <Clock size={12} className="text-zinc-500 group-hover:text-blue-400 transition-colors" />
            <span className="text-[11px] font-bold text-zinc-300 font-mono tracking-wider">
                {time}
            </span>
            <span className="text-[9px] font-medium text-zinc-600 uppercase">
                {timezone.split('/').pop()?.replace('_', ' ')}
            </span>
        </div>
    );
}
