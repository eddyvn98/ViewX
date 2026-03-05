import mongoose from "mongoose";
const { Schema } = mongoose;

const telegramPreferencesSchema = new Schema(
  {
    signals: { type: Boolean, default: true },
    orderEvents: { type: Boolean, default: true },
    alertHits: { type: Boolean, default: true },
    system: { type: Boolean, default: false },
  },
  { _id: false },
);

const telegramSchema = new Schema(
  {
    chatId: { type: String, default: "" },
    telegramUserId: { type: String, default: "" },
    username: { type: String, default: "" },
    firstName: { type: String, default: "" },
    linkedAt: { type: Date, default: null },
    isActive: { type: Boolean, default: false },
    pendingLinkTokenHash: { type: String, default: "" },
    pendingLinkExpiresAt: { type: Date, default: null },
    preferences: { type: telegramPreferencesSchema, default: () => ({}) },
  },
  { _id: false },
);

const schema = new Schema(
  {
    username: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required() {
        return this.authProvider !== "google";
      },
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      required: true,
      default: "local",
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    displayName: {
      type: String,
      default: "",
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      required: true,
      enum: ["viewer", "trader", "admin", "user", "owner"],
      default: "viewer",
    },
    sessionVersion: {
      type: Number,
      required: true,
      default: 1,
    },
    telegram: {
      type: telegramSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

const model = mongoose.model("User", schema);
export const userModel = model;

//@Function
const create = (data) => {
  return new Promise((resolve, reject) => {
    try {
      const newDocument = new model({
        username: data.username,
        password: data.encryptedPassword,
        authProvider: "local",
        role: data.role || "viewer",
        sessionVersion: 1,
      });
      newDocument
        .save()
        .then((createdDocument) => {
          resolve(createdDocument);
        })
        .catch((error) => {
          reject(error);
        });
    } catch (error) {
      reject(error);
    }
  });
};

const findOne = (filter) => {
  return new Promise((resolve, reject) => {
    try {
      model
        .findOne({ ...filter })
        .then((document) => {
          resolve(document);
        })
        .catch((error) => {
          reject(error);
        });
    } catch (error) {
      reject(error);
    }
  });
};

const find = (filter) => {
  return new Promise((resolve, reject) => {
    try {
      model
        .find({ ...filter })
        .then((documents) => {
          resolve(documents);
        })
        .catch((error) => {
          reject(error);
        });
    } catch (error) {
      reject(error);
    }
  });
};

const deleteOne = (filter) => {
  return new Promise((resolve, reject) => {
    try {
      model
        .deleteOne(filter)
        .then((result) => {
          if (!result.deletedCount) {
            resolve(false);
          } else {
            resolve(true);
          }
        })
        .catch((error) => {
          reject(error);
        });
    } catch (error) {
      reject(error);
    }
  });
};

const Users = {
  create,
  findOne,
  find,
  deleteOne,
};
export default Users;
