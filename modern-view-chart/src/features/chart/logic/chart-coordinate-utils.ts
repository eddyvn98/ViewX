export function safeChartCoordinate(readCoordinate: () => number | null | undefined): number | null {
    try {
        const coordinate = readCoordinate();
        return typeof coordinate === 'number' && Number.isFinite(coordinate) ? coordinate : null;
    } catch {
        // Lightweight Charts can transiently reject coordinates while a series is replaced.
        return null;
    }
}
