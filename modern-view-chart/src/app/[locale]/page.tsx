'use client';

import { useTranslations } from 'next-intl';
import { Link } from "@/i18n/routing";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Hero } from "@/features/landing/components/Hero";
import { Features } from "@/features/landing/components/Features";
import { Workflow } from "@/features/landing/components/Workflow";
import { LanguageSwitcher } from "@/features/landing/components/LanguageSwitcher";

export default function LandingPage() {
  const t = useTranslations('HomePage');

  return (
    <div
      className="h-screen overflow-y-auto bg-gradient-to-b from-sky-50 via-white to-blue-50/40 text-slate-900 [font-family:Outfit,Segoe_UI,Arial,sans-serif]"
    >
      <header className="border-b border-sky-100 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <nav
            className="flex w-full items-center justify-between"
            aria-label="Primary navigation"
          >
            <Logo showText size={28} />
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <Link
                href="/chart"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-black text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:opacity-90"
              >
                Launch Chart
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-5 py-10 md:gap-20 md:px-8 md:py-14">
        <Hero />
        <Workflow />
        <Features />

        <section className="rounded-2xl border border-sky-100 bg-white/90 p-8 text-center">
          <h2 className="text-2xl font-black mb-4">Professional Trading Intelligence</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Vivutrade combines advanced charting with real-time signal monitoring to give you a competitive edge in Forex, XAUUSD, and Cryptocurrencies.
          </p>
        </section>
      </main>

      <footer className="border-t border-sky-200 bg-white px-5 py-10 md:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="max-w-md space-y-4">
            <Logo showText size={32} />
            <p className="text-sm text-slate-600">
              AI-assisted strategy dashboard and realtime chart monitor for professional traders.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-right">
            <p className="text-xs text-slate-500">
              &copy; {new Date().getFullYear()} Vivutrade. All rights reserved.
            </p>
            <div className="flex gap-4 text-xs text-slate-400">
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
