import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Chính sách quyền riêng tư",
  description:
    "Chính sách quyền riêng tư của vivutrade: phạm vi dữ liệu, mục đích xử lý và quyền của người dùng.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Chính sách quyền riêng tư | vivutrade",
    description:
      "Thông tin về cách vivutrade thu thập, sử dụng và bảo vệ dữ liệu người dùng.",
    url: "/privacy",
    type: "website",
  },
};

const breadcrumbStructuredData = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Landing", item: "/landing" },
    {
      "@type": "ListItem",
      position: 2,
      name: "Chính sách quyền riêng tư",
      item: "/privacy",
    },
  ],
};

export default function PrivacyPage() {
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
          / <span>Chính sách quyền riêng tư</span>
        </nav>

        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm md:p-8">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            Chính sách quyền riêng tư
          </h1>
          <p className="mt-4 leading-8 text-slate-700">
            Trang này mô tả nguyên tắc xử lý dữ liệu trên vivutrade. Bằng việc
            sử dụng sản phẩm, bạn đồng ý với cách thu thập và sử dụng dữ liệu như
            dưới đây.
          </p>
        </section>

        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-2xl font-bold">1. Dữ liệu có thể được thu thập</h2>
          <article className="mt-4 space-y-2 leading-8 text-slate-700">
            <p>Thông tin thiết bị, trình duyệt, nhật ký truy cập và hành vi sử dụng tính năng.</p>
            <p>Thông tin tài khoản hoặc liên hệ do người dùng chủ động cung cấp.</p>
          </article>
        </section>

        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-2xl font-bold">2. Mục đích xử lý dữ liệu</h2>
          <article className="mt-4 space-y-2 leading-8 text-slate-700">
            <p>Vận hành sản phẩm ổn định, cải thiện trải nghiệm và xử lý lỗi kỹ thuật.</p>
            <p>Hỗ trợ người dùng, bảo mật hệ thống và tuân thủ yêu cầu pháp lý khi cần.</p>
          </article>
        </section>

        <section className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-2xl font-bold">3. Câu trả lời ngắn</h2>
          <article className="mt-4 space-y-3 leading-8 text-slate-700">
            <p>
              <strong>vivutrade có bán dữ liệu cá nhân không?</strong> Không, dữ
              liệu không được bán cho bên thứ ba.
            </p>
            <p>
              <strong>Cần hỗ trợ quyền dữ liệu?</strong> Liên hệ qua{" "}
              <Link href="/contact" className="font-semibold text-primary underline">
                trang liên hệ
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
            <Link href="/contact" className="text-primary underline">
              Contact
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
