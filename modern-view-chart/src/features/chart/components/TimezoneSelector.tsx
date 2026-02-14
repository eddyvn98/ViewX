'use client';

import React, { useState, useMemo } from 'react';
import { Globe, Search, Check } from 'lucide-react';
import { useMarketStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const POPULAR_TIMEZONES = [
    { id: 'Etc/UTC', label: 'UTC (Greenwich)' },
    { id: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh (UTC+7)' },
    { id: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
    { id: 'Asia/Seoul', label: 'Seoul (UTC+9)' },
    { id: 'Asia/Singapore', label: 'Singapore (UTC+8)' },
    { id: 'Europe/London', label: 'London (BST/GMT)' },
    { id: 'Europe/Paris', label: 'Paris (CEST/CET)' },
    { id: 'Europe/Berlin', label: 'Berlin (CEST/CET)' },
    { id: 'America/New_York', label: 'New York (EDT/EST)' },
    { id: 'America/Chicago', label: 'Chicago (CDT/CST)' },
    { id: 'America/Los_Angeles', label: 'Los Angeles (PDT/PST)' },
    { id: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
];

export function TimezoneSelector() {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    const activeTabId = useMarketStore(state => state.activeTabId);
    const activeTab = useMarketStore(state => state.tabs[activeTabId]);
    const activeChartId = activeTab?.activeChartId;
    const activeChart = activeChartId ? activeTab.charts[activeChartId] : null;
    const setChartTimezone = useMarketStore(state => state.setChartTimezone);

    const currentTimezone = activeChart?.timezone || 'Asia/Ho_Chi_Minh';

    const displayLabel = useMemo(() => {
        const tz = POPULAR_TIMEZONES.find(t => t.id === currentTimezone);
        if (!tz) return 'UTC';
        // Extract UTC+X part if exists, else the first part of label
        const match = tz.label.match(/\(([^)]+)\)/);
        return match ? match[1] : tz.label.split(' ')[0];
    }, [currentTimezone]);

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

    if (!activeChart) return null;

    return (
        <div className="relative border-l border-zinc-800/50 dark:border-zinc-800/50 border-zinc-200/50 pl-2 ml-1">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors",
                    "text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80",
                    isOpen && "bg-secondary text-foreground"
                )}
                title={`Current Timezone: ${currentTimezone}`}
            >
                <Globe className="w-3.5 h-3.5" />
                <span className="truncate max-w-[80px]">
                    {displayLabel}
                </span>
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-background border border-border rounded-lg shadow-xl z-[101] overflow-hidden">
                        <div className="p-2 border-b border-border">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Search timezone..."
                                    className="w-full bg-secondary/50 border-none rounded-md py-1.5 pl-7 pr-3 text-[12px] text-foreground focus:ring-1 focus:ring-primary/50 outline-none placeholder:text-muted-foreground/50"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
                            {filteredTimezones.map((tz) => (
                                <button
                                    key={tz.id}
                                    onClick={() => handleSelect(tz.id)}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2 rounded-md text-[12px] transition-colors group",
                                        currentTimezone === tz.id
                                            ? "bg-primary/10 text-primary"
                                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                    )}
                                >
                                    <div className="flex flex-col items-start translate-x-0 group-hover:translate-x-1 transition-transform">
                                        <span className="font-medium">{tz.label}</span>
                                        <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400">{tz.id}</span>
                                    </div>
                                    {currentTimezone === tz.id && <Check className="w-3.5 h-3.5" />}
                                </button>
                            ))}
                            {filteredTimezones.length === 0 && (
                                <div className="py-8 text-center text-zinc-500 text-[12px]">
                                    No timezones found
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
