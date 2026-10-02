import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatForecastTimeframe } from "./forecast-timeframe.js";
import { evaluateMarketProbability } from "./jevService.js";
import {
    executeForecastOnWorker,
    resolvePythonBin,
    startForecastWorker,
} from "./forecastWorkerClient.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FORECAST_SCRIPT = path.resolve(__dirname, "../forecast/forecast_service.py");
const DEFAULT_TIMEOUT_MS = 120_000;

// Pre-warm the Python TimesFM worker in the background
startForecastWorker();

function sanitizeFiniteNumber(value, digits = 8) {
    const num = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(num)) return null;
    return Number(num.toFixed(digits));
}

function sanitizeCandles(candles) {
    return (Array.isArray(candles) ? candles : [])
        .map((item) => {
            const time = sanitizeFiniteNumber(item?.time, 0);
            const open = sanitizeFiniteNumber(item?.open);
            const high = sanitizeFiniteNumber(item?.high);
            const low = sanitizeFiniteNumber(item?.low);
            const close = sanitizeFiniteNumber(item?.close);
            const volume = sanitizeFiniteNumber(item?.volume ?? 0);
            if (
                time === null ||
                open === null ||
                high === null ||
                low === null ||
                close === null
            ) {
                return null;
            }
            return { time, open, high, low, close, volume: volume ?? 0 };
        })
        .filter(Boolean);
}

function buildHumanSummary(chart, result, probabilities = null, lang = "vi", question = "") {
    const symbol = String(chart?.symbol || "").trim() || (lang === "vi" ? "chart này" : "this chart");
    const rawTimeframe = String(chart?.timeframe || chart?.interval || "").trim();
    const timeframe = formatForecastTimeframe(rawTimeframe) || (lang === "vi" ? "khung hiện tại" : "current timeframe");
    const horizon = Number(result?.horizon || 0);
    const currentPrice = Number(result?.current_price || 0);
    const targetPrice = Number(result?.target_price || 0);
    const deltaPct = Number(result?.delta_pct || 0);
    const bandLow = Number(result?.band_low || 0);
    const bandHigh = Number(result?.band_high || 0);
    const practicalBandLow = Number(result?.practical_band_low ?? bandLow);
    const practicalBandHigh = Number(result?.practical_band_high ?? bandHigh);
    const confidence = Number(result?.directional_clarity ?? result?.confidence ?? 0);
    const direction = String(result?.direction || "sideways");
    const atr14 = Number(result?.atr14 || 0);
    const moveAtr = Number(result?.move_atr || 0);
    const intervalSpanAtr = Number(result?.interval_span_atr || 0);
    const edge = String(result?.edge || "unknown");

    const isVi = lang === "vi";

    const directionText = isVi 
        ? (direction === "bullish" ? "**nghiêng về Tăng (Bullish)**" : direction === "bearish" ? "**nghiêng về Giảm (Bearish)**" : "**đang đi ngang (Sideways)**")
        : (direction === "bullish" ? "**Bullish bias**" : direction === "bearish" ? "**Bearish bias**" : "**Sideways**");

    const moveText = isVi
        ? (deltaPct > 0 ? `tăng khoảng **${deltaPct.toFixed(2)}%**` : deltaPct < 0 ? `giảm khoảng **${Math.abs(deltaPct).toFixed(2)}%**` : "biến động không đáng kể")
        : (deltaPct > 0 ? `rise about **${deltaPct.toFixed(2)}%**` : deltaPct < 0 ? `fall about **${Math.abs(deltaPct).toFixed(2)}%**` : "no significant move");

    const confidenceText = isVi
        ? (confidence >= 75 ? "độ rõ hướng **Khá cao**" : confidence >= 55 ? "độ rõ hướng **Trung bình**" : "độ rõ hướng **Thấp**")
        : (confidence >= 75 ? "**High directional clarity**" : confidence >= 55 ? "**Medium directional clarity**" : "**Low directional clarity**");

    const edgeText = isVi
        ? ({ noise: "Nhiễu / không đáng kể", weak: "Yếu", moderate: "Trung bình", strong: "Mạnh" }[edge] || "Chưa xác định")
        : ({ noise: "Noise / negligible", weak: "Weak", moderate: "Moderate", strong: "Strong" }[edge] || "Unknown");

    const isTimesfm = String(result?.engine || "").toLowerCase() === "timesfm";
    const engineTag = isTimesfm ? "TimesFM AI" : (isVi ? "Dự báo heuristic" : "Heuristic fallback");

    const lines = [
        `### 📊 ${isVi ? `Dự báo ${symbol} (${timeframe})` : `Forecast ${symbol} (${timeframe})`}`,
        isVi
            ? `Xu hướng chủ đạo trong ${horizon} nến tới là ${directionText} với ${confidenceText}.`
            : `Dominant trend for the next ${horizon} candles is ${directionText} with ${confidenceText}.`,
        isVi
            ? `**Kịch bản giá (${engineTag})**: Dự kiến ${moveText} từ **${currentPrice.toFixed(3)}** về **${targetPrice.toFixed(3)}**. Vùng thực dụng theo ATR: \`${practicalBandLow.toFixed(3)}\` - \`${practicalBandHigh.toFixed(3)}\`.`
            : `**Price Scenario (${engineTag})**: Expected to ${moveText} from **${currentPrice.toFixed(3)}** toward **${targetPrice.toFixed(3)}**. ATR-aware practical range: \`${practicalBandLow.toFixed(3)}\` - \`${practicalBandHigh.toFixed(3)}\`.`
    ];

    if (isTimesfm) {
        lines.push(
            isVi
                ? `- **Edge TimesFM**: **${edgeText}** | Dịch chuyển: **${moveAtr.toFixed(2)} ATR** | Biên p10-p90 cuối kỳ: **${intervalSpanAtr.toFixed(2)} ATR** | ATR14: **${atr14.toFixed(3)}**`
                : `- **TimesFM edge**: **${edgeText}** | Move: **${moveAtr.toFixed(2)} ATR** | Terminal p10-p90 span: **${intervalSpanAtr.toFixed(2)} ATR** | ATR14: **${atr14.toFixed(3)}**`
        );
    }

    const q = String(question || "").toLowerCase();
    const asksRange = /(vung gia|vùng giá|range|bien do|biên độ|volatility)/i.test(q);
    if (asksRange) {
        lines.splice(2, 0, isVi
            ? `- **Vùng giá thực dụng (ATR-aware)**: \`${practicalBandLow.toFixed(3)}\` - \`${practicalBandHigh.toFixed(3)}\` (Model p10-p90: \`${bandLow.toFixed(3)}\` - \`${bandHigh.toFixed(3)}\`)`
            : `- **ATR-aware practical range**: \`${practicalBandLow.toFixed(3)}\` - \`${practicalBandHigh.toFixed(3)}\` (Model p10-p90: \`${bandLow.toFixed(3)}\` - \`${bandHigh.toFixed(3)}\`)`
        );
    }

    if (probabilities) {
        const trend = probabilities.trendProbabilities || {};
        const pBull = Math.round((trend.bullish || 0) * 100);
        const pSide = Math.round((trend.sideways || 0) * 100);
        const pBear = Math.round((trend.bearish || 0) * 100);

        const action = probabilities.action || "WAIT";
        const actionProbs = probabilities.actionProbabilities || {};
        const actionPct = Math.round((actionProbs[action] ?? probabilities.actionConfidence ?? 0.7) * 100);
        const shouldEnterPct = Math.round((probabilities.shouldEnterScore || 0) * 100);
        const riskLevel = probabilities.riskLevel || "Moderate";
        const riskScore = probabilities.riskScore !== undefined ? probabilities.riskScore : 0.5;

        const actionBadge = action === "BUY"
            ? (isVi ? "🟢 **MUA (BUY)**" : "🟢 **BUY**")
            : action === "SELL"
            ? (isVi ? "🔴 **BÁN (SELL)**" : "🔴 **SELL**")
            : (isVi ? "🟡 **CHỜ ĐỢI (WAIT)**" : "🟡 **WAIT**");

        const enterVerdict = shouldEnterPct >= 70
            ? (isVi ? "Đạt điều kiện vào lệnh khả thi" : "Favorable Entry Condition")
            : shouldEnterPct >= 45
            ? (isVi ? "Cần theo dõi thêm tín hiệu xác nhận" : "Borderline / Watch closely")
            : (isVi ? "Chưa nên vào lệnh lúc này (Tỷ lệ rủi ro cao)" : "Not recommended to enter now");

        lines.push(
            `---`,
            `### 🎯 ${isVi ? "Thẩm định Xác suất & Vào lệnh (Jev AI %)" : "Probabilistic Entry Assessment (Jev AI %)"}`,
            isVi
                ? `- **Đề xuất hành động**: ${actionBadge} (Xác suất: **${actionPct}%**)`
                : `- **Action Recommendation**: ${actionBadge} (Probability: **${actionPct}%**)`,
            isVi
                ? `- **Xác suất xu hướng**: 🟢 Tăng: **${pBull}%** | 🟡 Đi ngang: **${pSide}%** | 🔴 Giảm: **${pBear}%**`
                : `- **Trend Probabilities**: 🟢 Bullish: **${pBull}%** | 🟡 Sideways: **${pSide}%** | 🔴 Bearish: **${pBear}%**`,
            isVi
                ? `- **Xác suất nên vào lệnh ngay**: **${shouldEnterPct}%** (${enterVerdict})`
                : `- **Should-Enter Probability**: **${shouldEnterPct}%** (${enterVerdict})`,
            isVi
                ? `- **Đánh giá rủi ro**: **${riskLevel}** (Chỉ số: \`${riskScore}/1.0\`)`
                : `- **Risk Assessment**: **${riskLevel}** (Score: \`${riskScore}/1.0\`)`
        );
    }

    lines.push(
        isVi
            ? `*Lưu ý: TimesFM chỉ là tín hiệu dự báo phụ; Jev thẩm định từ cấu trúc kỹ thuật. Các xác suất không phải tỷ lệ thắng được bảo đảm.*`
            : `*Note: TimesFM is advisory only; Jev assesses the technical structure. These probabilities are not guaranteed win rates.*`
    );

    return lines.join("\n\n");
}

function stripAnsi(text) {
    return String(text || "").replace(/\x1B\[[0-9;]*[A-Za-z]/g, "");
}

function parseForecastPayload(stdout) {
    const cleaned = stripAnsi(stdout).trim();
    if (!cleaned) return {};
    try {
        return JSON.parse(cleaned);
    } catch {}

    const lines = cleaned.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (let idx = lines.length - 1; idx >= 0; idx -= 1) {
        const line = lines[idx];
        if (!line.startsWith("{") || !line.endsWith("}")) continue;
        try {
            return JSON.parse(line);
        } catch {}
    }
    throw new Error("Forecast response did not contain valid JSON.");
}

async function executeForecastOneShot(payload, timeoutMs) {
    const pythonBin = resolvePythonBin();
    return new Promise((resolve) => {
        const child = spawn(pythonBin, [FORECAST_SCRIPT], {
            stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";
        let settled = false;

        const finish = (result) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(result);
        };

        const timer = setTimeout(() => {
            try {
                child.kill();
            } catch {}
            finish({
                status: "error",
                code: "forecast_timeout",
                message: "Forecast service bi timeout.",
            });
        }, timeoutMs);

        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        child.on("error", (error) => {
            finish({
                status: "error",
                code: "forecast_spawn_failed",
                message: error?.message || "Khong the khoi dong forecast service.",
            });
        });
        child.on("close", (code) => {
            if (code !== 0) {
                finish({
                    status: "error",
                    code: "forecast_process_failed",
                    message: stderr.trim() || `Forecast process exited with code ${code}.`,
                });
                return;
            }
            try {
                const parsed = parseForecastPayload(stdout);
                finish(parsed);
            } catch (error) {
                finish({
                    status: "error",
                    code: "forecast_parse_failed",
                    message: error?.message || "Khong doc duoc ket qua forecast.",
                });
            }
        });

        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
    });
}

async function runForecastModel(payload, timeoutMs) {
    let parsed = await executeForecastOnWorker(payload, Math.min(timeoutMs, 10_000));
    if (!parsed?.result || parsed?.status !== "ok") {
        parsed = await executeForecastOneShot(payload, timeoutMs);
    }
    return parsed;
}

export async function generateForecast({
    chart,
    candles,
    horizon,
    question,
    lang = "vi",
    timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
    const symbol = String(chart?.symbol || "").trim();
    const timeframe = String(chart?.timeframe || chart?.interval || "").trim();
    if (!symbol || !timeframe) {
        return {
            ok: false,
            code: "forecast_chart_context_missing",
            message: "Khong xac dinh duoc chart dang duoc chon de du bao.",
        };
    }

    const sanitizedCandles = sanitizeCandles(candles);
    if (sanitizedCandles.length < 20) {
        return {
            ok: false,
            code: "insufficient_candles",
            message: "Can it nhat 20 nen hop le de du bao.",
        };
    }

    const payload = {
        chart: {
            chartId: String(chart?.chartId || chart?.id || "").trim() || null,
            symbol,
            timeframe,
            source: String(chart?.source || "").trim() || "MT5",
        },
        question: String(question || "").trim(),
        horizon: Number.isFinite(Number(horizon)) ? Number(horizon) : undefined,
        candles: sanitizedCandles,
    };

    // Execute TimesFM model and Jev AI evaluator concurrently for independent analysis & minimal latency
    const [parsed, probabilities] = await Promise.all([
        runForecastModel(payload, timeoutMs),
        evaluateMarketProbability({
            symbol: payload.chart.symbol,
            timeframe: payload.chart.timeframe,
            candles: sanitizedCandles,
        }).catch((probErr) => {
            console.warn("[Forecast] Probability evaluation failed:", probErr?.message || probErr);
            return null;
        }),
    ]);

    if (!parsed || parsed.status !== "ok" || !parsed.result) {
        return {
            ok: false,
            code: parsed?.code || "forecast_service_failed",
            message: parsed?.message || "Forecast service tra ve du lieu khong hop le.",
        };
    }

    return {
        ok: true,
        forecast: {
            ...parsed.result,
            probabilities,
        },
        response: buildHumanSummary(payload.chart, parsed.result, probabilities, lang, question),
        engine: String(parsed.result?.engine || "unknown"),
        probabilities,
    };
}
