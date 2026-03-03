import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Multi-Symbol Strategy Matrix Monitor | Ma Trận Tín Hiệu | Vivutrade',
    description: 'Real-time monitoring of trends, BUY/SELL signals, and technical indicators across dozens of symbols and timeframes. Giám sát tín hiệu đa cặp trực quan.',
    alternates: {
        canonical: '/strategy/matrix',
    },
};

export default function MatrixLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
