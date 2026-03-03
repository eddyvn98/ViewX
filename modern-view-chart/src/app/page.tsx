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
import { Logo } from "@/components/layout/Logo";

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
    url: "/",
    siteName: "vivutrade",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "vivutrade | Nền tảng Chart & Strategy",
    description:
      "Trading chart realtime, strategy matrix monitor và backtest analytics trong một không gian làm việc thống nhất.",
    images: ["/opengraph-image"],
  },
  alternates: {
    canonical: "/",
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
            <Logo showText size={28} />
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
                href="/chart"
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
                href="/chart"
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

          <Link
            href="/chart"
            aria-label="Hình ảnh hệ thống thực tế"
            className="relative group cursor-pointer overflow-hidden rounded-2xl border border-sky-200 bg-white p-2 shadow-2xl shadow-sky-200/50 transition-all hover:border-primary/40 block"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <img
              src="/brand/chart-preview.png"
              alt="Vivutrade Trading Chart Realtime"
              className="w-full h-auto rounded-xl object-cover transition-transform duration-700 group-hover:scale-[1.02]"
            />
            <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between rounded-lg bg-white/90 p-3 backdrop-blur-md border border-sky-100 shadow-lg translate-y-2 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <Radio className="h-4 w-4 animate-pulse" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Live Workspace</p>
                  <p className="text-sm font-black text-slate-900">XAUUSD Realtime Feed</p>
                </div>
              </div>
              <div className="rounded-full bg-primary px-3 py-1 text-[10px] font-black text-white">
                LIVE
              </div>
            </div>
          </Link>
        </section>

        <section aria-labelledby="showcase-title" className="space-y-10">
          <div className="text-center space-y-4">
            <h2
              id="showcase-title"
              className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-4xl"
            >
              Trải Nghiệm Trực Quan Khối Năng Lực
            </h2>
            <p className="max-w-2xl mx-auto text-sm leading-7 text-slate-700 md:text-base">
              Chúng tôi không chỉ nói về tính năng, chúng tôi cho bạn thấy kết quả thực tế từ hệ thống giám sát và phân tích chiến lược.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <Link href="/strategy/dashboard" className="space-y-4 group">
              <div className="overflow-hidden rounded-2xl border border-sky-100 shadow-xl transition-all group-hover:border-primary/30 group-hover:shadow-primary/10">
                <img
                  src="/brand/dashboard-preview.png"
                  alt="Dashboard Backtest Analysis"
                  className="w-full h-auto transition-transform duration-500 group-hover:scale-[1.01]"
                />
              </div>
              <div className="px-2">
                <h3 className="text-xl font-black text-slate-900 mb-2 group-hover:text-primary transition-colors">Phân Tích Backtest Dashboard</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  Bảng tổng hợp hiệu suất với Equity Curve, Winrate, Profit Factor và lịch sử lệnh chi tiết. Mọi thông số được tính toán tự động dựa trên Tick Data thực tế.
                </p>
                <div className="text-sm font-bold text-primary inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Khám phá Dashboard <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>

            <Link href="/strategy/matrix" className="space-y-4 group">
              <div className="overflow-hidden rounded-2xl border border-sky-100 shadow-xl transition-all group-hover:border-primary/30 group-hover:shadow-primary/10">
                <img
                  src="/brand/matrix-preview.png"
                  alt="Strategy Matrix Monitor"
                  className="w-full h-auto transition-transform duration-500 group-hover:scale-[1.01]"
                />
              </div>
              <div className="px-2">
                <h3 className="text-xl font-black text-slate-900 mb-2 group-hover:text-primary transition-colors">Giám Sát Ma Trận Chiến Lược</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  Góc nhìn 360 độ về thị trường: theo dõi RSI, xu hướng và tín hiệu BUY/SELL trên nhiều Symbol và Timeframe cùng lúc để không bỏ lỡ cơ hội.
                </p>
                <div className="text-sm font-bold text-primary inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Xem Ma Trận <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>
          </div>
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

        {/* Data Feed & Trust Layer Section */}
        <section
          aria-labelledby="trust-layer-title"
          className="rounded-2xl border border-sky-200 bg-gradient-to-br from-white via-sky-50 to-white p-6 shadow-sm shadow-sky-100/80 md:p-8"
        >
          <div className="mb-8 text-center max-w-3xl mx-auto space-y-4">
            <h2
              id="trust-layer-title"
              className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl"
            >
              Hạ Tầng Dữ Liệu MinBạch & Chuẩn Xác
            </h2>
            <p className="text-sm md:text-base leading-7 text-slate-700">
              Vivutrade định vị như một công cụ phân tích phân tích chuyên sâu (signal audit & strategy monitoring), không can thiệp lệnh. Mọi tín hiệu đều hoàn toàn khách quan thông qua hệ thống dữ liệu độ trễ thấp.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="p-5 rounded-xl border border-sky-100 bg-white shadow-sm transition-all hover:border-primary/30">
              <div className="mb-3 inline-flex rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
                <Radio className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-base font-bold text-slate-900">Realtime Tick Data</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Data Feed kết nối trực tiếp với MT5 và thị trường Crypto, cung cấp dữ liệu Tick thực sự (Real Volume, Spread thực) với độ trễ tối thiểu, thay vì data sinh ảo hay trễ nhịp.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-sky-100 bg-white shadow-sm transition-all hover:border-primary/30">
              <div className="mb-3 inline-flex rounded-lg bg-blue-500/10 p-2 text-blue-600">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-base font-bold text-slate-900">Đồng Bộ Timezone</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Thời gian nến và tín hiệu được đồng bộ hoàn toàn khớp với Local Timezone của thiết bị, loại bỏ sự sai lệch múi giờ gây khó khăn trong phân tích điểm đảo chiều (session overlaps).
              </p>
            </div>

            <div className="p-5 rounded-xl border border-sky-100 bg-white shadow-sm transition-all hover:border-primary/30">
              <div className="mb-3 inline-flex rounded-lg bg-indigo-500/10 p-2 text-indigo-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-base font-bold text-slate-900">Phi Ngân Hàng / Broker</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Vivutrade là công cụ cung cấp nền tảng Biểu đồ và Ma trận thuật toán phục vụ quá trình Discretionary Trading. Nền tảng độc lập, phi lợi ích xung đột với kết quả giao dịch của người dùng.
              </p>
            </div>
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
                href="/chart"
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
                <Link href="/chart" className="font-semibold text-primary underline">
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

      <footer className="border-t border-sky-200 bg-white px-5 py-10 md:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="max-w-md space-y-4">
            <Logo showText size={32} />
            <p className="text-sm text-slate-600">
              AI-assisted strategy dashboard and realtime chart monitor for discretionary forex & crypto traders.
            </p>
            <p className="text-xs text-slate-500">
              📍 Hanoi, Vietnam
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-2 md:gap-12">
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900">Product</h4>
              <nav className="flex flex-col gap-2 text-sm text-slate-600">
                <Link href={`${process.env.NEXT_PUBLIC_APP_URL || 'https://chart.vivutrade.io.vn'}`} className="hover:text-primary transition-colors">
                  Trading Chart
                </Link>
                <Link href="/strategy/dashboard" className="hover:text-primary transition-colors">
                  Strategy Matrix
                </Link>
                <Link href="/about" className="hover:text-primary transition-colors">
                  Về chúng tôi
                </Link>
              </nav>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900">Legal</h4>
              <nav className="flex flex-col gap-2 text-sm text-slate-600">
                <Link href="/terms" className="hover:text-primary transition-colors">
                  Điều khoản Dịch vụ
                </Link>
                <Link href="/privacy" className="hover:text-primary transition-colors">
                  Chính sách Bảo mật
                </Link>
                <Link href="/contact" className="hover:text-primary transition-colors">
                  Liên hệ Hỗ trợ
                </Link>
              </nav>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 w-full max-w-7xl border-t border-sky-100 pt-6 text-xs text-slate-500 flex flex-col gap-4">
          <p className="leading-relaxed">
            <strong className="text-slate-700">Disclaimer:</strong> Vivutrade provides charting software, algorithmic indicators, and market data analysis tools for educational and research purposes. We are NOT a registered broker, financial advisor, or investment firm. Any signals, automated matrices, or content provided on this platform are strictly analytical and do not constitute financial advice. Past performance of any algorithm or strategy is not indicative of future results.
          </p>
          <div className="flex items-center justify-between">
            <p>&copy; {new Date().getFullYear()} Vivutrade. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
