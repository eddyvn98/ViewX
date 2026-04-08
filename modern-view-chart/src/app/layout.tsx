import type { Metadata, Viewport } from 'next';
import NextTopLoader from 'nextjs-toploader';
import React from 'react';
import { Toaster } from 'sonner';
import './globals.css';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { getSiteUrl } from '@/lib/site-url';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
    <html lang="vi" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
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
          <Toaster theme="light" position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
