import type { RootState } from '@/lib/store';

export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Object.prototype.toString.call(value) === '[object Object]';
}

export function sanitizeViewport(
    viewport: RootState['tabs'][string]['charts'][string]['viewport'],
): RootState['tabs'][string]['charts'][string]['viewport'] | undefined {
    if (!isPlainObject(viewport)) return undefined;

    const toSafeRange = (input: unknown) => {
        if (!isPlainObject(input)) return undefined;
        const from = Number(input.from);
        const to = Number(input.to);
        if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return undefined;
        return { from, to };
    };

    const nextViewport: NonNullable<RootState['tabs'][string]['charts'][string]['viewport']> = {};
    const contextKey = typeof viewport.contextKey === 'string' ? viewport.contextKey.trim() : '';
    if (contextKey) nextViewport.contextKey = contextKey;

    const logicalRange = toSafeRange(viewport.logicalRange);
    const mainPriceRange = toSafeRange(viewport.mainPriceRange);
    const subPriceRange = toSafeRange(viewport.subPriceRange);
    const savedAt = Number(viewport.savedAt);

    if (logicalRange) nextViewport.logicalRange = logicalRange;
    if (mainPriceRange) nextViewport.mainPriceRange = mainPriceRange;
    if (subPriceRange) nextViewport.subPriceRange = subPriceRange;
    if (Number.isFinite(savedAt) && savedAt > 0) nextViewport.savedAt = savedAt;

    return Object.keys(nextViewport).length > 0 ? nextViewport : undefined;
}

export function sanitizeTabsForPersistence(tabs: RootState['tabs']): RootState['tabs'] {
    const sanitizedTabs: RootState['tabs'] = {};

    for (const [tabId, tab] of Object.entries(tabs || {})) {
        const sanitizedCharts = Object.fromEntries(
            Object.entries(tab.charts || {}).map(([chartId, chart]) => [
                chartId,
                {
                    ...chart,
                    viewport: sanitizeViewport(chart.viewport),
                },
            ]),
        );

        sanitizedTabs[tabId] = {
            ...tab,
            charts: sanitizedCharts,
        };
    }

    return sanitizedTabs;
}

export function buildChartContextKey(input: { symbol?: unknown; interval?: unknown; source?: unknown }): string {
    const symbol = typeof input.symbol === 'string' ? input.symbol.trim() : '';
    const interval = typeof input.interval === 'string' ? input.interval.trim() : '';
    const source = input.source === 'BINANCE' || input.source === 'MT5' || input.source === 'VN_GOLD' ? input.source : '';
    return `${symbol}|${interval}|${source}`;
}

export function mapLocalChartIdsByContext(tabs: RootState['tabs']): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const tab of Object.values(tabs || {})) {
        for (const chart of Object.values(tab.charts || {})) {
            const key = buildChartContextKey(chart);
            if (!key || key === '||') continue;
            const current = map.get(key) || [];
            if (!current.includes(chart.id)) current.push(chart.id);
            map.set(key, current);
        }
    }
    return map;
}

export function resolveRemoteChartContextById(
    tabsInput: unknown,
): Map<string, { symbol?: string; interval?: string; source?: 'BINANCE' | 'MT5' | 'VN_GOLD' }> {
    const map = new Map<string, { symbol?: string; interval?: string; source?: 'BINANCE' | 'MT5' | 'VN_GOLD' }>();
    if (!isPlainObject(tabsInput)) return map;

    for (const rawTab of Object.values(tabsInput)) {
        if (!isPlainObject(rawTab)) continue;
        const charts = isPlainObject(rawTab.charts) ? rawTab.charts : {};
        for (const [remoteChartId, rawChart] of Object.entries(charts)) {
            if (!isPlainObject(rawChart)) continue;
            const symbol = typeof rawChart.symbol === 'string' ? rawChart.symbol : undefined;
            const interval = typeof rawChart.interval === 'string' ? rawChart.interval : undefined;
            const source = rawChart.source === 'BINANCE' || rawChart.source === 'MT5' || rawChart.source === 'VN_GOLD' ? rawChart.source : undefined;
            map.set(remoteChartId, { symbol, interval, source });
        }
    }
    return map;
}

export function remapRemoteDrawingsToLocalCharts(
    remoteDrawingsInput: unknown,
    persistedTabsInput: unknown,
    localTabs: RootState['tabs'],
): RootState['chartDrawings'] | null {
    if (!isPlainObject(remoteDrawingsInput)) return null;

    const remoteDrawings = remoteDrawingsInput as Record<string, unknown>;
    const localIdsByContext = mapLocalChartIdsByContext(localTabs);
    const remoteContextByChartId = resolveRemoteChartContextById(persistedTabsInput);
    const next: RootState['chartDrawings'] = {};

    for (const [remoteChartId, rawItems] of Object.entries(remoteDrawings)) {
        if (!Array.isArray(rawItems)) continue;
        const remoteChartContext = remoteContextByChartId.get(remoteChartId);
        const targetChartIds = new Set<string>();

        if (localTabs[remoteChartId]) targetChartIds.add(remoteChartId);
        if (remoteChartContext) {
            const contextKey = buildChartContextKey(remoteChartContext);
            for (const localChartId of localIdsByContext.get(contextKey) || []) {
                targetChartIds.add(localChartId);
            }
        }

        if (targetChartIds.size === 0) continue;

        for (const localChartId of targetChartIds) {
            next[localChartId] = rawItems as RootState['chartDrawings'][string];
        }
    }

    if (Object.keys(next).length === 0) {
        for (const rawItems of Object.values(remoteDrawings)) {
            if (!Array.isArray(rawItems)) continue;
            for (const rawDrawing of rawItems) {
                if (!isPlainObject(rawDrawing)) continue;
                const contextKey = buildChartContextKey({
                    symbol: rawDrawing.symbol,
                    interval: rawDrawing.interval,
                    source: rawDrawing.source,
                });
                if (!contextKey || contextKey === '||') continue;
                const localIds = localIdsByContext.get(contextKey) || [];
                if (localIds.length === 0) continue;

                for (const localChartId of localIds) {
                    const current = next[localChartId] || [];
                    const drawingId = typeof rawDrawing.id === 'string' ? rawDrawing.id : '';
                    if (drawingId && current.some((item) => item.id === drawingId)) continue;
                    next[localChartId] = [...current, rawDrawing as unknown as RootState['chartDrawings'][string][number]];
                }
            }
        }
    }

    return next;
}

export function remapRemoteIndicatorsToLocalCharts(
    remoteIndicatorsInput: unknown,
    persistedTabsInput: unknown,
    localTabs: RootState['tabs'],
): RootState['chartIndicators'] | null {
    if (!isPlainObject(remoteIndicatorsInput)) return null;

    const remoteIndicators = remoteIndicatorsInput as Record<string, unknown>;
    const localIdsByContext = mapLocalChartIdsByContext(localTabs);
    const remoteContextByChartId = resolveRemoteChartContextById(persistedTabsInput);
    const next: RootState['chartIndicators'] = {};

    for (const [remoteChartId, rawItems] of Object.entries(remoteIndicators)) {
        if (!Array.isArray(rawItems)) continue;
        const remoteChartContext = remoteContextByChartId.get(remoteChartId);
        const targetChartIds = new Set<string>();

        if (localTabs[remoteChartId]) targetChartIds.add(remoteChartId);
        if (remoteChartContext) {
            const contextKey = buildChartContextKey(remoteChartContext);
            for (const localChartId of localIdsByContext.get(contextKey) || []) {
                targetChartIds.add(localChartId);
            }
        }

        if (targetChartIds.size === 0) continue;

        for (const localChartId of targetChartIds) {
            next[localChartId] = rawItems as RootState['chartIndicators'][string];
        }
    }

    return next;
}

export function createFallbackTabs(): RootState['tabs'] {
    return {
        'default-tab': {
            id: 'default-tab',
            name: 'Workspace 1',
            charts: {
                default: {
                    id: 'default',
                    symbol: 'XAUUSDm',
                    interval: '1',
                    source: 'MT5',
                    group: 'A',
                    chartType: 'smart_candles',
                    timezone: 'Asia/Ho_Chi_Minh',
                },
            },
            activeChartId: 'default',
            maximizedChartId: null,
            layoutMode: '1x1',
            rows: 1,
            cols: 1,
        },
    };
}

export function sanitizeTabsInput(input: unknown): RootState['tabs'] | null {
    if (!isPlainObject(input)) return null;

    const tabEntries = Object.entries(input).filter(([, tab]) => isPlainObject(tab));
    if (tabEntries.length === 0) return null;

    const safeTabs: RootState['tabs'] = {};

    for (const [tabId, rawTab] of tabEntries) {
        const tab = rawTab as Record<string, unknown>;
        const rawCharts = isPlainObject(tab.charts) ? tab.charts : {};
        const chartEntries = Object.entries(rawCharts).filter(([, chart]) => isPlainObject(chart));
        if (chartEntries.length === 0) continue;

        const safeCharts: RootState['tabs'][string]['charts'] = {};
        for (const [chartId, rawChart] of chartEntries) {
            const chart = rawChart as Record<string, unknown>;
            const symbol = typeof chart.symbol === 'string' && chart.symbol.trim() ? chart.symbol : 'XAUUSDm';
            const interval = typeof chart.interval === 'string' && chart.interval.trim() ? chart.interval : '1';
            const source = chart.source === 'BINANCE' || chart.source === 'MT5' || chart.source === 'VN_GOLD' ? chart.source : 'MT5';
            const chartType =
                chart.chartType === 'candles' || chart.chartType === 'heikin_ashi' || chart.chartType === 'smart_candles'
                    ? chart.chartType
                    : 'smart_candles';
            const subchartHeightPctRaw = Number(chart.subchartHeightPct);
            const subchartHeightPct = Number.isFinite(subchartHeightPctRaw)
                ? Math.max(3, Math.min(85, Math.round(subchartHeightPctRaw)))
                : undefined;
            safeCharts[chartId] = {
                ...chart,
                id: typeof chart.id === 'string' && chart.id.trim() ? chart.id : chartId,
                symbol,
                interval,
                source,
                chartType,
                timezone: typeof chart.timezone === 'string' ? chart.timezone : 'Asia/Ho_Chi_Minh',
                subchartHeightPct,
            };
        }

        const safeChartIds = Object.keys(safeCharts);
        if (safeChartIds.length === 0) continue;

        const rawActiveChartId = typeof tab.activeChartId === 'string' ? tab.activeChartId : '';
        const activeChartId = safeCharts[rawActiveChartId] ? rawActiveChartId : safeChartIds[0];
        const rawRows = Number(tab.rows);
        const rawCols = Number(tab.cols);
        const rows = Number.isFinite(rawRows) && rawRows > 0 ? Math.floor(rawRows) : 1;
        const cols = Number.isFinite(rawCols) && rawCols > 0 ? Math.floor(rawCols) : 1;

        safeTabs[tabId] = {
            id: typeof tab.id === 'string' && tab.id.trim() ? tab.id : tabId,
            name:
                typeof tab.name === 'string' && tab.name.trim()
                    ? tab.name
                    : `Workspace ${Object.keys(safeTabs).length + 1}`,
            charts: safeCharts,
            activeChartId,
            maximizedChartId:
                typeof tab.maximizedChartId === 'string' && safeCharts[tab.maximizedChartId]
                    ? tab.maximizedChartId
                    : null,
            layoutMode:
                typeof tab.layoutMode === 'string' && tab.layoutMode.trim()
                    ? tab.layoutMode
                    : `${rows}x${cols}`,
            rows,
            cols,
        } as RootState['tabs'][string];
    }

    return Object.keys(safeTabs).length > 0 ? safeTabs : null;
}
