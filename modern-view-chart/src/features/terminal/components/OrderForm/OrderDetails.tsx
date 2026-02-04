'use client';

import React from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderDetailsProps {
    isDetailsExpanded: boolean;
    setIsDetailsExpanded: (v: boolean) => void;
    spread: string;
}

export function OrderDetails({
    isDetailsExpanded,
    setIsDetailsExpanded,
    spread
}: OrderDetailsProps) {
    const details = [
        { label: 'Phí giao dịch', value: `≈ ${spread} USD`, info: true },
        { label: 'Đòn bẩy', value: '1:2000', info: true },
        { label: 'Ký quỹ', value: '2.44 USD', info: true },
        { label: 'Phí qua đêm', value: '-0.53 USD', info: true },
        { label: 'Giá trị điểm cơ bản', value: '0.01 USD' },
        { label: 'Khối lượng theo đơn vị', value: '1.00 Troy oz.' },
        { label: 'Khối lượng theo USD', value: '4,872.58 USD' },
    ];

    return (
        <div className="pt-2 border-t border-zinc-800/50">
            <button
                onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                className="flex items-center gap-1 text-[11px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors"
            >
                {isDetailsExpanded ? 'Thu gọn' : 'Xem chi tiết'}
                <ChevronDown size={14} className={cn("transition-transform duration-300", isDetailsExpanded && "rotate-180")} />
            </button>

            {isDetailsExpanded && (
                <div className="mt-3 space-y-2.5">
                    {details.map((detail, idx) => (
                        <div key={idx} className="flex justify-between items-center leading-none">
                            <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                                {detail.label} {detail.info && <Info size={10} className="text-zinc-800" />}
                            </span>
                            <span className="text-[11px] font-bold text-zinc-300 tracking-tight">{detail.value}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
