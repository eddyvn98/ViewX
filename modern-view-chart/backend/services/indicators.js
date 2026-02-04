import { BollingerBands, RSI } from "technicalindicators";

export function calcBollingerBands(candles, period = 20, stdDev = 2) {
  const closes = candles.map((c) => c.close);

  const result = BollingerBands.calculate({
    period,
    stdDev,
    values: closes,
  });

  return result.map((b, i) => ({
    time: candles[i + period - 1].time,
    lower: b.lower,
    middle: b.middle,
    upper: b.upper,
  }));
}

export function calcRSI(candles, period = 14) {
  const closes = candles.map((c) => c.close);
  const values = RSI.calculate({ values: closes, period });

  return values
    .map((value, i) => ({
      time: candles[i + period]?.time,
      value,
    }))
    .filter((d) => d.time);
}
