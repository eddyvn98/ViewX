import Link from "next/link";

export default async function TerminalGuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isVi = locale !== "en";

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <h1 className="text-2xl font-bold">
        {isVi ? "Tong quan luong kich hoat MT5 Module" : "MT5 Module Activation Overview"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {isVi
          ? "Luong moi tap trung vao 1 hanh trinh: app dang nhap -> web xac nhan module -> app tray tu dong mo bridge."
          : "The new flow is a single journey: app sign-in -> web module confirmation -> app tray auto-bridge."}
      </p>

      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">{isVi ? "1. Cai EXE, mo app, bam Dang nhap" : "1. Install EXE, open app, press Sign in"}</h2>
        <p className="text-sm">{isVi ? "App mo trang web de dang nhap va xu ly thanh toan neu can." : "The app opens web login and payment flow if needed."}</p>
      </section>

      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">{isVi ? "2. Web xac nhan module thanh cong" : "2. Web confirms module activation"}</h2>
        <p className="text-sm">{isVi ? "Sau khi xac nhan xong, dong tab web." : "Close the web tab after confirmation."}</p>
      </section>

      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">{isVi ? "3. App chay tray va bat bridge tu dong" : "3. App runs in tray and auto-starts bridge"}</h2>
        <p className="text-sm">{isVi ? "Khong can giu tab web mo lien tuc." : "You do not need to keep the web tab open."}</p>
      </section>

      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">{isVi ? "4. Quay lai /chart de trade" : "4. Return to /chart and trade"}</h2>
        <p className="text-sm">{isVi ? "Khi web detect bridge online va account hop le, terminal mo data MT5." : "When web detects online bridge and valid account, MT5 data is enabled in terminal."}</p>
      </section>

      <div>
        <Link href={`/${locale}/chart`} className="text-sm underline underline-offset-2">
          {isVi ? "Quay lai chart" : "Back to chart"}
        </Link>
      </div>
    </main>
  );
}
