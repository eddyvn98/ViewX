import React, { memo } from 'react';

export const Sidebar = memo(function Sidebar() {
    return (
        <div className="fixed left-0 top-0 w-20 h-8 flex items-center justify-center z-[110] pointer-events-none">
            {/* Logo Area - Floating Overlay (Slim Version) */}
            <div className="pointer-events-auto group cursor-pointer">
                <div className="w-7 h-7 bg-gradient-to-br from-primary via-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-[0_2px_10px_rgba(37,99,235,0.3)] group-hover:shadow-[0_2px_15px_rgba(37,99,235,0.5)] transition-all duration-500 transform group-hover:scale-110 active:scale-95 group-hover:rotate-3">
                    <span className="font-black text-white italic text-sm leading-none drop-shadow-sm">V</span>
                </div>
            </div>
        </div>
    );
});
