import { BusinessDay, Time } from 'lightweight-charts';

export function normalizeCrosshairTime(value: Time | null | undefined): number | null {
    if (value == null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;

    const candidate = value as Partial<BusinessDay & { timestamp?: unknown }>;
    if (typeof candidate.timestamp === 'number' && Number.isFinite(candidate.timestamp)) {
        return candidate.timestamp > 10000000000 ? Math.floor(candidate.timestamp / 1000) : candidate.timestamp;
    }

    if (typeof candidate.year === 'number' && typeof candidate.month === 'number' && typeof candidate.day === 'number') {
        return Math.floor(Date.UTC(candidate.year, candidate.month - 1, candidate.day) / 1000);
    }

    return null;
}
