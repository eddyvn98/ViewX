import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nhật ký cập nhật",
  description:
    "Changelog của vivutrade: các thay đổi sản phẩm, cải tiến SEO và cập nhật trải nghiệm theo phiên bản.",
  alternates: { canonical: "/changelog" },
  openGraph: {
    title: "Changelog | vivutrade",
    description: "Theo dõi các cập nhật mới nhất của vivutrade.",
    url: "/changelog",
    type: "website",
  },
};

const entries = [
  {
    version: "v0.1.0",
    date: "2026-03-02",
    notes: [
      "Ra mắt landing page tiếng Việt với cấu trúc semantic rõ ràng.",
      "Bổ sung robots, sitemap, llms và structured data cơ bản.",
      "Thêm các trang trust/legal để tăng tín hiệu SEO.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <main className="h-screen overflow-y-auto bg-gradient-to-b from-sky-50 via-white to-slate-50 px-5 py-10 text-slate-900 md:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          Nhật ký cập nhật
        </h1>
        {entries.map((entry) => (
          <section
            key={entry.version}
            className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm"
          >
            <h2 className="text-xl font-bold">
              {entry.version} - {entry.date}
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
              {entry.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}

