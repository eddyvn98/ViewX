import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ChartCandlestick,
  Gauge,
  Layers,
  LineChart,
  MonitorSmartphone,
  Radio,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "vivutrade | Nền tảng Chart & Strategy",
  description:
    "Landing page giới thiệu vivutrade: trading chart realtime, strategy matrix monitor, backtest analytics và workflow đa khung thời gian.",
  keywords: [
    "vivutrade",
    "trading chart",
    "strategy matrix",
    "backtest",
    "realtime signals",
    "multi timeframe",
  ],
  openGraph: {
    title: "vivutrade | Nền tảng Chart & Strategy",
    description:
      "Trading chart realtime, strategy matrix monitor và backtest analytics trong một không gian làm việc thống nhất.",
    type: "website",
    url: "/landing",
    siteName: "vivutrade",
    images: ["/landing/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "vivutrade | Nền tảng Chart & Strategy",
    description:
      "Trading chart realtime, strategy matrix monitor và backtest analytics trong một không gian làm việc thống nhất.",
    images: ["/landing/opengraph-image"],
  },
  alternates: {
    canonical: "/landing",
  },
};

const featureCards = [
  {
    title: "Không Gian Biểu Đồ Realtime",
    description:
      "Không gian biểu đồ tối ưu cho phân tích nhanh, đồng bộ dữ liệu thời gian thực và thao tác mượt trên nhiều layout.",
    icon: LineChart,
  },
  {
    title: "Giám Sát Ma Trận Chiến Lược",
    description:
      "Theo dõi tín hiệu BUY/SELL theo symbol và timeframe bằng ma trận trực quan để phát hiện cơ hội tức thời.",
    icon: Layers,
  },
  {
    title: "Bảng Điều Khiển Backtest",
    description:
      "Đo lường hiệu suất bằng equity curve, trade history và thống kê rủi ro để cải tiến chiến lược theo dữ liệu.",
    icon: Gauge,
  },
  {
    title: "Quy Trình Đa Khung Thời Gian",
    description:
      "Kết nối logic tín hiệu nhiều khung thời gian giúp xác nhận entry chặt chẽ và giảm nhiễu giao dịch ngắn hạn.",
    icon: ChartCandlestick,
  },
  {
    title: "Mobile-Ready Interaction",
    description:
      "Thiết kế tương thích mobile với panel điều hướng tối ưu thao tác nhanh trong môi trường biến động cao.",
    icon: MonitorSmartphone,
  },
];

const technicalHighlights = [
  "Trading chart realtime giúp theo dõi biến động giá trực tiếp với độ trễ thấp cho quyết định vào lệnh nhanh.",
  "Strategy matrix monitor gom tín hiệu BUY/SELL theo symbol và timeframe để lọc cơ hội giao dịch rõ ràng hơn.",
  "Backtest analytics hiển thị equity curve, winrate và drawdown để tối ưu chiến lược bằng dữ liệu thực tế.",
  "Nền tảng hỗ trợ workflow đa khung thời gian cho scalping, intraday và swing trading trên cùng một hệ thống.",
];

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "vivutrade",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "vivutrade là nền tảng trading chart realtime, strategy matrix monitor và backtest analytics cho nhà giao dịch.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Trading chart realtime",
    "Strategy matrix monitor",
    "Backtest analytics",
    "Multi-timeframe signal workflow",
    "Mobile-ready trading interface",
  ],
};

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "vivutrade dùng để làm gì?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "vivutrade hỗ trợ theo dõi trading chart realtime, giám sát strategy matrix và đánh giá backtest analytics trong cùng một nền tảng.",
      },
    },
    {
      "@type": "Question",
      name: "vivutrade có phù hợp cho giao dịch đa khung thời gian không?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Có. Hệ thống được thiết kế cho workflow multi-timeframe, giúp so sánh tín hiệu theo nhiều timeframe để xác nhận điểm vào lệnh.",
      },
    },
    {
      "@type": "Question",
      name: "Làm sao bắt đầu với vivutrade?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Bạn có thể vào route chart chính để theo dõi thị trường realtime, sau đó mở strategy dashboard để kiểm tra hiệu suất chiến lược.",
      },
    },
  ],
};

export default function LandingPage() {
  return (
    <div
      className="h-screen overflow-y-auto bg-gradient-to-b from-sky-50 via-white to-blue-50/40 text-slate-900 [font-family:Outfit,Segoe_UI,Arial,sans-serif]"
    >
      <header className="border-b border-sky-100 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <nav
            className="flex w-full items-center justify-between"
            aria-label="Điều hướng landing"
          >
            <div className="flex items-center gap-2">
              <div className="rounded-lg border border-primary/30 bg-primary/10 p-2">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-black uppercase tracking-[0.18em]">
                vivutrade
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/about"
                className="hidden rounded-md border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-sky-50 lg:inline-flex"
              >
                Về chúng tôi
              </Link>
              <Link
                href="/contact"
                className="hidden rounded-md border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-sky-50 lg:inline-flex"
              >
                Liên hệ
              </Link>
              <Link
                href="/strategy/dashboard"
                className="hidden rounded-md border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-sky-50 md:inline-flex"
              >
                Dashboard Chiến Lược
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-black text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:opacity-90"
              >
                Mở Chart
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-5 py-10 md:gap-20 md:px-8 md:py-14">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
        />
        <section
          className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12"
          aria-labelledby="hero-title"
        >
          <article className="space-y-6">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              <Radio className="h-3.5 w-3.5" />
              Quy Trình Giao Dịch Realtime
            </p>
            <h1
              id="hero-title"
              className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-5xl"
            >
              vivutrade là nền tảng chart và strategy dành cho phân tích tốc độ
              cao.
            </h1>
            <p className="max-w-xl text-sm leading-7 text-slate-700 md:text-base">
              Tập trung vào dữ liệu và luồng quyết định: realtime chart workspace,
              strategy matrix giám sát tín hiệu, cùng dashboard backtest để bạn
              đánh giá hiệu suất chiến lược theo thời gian thực.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:opacity-90"
              >
                Mở Chart
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/strategy/dashboard"
                className="inline-flex items-center gap-2 rounded-md border border-sky-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-sky-50"
              >
                Xem Dashboard Chiến Lược
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
              {[
                "Tín Hiệu Realtime",
                "Giám Sát Matrix",
                "Phân Tích Backtest",
                "Sẵn Sàng Mobile",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-md border border-sky-200 bg-white px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-700"
                >
                  {item}
                </span>
              ))}
            </div>
          </article>

          <article
            aria-label="Mockup hệ thống giao dịch"
            className="relative rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-sky-50/50 to-blue-50/70 p-4 shadow-xl shadow-sky-100/80 md:p-6"
          >
            <div className="absolute -left-8 top-10 h-28 w-28 rounded-full bg-primary/20 blur-2xl" />
            <div className="absolute -bottom-8 right-4 h-24 w-24 rounded-full bg-emerald-400/20 blur-2xl" />
            <div className="relative space-y-4">
              <div className="rounded-xl border border-sky-100 bg-white/90 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Biểu Đồ Realtime
                  </span>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-600">
                    LIVE
                  </span>
                </div>
                <div className="grid h-32 grid-cols-12 items-end gap-1">
                  {[32, 58, 49, 62, 44, 68, 54, 73, 65, 79, 70, 88].map(
                    (value, index) => (
                      <span
                        key={`${value}-${index}`}
                        className="rounded-sm bg-primary/80 transition-all duration-500 hover:-translate-y-1 hover:bg-primary"
                        style={{ height: `${value}%` }}
                      />
                    )
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-sky-100 bg-white/90 p-3">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Ma Trận Chiến Lược
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      "bg-emerald-500/25",
                      "bg-rose-500/25",
                      "bg-secondary",
                      "bg-secondary",
                      "bg-emerald-500/25",
                      "bg-secondary",
                      "bg-rose-500/25",
                      "bg-secondary",
                      "bg-emerald-500/25",
                    ].map((tone, index) => (
                      <span
                        key={`${tone}-${index}`}
                        className={`h-6 rounded-sm border border-sky-100 ${tone}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-sky-100 bg-white/90 p-3">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Nhịp Backtest
                  </div>
                  <div className="space-y-1.5">
                    {[
                      ["Tỷ lệ thắng", "63.4%"],
                      ["PF", "1.82"],
                      ["Max DD", "8.6%"],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between rounded-md border border-sky-100 bg-white px-2 py-1 text-[11px]"
                      >
                        <span className="font-bold text-slate-600">{label}</span>
                        <span className="font-black text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section aria-labelledby="features-title" className="space-y-6">
          <div className="space-y-3">
            <h2
              id="features-title"
              className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl"
            >
              Khối năng lực chính
            </h2>
            <p className="max-w-3xl text-sm leading-7 text-slate-700 md:text-base">
              Landing tập trung mô tả rõ năng lực vận hành thực tế của hệ thống:
              thu thập tín hiệu realtime, điều phối theo matrix, và phản hồi bằng
              dữ liệu hiệu suất chiến lược.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featureCards.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="group rounded-xl border border-sky-100 bg-white/90 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg hover:shadow-sky-100"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <div className="mb-3 inline-flex rounded-lg border border-primary/30 bg-primary/10 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="mb-2 text-lg font-black">{feature.title}</h3>
                  <p className="text-sm leading-7 text-slate-700">
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section
          aria-labelledby="technical-title"
          className="rounded-2xl border border-sky-100 bg-white/90 p-6 shadow-sm shadow-sky-100/80 md:p-8"
        >
          <h2
            id="technical-title"
            className="mb-5 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl"
          >
            Vì sao vivutrade phù hợp cho trading chart và strategy
          </h2>
          <div className="grid gap-3">
            {technicalHighlights.map((item) => (
              <article
                key={item}
                className="flex items-start gap-3 rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-3"
              >
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-sm leading-7 text-slate-700">{item}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="final-cta-title"
          className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-100/70 via-white to-blue-100/70 p-6 shadow-sm shadow-sky-100/70 md:p-10"
        >
          <div className="max-w-3xl space-y-4">
            <h2
              id="final-cta-title"
              className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-4xl"
            >
              Sẵn sàng vào luồng giao dịch realtime?
            </h2>
            <p className="text-sm leading-7 text-slate-700 md:text-base">
              Bắt đầu từ chart để theo dõi thị trường trực tiếp, sau đó mở strategy
              dashboard để đánh giá chất lượng tín hiệu và hiệu suất hệ thống.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:opacity-90"
              >
                Mở Chart
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/strategy/dashboard"
                className="inline-flex items-center gap-2 rounded-md border border-sky-200 bg-white px-5 py-3 text-sm font-bold transition-colors hover:bg-sky-50"
              >
                Xem Dashboard Chiến Lược
              </Link>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="faq-title"
          className="rounded-2xl border border-sky-100 bg-white/90 p-6 shadow-sm shadow-sky-100/70 md:p-8"
        >
          <h2
            id="faq-title"
            className="mb-5 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl"
          >
            Câu hỏi thường gặp về vivutrade
          </h2>
          <div className="space-y-3">
            <article className="rounded-lg border border-sky-100 bg-sky-50/40 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-900">
                vivutrade dùng để làm gì?
              </h3>
              <p className="mt-1 text-sm leading-7 text-slate-700">
                vivutrade tập trung vào trading chart realtime, strategy matrix
                monitor và backtest analytics để tối ưu quyết định giao dịch.
              </p>
            </article>
            <article className="rounded-lg border border-sky-100 bg-sky-50/40 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-900">
                Nền tảng có hỗ trợ multi-timeframe không?
              </h3>
              <p className="mt-1 text-sm leading-7 text-slate-700">
                Có. Bạn có thể theo dõi tín hiệu theo nhiều timeframe để xác nhận
                xu hướng và giảm nhiễu khi vào lệnh.
              </p>
            </article>
            <article className="rounded-lg border border-sky-100 bg-sky-50/40 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-900">
                Bắt đầu từ đâu để trải nghiệm nhanh?
              </h3>
              <p className="mt-1 text-sm leading-7 text-slate-700">
                Mở{" "}
                <Link href="/" className="font-semibold text-primary underline">
                  trang chart
                </Link>{" "}
                để xem dữ liệu realtime, sau đó vào{" "}
                <Link
                  href="/strategy/dashboard"
                  className="font-semibold text-primary underline"
                >
                  strategy dashboard
                </Link>{" "}
                để đánh giá hiệu suất chiến lược.
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className="border-t border-sky-100 px-5 py-5 md:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p className="font-bold uppercase tracking-[0.1em]">vivutrade</p>
          <nav
            className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600"
            aria-label="Liên kết nội bộ SEO"
          >
            <Link href="/landing" className="underline-offset-4 hover:underline">
              Trang giới thiệu
            </Link>
            <Link href="/about" className="underline-offset-4 hover:underline">
              Giới thiệu
            </Link>
            <Link href="/contact" className="underline-offset-4 hover:underline">
              Liên hệ
            </Link>
            <Link href="/privacy" className="underline-offset-4 hover:underline">
              Quyền riêng tư
            </Link>
            <Link href="/terms" className="underline-offset-4 hover:underline">
              Điều khoản
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
