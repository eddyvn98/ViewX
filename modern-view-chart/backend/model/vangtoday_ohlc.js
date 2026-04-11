import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        symbol: { type: String, required: true, index: true },
        source: { type: String, default: "VANG_TODAY", index: true },
        currency: { type: String, default: "VND", index: true },
        priceType: { type: String, enum: ["buy", "sell"], required: true, index: true },
        timeframe: { type: String, required: true, index: true }, // 60 | 240 | D
        bucketStart: { type: Date, required: true, index: true },
        open: { type: Number, required: true },
        high: { type: Number, required: true },
        low: { type: Number, required: true },
        close: { type: Number, required: true },
        volume: { type: Number, default: 0 },
        points: { type: Number, default: 1 },
    },
    {
        collection: "vangtoday_ohlcs",
        timestamps: false,
    },
);

schema.index({ symbol: 1, priceType: 1, timeframe: 1, bucketStart: 1 }, { unique: true });

export const vangTodayOhlcModel = mongoose.models.VangTodayOhlc
    || mongoose.model("VangTodayOhlc", schema);

