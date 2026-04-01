import Link from "next/link";
import { ENABLE_NATIVE_APP_DOWNLOAD } from "@/config/feature-flags";

export default async function TerminalSetupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isVi = locale !== "en";

  return (
    <main className="min-h-screen overflow-y-auto bg-gradient-to-b from-sky-50 via-white to-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-5 pb-10">
        <h1 className="text-2xl font-bold">
          {isVi ? "KÃ­ch hoáº¡t MT5: chá»n 1 trong 2 cÃ¡ch" : "MT5 Activation: choose 1 of 2 options"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isVi
            ? "Báº¡n cÃ³ thá»ƒ dÃ¹ng web vá»›i extension hoáº·c dÃ¹ng báº£n desktop full. Chá»‰ cáº§n chá»n 1 luá»“ng phÃ¹ há»£p."
            : "You can use web with extension or the full desktop app. Pick the flow that fits you."}
        </p>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="space-y-3 rounded-lg border border-cyan-300 bg-cyan-50 p-4">
            <h2 className="text-lg font-semibold text-cyan-900">
              {isVi ? "Lá»±a chá»n 1: Web + Extension" : "Option 1: Web + Extension"}
            </h2>
            <p className="text-sm text-cyan-900/90">
              {isVi
                ? "PhÃ¹ há»£p khi báº¡n muá»‘n tiáº¿p tá»¥c giao diá»‡n web /chart hiá»‡n táº¡i."
                : "Best if you want to keep using the current web /chart interface."}
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-cyan-900/90">
              <li>{isVi ? "Má»Ÿ app vÃ  báº¥m ÄÄƒng nháº­p." : "Open app and press Sign in."}</li>
              <li>{isVi ? "App má»Ÿ web Ä‘á»ƒ xÃ¡c nháº­n tÃ i khoáº£n/module." : "App opens web to confirm account/module."}</li>
              <li>{isVi ? "Náº¿u chÆ°a mua, thanh toÃ¡n ngay trÃªn web." : "If module is inactive, pay on web."}</li>
              <li>{isVi ? "XÃ¡c nháº­n xong, Ä‘Ã³ng tab web vÃ  Ä‘á»ƒ app cháº¡y tray." : "After confirmation, close web tab and keep app in tray."}</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <a
                href="/downloads/vivutrade-mt5-extension.zip"
                download
                className="rounded-md border border-cyan-400 bg-white px-3 py-1.5 text-sm font-medium text-cyan-900 hover:bg-cyan-100"
              >
                {isVi ? "Táº£i Extension (.zip)" : "Download Extension (.zip)"}
              </a>
            </div>
          </article>

          <article className="space-y-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
            <h2 className="text-lg font-semibold text-emerald-900">
              {isVi ? "Lá»±a chá»n 2: Desktop App Full" : "Option 2: Desktop App Full"}
            </h2>
            <p className="text-sm text-emerald-900/90">
              {isVi
                ? "PhÃ¹ há»£p khi báº¡n muá»‘n cháº¡y full trong app, háº¡n cháº¿ phá»¥ thuá»™c trÃ¬nh duyá»‡t."
                : "Best if you want a full in-app flow with less browser dependency."}
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-emerald-900/90">
              <li>{isVi ? "CÃ i 1 file EXE duy nháº¥t." : "Install one EXE package."}</li>
              <li>{isVi ? "Má»Ÿ app, báº¥m ÄÄƒng nháº­p Ä‘á»ƒ nháº£y lÃªn web xÃ¡c nháº­n." : "Open app, press Sign in to open web confirmation."}</li>
              <li>{isVi ? "Náº¿u chÆ°a thanh toÃ¡n thÃ¬ hoÃ n táº¥t trÃªn web." : "If not paid yet, complete payment on web."}</li>
              <li>{isVi ? "Xong thÃ¬ Ä‘Ã³ng tab web, app cháº¡y tray vÃ  má»Ÿ luá»“ng dá»¯ liá»‡u." : "Close web tab, app runs in tray and opens data flow."}</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              {ENABLE_NATIVE_APP_DOWNLOAD ? (
                <a
                  href="/downloads/Vivutrade-Desktop-Full-Installer.exe"
                  download
                  className="rounded-md border border-emerald-400 bg-white px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
                >
                  {isVi ? "Tải Desktop App (.exe)" : "Download Desktop App (.exe)"}
                </a>
              ) : (
                <span className="rounded-md border border-emerald-300 bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-900/80">
                  {isVi ? "Tạm khóa tải app native (đang test)" : "Native app download is temporarily disabled (testing)"}
                </span>
              )}
            </div>
          </article>
        </section>

        <section className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-lg font-semibold text-amber-900">
            {isVi ? "LÆ°u Ã½ quan trá»ng" : "Important note"}
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
            <li>
              {isVi
                ? "Báº¡n chá»‰ cáº§n chá»n 1 lá»±a chá»n. KhÃ´ng báº¯t buá»™c lÃ m cáº£ hai."
                : "You only need one option. You do not need both."}
            </li>
            <li>
              {isVi
                ? "Náº¿u Ä‘Ã£ kÃ­ch hoáº¡t module thÃ nh cÃ´ng, web /chart sáº½ má»Ÿ dá»¯ liá»‡u MT5."
                : "Once module is active, MT5 data is enabled on /chart."}
            </li>
          </ul>
        </section>

        <div>
          <Link href={`/${locale}/chart`} className="text-sm underline underline-offset-2">
            {isVi ? "Quay láº¡i chart" : "Back to chart"}
          </Link>
        </div>
      </div>
    </main>
  );
}



