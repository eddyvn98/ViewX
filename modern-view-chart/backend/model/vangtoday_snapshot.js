import mongoose from "mongoose";

const schema = new mongoose.Schema(
    {
        symbol: { type: String, required: true, index: true },
        name: { type: String, default: "" },
        currency: { type: String, default: "VND", index: true },
        buy: { type: Number, required: true },
        sell: { type: Number, required: true },
        capturedAt: { type: Date, required: true, index: true },
        source: { type: String, default: "VANG_TODAY", index: true },
    },
    {
        collection: "vangtoday_snapshots",
        timestamps: false,
    },
);

schema.index({ symbol: 1, capturedAt: 1 }, { unique: true });

export const vangTodaySnapshotModel = mongoose.models.VangTodaySnapshot
    || mongoose.model("VangTodaySnapshot", schema);

