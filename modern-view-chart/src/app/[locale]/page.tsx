'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from "@/i18n/routing";
import { ArrowRight, Bot, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Hero } from "@/features/landing/components/Hero";
import { LanguageSwitcher } from "@/features/landing/components/LanguageSwitcher";
import dynamic from 'next/dynamic';

const Workflow = dynamic(() => import('@/features/landing/components/Workflow').then(m => ({ default: m.Workflow })), { ssr: true });
const Features = dynamic(() => import('@/features/landing/components/Features').then(m => ({ default: m.Features })), { ssr: true });

export default function LandingPage() {
  const locale = useLocale();
  const navT = useTranslations('Navigation');
  const docsLabel = locale === 'vi' ? 'Thông tin' : 'Information';

  return (
    <div
      className="h-screen overflow-y-auto bg-gradient-to-b from-slate-50 via-white to-sky-50/30 text-slate-900 [font-family:Outfit,Segoe_UI,Arial,sans-serif]"
    >
      <header className="sticky top-0 z-50 border-b border-sky-100 bg-white/70 backdrop-blur-xl transition-all">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-3 md:px-8">
          <nav
            className="flex w-full items-center justify-between"
            aria-label="Primary navigation"
          >
            <Logo showText size={28} />
            <div className="flex items-center gap-2 md:gap-4">
              <LanguageSwitcher />
              <Link
                href="/chart"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-black text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-primary/30"
              >
                Launch App
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-5 py-10 md:gap-24 md:px-8 md:py-16">
        <Hero />
        
        <Workflow />
        
        <Features />

        <section className="relative overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 px-8 py-16 text-center shadow-2xl md:px-16 md:py-24">
          <div className="absolute inset-0 bg-[url('/brand/grid.svg')] bg-center opacity-10 mix-blend-overlay"></div>
          <div className="relative z-10 mx-auto max-w-3xl space-y-8">
            <h2 className="text-3xl font-black text-white md:text-5xl">Ready to Trade with AI?</h2>
            <p className="text-lg leading-relaxed text-slate-300 md:text-xl">
              Join professional traders who leverage our MT5 data, Diamond charts, and AI-driven insights to maintain their edge in the markets.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                href="/chart"
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-black text-slate-900 transition-all hover:scale-105 hover:bg-sky-50"
              >
                Start Trading Now
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 pt-8 text-sm font-medium text-slate-400">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                No credit card required
              </span>
              <span className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-blue-400" />
                AI Strategy Builder included
              </span>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-5 py-12 md:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="max-w-md space-y-4">
            <Logo showText size={32} />
            <p className="text-sm leading-relaxed text-slate-500">
              The premier AI-assisted strategy dashboard and realtime chart monitor for professional traders. Powered by direct MT5 broker connections.
            </p>
          </div>
          <div className="flex flex-col gap-4 lg:text-right">
            <div className="flex flex-wrap lg:justify-end gap-6 text-sm font-semibold text-slate-700">
              <Link className="hover:text-primary transition-colors" href="/chart">{navT('chart')}</Link>
              <Link className="hover:text-primary transition-colors" href="/strategy/matrix">{navT('matrix')}</Link>
              <Link className="hover:text-primary transition-colors" href="/strategy/dashboard">{navT('dashboard')}</Link>
            </div>
            <p className="text-xs text-slate-400">
              &copy; {new Date().getFullYear()} Vivutrade. All rights reserved.
            </p>
            <div className="mt-2 flex flex-wrap lg:justify-end gap-4 text-xs font-medium text-slate-400">
              <span className="text-slate-500">{docsLabel}:</span>
              <Link className="hover:text-slate-700" href="/faq">FAQ</Link>
              <Link className="hover:text-slate-700" href="/about">About</Link>
              <Link className="hover:text-slate-700" href="/methodology">Methodology</Link>
              <Link className="hover:text-slate-700" href="/contact">Contact</Link>
              <Link className="hover:text-slate-700" href="/terms">Terms</Link>
              <Link className="hover:text-slate-700" href="/privacy">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
