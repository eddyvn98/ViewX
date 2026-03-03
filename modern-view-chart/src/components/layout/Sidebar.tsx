import React, { memo } from 'react';
import Link from 'next/link';
import { Logo } from './Logo';

export const Sidebar = memo(function Sidebar() {
    return (
        <div className="fixed left-0 top-0 w-20 h-8 flex items-center justify-center z-[110] pointer-events-none">
            <Link
                href="/landing"
                aria-label="Mo landing page vivutrade"
                title="Mo landing page"
                className="pointer-events-auto group cursor-pointer"
            >
                <Logo size={32} className="transition-all duration-500 transform group-hover:scale-105 active:scale-95" />
            </Link>
        </div>
    );
});
