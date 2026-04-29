'use client';

import * as React from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import type { ClientModule } from '@/lib/auth/entitlements';
import { cn } from '@/lib/utils';
import { getModuleGuideContent, renderGuideSection } from '@/features/modules/module-guide-content';

type ModuleGuideModalProps = {
  open: boolean;
  locale: string;
  module: ClientModule | null;
  onClose: () => void;
};

export function ModuleGuideModal({ open, locale, module, onClose }: ModuleGuideModalProps) {
  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !module) return null;

  const guide = getModuleGuideContent(module, locale);

  return (
    <div className="dark fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/72 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#020617] shadow-[0_30px_120px_rgba(2,6,23,0.75)]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Decorative gradients */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[80px] rounded-full" />
          <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-blue-500/10 blur-[80px] rounded-full" />
        </div>

        <div className="relative z-10 flex flex-col overflow-hidden">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close module guide"
          className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-slate-950/70 text-slate-100 transition hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
          <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl md:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-300">{guide.badge}</p>
            <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-white md:text-5xl">{guide.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">{guide.summary}</p>
            
            {guide.poster ? (
              <div className="mt-8 overflow-hidden rounded-[24px] border border-white/10 bg-slate-900 shadow-2xl">
                <img 
                  src={guide.poster} 
                  alt={`${guide.badge} preview`} 
                  className="w-full object-cover aspect-video"
                />
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={guide.primaryCta.download ? guide.primaryCta.href : `/${locale}${guide.primaryCta.href}`}
                download={guide.primaryCta.download}
                className="inline-flex items-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:scale-[1.01] hover:bg-emerald-400"
              >
                {guide.primaryCta.label}
              </a>
              {guide.secondaryCta ? (
                <Link
                  href={`/${locale}${guide.secondaryCta.href}`}
                  className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  {guide.secondaryCta.label}
                </Link>
              ) : null}
            </div>
          </section>

          <div className={cn('mt-6 grid gap-6', module === 'your_mt5' ? 'lg:grid-cols-[1.12fr_0.88fr]' : 'lg:grid-cols-2')}>
            {guide.sections.map((section) => renderGuideSection(section))}
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
