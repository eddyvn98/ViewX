"use client";

import React from "react";
import { createChart, IChartApi, ISeriesApi, LineData, LineSeries, UTCTimestamp } from "lightweight-charts";

type GoldSymbol = {
  symbol: string;
  name: string;
};

type GoldQuote = {
  symbol: string;
  name: string;
  buy: number;
  sell: number;
  currency: string;
  capturedAt: string | number | Date;
};

type ApiCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type PriceType = "buy" | "sell";
type Timeframe = "60" | "240" | "D";

const TIMEFRAMES: Array<{ key: Timeframe; label: string }> = [
  { key: "60", label: "1h" },
  { key: "240", label: "4h" },
  { key: "D", label: "1D" },
];

const formatVnd = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0));

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`request_failed_${response.status}`);
  return response.json() as Promise<T>;
}

export function GoldChartClient() {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const seriesRef = React.useRef<ISeriesApi<"Line"> | null>(null);

  const [symbols, setSymbols] = React.useState<GoldSymbol[]>([]);
  const [quotes, setQuotes] = React.useState<GoldQuote[]>([]);
  const [symbol, setSymbol] = React.useState<string>("");
  const [timeframe, setTimeframe] = React.useState<Timeframe>("60");
  const [priceType, setPriceType] = React.useState<PriceType>("buy");
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string>("");

  const activeQuote = React.useMemo(
    () => quotes.find((item) => item.symbol === symbol) || null,
    [quotes, symbol],
  );

  React.useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#050914" },
        textColor: "#d4e6ff",
      },
      grid: {
        vertLines: { color: "rgba(35, 56, 87, 0.35)" },
        horzLines: { color: "rgba(35, 56, 87, 0.35)" },
      },
      rightPriceScale: {
        borderColor: "rgba(104, 129, 164, 0.4)",
      },
      timeScale: {
        borderColor: "rgba(104, 129, 164, 0.4)",
        timeVisible: true,
      },
      crosshair: {
        vertLine: { color: "rgba(120, 190, 255, 0.5)" },
        horzLine: { color: "rgba(120, 190, 255, 0.5)" },
      },
      autoSize: true,
    });
    const series = chart.addSeries(LineSeries, {
      color: "#35e2c2",
      lineWidth: 2,
      crosshairMarkerVisible: true,
      lastValueVisible: true,
      priceLineVisible: true,
    });
    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  const loadSymbolsAndQuotes = React.useCallback(async () => {
    const [symbolsRes, quotesRes] = await Promise.all([
      fetchJson<{ symbols: GoldSymbol[] }>("/api/user/vangtoday/symbols"),
      fetchJson<{ quotes: GoldQuote[] }>("/api/user/vangtoday/prices"),
    ]);
    const nextSymbols = symbolsRes.symbols || [];
    const nextQuotes = quotesRes.quotes || [];
    setSymbols(nextSymbols);
    setQuotes(nextQuotes);
    setSymbol((prev) => prev || nextSymbols[0]?.symbol || "");
  }, []);

  const loadCandles = React.useCallback(async () => {
    if (!symbol) return;
    const payload = await fetchJson<{ candles: ApiCandle[] }>(
      `/api/user/vangtoday/candles?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(timeframe)}&priceType=${encodeURIComponent(priceType)}&count=500`,
    );
    const items = (payload.candles || []).map((candle) => ({
      time: Number(candle.time) as UTCTimestamp,
      value: Number(candle.close),
    })) as LineData[];

    seriesRef.current?.setData(items);
    chartRef.current?.timeScale().fitContent();
  }, [symbol, timeframe, priceType]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    (async () => {
      try {
        await loadSymbolsAndQuotes();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không tải được dữ liệu giá vàng");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadSymbolsAndQuotes]);

  React.useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setError("");

    (async () => {
      try {
        await loadCandles();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không tải được dữ liệu nến");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, priceType, loadCandles]);

  React.useEffect(() => {
    const priceTimer = window.setInterval(() => {
      loadSymbolsAndQuotes().catch(() => {});
    }, 15_000);
    return () => window.clearInterval(priceTimer);
  }, [loadSymbolsAndQuotes]);

  React.useEffect(() => {
    if (!symbol) return;
    const candleTimer = window.setInterval(() => {
      loadCandles().catch(() => {});
    }, 30_000);
    return () => window.clearInterval(candleTimer);
  }, [symbol, timeframe, priceType, loadCandles]);

  return (
    <main className="min-h-screen bg-[#040813] px-3 py-4 md:px-6">
      <section className="mx-auto max-w-[1500px] rounded-2xl border border-[#1a3557] bg-[#071225] p-4 shadow-[0_20px_90px_rgba(10,40,90,0.35)] md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-white md:text-2xl">Biểu đồ vàng Việt Nam (vang.today)</h1>
            <p className="text-xs text-[#9db3d1] md:text-sm">
              Trang chart riêng cho vàng VND. Chuyển nhanh giữa nến giá mua và nến giá bán.
            </p>
          </div>
          <div className="rounded-lg border border-[#24486e] bg-[#0a1a33] px-3 py-2 text-right">
            <div className="text-xs text-[#8ea9cc]">Giá hiện tại</div>
            <div className="text-sm font-bold text-[#e8f2ff]">
              Mua {formatVnd(Number(activeQuote?.buy || 0))} / Bán {formatVnd(Number(activeQuote?.sell || 0))}
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-[#2a4f78] bg-[#0a1d38] px-3 py-2 text-sm text-[#d7e9ff] outline-none"
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
          >
            {symbols.map((item) => (
              <option key={item.symbol} value={item.symbol}>
                {item.symbol} - {item.name}
              </option>
            ))}
          </select>

          {TIMEFRAMES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTimeframe(item.key)}
              className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                timeframe === item.key
                  ? "border-[#2effba] bg-[#103d33] text-[#61ffd0]"
                  : "border-[#315b89] bg-[#0c213f] text-[#b7cae4]"
              }`}
            >
              {item.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setPriceType("buy")}
            className={`rounded-md border px-3 py-2 text-sm font-semibold ${
              priceType === "buy"
                ? "border-[#4ce5ff] bg-[#11304f] text-[#8df0ff]"
                : "border-[#315b89] bg-[#0c213f] text-[#b7cae4]"
            }`}
          >
            Nến giá mua
          </button>
          <button
            type="button"
            onClick={() => setPriceType("sell")}
            className={`rounded-md border px-3 py-2 text-sm font-semibold ${
              priceType === "sell"
                ? "border-[#ffd15d] bg-[#4a3a11] text-[#ffe08c]"
                : "border-[#315b89] bg-[#0c213f] text-[#b7cae4]"
            }`}
          >
            Nến giá bán
          </button>
        </div>

        <div className="h-[68vh] min-h-[460px] w-full overflow-hidden rounded-xl border border-[#17395d] bg-[#030a19]">
          <div ref={containerRef} className="h-full w-full" />
        </div>

        <div className="mt-3 text-xs text-[#86a3c5]">
          {loading ? "Đang tải dữ liệu..." : `Đã sẵn sàng • ${symbol || "Chưa có symbol"} • ${priceType === "buy" ? "Giá mua" : "Giá bán"}`}
          {error ? ` • Lỗi: ${error}` : ""}
        </div>
      </section>
    </main>
  );
}
