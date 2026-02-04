'use client';

import React from 'react';

/**
 * Renders a sentiment bar showing the percentage of buy vs sell.
 * @returns {JSX.Element}
 */
export function SentimentBar() {
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-bold">
                <span className="text-red-500">64%</span>
                <span className="text-blue-500">36%</span>
            </div>
            <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden flex shadow-inner">
                <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: '64%' }} />
                <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: '36%' }} />
            </div>
        </div>
    );
}
