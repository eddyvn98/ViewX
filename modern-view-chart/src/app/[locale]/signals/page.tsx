'use client';

import React from 'react';
import Link from 'next/link';
import { Activity, ArrowLeft } from 'lucide-react';
import { StrategySignalScanners } from '@/features/strategy/components/StrategySignalScanners';
import { SignalsView } from '@/features/strategy/components/SignalsView';
import { usePathname, useSearchParams } from 'next/navigation';

export default function SignalsMonitorPage() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const locale = pathname.split('/').filter(Boolean)[0] || 'en';

    React.useEffect(() => {
        const focus = searchParams.get('focus');
        if (focus !== 'matrix') return;

        const run = () => {
            const target = document.getElementById('signal-monitor-matrix');
            if (!target) return;
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        const t1 = window.setTimeout(run, 80);
        const t2 = window.setTimeout(run, 320);
        return () => {
            window.clearTimeout(t1);
            window.clearTimeout(t2);
        };
    }, [searchParams]);

    return (
        <div className="h-screen bg-secondary/20 text-foreground overflow-hidden flex flex-col">
            <header className="h-12 shrink-0 border-b border-border/60 bg-background/80 backdrop-blur px-4 flex items-center justify-between">
                <div className="inline-flex items-center gap-2">
                    <Activity size={15} className="text-primary" />
                    <h1 className="text-xs font-black uppercase tracking-[0.16em]">Signal Monitor</h1>
                </div>
                <Link
                    href={`/${locale}/chart`}
                    className="h-7 px-2 rounded-md border border-border/60 bg-background text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
                >
                    <ArrowLeft size={12} />
                    Chart
                </Link>
            </header>
            <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
                <div className="mx-auto w-full max-w-7xl">
                    <section id="signal-monitor-matrix" className="rounded-2xl border border-border/60 bg-background shadow-sm p-4 md:p-5">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm md:text-base font-black uppercase tracking-wider text-foreground/85">Signal Monitor Matrix</h2>
                        </div>
                        <StrategySignalScanners />
                    </section>

                    <section className="mt-4 rounded-2xl border border-border/60 bg-background shadow-sm p-2 md:p-3">
                        <SignalsView showVirtualBalanceCard={false} showMatrix={false} />
                    </section>
                </div>
            </main>
        </div>
    );
}
