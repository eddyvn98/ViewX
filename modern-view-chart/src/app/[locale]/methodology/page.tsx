import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Phương pháp tính chỉ số",
  description:
    "Giải thích phương pháp tính các chỉ số trên vivutrade như winrate, drawdown, equity curve và profit factor.",
  alternates: { canonical: "/methodology" },
  openGraph: {
    title: "Methodology | vivutrade",
    description: "Minh bạch cách tính chỉ số hiệu suất và đánh giá chiến lược.",
    url: "/methodology",
    type: "website",
  },
};

export default function MethodologyPage() {
  return (
    <main className="h-screen overflow-y-auto bg-gradient-to-b from-sky-50 via-white to-slate-50 px-5 py-10 text-slate-900 md:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          Phương pháp tính chỉ số
        </h1>
        <section className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm text-slate-700">
          <h2 className="text-xl font-bold text-slate-900">Winrate</h2>
          <p className="mt-2 leading-7">
            Winrate = (Số lệnh thắng / Tổng số lệnh) x 100%.
          </p>
        </section>
        <section className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm text-slate-700">
          <h2 className="text-xl font-bold text-slate-900">Drawdown</h2>
          <p className="mt-2 leading-7">
            Drawdown đo mức giảm vốn lớn nhất từ đỉnh gần nhất đến đáy tiếp theo
            trong chuỗi giao dịch.
          </p>
        </section>
        <section className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm text-slate-700">
          <h2 className="text-xl font-bold text-slate-900">Equity Curve</h2>
          <p className="mt-2 leading-7">
            Equity Curve thể hiện biến động vốn theo thời gian để đánh giá độ ổn
            định của chiến lược.
          </p>
        </section>
        <section className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm text-slate-700">
          <h2 className="text-xl font-bold text-slate-900">Profit Factor</h2>
          <p className="mt-2 leading-7">
            Profit Factor = Tổng lợi nhuận lệnh thắng / Tổng thua lỗ lệnh thua.
          </p>
        </section>
      </div>
    </main>
  );
}

