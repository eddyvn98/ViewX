import mongoose from "mongoose";

const { Schema } = mongoose;

const telegramNluEventSchema = new Schema(
  {
    ownerUserId: { type: String, required: true, index: true },
    chatId: { type: String, required: true, index: true },
    messageText: { type: String, default: "" },
    normalizedText: { type: String, default: "", index: true },
    intentType: { type: String, default: "unknown", index: true },
    intentSource: { type: String, default: "" },
    intentSummary: { type: String, default: "" },
    lang: { type: String, default: "vi", index: true },
    hasPending: { type: Boolean, default: false },
    isUnknown: { type: Boolean, default: false, index: true },
    suggestion: { type: String, default: "" },
    payload: { type: Schema.Types.Mixed, default: {} },
    labelStatus: { type: String, enum: ["unlabeled", "labeled", "ignored"], default: "unlabeled", index: true },
    labelIntentType: { type: String, default: "" },
    labelPayload: { type: Schema.Types.Mixed, default: {} },
    labelNote: { type: String, default: "" },
    labeledBy: { type: String, default: "" },
    labeledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

telegramNluEventSchema.index({ createdAt: -1 });
telegramNluEventSchema.index({ ownerUserId: 1, isUnknown: 1, labelStatus: 1, createdAt: -1 });
telegramNluEventSchema.index({ normalizedText: 1, labelStatus: 1, createdAt: -1 });

const telegramNluEventModel =
  mongoose.models.TelegramNluEvent || mongoose.model("TelegramNluEvent", telegramNluEventSchema);

export default telegramNluEventModel;

