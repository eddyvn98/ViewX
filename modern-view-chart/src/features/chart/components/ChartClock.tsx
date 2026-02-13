'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useMarketStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { Clock, Globe, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const POPULAR_TIMEZONES = [
    { id: 'Etc/UTC', label: 'UTC (GMT+0)' },
    { id: 'Asia/Ho_Chi_Minh', label: 'Hanoi, Bangkok, Jakarta (UTC+7)' },
    { id: 'Asia/Tokyo', label: 'Tokyo, Seoul (UTC+9)' },
    { id: 'Asia/Singapore', label: 'Singapore, Hong Kong (UTC+8)' },
    { id: 'Europe/London', label: 'London (GMT/BST)' },
    { id: 'Europe/Paris', label: 'Paris, Berlin, Rome (CET/CEST)' },
    { id: 'America/New_York', label: 'New York (EST/EDT)' },
    { id: 'America/Chicago', label: 'Chicago (CST/CDT)' },
    { id: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
    { id: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
];

export function ChartClock() {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const timeRef = useRef<HTMLSpanElement>(null);

    const activeTabId = useMarketStore(state => state.activeTabId);
    const { timezone, activeChartId } = useMarketStore(useShallow(state => {
        const activeTab = state.tabs[activeTabId];
        const activeChartId = activeTab?.activeChartId;
        const activeChart = activeChartId ? activeTab.charts[activeChartId] : null;
        return {
            timezone: activeChart?.timezone || 'Asia/Ho_Chi_Minh',
            activeChartId
        };
    }));

    const setChartTimezone = useMarketStore(state => state.setChartTimezone);

    const utcOffset = useMemo(() => {
        try {
            const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                timeZoneName: 'shortOffset'
            }).formatToParts(new Date());
            const offsetPart = parts.find(p => p.type === 'timeZoneName');
            return offsetPart ? offsetPart.value.replace('GMT', 'UTC') : 'UTC';
        } catch (e) {
            return 'UTC';
        }
    }, [timezone]);

    const filteredTimezones = useMemo(() => {
        if (!search) return POPULAR_TIMEZONES;
        return POPULAR_TIMEZONES.filter(tz =>
            tz.label.toLowerCase().includes(search.toLowerCase()) ||
            tz.id.toLowerCase().includes(search.toLowerCase())
        );
    }, [search]);

    const handleSelect = (id: string) => {
        if (activeChartId) {
            setChartTimezone(activeChartId, id);
        }
        setIsOpen(false);
    };

    useEffect(() => {
        const updateClock = () => {
            if (!timeRef.current) return;
            const now = new Date();
            const timeStr = new Intl.DateTimeFormat('en-GB', {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            }).format(now);

            timeRef.current.textContent = timeStr;
        };

        const timer = setInterval(updateClock, 1000);
        updateClock();

        return () => clearInterval(timer);
    }, [timezone]);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-2.5 px-3 py-1 bg-zinc-900/40 rounded-md border transition-all select-none group",
                    isOpen ? "border-blue-500/50 bg-blue-500/10 shadow-[0_0_12px_rgba(59,130,246,0.15)]" : "border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-800/40"
                )}
            >
                <Clock size={12} className={cn("transition-colors", isOpen ? "text-blue-400" : "text-zinc-500 group-hover:text-zinc-400")} />
                <span
                    ref={timeRef}
                    className="text-[11px] font-bold text-zinc-200 font-mono tracking-wider"
                >
                    --:--:--
                </span>
                <span className="text-[9px] font-black text-blue-500 uppercase tracking-tight bg-blue-500/10 px-1.5 py-0.5 rounded leading-none">
                    {utcOffset}
                </span>
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full right-0 mt-2 w-72 bg-[#1c202b] border border-zinc-800 rounded-lg shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
                        <div className="p-2.5 border-b border-zinc-800 bg-black/20">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Search timezone..."
                                    className="w-full bg-black/40 border-none rounded-md py-2 pl-8 pr-3 text-[12px] text-zinc-200 focus:ring-1 focus:ring-blue-500/40 outline-none placeholder:text-zinc-600"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="max-h-[320px] overflow-y-auto custom-scrollbar p-1">
                            {filteredTimezones.map((tz) => (
                                <button
                                    key={tz.id}
                                    onClick={() => handleSelect(tz.id)}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2.5 rounded-md text-[12px] transition-all group/item",
                                        timezone === tz.id
                                            ? "bg-blue-500/15 text-blue-400"
                                            : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                    )}
                                >
                                    <div className="flex flex-col items-start transition-transform group-hover/item:translate-x-0.5">
                                        <span className="font-bold leading-tight">{tz.label}</span>
                                        <span className="text-[10px] text-zinc-600 group-hover:text-zinc-500">{tz.id}</span>
                                    </div>
                                    {timezone === tz.id && <Check className="w-3.5 h-3.5 text-blue-400" />}
                                </button>
                            ))}
                            {filteredTimezones.length === 0 && (
                                <div className="py-10 text-center text-zinc-600 text-[12px]">
                                    No results found
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default React.memo(ChartClock);
