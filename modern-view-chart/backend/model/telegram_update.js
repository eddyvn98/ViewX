import mongoose from "mongoose";

const { Schema } = mongoose;

const telegramUpdateSchema = new Schema(
  {
    updateId: { type: Number, required: true, index: true, unique: true },
    status: { type: String, enum: ["queued", "processing", "done", "failed"], default: "queued", index: true },
    attempts: { type: Number, default: 0 },
    leaseUntil: { type: Date, default: null, index: true },
    nextRetryAt: { type: Date, default: null, index: true },
    lastError: { type: String, default: "" },
    payload: { type: Schema.Types.Mixed, required: true },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

telegramUpdateSchema.index({ status: 1, nextRetryAt: 1, leaseUntil: 1, createdAt: 1 });

const telegramUpdateModel = mongoose.models.TelegramUpdate || mongoose.model("TelegramUpdate", telegramUpdateSchema);

export default telegramUpdateModel;
