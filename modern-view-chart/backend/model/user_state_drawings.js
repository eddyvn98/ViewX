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
    chartDrawings: {
      type: Schema.Types.Mixed,
      default: {},
    },
    clientUpdatedAt: {
      type: Date,
      default: null,
    },
    lastSourceClientId: {
      type: String,
      default: "",
      trim: true,
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

schema.index({ scopeType: 1, scopeId: 1 }, { unique: true });

const model = mongoose.model("UserStateDrawings", schema);
export const userStateDrawingsModel = model;

export default model;
