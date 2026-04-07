import mongoose from "mongoose";

const { Schema } = mongoose;

const moduleOrderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    module: { type: String, required: true, index: true },
    modules: { type: [String], default: [] },
    orderCode: { type: String, required: true, unique: true, index: true },
    amount: { type: Number, required: true, default: 0 },
    currency: { type: String, default: "VND" },
    status: { type: String, default: "pending", index: true },
    transferContent: { type: String, default: "" },
    paymentMethod: { type: String, default: "bank_transfer_qr" },
    confirmedBy: { type: String, default: "" },
    confirmedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    durationDays: { type: Number, default: 30 },
    qrUrl: { type: String, default: "" },
    bankCode: { type: String, default: "" },
    bankAccountNo: { type: String, default: "" },
    bankAccountName: { type: String, default: "" },
    rawWebhookPayload: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

export const moduleOrderModel = mongoose.model("ModuleOrder", moduleOrderSchema);
