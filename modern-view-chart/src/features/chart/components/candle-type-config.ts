export type ChartTypeOption = 'candles' | 'heikin_ashi' | 'smart_candles';

export const CHART_TYPE_CONFIG: Array<{
    id: ChartTypeOption;
    label: string;
    shortLabel: string;
}> = [
    { id: 'candles', label: 'Nến Thường', shortLabel: 'C' },
    { id: 'heikin_ashi', label: 'Heikin Ashi', shortLabel: 'HA' },
    { id: 'smart_candles', label: 'Nến Kim Cương', shortLabel: 'SC' },
];
