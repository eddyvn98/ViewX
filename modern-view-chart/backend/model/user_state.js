import mongoose from "mongoose";

const { Schema } = mongoose;

const schema = new Schema(
    {
        scopeType: {
            type: String,
            enum: ["user", "service", "guest"],
            required: true,
        },
        scopeId: {
            type: String,
            required: true,
            trim: true,
        },
        state: {
            type: Schema.Types.Mixed,
            default: {},
        },
        schemaVersion: {
            type: Number,
            default: 1,
        },
        lastSyncedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true },
);

schema.index({ scopeType: 1, scopeId: 1 }, { unique: true });

const model = mongoose.model("UserState", schema);
export const userStateModel = model;

export default model;
