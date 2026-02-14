'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    // Avoid hydration mismatch by only rendering after mounting
    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="w-8 h-8 rounded-md bg-accent/20 animate-pulse" />
        );
    }

    const isDark = theme === 'dark';

    return (
        <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={cn(
                "w-7 h-7 rounded-full transition-all active:scale-95 flex items-center justify-center",
                "bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/50"
            )}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
            {isDark ? (
                <Sun size={15} className="text-yellow-500" />
            ) : (
                <Moon size={15} className="text-blue-500" />
            )}
        </button>
    );
}
