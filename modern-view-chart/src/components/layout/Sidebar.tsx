import React, { memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export const Sidebar = memo(function Sidebar() {
    return (
        <div className="fixed left-0 top-0 w-20 h-8 flex items-center justify-center z-[110] pointer-events-none">
            <Link
                href="/landing"
                aria-label="Mo landing page vivutrade"
                title="Mo landing page"
                className="pointer-events-auto group cursor-pointer"
            >
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/85 dark:bg-black/30 border border-border/50 flex items-center justify-center shadow-[0_2px_10px_rgba(37,99,235,0.2)] group-hover:shadow-[0_2px_15px_rgba(37,99,235,0.35)] transition-all duration-500 transform group-hover:scale-105 active:scale-95">
                    <Image
                        src="/brand/vivutrade-logo-transparent.png"
                        alt="vivutrade logo"
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                        priority
                    />
                </div>
            </Link>
        </div>
    );
});
