import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Câu hỏi thường gặp",
  description:
    "FAQ về vivutrade: trading chart realtime, strategy matrix, backtest analytics và quy trình đa khung thời gian.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "FAQ | vivutrade",
    description:
      "Tổng hợp câu hỏi thường gặp để hiểu nhanh cách dùng vivutrade.",
    url: "/faq",
    type: "website",
  },
};

const faqItems = [
  {
    q: "vivutrade dùng để làm gì?",
    a: "vivutrade hỗ trợ theo dõi biểu đồ realtime, giám sát tín hiệu bằng ma trận chiến lược và đánh giá hiệu suất qua backtest analytics.",
  },
  {
    q: "Nền tảng có phù hợp cho giao dịch đa khung thời gian không?",
    a: "Có. Bạn có thể theo dõi tín hiệu theo nhiều timeframe để xác nhận xu hướng và điểm vào lệnh.",
  },
  {
    q: "Backtest trên vivutrade dùng để làm gì?",
    a: "Backtest giúp đo winrate, drawdown, equity curve để kiểm tra chất lượng chiến lược trước khi áp dụng thực tế.",
  },
  {
    q: "Dữ liệu tín hiệu có phải cam kết lợi nhuận không?",
    a: "Không. Tín hiệu chỉ hỗ trợ phân tích và người dùng tự chịu trách nhiệm với quyết định giao dịch.",
  },
  {
    q: "Bắt đầu nhanh với vivutrade như thế nào?",
    a: "Mở trang chart realtime, cấu hình strategy matrix, sau đó theo dõi dashboard để đánh giá hiệu suất.",
  },
];

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

export default function FaqPage() {
  return (
    <main className="h-screen overflow-y-auto bg-gradient-to-b from-sky-50 via-white to-slate-50 px-5 py-10 text-slate-900 md:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          Câu hỏi thường gặp về vivutrade
        </h1>
        <section className="space-y-3">
          {faqItems.map((item) => (
            <article
              key={item.q}
              className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm"
            >
              <h2 className="text-lg font-bold">{item.q}</h2>
              <p className="mt-2 leading-7 text-slate-700">{item.a}</p>
            </article>
          ))}
        </section>
        <nav className="text-sm text-slate-700">
          <Link href="/landing" className="text-primary underline">
            Quay lại landing
          </Link>
        </nav>
      </div>
    </main>
  );
}

