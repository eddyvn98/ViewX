import mongoose from "mongoose";

const { Schema } = mongoose;

const schema = new Schema(
    {
        symbol: { type: String, required: true, index: true },
        source: { type: String, default: "VN_GOLD", index: true },
        provider: { type: String, required: true, index: true },
        price: { type: Number, required: true },
        bid: { type: Number, default: 0 },
        ask: { type: Number, default: 0 },
        capturedAt: { type: Date, required: true, index: true },
        sourceUrl: { type: String, default: "" },
    },
    { timestamps: true },
);

schema.index({ symbol: 1, capturedAt: 1 }, { unique: true });

export const goldPriceSnapshotModel = mongoose.models.GoldPriceSnapshot
    || mongoose.model("GoldPriceSnapshot", schema);

