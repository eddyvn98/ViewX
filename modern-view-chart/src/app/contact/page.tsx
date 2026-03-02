import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Liên hệ",
  description:
    "Kênh liên hệ chính thức của vivutrade để trao đổi về sản phẩm, hỗ trợ kỹ thuật và hợp tác.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Liên hệ vivutrade",
    description:
      "Liên hệ đội ngũ vivutrade cho hỗ trợ sản phẩm, kỹ thuật và hợp tác.",
    url: "/contact",
    type: "website",
  },
};

const breadcrumbStructuredData = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Landing", item: "/landing" },
    { "@type": "ListItem", position: 2, name: "Liên hệ", item: "/contact" },
  ],
};

export default function ContactPage() {
  return (
    <main className="h-screen overflow-y-auto bg-gradient-to-b from-sky-50 via-white to-slate-50 px-5 py-10 text-slate-900 md:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbStructuredData) }}
      />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <nav className="text-sm text-slate-600">
          <Link href="/landing" className="underline underline-offset-4">
            Landing
          </Link>{" "}
          / <span>Liên hệ</span>
        </nav>

        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm md:p-8">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            Liên hệ vivutrade
          </h1>
          <p className="mt-4 leading-8 text-slate-700">
            Nếu bạn cần hỗ trợ kỹ thuật, góp ý sản phẩm hoặc trao đổi hợp tác,
            vui lòng dùng các kênh dưới đây. Nội dung liên hệ nên ghi rõ bối cảnh,
            route gặp lỗi và thời điểm xảy ra để đội ngũ xử lý nhanh hơn.
          </p>
        </section>

        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-2xl font-bold">Kênh liên hệ</h2>
          <article className="mt-4 space-y-3 leading-8 text-slate-700">
            <p>
              <strong>Email hỗ trợ:</strong>{" "}
              <a className="text-primary underline" href="mailto:support@vivutrade.com">
                support@vivutrade.com
              </a>
            </p>
            <p>
              <strong>Email hợp tác:</strong>{" "}
              <a className="text-primary underline" href="mailto:partnership@vivutrade.com">
                partnership@vivutrade.com
              </a>
            </p>
            <p>
              <strong>Thời gian phản hồi:</strong> 09:00-18:00 (GMT+7), Thứ Hai
              đến Thứ Sáu.
            </p>
          </article>
        </section>

        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-2xl font-bold">Câu trả lời ngắn</h2>
          <article className="mt-4 space-y-3 leading-8 text-slate-700">
            <p>
              <strong>Nên gửi gì để hỗ trợ nhanh?</strong> Ảnh chụp màn hình, route
              bị lỗi, thời gian lỗi và hành vi mong muốn.
            </p>
            <p>
              <strong>Cần xem sản phẩm trước?</strong> Truy cập{" "}
              <Link href="/landing" className="font-semibold text-primary underline">
                landing page
              </Link>{" "}
              hoặc vào{" "}
              <Link href="/" className="font-semibold text-primary underline">
                chart realtime
              </Link>
              .
            </p>
          </article>
        </section>

        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-bold">Liên kết liên quan</h2>
          <nav className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/landing" className="text-primary underline">
              Landing
            </Link>
            <Link href="/about" className="text-primary underline">
              About
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
