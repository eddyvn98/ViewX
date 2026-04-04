export type AiVerdict = 'PASS' | 'WATCH' | 'BLOCK';

export function getAiVerdict(confidence: number | null | undefined): AiVerdict | null {
    if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return null;
    if (confidence >= 70) return 'PASS';
    if (confidence >= 45) return 'WATCH';
    return 'BLOCK';
}
