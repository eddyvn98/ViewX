import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Bắt đầu nhanh",
  description:
    "Hướng dẫn bắt đầu nhanh với vivutrade: mở chart, cấu hình matrix, theo dõi dashboard và đánh giá hiệu suất.",
  alternates: { canonical: "/docs/getting-started" },
  openGraph: {
    title: "Bắt đầu nhanh | vivutrade",
    description: "Checklist 5 bước để bắt đầu workflow giao dịch trên vivutrade.",
    url: "/docs/getting-started",
    type: "website",
  },
};

const steps = [
  "Mở chart realtime tại route '/'.",
  "Chọn symbol và timeframe phù hợp với chiến lược.",
  "Bật strategy matrix để theo dõi tín hiệu BUY/SELL.",
  "Quan sát dashboard để đo winrate, drawdown, equity curve.",
  "Tối ưu rule dựa trên dữ liệu backtest và lặp lại.",
];

export default function GettingStartedPage() {
  return (
    <main className="h-screen overflow-y-auto bg-gradient-to-b from-sky-50 via-white to-slate-50 px-5 py-10 text-slate-900 md:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          Hướng dẫn bắt đầu nhanh
        </h1>
        <section className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
          <ol className="list-decimal space-y-3 pl-5 text-slate-700">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link href="/" className="text-primary underline">
            Mở chart
          </Link>
          <Link href="/strategy/dashboard" className="text-primary underline">
            Dashboard chiến lược
          </Link>
          <Link href="/strategy/matrix" className="text-primary underline">
            Matrix chiến lược
          </Link>
        </nav>
      </div>
    </main>
  );
}

