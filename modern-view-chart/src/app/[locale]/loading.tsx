import React from 'react';
import { Logo } from '@/components/layout/Logo';

export default function Loading() {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white dark:bg-[#0b0e14]">
            <div className="relative flex flex-col items-center gap-6">
                {/* Animated Logo */}
                <div className="relative animate-pulse">
                    <Logo size={48} className="opacity-80" />
                    <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                </div>

                {/* Loading Bar Container */}
                <div className="w-48 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                    <div className="h-full bg-primary animate-[loading-bar_1.5s_ease-in-out_infinite] origin-left" />
                </div>

                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-white/20 animate-pulse">
                    Connecting to workspace...
                </p>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes loading-bar {
          0% { transform: scaleX(0); }
          50% { transform: scaleX(0.7); }
          100% { transform: scaleX(1); opacity: 0; }
        }
      `}} />
        </div>
    );
}
