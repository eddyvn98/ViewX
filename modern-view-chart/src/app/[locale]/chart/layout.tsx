import type { Metadata } from 'next';

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const normalizedLocale = locale === 'vi' ? 'vi' : 'en';

    return {
        title: 'Realtime Financial Chart | Biểu Đồ Tài Chính Trực Tuyến | Vivutrade',
        description: 'High-performance chart workspace with real-time candle data, smooth interactions, and professional analysis tools for 100+ assets. Biểu đồ nến thời gian thực siêu mượt mà.',
        alternates: {
            canonical: `/${normalizedLocale}/chart`,
            languages: {
                en: '/en/chart',
                vi: '/vi/chart',
                'x-default': '/en/chart',
            },
        },
    };
}

export default function ChartLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
