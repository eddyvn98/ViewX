import mongoose from "mongoose";

const { Schema } = mongoose;

const schema = new Schema(
    {
        symbol: { type: String, required: true, index: true },
        source: { type: String, default: "VN_GOLD", index: true },
        provider: { type: String, required: true, index: true },
        timeframe: { type: String, required: true, index: true },
        bucketStart: { type: Date, required: true, index: true },
        open: { type: Number, required: true },
        high: { type: Number, required: true },
        low: { type: Number, required: true },
        close: { type: Number, required: true },
        volume: { type: Number, default: 0 },
        points: { type: Number, default: 0 },
        meta: { type: Schema.Types.Mixed, default: null },
    },
    { timestamps: true },
);

schema.index({ symbol: 1, timeframe: 1, bucketStart: 1 }, { unique: true });

export const goldOhlcModel = mongoose.models.GoldOhlc
    || mongoose.model("GoldOhlc", schema);

