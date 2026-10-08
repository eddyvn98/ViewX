import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro, Outfit, Inter } from 'next/font/google';
import NextTopLoader from 'nextjs-toploader';
import React from 'react';
import { Toaster } from 'sonner';
import './globals.css';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { FloatingSupportButton } from '@/components/layout/FloatingSupportButton';
import { getSiteUrl } from '@/lib/site-url';

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam',
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-outfit',
});

const inter = Inter({
  subsets: ['vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b0e14',
};

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  icons: {
    icon: '/icon.svg',
    shortcut: '/favicon.ico',
    apple: '/icon.svg',
  },
  title: 'vivutrade',
  description: 'vivutrade trading platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning className={`${beVietnamPro.variable} ${outfit.variable} ${inter.variable}`}>
      <body className={`${beVietnamPro.className} antialiased`} suppressHydrationWarning>
        <NextTopLoader
          color="#0ea5e9"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #0ea5e9,0 0 5px #0ea5e9"
        />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
          <FloatingSupportButton />
          <Toaster theme="light" position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
