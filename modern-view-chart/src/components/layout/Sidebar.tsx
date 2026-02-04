'use client';

import { BarChart2, CandlestickChart, LayoutGrid, Newspaper, Wallet, FolderOpen } from 'lucide-react';

const MENU_ITEMS = [
    { icon: LayoutGrid, label: 'Dashboard' },
    { icon: CandlestickChart, label: 'Chart', active: true },
    { icon: BarChart2, label: 'Markets' },
    { icon: Wallet, label: 'Portfolio' },
    { icon: Newspaper, label: 'News' },
    { icon: FolderOpen, label: 'History' },
];

export function Sidebar({ onToggleMarket }: { onToggleMarket?: () => void }) {
    return (
        <aside className="fixed left-0 top-14 h-[calc(100vh-56px)] w-16 flex-col items-center border-r border-zinc-800 bg-zinc-950 py-4 flex z-20">
            <div className="flex flex-col gap-6 w-full items-center">
                <button
                    onClick={onToggleMarket}
                    className="flex h-10 w-10 items-center justify-center rounded-lg transition-all text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
                    title="Toggle Market List"
                >
                    <BarChart2 size={20} strokeWidth={2} />
                </button>
                {MENU_ITEMS.map((item, index) => (
                    item.label !== 'Markets' && (
                        <button
                            key={index}
                            className={`flex h-10 w-10 items-center justify-center rounded-lg transition-all
              ${item.active
                                    ? 'bg-blue-600/10 text-blue-500'
                                    : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'}
            `}
                            title={item.label}
                        >
                            <item.icon size={20} strokeWidth={2} />
                        </button>
                    )
                ))}
            </div>
        </aside>
    );
}
