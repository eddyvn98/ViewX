'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
    className?: string;
    iconClassName?: string;
    showText?: boolean;
    size?: number;
}

export function Logo({
    className,
    iconClassName,
    showText = false,
    size = 28
}: LogoProps) {
    const logoSrc = '/brand/vivutrade-logo.svg?v=star-rebuild-1';
    const fallbackSrc = '/brand/vivutrade-logo-transparent.png?v=star-updated';

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <div
                className={cn(
                    'relative flex items-center justify-center rounded-lg overflow-hidden bg-transparent',
                    iconClassName
                )}
                style={{ width: size, height: size }}
            >
                <img
                    src={logoSrc}
                    alt='vivutrade logo'
                    className='w-full h-full object-contain'
                    onError={(event) => {
                        const target = event.currentTarget;
                        if (target.src.includes('vivutrade-logo-transparent.png')) return;
                        target.src = fallbackSrc;
                    }}
                />
            </div>

            {showText && (
                <span className='text-sm font-black uppercase tracking-[0.18em] text-foreground'>
                    vivutrade
                </span>
            )}
        </div>
    );
}
