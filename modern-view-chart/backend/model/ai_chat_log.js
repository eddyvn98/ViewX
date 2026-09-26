import mongoose from "mongoose";

const { Schema } = mongoose;

const schema = new Schema(
    {
        actorKey: { type: String, required: true, index: true, trim: true },
        userId: { type: String, default: null, trim: true, index: true },
        conversationId: { type: String, default: null, trim: true, index: true },
        messageId: { type: String, required: true, trim: true },
        source: { type: String, enum: ["chat", "system"], required: true },
        prompt: { type: String, default: "" },
        response: { type: String, default: "" },
        timestamp: { type: Number, required: true, index: true },
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

schema.index({ actorKey: 1, timestamp: -1 });
schema.index({ actorKey: 1, conversationId: 1, timestamp: -1 });
schema.index({ actorKey: 1, messageId: 1 }, { unique: true });

const model = mongoose.models.AiChatLog || mongoose.model("AiChatLog", schema);

export const aiChatLogModel = model;
export default model;
