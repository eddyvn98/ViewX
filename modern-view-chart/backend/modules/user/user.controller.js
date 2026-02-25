import Users, { userModel } from "../../model/user.js";
import userStateModel from "../../model/user_state.js";
import CryptoJS from "crypto-js";
import jwt from "jsonwebtoken";
import { normalizeUserRole } from "../../auth/roles.js";

function sanitizeClientId(input) {
  const raw = String(input || "").trim();
  if (!raw) return "public";
  const safe = raw.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 128);
  return safe || "public";
}

function resolveStateScope(req) {
  if (req.auth?.type === "user" && req.auth?.userId) {
    return { scopeType: "user", scopeId: String(req.auth.userId) };
  }

  const headerClientId = req.headers["x-client-id"];
  const queryClientId = req.query?.client_id;
  const clientId = sanitizeClientId(
    typeof headerClientId === "string"
      ? headerClientId
      : typeof queryClientId === "string"
        ? queryClientId
        : "",
  );

  return { scopeType: "service", scopeId: clientId };
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function parseMaxStateBytes() {
  const configured = Number.parseInt(process.env.USER_STATE_MAX_BYTES || "262144", 10);
  return Number.isFinite(configured) && configured > 1024 ? configured : 262144;
}

/**
 * Lấy ra danh sách user
 * @param {*} req
 * @param {*} res
 * @returns
 */
export const getListUsers = async (req, res) => {
  try {
    const userList = await Users.find({});
    res.status(200).json({ success: true, data: userList });
  } catch (error) {
    return res.status(500).json({ error: "Đã xảy ra lỗi" });
  }
};

/**
 * Tạo user mới (Register)
 * @param {*} req
 * @param {*} res
 * @returns
 */
export const createUser = async (req, res) => {
  const username = req.body.email;
  const password = req.body.password;
  try {
    const existingAccount = await Users.findOne({
      username: username,
    });

    if (existingAccount) {
      return res.status(400).json({ error: "Tài khoản đã tồn tại" });
    }

    const encryptedPassword = CryptoJS.AES.encrypt(
      password,
      process.env.KEY_CRYPTO
    ).toString();

    const newUser = await Users.create({
      username,
      encryptedPassword,
    });

    return res.status(201).json({ message: "Tài khoản đã được tạo" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Đã xảy ra lỗi" });
  }
};

/**
 * Xóa user
 * @param {*} req
 * @param {*} res
 * @returns
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.body;
    const deleteUser = Users.deleteOne({
      _id: id,
    });
    if (deleteUser) {
      res
        .status(200)
        .json({ success: true, message: "User updated successful" });
    } else {
      res.status(200).json({ success: false, message: "User updated failed" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Đã xảy ra lỗi" });
  }
};

/**
 * Login user
 * @param {*} req
 * @param {*} res
 */
export const login = async (req, res) => {
  const username = req.body.email;
  const inputPassword = req.body.password;
  try {
    const user = await Users.findOne({
      username,
    });

    if (user) {
      const HashPassword = CryptoJS.AES.decrypt(
        user.password,
        process.env.KEY_CRYPTO
      );
      const password = HashPassword.toString(CryptoJS.enc.Utf8);
      if (inputPassword === password) {
        const role = normalizeUserRole(user.role);
        const sessionVersion = Number.isFinite(Number(user.sessionVersion)) ? Number(user.sessionVersion) : 1;
        const token = jwt.sign(
          { _id: user._id, role, sv: sessionVersion },
          process.env.JWT
        );
        res.cookie("token", token, { httpOnly: true });
        res.json({
          message: "Login successfully !!!",
          token: token,
          user: {
            _id: user._id,
            username: user.username,
            role,
          },
        });
      } else {
        res.status(404).json({ error: "Tài khoản không tồn tại" });
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Đã xảy ra lỗi" });
  }
};

/**
 * Đổi password
 * @param {*} req
 * @param {*} res
 * @returns
 */
export const updatePassword = async (req, res) => {
  try {
    const userId = req.params.id;
    const { newPassword } = req.body;

    const user = await Users.findOne({
      _id: userId,
    });
    const encryptedPassword = CryptoJS.AES.encrypt(
      newPassword,
      process.env.KEY_CRYPTO
    ).toString();
    user.password = encryptedPassword;

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updatedUser = await user.save();

    res
      .status(200)
      .json({ message: "Change password successfully", user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getUserSetupState = async (req, res) => {
  try {
    const scope = resolveStateScope(req);
    const doc = await userStateModel
      .findOne({ scopeType: scope.scopeType, scopeId: scope.scopeId })
      .select("state schemaVersion updatedAt")
      .lean();

    if (!doc) {
      return res.status(200).json({
        scope_type: scope.scopeType,
        scope_id: scope.scopeId,
        schema_version: 1,
        updated_at: null,
        state: {},
      });
    }

    return res.status(200).json({
      scope_type: scope.scopeType,
      scope_id: scope.scopeId,
      schema_version: doc.schemaVersion || 1,
      updated_at: doc.updatedAt || null,
      state: isPlainObject(doc.state) ? doc.state : {},
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const upsertUserSetupState = async (req, res) => {
  try {
    const scope = resolveStateScope(req);
    const state = req.body?.state;
    if (!isPlainObject(state)) {
      return res.status(400).json({ error: "state must be an object" });
    }

    const serialized = JSON.stringify(state);
    const maxBytes = parseMaxStateBytes();
    if (Buffer.byteLength(serialized, "utf8") > maxBytes) {
      return res.status(413).json({ error: "state payload too large" });
    }

    const schemaVersionRaw = Number.parseInt(String(req.body?.schema_version || "1"), 10);
    const schemaVersion = Number.isFinite(schemaVersionRaw) && schemaVersionRaw > 0 ? schemaVersionRaw : 1;

    const doc = await userStateModel.findOneAndUpdate(
      { scopeType: scope.scopeType, scopeId: scope.scopeId },
      {
        $set: {
          state,
          schemaVersion,
          lastSyncedAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    return res.status(200).json({
      message: "state_saved",
      scope_type: scope.scopeType,
      scope_id: scope.scopeId,
      schema_version: doc.schemaVersion || schemaVersion,
      updated_at: doc.updatedAt || new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
