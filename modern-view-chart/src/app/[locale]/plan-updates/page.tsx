import type { Metadata } from 'next';
import { Link } from '@/i18n/routing';

export const metadata: Metadata = {
  title: 'Plan Updates',
  description: 'Explore the latest rollout notes for Vivutrade paid plans.',
  alternates: { canonical: '/plan-updates' },
};

export default async function PlanUpdatesIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isVi = locale === 'vi';

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-slate-50 px-5 py-10 text-slate-900 md:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            {isVi ? 'Cập nhật gói dịch vụ Vivutrade' : 'Vivutrade Plan Updates'}
          </h1>
          <p className="max-w-3xl text-slate-700">
            {isVi
              ? 'Hai gói trả phí của Vivutrade đang được hoàn thiện theo hai hướng rất khác nhau: một gói tập trung vào web terminal thực chiến cho trader MT5, và một gói tập trung vào sức mạnh AI cho workflow chiến lược chuyên sâu.'
              : 'Vivutrade paid plans are evolving along two distinct tracks: one optimized for serious MT5 web execution, and one built around advanced AI-powered strategy workflows.'}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
                {isVi ? 'Gói Nâng cao' : 'Pro Plan'}
              </p>
              <h2 className="text-2xl font-black text-slate-900">
                {isVi ? 'Web terminal MT5 hiện đại, nhanh và rõ ràng' : 'A modern MT5 web terminal built for speed and clarity'}
              </h2>
              <p className="text-slate-700">
                {isVi
                  ? 'Dành cho trader cần một không gian giao dịch web thực sự mạnh, giảm thao tác thừa và theo sát dữ liệu thực chiến.'
                  : 'Built for traders who want a truly capable web workspace that cuts friction and stays close to live execution realities.'}
              </p>
              <Link
                href="/plan-updates/pro"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-slate-700"
              >
                {isVi ? 'Đọc bài về gói Nâng cao' : 'Read the Pro article'}
              </Link>
            </div>
          </article>

          <article className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">
                {isVi ? 'Gói Cao cấp' : 'AI Plan'}
              </p>
              <h2 className="text-2xl font-black text-slate-900">
                {isVi ? 'Lớp AI chiến lược dành cho team và trader nâng cao' : 'An advanced AI strategy layer for teams and power users'}
              </h2>
              <p className="text-slate-700">
                {isVi
                  ? 'Phù hợp với người dùng muốn dùng AI để đánh giá, tinh chỉnh và vận hành chiến lược ở mức sâu hơn thị trường hiện tại.'
                  : 'Designed for users who want AI to analyze, refine, and operate strategies at a depth beyond today’s mainstream platforms.'}
              </p>
              <Link
                href="/plan-updates/ai"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-slate-700"
              >
                {isVi ? 'Đọc bài về gói Cao cấp' : 'Read the AI article'}
              </Link>
            </div>
          </article>
        </div>

        <div>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-900 transition-colors hover:bg-slate-100"
          >
            {isVi ? 'Quay lại trang chủ' : 'Back to home'}
          </Link>
        </div>
      </div>
    </main>
  );
}
