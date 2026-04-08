import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import type { Metadata, Viewport } from "next";
import { getSiteOrigin, getSiteUrl } from "@/lib/site-url";
import React from 'react';

const siteOrigin = getSiteOrigin();
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b0e14",
};

// Metadata definitions
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
    description: "Vivutrade is a professional trading platform featuring Diamond Charts, AI Trade Monitoring, MT5 Realtime Data, and advanced multi-chart setups. Superior to TradingView.",
    applicationName: "vivutrade",
    keywords: [
      "diamond chart",
      "ai trade monitor",
      "mt5 realtime data",
      "multi-chart trading",
      "strategy matrix",
      "backtest analytics",
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
      description: "Vivutrade is a professional trading platform featuring Diamond Charts, AI Trade Monitoring, MT5 Realtime Data, and advanced multi-chart setups. Superior to TradingView.",
      images: [`${siteOrigin}/opengraph-image`],
    },
    twitter: {
      card: "summary_large_image",
      title: t('title'),
      description: "Vivutrade is a professional trading platform featuring Diamond Charts, AI Trade Monitoring, MT5 Realtime Data, and advanced multi-chart setups. Superior to TradingView.",
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
    "vivutrade is a professional trading platform featuring Diamond Charts, AI Trade Monitoring, MT5 Realtime Data feeds, and advanced multi-chart setups for ultimate trading performance. Nền tảng giao dịch AI chuyên nghiệp với dữ liệu MT5 thời gian thực.",
};

const websiteStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "vivutrade",
  url: siteOrigin,
  inLanguage: ["vi-VN", "en-US"],
  description: "vivutrade is a professional trading platform featuring Diamond Charts, AI Trade Monitoring, MT5 Realtime Data feeds, and advanced multi-chart setups for ultimate trading performance.",
};

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationStructuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData) }}
      />
      {children}
    </NextIntlClientProvider>
  );
}
