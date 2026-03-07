import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Bat dau nhanh",
  description:
    "Huong dan bat dau nhanh voi vivutrade: mo chart, tao bot generic, theo doi Signals matrix va danh gia dashboard.",
  alternates: { canonical: "/docs/getting-started" },
  openGraph: {
    title: "Bat dau nhanh | vivutrade",
    description: "Checklist 5 buoc de bat dau workflow giao dich tren vivutrade.",
    url: "/docs/getting-started",
    type: "website",
  },
};

const steps = [
  "Mo chart realtime tai route '/'.",
  "Tao bot mau generic trong tab My Bot.",
  "Bat scanner matrix trong tab Signals de theo doi BUY/SELL.",
  "Quan sat dashboard de do winrate, drawdown, equity curve.",
  "Toi uu rule dua tren du lieu backtest va lap lai.",
];

export default function GettingStartedPage() {
  return (
    <main className="h-screen overflow-y-auto bg-gradient-to-b from-sky-50 via-white to-slate-50 px-5 py-10 text-slate-900 md:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Huong dan bat dau nhanh</h1>
        <section className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
          <ol className="list-decimal space-y-3 pl-5 text-slate-700">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link href="/" className="text-primary underline">
            Mo chart
          </Link>
          <Link href="/strategy/dashboard" className="text-primary underline">
            Dashboard chien luoc
          </Link>
        </nav>
      </div>
    </main>
  );
}
