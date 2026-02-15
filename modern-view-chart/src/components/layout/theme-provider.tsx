'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useMarketStore } from '@/lib/store';

export function ThemeProvider({
    children,
    ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
    const themeColor = useMarketStore((state) => state.themeColor);

    React.useEffect(() => {
        const root = window.document.body;
        // Remove old theme classes
        root.classList.remove('theme-slate', 'theme-blue', 'theme-green', 'theme-red', 'theme-amber');
        // Add new theme class if it exists and isn't 'slate' (default)
        if (themeColor && themeColor !== 'slate') {
            root.classList.add(`theme-${themeColor}`);
        }
    }, [themeColor]);

    return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
