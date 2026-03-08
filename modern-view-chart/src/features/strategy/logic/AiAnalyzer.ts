import { SignalStats, AiResponse, Strategy, Condition, ConditionGroup } from '../types';
import { getStrategyLeg } from '../strategy-helpers';

interface CacheEntry {
    response: AiResponse;
    timestamp: number;
}

const cache = new Map<string, CacheEntry>();

export enum AnalysisType {
    PRE_TRADE = 'PRE_TRADE',
    POST_TRADE = 'POST_TRADE'
}

export class AiAnalyzer {
    static async analyzeSignal(
        strategy: Strategy,
        signal: any,
        metrics: any,
        stats: SignalStats,
        type: AnalysisType = AnalysisType.PRE_TRADE
    ): Promise<AiResponse> {
        const strategyId = strategy.id;
        const cacheKey = `${strategyId}-${signal.type}-${metrics.volatility}-${metrics.session}-${type}`;
        const cached = cache.get(cacheKey);

        if (cached && (Date.now() - cached.timestamp < 60000)) {
            console.log('[AiAnalyzer] Returning cached result');
            return cached.response;
        }

        const prompt = this.buildPrompt(strategy, signal, metrics, stats, type);

        try {
            const response = await this.callBridgeAi(prompt);
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

    private static buildPrompt(strategy: Strategy, signal: any, metrics: any, stats: SignalStats, type: AnalysisType) {
        const direction = (signal.type === 'BUY' || signal.type === 'SELL' ? signal.type : signal.direction || 'BUY') as 'BUY' | 'SELL';
        const leg = getStrategyLeg(strategy, direction);
        const rules = this.stringifyRules(leg.entry);

        if (type === AnalysisType.POST_TRADE) {
            const pnl = signal.pnl || 0;
            const status = signal.status || 'closed';

            return `
      You are a trading performance auditor. Return JSON only.
      
      [STRATEGY RULES]
      Strategy: ${strategy.name} (${direction})
      Entry Rules: ${rules}

      [TRADE DETAILS]
      Symbol: ${signal.symbol}
      Status: ${status}
      PnL: ${pnl.toFixed(2)}
      Entry Time: ${new Date(signal.timestamp).toISOString()}
      MAE (Max Adverse Excursion): ${signal.metadata?.mae?.toFixed(1) || 0} pips
      MFE (Max Favorable Excursion): ${signal.metadata?.mfe?.toFixed(1) || 0} pips

      [MARKET CONTEXT AT ENTRY]
      RSI: ${metrics.rsi || 'N/A'}
      Volatility: ${metrics.volatility > 50 ? 'High' : 'Low'}
      Session: ${metrics.session || 'Unknown'}

      Return JSON only:
      {
        "confidence": number (matching score 0-100),
        "riskLevel": "high" | "medium" | "low",
        "reasoning": ["insight 1", "insight 2"],
        "suggestedFix": { "field": "rsi_threshold", "value": 35, "reason": "Avoids early entry in low volatility" } // optional
      }
    `;
        }

        // PRE_TRADE (Default)
        return `
      You are a trading strategy evaluator. Return JSON only.
      
      [STRATEGY RULES]
      Strategy Name: ${strategy.name}
      Side: ${direction}
      Entry Conditions: ${rules}

      [MARKET CONTEXT AT SIGNAL]
      Symbol: ${signal.symbol}
      Time: ${new Date(signal.timestamp).toISOString()}
      RSI: ${metrics.rsi || 'N/A'} (oversold/overbought context)
      Trend: ${metrics.trendStrength > 20 ? 'Strong' : 'Weak'}
      Volatility: ${metrics.volatility > 50 ? 'High' : 'Low'} (vs historical average)
      Session: ${metrics.session || 'Unknown'}

      [HISTORICAL PERFORMANCE STATS]
      Overall Winrate: ${(stats.overallWinrate * 100).toFixed(1)}%
      Side-specific Winrate (${direction}): ${((direction === 'BUY' ? stats.buyWinrate : stats.sellWinrate) * 100).toFixed(1)}%
      Recent Performance (Last 10): ${stats.recentPerformance.wins}W - ${stats.recentPerformance.losses}L (${(stats.recentWinrate * 100).toFixed(1)}%)
      
      Regime-specific Winrate:
      - Trend Market: ${(stats.trendWinrate * 100).toFixed(1)}%
      - Range Market: ${(stats.rangeWinrate * 100).toFixed(1)}%
      
      Volatility-specific Winrate: ${((stats.winrateByVolatility[metrics.volatility] || 0) * 100).toFixed(1)}%
      
      Risk/Reward Reality (Averages):
      - Average MAE (Max Adverse Excursion): ${stats.avgMae.toFixed(1)} pips
      - Average MFE (Max Favorable Excursion): ${stats.avgMfe.toFixed(1)} pips
      
      Sample Size: ${stats.sampleSize} trades (${stats.sampleSize > 100 ? 'High' : stats.sampleSize > 30 ? 'Medium' : 'Low'} reliability)

      [ACCOUNT-WIDE PERFORMANCE]
      Global Winrate: 27.3% (9W - 24L)

      Based on this deep quantitative data, evaluate if the current signal is a high-probability trade. 
      Do not be emotional. Use the stats to justify your confidence.
      Return JSON only:
      {
        "confidence": number (0-100),
        "riskLevel": "high" | "medium" | "low",
        "reasoning": ["point 1 with data", "point 2 with data"],
        "suggestedFix": { "field": "string", "value": any, "reason": "string" } // optional
      }
    `;
    }

    private static stringifyRules(group: ConditionGroup): string {
        if (!group || !group.conditions) return "None";
        return group.conditions.map(c => {
            if ('operator' in c) {
                return `(${this.stringifyRules(c)})`;
            }
            const left = `${c.left.type}${JSON.stringify(c.left.params)}${c.left.field ? '.' + c.left.field : ''}`;
            const right = typeof c.right === 'number' ? c.right : `${c.right.type}${JSON.stringify(c.right.params)}${c.right.field ? '.' + c.right.field : ''}`;
            return `${left} ${c.comparator} ${right}`;
        }).join(` ${group.operator} `);
    }

    private static async callBridgeAi(prompt: string): Promise<AiResponse> {
        try {
            const res = await fetch('/api/ai/bridge/task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, timeout: 120000 })
            });

            if (!res.ok) throw new Error(`Bridge error: ${res.statusText}`);
            const data = await res.json();

            if (data.status === 'ok' && data.response) {
                return this.parseAiResponse(data.response);
            }
            throw new Error(data.msg || "Unknown bridge error");
        } catch (error) {
            console.error('[AiAnalyzer] Bridge call failed:', error);
            throw error;
        }
    }

    private static parseAiResponse(text: string): AiResponse {
        try {
            const startIdx = text.indexOf('{');
            const endIdx = text.lastIndexOf('}');

            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                const cleanJson = text.substring(startIdx, endIdx + 1);
                return JSON.parse(cleanJson);
            }

            const fallback = text.replace(/```json|```/g, '').trim();
            return JSON.parse(fallback);
        } catch (e) {
            console.error('[AiAnalyzer] Failed to parse AI response:', e);
            return {
                confidence: 50,
                riskLevel: 'medium',
                reasoning: ['Could not parse AI response, using fallback evaluation']
            };
        }
    }
}
