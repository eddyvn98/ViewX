import type { Metadata } from 'next';
import Link from 'next/link';

const NATIVE_SETUP_DOWNLOAD = '/downloads/desktop-native/Vivutrade%20Desktop%20Native%20Setup%201.0.0.exe';

type PageProps = {
    params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params;
    const isVi = locale.toLowerCase().startsWith('vi');

    return {
        title: isVi ? 'Hướng dẫn Your MT5 | vivutrade' : 'Your MT5 Guide | vivutrade',
        description: isVi
            ? 'Tải app native, kết nối MT5 local, hoàn tất consent và mở khóa terminal Vivutrade.'
            : 'Download the native app, connect local MT5, complete consent, and unlock the Vivutrade terminal.',
        alternates: { canonical: '/your-mt5-guide' },
    };
}

export default async function YourMt5GuidePage({ params }: PageProps) {
    const { locale } = await params;
    const isVi = locale.toLowerCase().startsWith('vi');

    const steps = isVi
        ? [
              'Tải và cài app Vivutrade Desktop Native trên máy Windows đang chạy MT5.',
              'Mở app và đăng nhập bằng đúng tài khoản Vivutrade đã mua module Your MT5.',
              'Mở MT5 local trên cùng máy, rồi đăng nhập account giao dịch.',
              'Quay lại web trong app để kiểm tra native bridge đang online và account đã được nhận diện.',
              'Mở bước kích hoạt MT5, xác nhận consent, rồi quay lại chart để mở khóa terminal.',
          ]
        : [
              'Download and install the Vivutrade Desktop Native app on the Windows machine that runs MT5.',
              'Open the app and sign in with the Vivutrade account that purchased the Your MT5 module.',
              'Open local MT5 on the same machine and sign in to the trading account.',
              'Return to the web view inside the app and confirm the native bridge is online plus account detection.',
              'Open MT5 activation, complete consent, then return to the chart to unlock the terminal.',
          ];

    const faq = isVi
        ? [
              ['Tôi đã mua module nhưng terminal vẫn bị khóa?', 'Đăng nhập lại trong desktop app bằng đúng tài khoản vừa mua module. Entitlement hiện đọc theo module `your_mt5` của account hiện tại.'],
              ['Cần cài gì trên máy user?', 'Chỉ cần app Vivutrade Desktop Native và MT5 local. Native bridge đã được đóng gói sẵn trong app native.'],
              ['Bridge online rồi nhưng chưa thấy account?', 'Mở MT5 trên đúng máy, đăng nhập account, chờ vài giây để account payload được gửi về web.'],
              ['Khi nào cần mở log?', 'Khi app báo bridge error hoặc web không thấy bridge/account sau khi bạn đã login MT5.'],
          ]
        : [
              ['I bought the module but the terminal is still locked.', 'Sign in again inside the desktop app with the same account that purchased the module. Entitlements now follow the `your_mt5` module on the current account.'],
              ['What does the user need to install?', 'Only the Vivutrade Desktop Native app and local MT5. The native bridge is already bundled in the app.'],
              ['The bridge is online but the account is still missing.', 'Open MT5 on the same machine, sign in to the account, and wait a few seconds for the account payload to reach the web app.'],
              ['When should I open logs?', 'Open logs when the app reports a bridge error or the web view still cannot detect bridge/account after MT5 login.'],
          ];

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.14),_transparent_24%),#020617] px-4 py-10 text-white">
            <div className="mx-auto max-w-5xl space-y-8">
                <section className="rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-300">
                        {isVi ? 'Your MT5 onboarding' : 'Your MT5 onboarding'}
                    </p>
                    <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight md:text-5xl">
                        {isVi
                            ? 'Mua xong module rồi, bắt đầu từ đây để cài app native và mở khóa terminal'
                            : 'After purchase, start here to install the native app and unlock the terminal'}
                    </h1>
                    <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                        {isVi
                            ? 'Trang này là đích đến sau khi mua module Your MT5. Nó gom đủ link tải app, các bước cài native bridge, cách dùng, FAQ và đường quay lại activation flow.'
                            : 'This is the post-purchase destination for the Your MT5 module. It gathers the native app download, installation steps, usage guidance, FAQ, and the way back to activation.'}
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <a
                            href={NATIVE_SETUP_DOWNLOAD}
                            className="inline-flex items-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:scale-[1.01] hover:bg-emerald-400"
                        >
                            {isVi ? 'Tai app desktop native' : 'Download native desktop app'}
                        </a>
                        <Link
                            href={`/${locale}/mt5-activation`}
                            className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                        >
                            {isVi ? 'Tiếp tục kích hoạt MT5' : 'Continue MT5 activation'}
                        </Link>
                        <Link
                            href={`/${locale}/chart`}
                            className="inline-flex items-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/20"
                        >
                            {isVi ? 'Vào chart để dùng' : 'Go to chart to use it'}
                        </Link>
                        <Link
                            href={`/${locale}/pricing`}
                            className="inline-flex items-center rounded-2xl border border-white/10 bg-slate-900/70 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-900"
                        >
                            {isVi ? 'Xem pricing' : 'View pricing'}
                        </Link>
                        <Link
                            href={`/${locale}/faq`}
                            className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                        >
                            FAQ
                        </Link>
                    </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-6">
                        <h2 className="text-2xl font-bold">
                            {isVi ? 'Các bước user cần làm' : 'What the user needs to do'}
                        </h2>
                        <ol className="mt-5 space-y-4">
                            {steps.map((step, index) => (
                                <li key={step} className="flex gap-4 rounded-2xl border border-white/5 bg-white/5 p-4">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-black text-emerald-300">
                                        {index + 1}
                                    </div>
                                    <p className="text-sm leading-7 text-slate-200">{step}</p>
                                </li>
                            ))}
                        </ol>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                            <h2 className="text-xl font-bold">
                                {isVi ? 'User sẽ thấy gì trong app' : 'What the user will see in the app'}
                            </h2>
                            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                                <li>{isVi ? 'Chưa login Vivutrade: app chờ access token.' : 'No Vivutrade login yet: the app waits for an access token.'}</li>
                                <li>{isVi ? 'Chưa mở MT5: overlay báo đang chờ MT5 local.' : 'MT5 not open yet: the overlay shows it is waiting for local MT5.'}</li>
                                <li>{isVi ? 'Chưa mua module: flow bị gate và CTA chính sang pricing.' : 'Module not purchased yet: the flow is gated and the main CTA goes to pricing.'}</li>
                                <li>{isVi ? 'Bridge, account, consent đầy đủ: terminal được mở khóa.' : 'Bridge, account, and consent ready: the terminal unlocks.'}</li>
                            </ul>
                        </div>

                        <div className="rounded-[28px] border border-amber-400/15 bg-amber-400/10 p-6">
                            <h2 className="text-xl font-bold text-amber-100">
                                {isVi ? 'Lưu ý hỗ trợ' : 'Support note'}
                            </h2>
                            <p className="mt-3 text-sm leading-7 text-amber-50/90">
                                {isVi
                                    ? 'Nếu user đã mua module nhưng app chưa nhận quyền, hãy đăng xuất rồi đăng nhập lại trong desktop app trước khi xử lý bridge hoặc MT5.'
                                    : 'If the user already purchased the module but the app still does not see the entitlement, sign out and sign back in inside the desktop app before troubleshooting bridge or MT5.'}
                            </p>
                            <p className="mt-3 text-sm leading-7 text-amber-50/90">
                                {isVi ? 'Chưa mua module? ' : 'No module yet? '}
                                <Link href={`/${locale}/pricing`} className="font-semibold text-amber-50 underline-offset-4 hover:underline">
                                    {isVi ? 'Đi tới pricing' : 'Go to pricing'}
                                </Link>
                            </p>
                        </div>
                    </div>
                </section>

                <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                    <div className="flex items-center justify-between gap-4">
                        <h2 className="text-2xl font-bold">{isVi ? 'FAQ nhanh cho Your MT5' : 'Quick FAQ for Your MT5'}</h2>
                        <Link href={`/${locale}/faq`} className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">
                            {isVi ? 'Xem FAQ đầy đủ' : 'Open full FAQ'}
                        </Link>
                    </div>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                        {faq.map(([q, a]) => (
                            <article key={q} className="rounded-2xl border border-white/5 bg-slate-950/70 p-4">
                                <h3 className="font-semibold text-white">{q}</h3>
                                <p className="mt-2 text-sm leading-7 text-slate-300">{a}</p>
                            </article>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
}
