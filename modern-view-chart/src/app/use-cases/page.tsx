import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Use Cases Giao Dịch",
  description:
    "Các kịch bản sử dụng vivutrade cho scalping, intraday và swing trading với workflow rõ ràng.",
  alternates: { canonical: "/use-cases" },
  openGraph: {
    title: "Use Cases | vivutrade",
    description:
      "Kịch bản thực tế để vận hành workflow chart, matrix và backtest trên vivutrade.",
    url: "/use-cases",
    type: "website",
  },
};

const cases = [
  {
    title: "Scalping",
    steps: [
      "Theo dõi chart realtime ở khung thấp (1m/5m).",
      "Dùng strategy matrix để xác nhận tín hiệu cùng chiều.",
      "Theo dõi drawdown ngắn hạn để điều chỉnh nhịp vào lệnh.",
    ],
  },
  {
    title: "Intraday",
    steps: [
      "Xác định bias theo khung 15m/1h.",
      "Kiểm tra xác nhận tín hiệu trên matrix trước khi vào lệnh.",
      "Theo dõi dashboard hiệu suất theo phiên giao dịch.",
    ],
  },
  {
    title: "Swing Trading",
    steps: [
      "Dùng khung 4h/D1 để xác định xu hướng chính.",
      "Backtest bộ rule trước khi áp dụng.",
      "So sánh winrate và drawdown để tối ưu chiến lược.",
    ],
  },
];

export default function UseCasesPage() {
  return (
    <main className="h-screen overflow-y-auto bg-gradient-to-b from-sky-50 via-white to-slate-50 px-5 py-10 text-slate-900 md:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          Kịch bản sử dụng vivutrade
        </h1>
        {cases.map((item) => (
          <section
            key={item.title}
            className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm"
          >
            <h2 className="text-2xl font-bold">{item.title}</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-slate-700">
              {item.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </main>
  );
}

