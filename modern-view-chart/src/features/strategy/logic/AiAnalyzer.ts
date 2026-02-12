import { SignalStats, AiResponse } from '../types';

interface CacheEntry {
    response: AiResponse;
    timestamp: number;
}

const cache = new Map<string, CacheEntry>();

export class AiAnalyzer {
    static async analyzeSignal(
        strategyId: string,
        signal: any,
        metrics: any,
        stats: SignalStats
    ): Promise<AiResponse> {
        const cacheKey = `${strategyId}-${signal.type}-${metrics.volatility}-${metrics.session}`;
        const cached = cache.get(cacheKey);

        if (cached && (Date.now() - cached.timestamp < 60000)) {
            console.log('[AiAnalyzer] Returning cached result');
            return cached.response;
        }

        const prompt = this.buildPrompt(signal, metrics, stats);

        try {
            // In a real implementation, this would call your backend endpoint or OpenAI directly
            // For this demo, we'll simulate the API call logic
            const response = await this.mockApiCall(prompt);

            cache.set(cacheKey, {
                response,
                timestamp: Date.now()
            });

            return response;
        } catch (error) {
            console.error('[AiAnalyzer] AI Analysis failed:', error);
            return {
                confidence: 0,
                riskLevel: 'medium',
                reasoning: ['AI analysis temporarily unavailable']
            };
        }
    }

    private static buildPrompt(signal: any, metrics: any, stats: SignalStats) {
        return `
      You are a trading strategy evaluator. Return JSON only.
      Signal: ${signal.type}
      RSI: ${metrics.rsi || 'N/A'}
      Trend: ${metrics.trendStrength > 20 ? 'Strong' : 'Weak'}
      Volatility: ${metrics.volatility > 50 ? 'High' : 'Low'}
      Session: ${metrics.session || 'Unknown'}

      Historical Context:
      Overall Winrate: ${(stats.overallWinrate * 100).toFixed(1)}%
      Current Context Winrate: ${(stats.winrateByVolatility[metrics.volatility] || 0) * 100}%
      Sample Size: ${stats.sampleSize} trades

      Based on this, return:
      {
        "confidence": number (0-100),
        "riskLevel": "high" | "medium" | "low",
        "reasoning": ["point 1", "point 2"]
      }
    `;
    }

    private static async mockApiCall(prompt: string): Promise<AiResponse> {
        // This is where you'd call fetch('api.openai.com...')
        // We simulate a smart response for demonstration
        await new Promise(r => setTimeout(r, 1000));

        const isGood = prompt.includes('Winrate: 60') || prompt.includes('Trend: Strong');

        return {
            confidence: isGood ? 75 : 45,
            riskLevel: isGood ? 'low' : 'high',
            reasoning: isGood
                ? ["Historical performance is strong in this session", "Trend confirms the signal direction"]
                : ["High volatility creates noise in this setup", "Overall winrate is below threshold"]
        };
    }
}
