import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Về vivutrade",
  description:
    "Tìm hiểu vivutrade: nền tảng trading chart realtime, strategy matrix monitor và backtest analytics cho nhà giao dịch.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "Về vivutrade",
    description:
      "Giới thiệu năng lực cốt lõi của vivutrade cho workflow giao dịch theo dữ liệu và đa khung thời gian.",
    url: "/about",
    type: "website",
  },
};

const softwareAppStructuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "vivutrade",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  inLanguage: "vi-VN",
  featureList: [
    "Trading chart realtime",
    "Strategy matrix monitor",
    "Backtest analytics",
    "Multi-timeframe workflow",
    "Mobile-ready interface",
  ],
};

const breadcrumbStructuredData = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Landing", item: "/landing" },
    { "@type": "ListItem", position: 2, name: "Về vivutrade", item: "/about" },
  ],
};

export default function AboutPage() {
  return (
    <main className="h-screen overflow-y-auto bg-gradient-to-b from-sky-50 via-white to-slate-50 px-5 py-10 text-slate-900 md:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppStructuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbStructuredData) }}
      />

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <nav className="text-sm text-slate-600">
          <Link href="/landing" className="underline underline-offset-4">
            Landing
          </Link>{" "}
          / <span>Về vivutrade</span>
        </nav>

        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm md:p-8">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            Về vivutrade
          </h1>
          <p className="mt-4 leading-8 text-slate-700">
            vivutrade là nền tảng giao dịch tập trung vào khả năng đọc dữ liệu
            nhanh, ra quyết định theo tín hiệu rõ ràng và đánh giá hiệu suất
            chiến lược bằng số liệu thực. Trọng tâm của hệ thống là trading chart
            realtime, strategy matrix monitor và backtest analytics.
          </p>
        </section>

        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-2xl font-bold">Năng lực cốt lõi</h2>
          <article className="mt-4 space-y-3 leading-8 text-slate-700">
            <p>
              Trading chart realtime hỗ trợ quan sát biến động giá liên tục và
              phản hồi thao tác nhanh trong một workspace thống nhất.
            </p>
            <p>
              Strategy matrix monitor giúp gom tín hiệu BUY/SELL theo symbol và
              timeframe, từ đó giảm nhiễu khi lọc cơ hội giao dịch.
            </p>
            <p>
              Backtest analytics cung cấp chỉ số hiệu suất như winrate, drawdown
              và đường cong vốn để đánh giá chất lượng chiến lược.
            </p>
          </article>
        </section>

        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-2xl font-bold">Câu trả lời ngắn</h2>
          <article className="mt-4 space-y-3 leading-8 text-slate-700">
            <p>
              <strong>vivutrade phù hợp với ai?</strong> Nhà giao dịch cần workflow
              đa khung thời gian và đánh giá tín hiệu theo dữ liệu.
            </p>
            <p>
              <strong>Bắt đầu ở đâu?</strong> Mở{" "}
              <Link href="/" className="font-semibold text-primary underline">
                trang chart
              </Link>{" "}
              rồi chuyển sang{" "}
              <Link
                href="/strategy/dashboard"
                className="font-semibold text-primary underline"
              >
                strategy dashboard
              </Link>{" "}
              để xem hiệu suất chiến lược.
            </p>
          </article>
        </section>

        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-bold">Liên kết liên quan</h2>
          <nav className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/landing" className="text-primary underline">
              Landing
            </Link>
            <Link href="/contact" className="text-primary underline">
              Contact
            </Link>
            <Link href="/privacy" className="text-primary underline">
              Privacy
            </Link>
            <Link href="/terms" className="text-primary underline">
              Terms
            </Link>
          </nav>
        </section>
      </div>
    </main>
  );
}
