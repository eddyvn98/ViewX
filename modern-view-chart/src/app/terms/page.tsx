import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng",
  description:
    "Điều khoản sử dụng vivutrade: quyền, nghĩa vụ và giới hạn trách nhiệm khi dùng nền tảng.",
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "Điều khoản sử dụng | vivutrade",
    description:
      "Thông tin điều khoản áp dụng khi truy cập và sử dụng nền tảng vivutrade.",
    url: "/terms",
    type: "website",
  },
};

const breadcrumbStructuredData = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Landing", item: "/landing" },
    { "@type": "ListItem", position: 2, name: "Điều khoản sử dụng", item: "/terms" },
  ],
};

export default function TermsPage() {
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
          / <span>Điều khoản sử dụng</span>
        </nav>

        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm md:p-8">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            Điều khoản sử dụng
          </h1>
          <p className="mt-4 leading-8 text-slate-700">
            Điều khoản này áp dụng cho mọi người dùng truy cập và sử dụng
            vivutrade. Khi sử dụng dịch vụ, bạn xác nhận đã đọc và đồng ý với các
            nội dung dưới đây.
          </p>
        </section>

        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-2xl font-bold">1. Phạm vi sử dụng</h2>
          <article className="mt-4 space-y-2 leading-8 text-slate-700">
            <p>Không sử dụng nền tảng cho mục đích trái pháp luật hoặc gây hại hệ thống.</p>
            <p>Người dùng tự chịu trách nhiệm với quyết định giao dịch của mình.</p>
          </article>
        </section>

        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-2xl font-bold">2. Giới hạn trách nhiệm</h2>
          <article className="mt-4 space-y-2 leading-8 text-slate-700">
            <p>
              Dữ liệu và tín hiệu trên nền tảng mang tính hỗ trợ phân tích, không
              phải cam kết lợi nhuận hoặc tư vấn đầu tư bắt buộc.
            </p>
            <p>
              vivutrade không chịu trách nhiệm cho tổn thất phát sinh từ quyết
              định giao dịch của người dùng.
            </p>
          </article>
        </section>

        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-2xl font-bold">3. Câu trả lời ngắn</h2>
          <article className="mt-4 space-y-3 leading-8 text-slate-700">
            <p>
              <strong>Dùng vivutrade có đảm bảo lợi nhuận không?</strong> Không.
              Nền tảng chỉ hỗ trợ phân tích dữ liệu và tín hiệu.
            </p>
            <p>
              <strong>Cần hỏi thêm về điều khoản?</strong> Truy cập{" "}
              <Link href="/contact" className="font-semibold text-primary underline">
                trang liên hệ
              </Link>{" "}
              để được hỗ trợ.
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
            <Link href="/contact" className="text-primary underline">
              Contact
            </Link>
            <Link href="/privacy" className="text-primary underline">
              Privacy
            </Link>
          </nav>
        </section>
      </div>
    </main>
  );
}
