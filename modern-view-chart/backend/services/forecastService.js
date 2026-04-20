import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FORECAST_SCRIPT = path.resolve(__dirname, "../forecast/forecast_service.py");
const DEFAULT_TIMEOUT_MS = 120_000;

function stripAnsi(text) {
    return String(text || "").replace(/\x1B\[[0-9;]*[A-Za-z]/g, "");
}

function parseForecastPayload(stdout) {
    const cleaned = stripAnsi(stdout).trim();
    if (!cleaned) return {};
    try {
        return JSON.parse(cleaned);
    } catch {}

    // TimesFM can print informational/progress lines to stdout.
    // Parse the last JSON object line if extra logs are mixed in.
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

function resolvePythonBin() {
    return (
        process.env.FORECAST_PYTHON_BIN ||
        process.env.PYTHON_BIN ||
        "python"
    ).trim();
}

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

function buildHumanSummary(chart, result, lang = "vi") {
    const symbol = String(chart?.symbol || "").trim() || (lang === "vi" ? "chart này" : "this chart");
    const timeframe = String(chart?.timeframe || chart?.interval || "").trim() || (lang === "vi" ? "khung hiện tại" : "current timeframe");
    const horizon = Number(result?.horizon || 0);
    const currentPrice = Number(result?.current_price || 0);
    const targetPrice = Number(result?.target_price || 0);
    const deltaPct = Number(result?.delta_pct || 0);
    const bandLow = Number(result?.band_low || 0);
    const bandHigh = Number(result?.band_high || 0);
    const confidence = Number(result?.confidence || 0);
    const direction = String(result?.direction || "sideways");

    const isVi = lang === "vi";

    const directionText = isVi 
        ? (direction === "bullish" ? "**nghiêng về Tăng (Bullish)**" : direction === "bearish" ? "**nghiêng về Giảm (Bearish)**" : "**đang đi ngang (Sideways)**")
        : (direction === "bullish" ? "**Bullish bias**" : direction === "bearish" ? "**Bearish bias**" : "**Sideways**");

    const moveText = isVi
        ? (deltaPct > 0 ? `tăng khoảng **${deltaPct.toFixed(2)}%**` : deltaPct < 0 ? `giảm khoảng **${Math.abs(deltaPct).toFixed(2)}%**` : "biến động không đáng kể")
        : (deltaPct > 0 ? `rise about **${deltaPct.toFixed(2)}%**` : deltaPct < 0 ? `fall about **${Math.abs(deltaPct).toFixed(2)}%**` : "no significant move");

    const confidenceText = isVi
        ? (confidence >= 75 ? "độ tin cậy **Khá cao**" : confidence >= 55 ? "độ tin cậy **Trung bình**" : "độ tin cậy **Thấp**")
        : (confidence >= 75 ? "**High confidence**" : confidence >= 55 ? "**Medium confidence**" : "**Low confidence**");

    const labels = isVi 
        ? {
            title: `### 📊 Dự báo ${symbol} (${timeframe})`,
            scenario: `**Kịch bản chính**: Dự kiến ${moveText} từ mức giá hiện tại **${currentPrice.toFixed(3)}** về vùng mục tiêu **${targetPrice.toFixed(3)}**.`,
            range: `**Vùng biến động**: \`${bandLow.toFixed(3)}\` - \`${bandHigh.toFixed(3)}\`.`,
            note: `*Lưu ý: Đây là dự báo tham khảo dựa trên dữ liệu kỹ thuật, không phải lời khuyên đầu tư.*`
        }
        : {
            title: `### 📊 Forecast ${symbol} (${timeframe})`,
            scenario: `**Main Scenario**: Expected to ${moveText} from current price **${currentPrice.toFixed(3)}** towards target **${targetPrice.toFixed(3)}**.`,
            range: `**Target Range**: \`${bandLow.toFixed(3)}\` - \`${bandHigh.toFixed(3)}\`.`,
            note: `*Note: This is a technical forecast for reference only, not financial advice.*`
        };

    return [
        labels.title,
        `Xu hướng chủ đạo trong ${horizon} nến tới là ${directionText} với ${confidenceText}.`,
        labels.scenario,
        labels.range,
        labels.note
    ].join("\n\n");
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
                ok: false,
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
                ok: false,
                code: "forecast_spawn_failed",
                message: error?.message || "Khong the khoi dong forecast service.",
            });
        });
        child.on("close", (code) => {
            if (code !== 0) {
                finish({
                    ok: false,
                    code: "forecast_process_failed",
                    message: stderr.trim() || `Forecast process exited with code ${code}.`,
                });
                return;
            }
            try {
                const parsed = parseForecastPayload(stdout);
                if (parsed?.status !== "ok" || !parsed?.result) {
                    finish({
                        ok: false,
                        code: parsed?.code || "forecast_invalid_response",
                        message: parsed?.message || "Forecast service tra ve du lieu khong hop le.",
                    });
                    return;
                }
                finish({
                    ok: true,
                    forecast: parsed.result,
                    response: buildHumanSummary(payload.chart, parsed.result, lang),
                    engine: String(parsed.result?.engine || "unknown"),
                });
            } catch (error) {
                finish({
                    ok: false,
                    code: "forecast_parse_failed",
                    message: error?.message || "Khong doc duoc ket qua forecast.",
                });
            }
        });

        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
    });
}
