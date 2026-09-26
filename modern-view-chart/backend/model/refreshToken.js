import mongoose from "mongoose";

const { Schema } = mongoose;

const schema = new Schema(
    {
        jti: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        revokedAt: {
            type: Date,
            default: null,
        },
        gracePeriodUntil: {
            type: Date,
            default: null,
        },
        replacedByJti: {
            type: String,
            default: "",
            trim: true,
        },
    },
    { timestamps: true },
);

// TTL index: MongoDB automatically removes documents when current time reaches expiresAt
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ userId: 1, revokedAt: 1 });

const model = mongoose.models.RefreshToken || mongoose.model("RefreshToken", schema);
export const refreshTokenModel = model;

export default model;
