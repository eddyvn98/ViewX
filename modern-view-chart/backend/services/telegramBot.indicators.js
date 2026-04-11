import {
  ADX,
  ATR,
  BollingerBands,
  CCI,
  EMA,
  IchimokuCloud,
  KST,
  KeltnerChannels,
  MACD,
  MFI,
  OBV,
  PSAR,
  ROC,
  RSI,
  SMA,
  Stochastic,
  StochasticRSI,
  TRIX,
  VWAP,
  WEMA,
  WMA,
  WilliamsR,
} from "technicalindicators";

const INDICATOR_ALIAS_MAP = {
  GIA: "PRICE",
  PRICE: "PRICE",
  EMA: "EMA",
  HMA: "HMA",
  SMA: "SMA",
  WMA: "WMA",
  WEMA: "WEMA",
  RSI: "RSI",
  ATR: "ATR",
  ADX: "ADX",
  CCI: "CCI",
  ROC: "ROC",
  TRIX: "TRIX",
  MFI: "MFI",
  OBV: "OBV",
  VWAP: "VWAP",
  MACD: "MACD",
  KST: "KST",
  STOCHASTIC: "STOCHASTIC",
  STOCHASTICRSI: "STOCHASTICRSI",
  WILLIAMSR: "WILLIAMSR",
  BOLLINGER: "BOLLINGERBANDS",
  BOLLINGERBANDS: "BOLLINGERBANDS",
  BB: "BOLLINGERBANDS",
  KELTNER: "KELTNERCHANNELS",
  KELTNERCHANNELS: "KELTNERCHANNELS",
  ICHIMOKU: "ICHIMOKUCLOUD",
  ICHIMOKUCLOUD: "ICHIMOKUCLOUD",
  PSAR: "PSAR",
  SAR: "PSAR",
};

export function stripDiacritics(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function normalizeIndicatorType(input) {
  const raw = String(input || "")
    .trim()
    .toUpperCase()
    .replaceAll("-", "")
    .replaceAll(" ", "")
    .replaceAll("(", "")
    .replaceAll(")", "");
  if (!raw) return "";
  return INDICATOR_ALIAS_MAP[raw] || raw;
}

export function getIndicatorPeriodOptions(type) {
  const normalized = normalizeIndicatorType(type);
  if (!normalized || normalized === "PRICE" || normalized === "VWAP" || normalized === "OBV" || normalized === "PSAR") {
    return [];
  }
  if (normalized === "RSI") return [7, 14, 21];
  return [7, 9, 14, 20, 26, 50, 55, 100, 200];
}

export function indicatorNeedsPeriod(type) {
  const normalized = normalizeIndicatorType(type);
  if (!normalized) return false;
  return !["PRICE", "VWAP", "OBV", "PSAR"].includes(normalized);
}

export function formatOperatorLabel(value) {
  switch (value) {
    case "crosses_above":
      return "Cắt lên";
    case "crosses_below":
      return "Cắt xuống";
    case ">":
      return "Lớn hơn";
    case "<":
      return "Nhỏ hơn";
    default:
      return value;
  }
}

export function normalizeMaType(type) {
  return String(type || "").trim().toUpperCase() === "HMA" ? "HMA" : "EMA";
}

function calculateHullMA(values, period) {
  const safePeriod = Math.max(2, Number(period || 20));
  const halfPeriod = Math.max(1, Math.floor(safePeriod / 2));
  const sqrtPeriod = Math.max(1, Math.round(Math.sqrt(safePeriod)));
  const wmaHalf = WMA.calculate({ period: halfPeriod, values });
  const wmaFull = WMA.calculate({ period: safePeriod, values });
  const paddedHalf = Array(values.length - wmaHalf.length).fill(null).concat(wmaHalf);
  const paddedFull = Array(values.length - wmaFull.length).fill(null).concat(wmaFull);
  const raw = values
    .map((_, index) => {
      if (paddedHalf[index] == null || paddedFull[index] == null) return null;
      return 2 * Number(paddedHalf[index]) - Number(paddedFull[index]);
    })
    .filter((item) => item != null);
  const hull = WMA.calculate({ period: sqrtPeriod, values: raw });
  return Array(values.length - hull.length).fill(null).concat(hull);
}

function calculateMovingAverage(type, values, period) {
  const maType = normalizeMaType(type);
  const safePeriod = Math.max(2, Number(period || 0));
  if (maType === "HMA") return calculateHullMA(values, safePeriod);
  const emaValues = EMA.calculate({ period: safePeriod, values });
  return Array(values.length - emaValues.length).fill(null).concat(emaValues);
}

function padSeries(totalLength, values, mapper = (item) => Number(item)) {
  const list = Array.isArray(values) ? values.map(mapper) : [];
  return Array(totalLength - list.length).fill(null).concat(list);
}

export function calculateIndicatorSeries(type, values, period) {
  const indicatorType = normalizeIndicatorType(type);
  if (indicatorType === "PRICE") return values.map((value) => Number(value));
  if (indicatorType === "RSI") {
    const safePeriod = Math.max(2, Number(period || 14));
    const rsiValues = RSI.calculate({ values, period: safePeriod });
    return padSeries(values.length, rsiValues);
  }
  if (indicatorType === "SMA") {
    const safePeriod = Math.max(2, Number(period || 20));
    const smaValues = SMA.calculate({ values, period: safePeriod });
    return padSeries(values.length, smaValues);
  }
  if (indicatorType === "WMA") {
    const safePeriod = Math.max(2, Number(period || 20));
    const out = WMA.calculate({ values, period: safePeriod });
    return padSeries(values.length, out);
  }
  if (indicatorType === "WEMA") {
    const safePeriod = Math.max(2, Number(period || 20));
    const out = WEMA.calculate({ values, period: safePeriod });
    return padSeries(values.length, out);
  }
  if (indicatorType === "EMA" || indicatorType === "HMA") {
    return calculateMovingAverage(indicatorType, values, period);
  }
  if (indicatorType === "ATR") {
    const safePeriod = Math.max(2, Number(period || 14));
    const out = ATR.calculate({ high: values, low: values, close: values, period: safePeriod });
    return padSeries(values.length, out);
  }
  if (indicatorType === "ADX") {
    const safePeriod = Math.max(2, Number(period || 14));
    const out = ADX.calculate({ high: values, low: values, close: values, period: safePeriod });
    return padSeries(values.length, out, (item) => Number(item?.adx));
  }
  if (indicatorType === "CCI") {
    const safePeriod = Math.max(2, Number(period || 20));
    const out = CCI.calculate({ high: values, low: values, close: values, period: safePeriod });
    return padSeries(values.length, out);
  }
  if (indicatorType === "ROC") {
    const safePeriod = Math.max(2, Number(period || 12));
    const out = ROC.calculate({ values, period: safePeriod });
    return padSeries(values.length, out);
  }
  if (indicatorType === "TRIX") {
    const safePeriod = Math.max(2, Number(period || 18));
    const out = TRIX.calculate({ values, period: safePeriod });
    return padSeries(values.length, out);
  }
  if (indicatorType === "MFI") {
    const safePeriod = Math.max(2, Number(period || 14));
    const out = MFI.calculate({ high: values, low: values, close: values, volume: values.map(() => 1), period: safePeriod });
    return padSeries(values.length, out);
  }
  if (indicatorType === "OBV") {
    const out = OBV.calculate({ close: values, volume: values.map(() => 1) });
    return padSeries(values.length, out);
  }
  if (indicatorType === "VWAP") {
    const out = VWAP.calculate({ high: values, low: values, close: values, volume: values.map(() => 1) });
    return padSeries(values.length, out);
  }
  if (indicatorType === "MACD") {
    const fastPeriod = Math.max(2, Number(period || 12));
    const out = MACD.calculate({
      values,
      fastPeriod,
      slowPeriod: Math.max(fastPeriod + 1, fastPeriod * 2),
      signalPeriod: Math.max(2, Math.round(fastPeriod / 2)),
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    return padSeries(values.length, out, (item) => Number(item?.MACD ?? item?.macd));
  }
  if (indicatorType === "KST") {
    const out = KST.calculate({
      values,
      ROCPer1: 10,
      ROCPer2: 15,
      ROCPer3: 20,
      ROCPer4: 30,
      SMAROCPer1: 10,
      SMAROCPer2: 10,
      SMAROCPer3: 10,
      SMAROCPer4: 15,
      signalPeriod: 9,
    });
    return padSeries(values.length, out, (item) => Number(item?.kst));
  }
  if (indicatorType === "STOCHASTIC") {
    const safePeriod = Math.max(2, Number(period || 14));
    const out = Stochastic.calculate({
      high: values,
      low: values,
      close: values,
      period: safePeriod,
      signalPeriod: 3,
    });
    return padSeries(values.length, out, (item) => Number(item?.k));
  }
  if (indicatorType === "STOCHASTICRSI") {
    const safePeriod = Math.max(2, Number(period || 14));
    const out = StochasticRSI.calculate({
      values,
      rsiPeriod: safePeriod,
      stochasticPeriod: Math.max(2, Math.round(safePeriod / 2)),
      kPeriod: 3,
      dPeriod: 3,
    });
    return padSeries(values.length, out, (item) => Number(item?.stochRSI ?? item?.k));
  }
  if (indicatorType === "WILLIAMSR") {
    const safePeriod = Math.max(2, Number(period || 14));
    const out = WilliamsR.calculate({ high: values, low: values, close: values, period: safePeriod });
    return padSeries(values.length, out);
  }
  if (indicatorType === "BOLLINGERBANDS") {
    const safePeriod = Math.max(2, Number(period || 20));
    const out = BollingerBands.calculate({ values, period: safePeriod, stdDev: 2 });
    return padSeries(values.length, out, (item) => Number(item?.middle));
  }
  if (indicatorType === "KELTNERCHANNELS") {
    const safePeriod = Math.max(2, Number(period || 20));
    const out = KeltnerChannels.calculate({
      high: values,
      low: values,
      close: values,
      maPeriod: safePeriod,
      atrPeriod: Math.max(2, Math.round(safePeriod / 2)),
      useSMA: false,
      multiplier: 2,
    });
    return padSeries(values.length, out, (item) => Number(item?.middle));
  }
  if (indicatorType === "ICHIMOKUCLOUD") {
    const out = IchimokuCloud.calculate({
      high: values,
      low: values,
      conversionPeriod: 9,
      basePeriod: 26,
      spanPeriod: 52,
      displacement: 26,
    });
    return padSeries(values.length, out, (item) => Number(item?.conversion ?? item?.base));
  }
  if (indicatorType === "PSAR") {
    const out = PSAR.calculate({ high: values, low: values, step: 0.02, max: 0.2 });
    return padSeries(values.length, out);
  }
  return [];
}

export function isIndicatorSupported(type) {
  const normalized = normalizeIndicatorType(type);
  return [
    "PRICE",
    "EMA",
    "HMA",
    "SMA",
    "WMA",
    "WEMA",
    "RSI",
    "ATR",
    "ADX",
    "CCI",
    "ROC",
    "TRIX",
    "MFI",
    "OBV",
    "VWAP",
    "MACD",
    "KST",
    "STOCHASTIC",
    "STOCHASTICRSI",
    "WILLIAMSR",
    "BOLLINGERBANDS",
    "KELTNERCHANNELS",
    "ICHIMOKUCLOUD",
    "PSAR",
  ].includes(normalized);
}
