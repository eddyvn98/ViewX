import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Realtime Financial Chart | Biểu Đồ Tài Chính Trực Tuyến | Vivutrade',
    description: 'High-performance chart workspace with real-time candle data, smooth interactions, and professional analysis tools for 100+ assets. Biểu đồ nến thời gian thực siêu mượt mà.',
    alternates: {
        canonical: '/chart',
    },
};

export default function ChartLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
