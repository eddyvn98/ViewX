'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface OrderTypeTabsProps {
    orderType: 'market' | 'pending';
    setOrderType: (type: 'market' | 'pending') => void;
}

export function OrderTypeTabs({ orderType, setOrderType }: OrderTypeTabsProps) {
    return (
        <div className="flex bg-secondary/20 p-1 rounded-lg">
            <button
                onClick={() => setOrderType('market')}
                className={cn(
                    "flex-1 py-1.5 rounded-md text-[12px] font-medium transition-all",
                    orderType === 'market' ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground/70"
                )}
            >
                Thị trường
            </button>
            <button
                onClick={() => setOrderType('pending')}
                className={cn(
                    "flex-1 py-1.5 rounded-md text-[12px] font-medium transition-all",
                    orderType === 'pending' ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground/70"
                )}
            >
                Đang chờ
            </button>
        </div>
    );
}
