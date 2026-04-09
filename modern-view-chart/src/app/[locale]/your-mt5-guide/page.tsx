import type { Metadata } from 'next';
import Link from 'next/link';
import { getModuleGuideContent, renderGuideSection } from '@/features/modules/module-guide-content';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale.toLowerCase().startsWith('vi');

  return {
    title: isVi ? 'Hướng dẫn Your MT5 | vivutrade' : 'Your MT5 Guide | vivutrade',
    description: isVi
      ? 'Cài app native, mở MT5 local, rồi dùng thẳng trong chart với luồng Your MT5 mới.'
      : 'Install the native app, open local MT5, and use the new Your MT5 flow directly in the chart.',
    alternates: { canonical: '/your-mt5-guide' },
  };
}

export default async function YourMt5GuidePage({ params }: PageProps) {
  const { locale } = await params;
  const guide = getModuleGuideContent('your_mt5', locale);
  const isVi = locale.toLowerCase().startsWith('vi');

  return (
    <main className="min-h-screen overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.14),_transparent_24%),#020617] px-4 py-8 text-white md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[32px] border border-white/10 bg-white/[0.05] p-6 shadow-2xl backdrop-blur-xl md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-300">{guide.badge}</p>
          <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight md:text-6xl">{guide.title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">{guide.summary}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={guide.primaryCta.href}
              download
              className="inline-flex items-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:scale-[1.01] hover:bg-emerald-400"
            >
              {guide.primaryCta.label}
            </a>
            <Link
              href={`/${locale}/chart`}
              className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              {isVi ? 'Mở chart để bắt đầu' : 'Open chart to begin'}
            </Link>
            <Link
              href={`/${locale}/pricing`}
              className="inline-flex items-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/20"
            >
              {isVi ? 'Xem quyền module và pricing' : 'View module access and pricing'}
            </Link>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
          {guide.sections.map((section) => renderGuideSection(section))}
        </div>
      </div>
    </main>
  );
}
