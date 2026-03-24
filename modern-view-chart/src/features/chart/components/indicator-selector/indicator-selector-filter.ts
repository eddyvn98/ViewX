import { INDICATOR_CATEGORIES } from './indicator-selector-categories';
import { CATEGORY_I18N, INDICATOR_I18N, normalizeSearchText } from './indicator-localization';

export function filterIndicatorCategories(searchQuery: string) {
    if (!searchQuery) return INDICATOR_CATEGORIES;

    const q = normalizeSearchText(searchQuery);
    return INDICATOR_CATEGORIES
        .map(cat => ({
            ...cat,
            indicators: cat.indicators.filter(ind =>
                [
                    ind.name,
                    ind.type,
                    INDICATOR_I18N[ind.type]?.en,
                    INDICATOR_I18N[ind.type]?.vi,
                    ...(INDICATOR_I18N[ind.type]?.aliases || []),
                    cat.name,
                    CATEGORY_I18N[cat.id]?.en,
                    CATEGORY_I18N[cat.id]?.vi,
                    ...(CATEGORY_I18N[cat.id]?.aliases || []),
                ]
                    .filter(Boolean)
                    .some((text) => normalizeSearchText(String(text)).includes(q))
            ),
        }))
        .filter(cat => cat.indicators.length > 0);
}
