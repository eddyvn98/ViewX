import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "../globals.css";
import { getSiteOrigin, getSiteUrl } from "@/lib/site-url";
import { Toaster } from 'sonner';
import { ThemeProvider } from "@/components/layout/theme-provider";
import NextTopLoader from 'nextjs-toploader';
import React from 'react';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const siteOrigin = getSiteOrigin();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b0e14",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });

  return {
    metadataBase: getSiteUrl(),
    icons: {
      icon: "/icon.svg",
      shortcut: "/favicon.ico",
      apple: "/icon.svg",
    },
    title: {
      default: t('title'),
      template: `%s | vivutrade`,
    },
    description: t('description'),
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
      title: t('title'),
      description: t('description'),
      images: [`${siteOrigin}/opengraph-image`],
    },
    twitter: {
      card: "summary_large_image",
      title: t('title'),
      description: t('description'),
      images: [`${siteOrigin}/opengraph-image`],
    },
  };
}

const organizationStructuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "vivutrade",
  url: siteOrigin,
  logo: `${siteOrigin}/brand/vivutrade-logo.svg`,
  description:
    "vivutrade is a professional trading chart, strategy matrix monitor, and backtest analytics platform. vivutrade là nền tảng trading chart realtime, strategy matrix monitor và backtest analytics cho nhà giao dịch.",
};

const websiteStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "vivutrade",
  url: siteOrigin,
  inLanguage: ["vi-VN", "en-US"],
};

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} antialiased`}
        suppressHydrationWarning
      >
        <NextTopLoader
          color="#0ea5e9"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #0ea5e9,0 0 5px #0ea5e9"
        />
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
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
          <Toaster theme="light" position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
