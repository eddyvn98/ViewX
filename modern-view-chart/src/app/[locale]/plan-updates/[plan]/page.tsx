import type { Metadata } from 'next';
import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { notFound } from 'next/navigation';

type PlanKey = 'free' | 'pro' | 'ai';

const PLAN_KEYS: PlanKey[] = ['free', 'pro', 'ai'];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; plan: string }>;
}): Promise<Metadata> {
  const { locale, plan } = await params;
  const isVi = locale === 'vi';

  if (!PLAN_KEYS.includes(plan as PlanKey)) {
    return {};
  }

  if (plan === 'free') {
    return {
      title: isVi ? 'Gói Miễn phí' : 'Free Plan',
      description: isVi
        ? 'Bài giới thiệu gói Miễn phí của Vivutrade cho người mới bắt đầu giao dịch có hệ thống.'
        : 'A practical introduction to the Vivutrade Free plan for beginners who want structured trading.',
      alternates: { canonical: `/plan-updates/${plan}` },
    };
  }

  if (plan === 'pro') {
    return {
      title: isVi ? 'Gói Nâng cao' : 'Pro Plan',
      description: isVi
        ? 'Bài giới thiệu gói Nâng cao của Vivutrade cho trader MT5 cần workflow web hiện đại.'
        : 'A practical introduction to the Vivutrade Pro plan for MT5 traders who want a modern web workflow.',
      alternates: { canonical: `/plan-updates/${plan}` },
    };
  }

  return {
    title: isVi ? 'Gói Cao cấp' : 'AI Plan',
    description: isVi
      ? 'Bài giới thiệu gói Cao cấp của Vivutrade dành cho team và power user cần lớp AI chiến lược.'
      : 'A practical introduction to the Vivutrade AI plan for teams and power users.',
    alternates: { canonical: `/plan-updates/${plan}` },
  };
}

function FreeArticle({ isVi }: { isVi: boolean }) {
  return (
    <>
      <section className="space-y-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-600">
          {isVi ? 'Gói Miễn phí' : 'Free Plan'}
        </p>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
          {isVi ? 'Bắt đầu giao dịch có hệ thống, không tốn chi phí' : 'Start structured trading without paying upfront'}
        </h1>
        <p className="max-w-4xl text-base leading-8 text-slate-700 md:text-lg">
          {isVi
            ? 'Nhiều trader mới bắt đầu với cảm giác quá tải: nhiều chỉ báo, nhiều khung thời gian, nhiều cách đọc chart và không biết nên bắt đầu từ đâu. Gói Miễn phí tập trung giải quyết đúng vấn đề này bằng một trải nghiệm dễ tiếp cận nhưng vẫn đủ công cụ để bạn luyện thói quen phân tích có kỷ luật.'
            : 'Many new traders start overwhelmed by too many indicators and too many charting choices. The Free plan solves this with an approachable workflow that still gives enough tools to build disciplined analysis habits.'}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-900">{isVi ? 'Rõ ràng từ ngày đầu' : 'Clarity from day one'}</p>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isVi
              ? 'Biểu đồ mượt, chuyển khung thời gian nhanh và giao diện gọn giúp bạn tập trung vào quyết định.'
              : 'A smooth chart with fast timeframe switching helps users focus on decision-making instead of UI friction.'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-900">{isVi ? 'Công cụ cốt lõi đủ dùng' : 'Core tools that matter'}</p>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isVi
              ? 'Bạn có công cụ vẽ cơ bản, chỉ báo phổ biến và bố cục để ghi chú/quan sát nhất quán mỗi ngày.'
              : 'Essential drawing and indicator tools are available so users can observe and annotate the market consistently.'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-900">{isVi ? 'Luyện kỷ luật giao dịch' : 'Build trading discipline'}</p>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isVi
              ? 'Thay vì giao dịch cảm tính, bạn có thể thiết lập quy trình quan sát, ghi chú và hành động rất thực tế.'
              : 'Instead of impulse decisions, users can follow a repeatable observe-note-act workflow.'}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-2xl font-black text-slate-900 md:text-3xl">
          {isVi ? 'Ai nên dùng gói này?' : 'Who this plan is for'}
        </h2>
        <div className="mt-4 space-y-4 text-base leading-8 text-slate-700">
          <p>
            {isVi
              ? 'Phù hợp với trader mới bắt đầu, người đang tự học phân tích kỹ thuật, hoặc bất kỳ ai muốn chuyển từ giao dịch cảm tính sang giao dịch có quy trình.'
              : 'Best for beginner traders, self-learners in technical analysis, and anyone moving from emotional to process-driven trading.'}
          </p>
          <p>
            {isVi
              ? 'Mục tiêu không phải là nhồi nhét tính năng, mà là cung cấp đúng nền tảng để bạn đi đường dài hệ thống hơn.'
              : 'The goal is not feature overload, but the right foundation for long-term consistency.'}
          </p>
          <p className="font-semibold text-slate-900">{isVi ? 'CTA: Dùng miễn phí ngay hôm nay.' : 'CTA: Start free today.'}</p>
        </div>
      </section>
    </>
  );
}

function ProArticle({ isVi }: { isVi: boolean }) {
  return (
    <>
      <section className="space-y-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">
          {isVi ? 'Gói Nâng cao' : 'Pro Plan'}
        </p>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
          {isVi ? 'Workflow web hiện đại cho user MT5' : 'A modern web workflow for MT5 users'}
        </h1>
        <p className="max-w-4xl text-base leading-8 text-slate-700 md:text-lg">
          {isVi
            ? 'Nếu bạn đang giao dịch trên MT5, bạn sẽ quen với việc mở nhiều cửa sổ, đối chiếu dữ liệu thủ công và chuyển symbol liên tục. Gói Nâng cao được thiết kế để cắt giảm ma sát đó: đồng bộ MT5, symbol và data trong một không gian làm việc web liền mạch, giúp bạn ra quyết định nhanh hơn khi thị trường biến động.'
            : 'MT5 traders often juggle too many windows and manual checks. Pro reduces this friction by syncing MT5, symbols, and data in one coherent web workspace for faster decisions.'}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-900">{isVi ? 'Giảm thao tác rời rạc' : 'Less fragmented execution'}</p>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isVi
              ? 'Tài khoản, position, order và chart xuất hiện trong cùng một luồng làm việc để bạn giảm chuyển ngữ cảnh.'
              : 'Accounts, positions, orders, and charts stay in one flow so you can reduce constant context switching.'}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-900">{isVi ? 'Đồng bộ dữ liệu chuẩn' : 'Reliable data sync'}</p>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isVi
              ? 'Symbol và data MT5 được đồng bộ theo thời gian thực, giúp bạn theo dõi thị trường với độ tin cậy cao hơn.'
              : 'MT5 symbols and data are synced in real time so users can trust what they see.'}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-900">{isVi ? 'Tốc độ cho phiên biến động' : 'Speed for volatile sessions'}</p>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isVi
              ? 'Workflow được tối giản để bạn thấy nhanh, thao tác nhanh và phản ứng nhanh hơn khi nhịp giá chạy mạnh.'
              : 'A lean workflow helps traders see, act, and react faster in high-volatility moments.'}
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="order-2 lg:order-2">
          <Image
            src="/brand/articles/pro-chart.png"
            alt={isVi ? 'Ảnh giao diện web workflow MT5 của Vivutrade' : 'Vivutrade MT5 web workflow interface'}
            width={1200}
            height={800}
            className="h-auto w-full rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]"
          />
        </div>
        <div className="order-1 space-y-4 lg:order-1">
          <h2 className="text-2xl font-black text-slate-900 md:text-3xl">
            {isVi ? 'Ai nên dùng gói Nâng cao?' : 'Who should use Pro'}
          </h2>
          <p className="text-base leading-8 text-slate-700">
            {isVi
              ? 'Gói này phù hợp với user MT5 giao dịch thường xuyên, cần một môi trường web linh hoạt nhưng vẫn bám sát dữ liệu thực chiến.'
              : 'Pro is ideal for frequent MT5 traders who want a flexible web workspace without losing execution reality.'}
          </p>
          <p className="text-base leading-8 text-slate-700">
            {isVi
              ? 'Nếu bạn muốn nâng hiệu suất thao tác mỗi phiên, giảm sai sót do quản lý các cửa sổ rời rạc và giữ quyết định nhất quán hơn, đây là gói phù hợp.'
              : 'If you want fewer workflow errors and more consistent execution speed per session, this plan is the practical upgrade.'}
          </p>
          <p className="text-base font-semibold leading-8 text-slate-900">
            {isVi ? 'CTA: Khám phá gói Nâng cao ngay hôm nay.' : 'CTA: Explore Pro today.'}
          </p>
        </div>
      </section>
    </>
  );
}

function AiArticle({ isVi }: { isVi: boolean }) {
  return (
    <>
      <section className="space-y-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">
          {isVi ? 'Gói Cao cấp' : 'AI Plan'}
        </p>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
          {isVi ? 'Lợi thế chiến lược cho team và power user' : 'A strategic edge for teams and power users'}
        </h1>
        <p className="max-w-4xl text-base leading-8 text-slate-700 md:text-lg">
          {isVi
            ? 'Khi quy mô giao dịch lớn dần, bài toán không còn là vào lệnh nhanh, mà là vận hành chiến lược bền vững và quản trị rủi ro nhất quán. Gói Cao cấp tập trung vào điều đó: AI phân tích chiến lược, gợi ý tối ưu rule, và dashboard hiệu suất giúp team ra quyết định dựa trên dữ liệu thay vì cảm tính.'
            : 'As trading operations scale, the challenge shifts from speed to consistency and risk control. The AI plan is built for that: deeper strategy analysis, actionable rule refinement, and performance dashboards for data-driven team decisions.'}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-900">{isVi ? 'AI phân tích chiến lược' : 'AI strategy analysis'}</p>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isVi
              ? 'AI giúp thấy rõ điểm mạnh/yếu của từng chiến lược trong từng bối cảnh thị trường cụ thể.'
              : 'AI reveals strategy strengths and weaknesses across specific market contexts.'}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-900">{isVi ? 'Tối ưu rule và rủi ro' : 'Rule and risk optimization'}</p>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isVi
              ? 'Hệ thống gợi ý tinh chỉnh rule có thể áp dụng ngay để giảm drawdown và nâng độ ổn định.'
              : 'The system provides actionable rule refinements to reduce drawdown and improve consistency.'}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-900">{isVi ? 'Dashboard hiệu suất minh bạch' : 'Transparent performance dashboard'}</p>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isVi
              ? 'Theo dõi PnL, win rate, expectancy và chất lượng từng chiến lược để team ra quyết định nhất quán hơn.'
              : 'Track PnL, win rate, expectancy, and strategy quality for aligned team decisions.'}
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="order-2 lg:order-2">
          <Image
            src="/brand/articles/ai-dashboard.png"
            alt={isVi ? 'Ảnh dashboard AI và phân tích chiến lược của Vivutrade' : 'Vivutrade AI dashboard and strategy analysis'}
            width={1200}
            height={800}
            className="h-auto w-full rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]"
          />
        </div>
        <div className="order-1 space-y-4 lg:order-1">
          <h2 className="text-2xl font-black text-slate-900 md:text-3xl">
            {isVi ? 'Ai nên dùng gói Cao cấp?' : 'Who should use the AI plan'}
          </h2>
          <p className="text-base leading-8 text-slate-700">
            {isVi
              ? 'Phù hợp với team trading, desk giao dịch, quỹ nhỏ và power user cần quản trị rủi ro có hệ thống, tối ưu chiến lược theo dữ liệu và chuẩn hóa quá trình ra quyết định.'
              : 'Best for trading teams, desks, and power users who need data-driven optimization and standardized risk-aware decisions.'}
          </p>
          <p className="text-base leading-8 text-slate-700">
            {isVi
              ? 'Điểm mạnh cốt lõi của gói này là khả năng biến dữ liệu thực thi thành hành động cụ thể cho cả cá nhân lẫn cả nhóm.'
              : 'Its core value is turning execution data into clear and actionable strategic decisions for individuals and teams.'}
          </p>
          <p className="text-base font-semibold leading-8 text-slate-900">
            {isVi ? 'CTA: Khám phá gói Cao cấp ngay hôm nay.' : 'CTA: Explore the AI plan today.'}
          </p>
        </div>
      </section>
    </>
  );
}

export default async function PlanArticlePage({
  params,
}: {
  params: Promise<{ locale: string; plan: string }>;
}) {
  const { locale, plan } = await params;
  const isVi = locale === 'vi';

  if (!PLAN_KEYS.includes(plan as PlanKey)) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-sky-50/30 px-5 py-10 text-slate-900 [font-family:Outfit,Segoe_UI,Arial,sans-serif] md:px-8 md:py-14">
      <div className="mx-auto w-full max-w-6xl space-y-10">
        {plan === 'free' ? <FreeArticle isVi={isVi} /> : plan === 'pro' ? <ProArticle isVi={isVi} /> : <AiArticle isVi={isVi} />}

        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-slate-700"
          >
            {isVi ? 'Quay lại trang chủ' : 'Back to home'}
          </Link>
        </div>
      </div>
    </main>
  );
}
