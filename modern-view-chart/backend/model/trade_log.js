import mongoose from "mongoose";

const { Schema } = mongoose;

const schema = new Schema(
    {
        strategy_id: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        symbol: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        type: {
            type: String,
            enum: ["BUY", "SELL"],
            required: true,
        },
        entry_price: {
            type: Number,
            required: true,
        },
        exit_price: {
            type: Number,
            default: null,
        },
        lot_size: {
            type: Number,
            required: true,
        },
        pnl: {
            type: Number,
            default: null,
        },
        mae: {
            type: Number,
            default: null,
        },
        mfe: {
            type: Number,
            default: null,
        },
        volatility: {
            type: String,
            default: "low",
            trim: true,
        },
        session: {
            type: String,
            default: "Unknown",
            trim: true,
        },
        indicators: {
            type: Schema.Types.Mixed,
            default: {},
        },
        entry_source: {
            type: String,
            enum: ["bot", "manual"],
            default: "bot",
            trim: true,
        },
        trigger_reason: {
            type: String,
            default: null,
            trim: true,
        },
        ai_verdict: {
            type: String,
            enum: ["PASS", "WATCH", "BLOCK"],
            default: null,
            trim: true,
        },
        exit_reason: {
            type: String,
            default: null,
            trim: true,
        },
        timestamp: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

schema.index({ strategy_id: 1, symbol: 1, timestamp: -1 });

const model = mongoose.models.TradeLog || mongoose.model("TradeLog", schema);

export const tradeLogModel = model;
export default model;
