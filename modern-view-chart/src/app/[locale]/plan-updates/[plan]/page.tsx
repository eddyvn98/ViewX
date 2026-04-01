import type { Metadata } from 'next';
import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { notFound } from 'next/navigation';

type PlanKey = 'pro' | 'ai';

const PLAN_KEYS: PlanKey[] = ['pro', 'ai'];

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

  return plan === 'pro'
    ? {
        title: isVi ? 'Gói Nâng cao' : 'Pro Plan',
        description: isVi
          ? 'Bài giới thiệu gói Nâng cao của Vivutrade cho trader MT5 cần một web terminal thực chiến.'
          : 'A detailed introduction to the Vivutrade Pro plan for MT5 traders who need a serious web terminal.',
        alternates: { canonical: `/plan-updates/${plan}` },
      }
    : {
        title: isVi ? 'Gói Cao cấp' : 'AI Plan',
        description: isVi
          ? 'Bài giới thiệu gói Cao cấp của Vivutrade dành cho workflow AI chiến lược chuyên sâu.'
          : 'A detailed introduction to the Vivutrade AI plan for advanced AI-driven strategy workflows.',
        alternates: { canonical: `/plan-updates/${plan}` },
      };
}

function ProArticle({ isVi }: { isVi: boolean }) {
  return (
    <>
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-600">
            {isVi ? 'Gói Nâng cao' : 'Pro Plan'}
          </p>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
            {isVi
              ? 'Web terminal MT5 hiện đại được xây để giao dịch thật sự'
              : 'A modern MT5 web terminal built for real trading'}
          </h1>
          <p className="max-w-3xl text-base leading-8 text-slate-700 md:text-lg">
            {isVi
              ? 'Gói Nâng cao là cách Vivutrade đưa trải nghiệm giao dịch MT5 lên một mặt bằng web mới: rõ hơn, nhanh hơn, gọn hơn và vẫn giữ được tính chất nghiêm túc của một môi trường thực chiến. Đây không chỉ là một giao diện đẹp. Đây là một workspace được tổ chức lại để trader có thể đọc chart nhanh, theo dõi lệnh nhanh và chuyển ngữ cảnh nhanh mà không bị đứt dòng suy nghĩ khi thị trường đang chạy mạnh.'
              : 'The Pro plan is how Vivutrade brings MT5 trading into a new web-first era: clearer, faster, tighter, and still serious enough for real execution. This is not just a polished interface. It is a reorganized trading workspace that helps traders read charts faster, monitor positions faster, and switch context faster without breaking concentration.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
              {isVi ? 'MT5 web terminal thực chiến' : 'MT5 execution-ready web terminal'}
            </span>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-700">
              {isVi ? 'Đa biểu đồ, đa khung thời gian' : 'Multi-chart, multi-timeframe'}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">
              {isVi ? 'Chưa mở rộng phát hành đại trà' : 'Not publicly rolled out yet'}
            </span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-emerald-200/70 bg-white p-3 shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-100/80 to-transparent" />
          <Image
            src="/brand/articles/pro-chart.png"
            alt={isVi ? 'Ảnh giao diện chart và terminal thực tế của Vivutrade' : 'Real Vivutrade chart and terminal interface'}
            width={1200}
            height={800}
            className="relative z-10 h-auto w-full rounded-[20px] border border-slate-200 object-cover"
            priority
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-900">{isVi ? 'Tập trung thao tác' : 'Execution focus'}</p>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isVi
              ? 'Tài khoản, position, order và chart được đưa về cùng một không gian làm việc để giảm chuyển tab và giảm ma sát thao tác.'
              : 'Account, positions, orders, and charts stay in one workspace so traders can reduce tab switching and operational friction.'}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-900">{isVi ? 'Đa biểu đồ thực chiến' : 'Practical multi-charting'}</p>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isVi
              ? 'Quan sát đa mã, đa khung thời gian và giữ được ngữ cảnh phân tích rõ ràng hơn nhiều so với nhóm công cụ MT5 truyền thống.'
              : 'Observe multiple symbols and timeframes while keeping analytical context far more coherent than traditional MT5-era tools.'}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-900">{isVi ? 'Sẵn cho phiên mạnh' : 'Ready for intense sessions'}</p>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isVi
              ? 'Tối ưu cho scalping và intraday, nơi mỗi bước chậm và mỗi thao tác dư đều làm hao hụt hiệu suất giao dịch.'
              : 'Tuned for scalping and intraday sessions where every slow step and every extra click costs performance.'}
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="order-2 lg:order-1">
          <Image
            src="/brand/articles/pro-strategy.png"
            alt={isVi ? 'Ảnh chiến lược và giám sát thực tế của Vivutrade' : 'Real Vivutrade strategy and monitoring preview'}
            width={1200}
            height={800}
            className="h-auto w-full rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]"
          />
        </div>
        <div className="order-1 space-y-4 lg:order-2">
          <h2 className="text-2xl font-black text-slate-900 md:text-3xl">
            {isVi ? 'Mạnh hơn thị trường hiện tại ở điểm nào?' : 'Where it outperforms the current market'}
          </h2>
          <p className="text-base leading-8 text-slate-700">
            {isVi
              ? 'Phần lớn giải pháp hiện nay rơi vào hai nhóm: nhóm đẹp và hiện đại nhưng thiếu độ sâu vận hành, và nhóm bám sát giao dịch nhưng giao diện cũ, thao tác nặng và khó tổ chức workspace. Gói Nâng cao được xây dựng để lấp đúng khoảng trống đó bằng một giao diện web rõ ràng nhưng vẫn tôn trọng tư duy giao dịch nghiêm túc.'
              : 'Most current solutions fall into two groups: those that look modern but lack operational depth, and those that remain execution-oriented but feel heavy and outdated. Pro is built to close that gap with a cleaner web experience that still respects serious trading workflow.'}
          </p>
          <p className="text-base leading-8 text-slate-700">
            {isVi
              ? 'Khác biệt lớn nhất không nằm ở một feature đơn lẻ. Nó nằm ở cảm giác vận hành tổng thể: chart rõ hơn, tín hiệu gần hơn, terminal liền mạch hơn và mọi thứ được đặt trong cùng một dòng suy nghĩ của trader.'
              : 'The biggest difference is not a single feature. It is the operational feel of the product: clearer charts, tighter signal context, a more coherent terminal, and a workspace that moves with the trader’s thought process.'}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-2xl font-black text-slate-900 md:text-3xl">
          {isVi ? 'Trạng thái phát hành hiện tại' : 'Current release status'}
        </h2>
        <div className="mt-4 space-y-4 text-base leading-8 text-slate-700">
          <p>
            {isVi
              ? 'Sản phẩm đã có hình ảnh thật, luồng sử dụng thật và các lớp cốt lõi được xây dựng theo hướng sản phẩm thật. Giai đoạn hiện tại không phải là vì chưa có gì để xem, mà là để tiếp tục làm chặt hơn về độ ổn định kết nối, kiểm soát dữ liệu và trải nghiệm onboarding trước khi trình làng rộng hơn.'
              : 'The product already has real interface imagery, real usage flow, and real core layers. This phase is not about lacking substance. It is about hardening connection stability, data control, and onboarding quality before wider presentation.'}
          </p>
          <p>
            {isVi
              ? 'Khi mở quyền truy cập chính thức, đây sẽ là gói dành cho trader muốn dùng web như môi trường giao dịch chính, không chỉ là giao diện phụ trợ bên cạnh MT5.'
              : 'Once public access opens, this will be the plan for traders who want the web to become their primary trading environment, not just a secondary interface next to MT5.'}
          </p>
        </div>
      </section>
    </>
  );
}

function AiArticle({ isVi }: { isVi: boolean }) {
  return (
    <>
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-600">
            {isVi ? 'Gói Cao cấp' : 'AI Plan'}
          </p>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
            {isVi
              ? 'Lớp AI chiến lược cao cấp được xây để vượt xa mặt bằng hiện tại'
              : 'A premium AI strategy layer built to move beyond the current market'}
          </h1>
          <p className="max-w-3xl text-base leading-8 text-slate-700 md:text-lg">
            {isVi
              ? 'Gói Cao cấp được định hướng cho trader chuyên sâu và team vận hành chiến lược cần một lớp AI thật sự hữu ích. Mục tiêu của gói này không phải để thêm vài dòng tư vấn cho đẹp, mà để tạo ra một hệ thống AI có thể đánh giá chất lượng tín hiệu, nhìn ra điểm yếu logic, đề xuất tinh chỉnh rule và giúp người dùng đọc hiểu hiệu suất ở mức sâu hơn mặt bằng sản phẩm AI trading thông thường.'
              : 'The AI plan is aimed at advanced traders and strategy teams that need AI to be genuinely useful. Its purpose is not to decorate the platform with superficial guidance, but to create a system that can evaluate signal quality, expose logic weaknesses, suggest rule refinements, and help users understand performance at a much deeper level than typical AI trading products.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <span className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">
              {isVi ? 'AI đánh giá chiến lược' : 'AI strategy evaluation'}
            </span>
            <span className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-4 py-2 text-sm font-bold text-fuchsia-700">
              {isVi ? 'Tối ưu rule và hiệu suất' : 'Rule and performance refinement'}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">
              {isVi ? 'Đang được làm kỹ trước khi ra mắt' : 'Being refined before launch'}
            </span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-amber-200/70 bg-white p-3 shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-amber-100/80 to-transparent" />
          <Image
            src="/brand/articles/ai-dashboard.png"
            alt={isVi ? 'Ảnh dashboard AI và phân tích chiến lược của Vivutrade' : 'Vivutrade AI dashboard and strategy analysis interface'}
            width={1200}
            height={800}
            className="relative z-10 h-auto w-full rounded-[20px] border border-slate-200 object-cover"
            priority
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-900">{isVi ? 'AI cho chất lượng chiến lược' : 'AI for strategy quality'}</p>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isVi
              ? 'Phân tích hiệu suất theo ngữ cảnh để trader thấy rõ chiến lược mạnh ở đâu, yếu ở đâu và vô hiệu ở điều kiện nào.'
              : 'Context-aware performance analysis helps traders see where a strategy is strong, weak, or structurally fragile.'}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-900">{isVi ? 'AI cho tối ưu rule' : 'AI for rule refinement'}</p>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isVi
              ? 'Hệ thống được định hướng để đưa ra các tinh chỉnh có tính hành động, không chỉ là tóm tắt kết quả đã xảy ra.'
              : 'The system is designed to produce actionable refinements, not just summarize what already happened.'}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-slate-900">{isVi ? 'AI cho workflow nhóm' : 'AI for team workflows'}</p>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isVi
              ? 'Phù hợp với team và power user cần một lớp suy luận bổ sung nằm phía trên chart, signal và dashboard.'
              : 'Built for teams and power users who need an extra reasoning layer above charts, signals, and dashboards.'}
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="order-2 lg:order-1">
          <Image
            src="/brand/articles/ai-matrix.png"
            alt={isVi ? 'Ảnh theo dõi chỉ báo và hệ thống phân tích của Vivutrade' : 'Vivutrade indicator monitoring and analysis system'}
            width={1200}
            height={800}
            className="h-auto w-full rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]"
          />
        </div>
        <div className="order-1 space-y-4 lg:order-2">
          <h2 className="text-2xl font-black text-slate-900 md:text-3xl">
            {isVi ? 'Khác biệt lớn nhất so với AI trading ngoài thị trường' : 'The biggest difference from typical AI trading products'}
          </h2>
          <p className="text-base leading-8 text-slate-700">
            {isVi
              ? 'Thị trường hiện nay có rất nhiều sản phẩm gắn nhãn AI, nhưng phần lớn dừng lại ở mức sinh nội dung, tóm tắt dữ liệu hoặc đưa ra tín hiệu tổng quát. Gói Cao cấp đi theo hướng khác: AI phải bám được ngữ cảnh chiến lược thật, chất lượng dữ liệu thật và tạo ra đầu ra đủ sâu để trader có thể hành động với mức độ tự tin cao hơn.'
              : 'The market is full of AI-branded products, but many stop at content generation, shallow summaries, or broad signal suggestions. The AI plan goes in a different direction: AI must stay grounded in real strategy context, real data quality, and produce output deep enough to support higher-confidence action.'}
          </p>
          <p className="text-base leading-8 text-slate-700">
            {isVi
              ? 'Đây là lý do gói này được làm kỹ hơn và chậm hơn. Chúng tôi ưu tiên độ hữu ích vận hành thực tế thay vì đưa AI lên sản phẩm chỉ để trình diễn.'
              : 'That is why this plan is being built more deliberately. We prioritize operational usefulness over shipping AI as a surface-level showcase.'}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-2xl font-black text-slate-900 md:text-3xl">
          {isVi ? 'Trạng thái phát hành hiện tại' : 'Current release status'}
        </h2>
        <div className="mt-4 space-y-4 text-base leading-8 text-slate-700">
          <p>
            {isVi
              ? 'Các hình ảnh giao diện, dashboard và workflow thực tế đã tồn tại. Giai đoạn hiện tại là để tiếp tục nâng chất lượng suy luận, cơ chế hiển thị và tiêu chuẩn đầu ra để mọi tính năng AI đều đáng dùng, không chỉ gây ấn tượng lúc demo.'
              : 'Real interface, dashboard, and workflow imagery already exists. The current phase is about improving reasoning quality, presentation quality, and output standards so every AI feature is genuinely useful, not only impressive in a demo.'}
          </p>
          <p>
            {isVi
              ? 'Khi mở rộng phát hành, đây sẽ là gói dành cho những người dùng muốn biến AI thành lợi thế vận hành thật sự trong việc phân tích, tối ưu và đánh giá chiến lược.'
              : 'When access expands, this will be the plan for users who want AI to become a real operating advantage for analysis, optimization, and strategy evaluation.'}
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
        {plan === 'pro' ? <ProArticle isVi={isVi} /> : <AiArticle isVi={isVi} />}

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
