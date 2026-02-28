import { INDICATOR_CATEGORIES } from './indicator-selector-categories';

export function filterIndicatorCategories(searchQuery: string) {
    if (!searchQuery) return INDICATOR_CATEGORIES;

    const q = searchQuery.toLowerCase();
    return INDICATOR_CATEGORIES
        .map(cat => ({
            ...cat,
            indicators: cat.indicators.filter(ind =>
                ind.name.toLowerCase().includes(q) || ind.type.toLowerCase().includes(q)
            ),
        }))
        .filter(cat => cat.indicators.length > 0);
}
