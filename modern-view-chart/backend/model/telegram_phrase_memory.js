import mongoose from "mongoose";

const { Schema } = mongoose;

const telegramPhraseMemorySchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    patternKey: { type: String, required: true, index: true },
    rawText: { type: String, default: "" },
    intentType: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    confidence: { type: Number, default: 0.5 },
    hitCount: { type: Number, default: 1 },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

telegramPhraseMemorySchema.index({ userId: 1, patternKey: 1 }, { unique: true });
telegramPhraseMemorySchema.index(
  { lastUsedAt: 1 },
  { expireAfterSeconds: Math.max(7 * 24 * 60 * 60, Number.parseInt(process.env.TELEGRAM_PHRASE_TTL_SEC || `${90 * 24 * 60 * 60}`, 10) || 90 * 24 * 60 * 60) },
);

const telegramPhraseMemoryModel =
  mongoose.models.TelegramPhraseMemory || mongoose.model("TelegramPhraseMemory", telegramPhraseMemorySchema);

export default telegramPhraseMemoryModel;
