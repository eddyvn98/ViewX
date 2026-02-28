import { INDICATOR_REGISTRY } from './indicator-definitions';

export function getIndicatorDefaultParams(type: string): Record<string, any> {
    const metadata = INDICATOR_REGISTRY[type as keyof typeof INDICATOR_REGISTRY];
    if (!metadata) return {};
    return Object.fromEntries(Object.entries(metadata.params).map(([key, schema]) => [key, schema.default]));
}
