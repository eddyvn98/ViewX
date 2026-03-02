import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { getSiteOrigin, getSiteUrl } from "@/lib/site-url";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b0e14",
};

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "vivutrade | Trading Chart & Strategy",
    template: "%s | vivutrade",
  },
  description:
    "vivutrade cung cấp trading chart realtime, strategy matrix monitor và backtest analytics cho nhà giao dịch.",
  applicationName: "vivutrade",
  keywords: [
    "trading chart",
    "strategy matrix",
    "backtest analytics",
    "realtime signals",
    "vivutrade",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: "vivutrade",
    title: "vivutrade | Trading Chart & Strategy",
    description:
      "Trading chart realtime, strategy matrix monitor và backtest analytics trong một nền tảng duy nhất.",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "vivutrade | Trading Chart & Strategy",
    description:
      "Trading chart realtime, strategy matrix monitor và backtest analytics trong một nền tảng duy nhất.",
    images: ["/opengraph-image"],
  },
};

const siteOrigin = getSiteOrigin();
const organizationStructuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "vivutrade",
  url: siteOrigin,
  logo: `${siteOrigin}/favicon.ico`,
  description:
    "vivutrade là nền tảng trading chart realtime, strategy matrix monitor và backtest analytics cho nhà giao dịch.",
};

const websiteStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "vivutrade",
  url: siteOrigin,
  inLanguage: "vi-VN",
};


import { Toaster } from 'sonner';
import { ThemeProvider } from "@/components/layout/theme-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} antialiased`}
        suppressHydrationWarning
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationStructuredData) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData) }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster theme="light" position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
