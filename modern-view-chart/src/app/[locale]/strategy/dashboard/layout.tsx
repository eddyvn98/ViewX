import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Strategy Performance & Backtest Dashboard | Vivutrade',
    description: 'Measure trading system effectiveness with Winrate, Profit Factor, and Equity Curve based on tick data. Đánh giá hiệu suất chiến lược và đo lường tỷ lệ thắng.',
    alternates: {
        canonical: '/strategy/dashboard',
    },
};

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
