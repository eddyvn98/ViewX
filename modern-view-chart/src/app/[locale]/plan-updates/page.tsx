import type { Metadata } from 'next';
import { Link } from '@/i18n/routing';

export const metadata: Metadata = {
  title: 'Plan Updates',
  description: 'Explore the latest rollout notes for Vivutrade plans.',
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
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            {isVi ? 'Cập nhật gói dịch vụ Vivutrade' : 'Vivutrade Plan Updates'}
          </h1>
          <p className="max-w-3xl text-slate-700">
            {isVi
              ? 'Ba gói Free, Nâng cao và Cao cấp được thiết kế cho ba nhóm người dùng khác nhau: bắt đầu có hệ thống, nâng tốc độ workflow MT5 và vận hành chiến lược bằng AI ở cấp độ team.'
              : 'Free, Pro, and AI plans are built for distinct user needs: structured onboarding, faster MT5 web execution, and strategic AI workflows for teams.'}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">
                {isVi ? 'Gói Miễn phí' : 'Free Plan'}
              </p>
              <h2 className="text-2xl font-black text-slate-900">
                {isVi ? 'Bắt đầu giao dịch có hệ thống, không tốn phí' : 'Start with a structured workflow, free forever'}
              </h2>
              <p className="text-slate-700">
                {isVi
                  ? 'Dành cho người mới cần bộ công cụ chart rõ ràng, dễ dùng để xây thói quen phân tích kỷ luật từ đầu.'
                  : 'Built for beginners who want a clear and practical chart toolkit to build disciplined habits from day one.'}
              </p>
              <Link
                href="/plan-updates/free"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-slate-700"
              >
                {isVi ? 'Đọc bài về gói Miễn phí' : 'Read the Free article'}
              </Link>
            </div>
          </article>

          <article className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
                {isVi ? 'Gói Nâng cao' : 'Pro Plan'}
              </p>
              <h2 className="text-2xl font-black text-slate-900">
                {isVi ? 'Workflow web MT5 hiện đại, nhanh và liền mạch' : 'A modern MT5 web workflow built for speed'}
              </h2>
              <p className="text-slate-700">
                {isVi
                  ? 'Dành cho user MT5 muốn giảm thao tác rời rạc, đồng bộ dữ liệu tốt hơn và phản ứng nhanh hơn mỗi phiên.'
                  : 'For MT5 users who want less fragmented execution, better sync, and faster session performance.'}
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
                {isVi ? 'Lớp AI chiến lược cho team và power user' : 'A strategic AI layer for teams and power users'}
              </h2>
              <p className="text-slate-700">
                {isVi
                  ? 'Phù hợp với nhóm cần tối ưu rule theo dữ liệu, quản trị rủi ro chủ động và theo dõi hiệu suất minh bạch.'
                  : 'Built for teams that need data-driven rule optimization, active risk control, and transparent performance tracking.'}
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
