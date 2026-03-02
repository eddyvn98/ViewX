import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Từ điển thuật ngữ",
  description:
    "Từ điển thuật ngữ trading và strategy trên vivutrade: winrate, drawdown, timeframe, matrix, backtest.",
  alternates: { canonical: "/glossary" },
  openGraph: {
    title: "Glossary | vivutrade",
    description: "Giải thích nhanh thuật ngữ quan trọng trong workflow giao dịch.",
    url: "/glossary",
    type: "website",
  },
};

const terms = [
  ["Timeframe", "Khung thời gian dùng để đọc biểu đồ và tín hiệu."],
  ["Strategy Matrix", "Bảng tín hiệu BUY/SELL theo symbol và timeframe."],
  ["Backtest", "Kiểm thử chiến lược trên dữ liệu quá khứ."],
  ["Winrate", "Tỷ lệ lệnh thắng trên tổng số lệnh."],
  ["Drawdown", "Mức giảm vốn lớn nhất trong giai đoạn giao dịch."],
  ["Equity Curve", "Đường cong thể hiện biến động vốn theo thời gian."],
];

export default function GlossaryPage() {
  return (
    <main className="h-screen overflow-y-auto bg-gradient-to-b from-sky-50 via-white to-slate-50 px-5 py-10 text-slate-900 md:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          Từ điển thuật ngữ vivutrade
        </h1>
        <section className="rounded-xl border border-sky-100 bg-white shadow-sm">
          <div className="divide-y divide-sky-100">
            {terms.map(([term, desc]) => (
              <article key={term} className="p-5">
                <h2 className="text-lg font-bold">{term}</h2>
                <p className="mt-1 text-slate-700">{desc}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

