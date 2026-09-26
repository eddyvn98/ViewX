export const TIMEFRAME_CONFIG = [
    { id: '1', label: '1m', title: '1 phút', category: 'PHÚT' },
    { id: '3', label: '3m', title: '3 phút', category: 'PHÚT' },
    { id: '5', label: '5m', title: '5 phút', category: 'PHÚT' },
    { id: '10', label: '10m', title: '10 phút', category: 'PHÚT' },
    { id: '15', label: '15m', title: '15 phút', category: 'PHÚT' },
    { id: '30', label: '30m', title: '30 phút', category: 'PHÚT' },
    { id: '60', label: '1h', title: '1 giờ', category: 'GIỜ' },
    { id: '120', label: '2h', title: '2 giờ', category: 'GIỜ' },
    { id: '240', label: '4h', title: '4 giờ', category: 'GIỜ' },
    { id: '1440', label: '1D', title: '1 ngày', category: 'NGÀY' },
    { id: '10080', label: '1W', title: '1 tuần', category: 'NGÀY' },
    { id: '43200', label: '1M', title: '1 tháng', category: 'NGÀY' },
];

/** Converts stored/API timeframe IDs to the compact label shown beside a symbol. */
export function formatChartTimeframe(interval: string | undefined): string {
    const raw = String(interval || '').trim();
    const canonical = raw === 'D' ? '1440' : raw === 'W' ? '10080' : raw;
    const config = TIMEFRAME_CONFIG.find((item) => item.id === canonical);
    if (!config) return raw;

    const label = config.label;
    if (canonical === '1440') return 'D';
    if (canonical === '10080') return 'W';
    return label.toUpperCase();
}
