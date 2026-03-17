import Users, { userModel } from "../../model/user.js";
import userStateModel from "../../model/user_state.js";
import CryptoJS from "crypto-js";
import jwt from "jsonwebtoken";
import { normalizeUserRole } from "../../auth/roles.js";
import { getDatabaseHealth } from "../../services/database.js";
import {
  buildTelegramDeepLink,
  buildTelegramStartPayload,
  getTelegramConfig,
  hashTelegramPayload,
  sendTelegramMessage,
} from "../../services/telegram.js";
import tradeLogModel from "../../model/trade_log.js";
import {
  buildEmptyTradeStats,
  computeTradeStats,
  sanitizeTradeLogPayload,
} from "./trade-log.service.js";

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
  if (req.user?.sub || req.user?._id) {
    return { scopeType: "user", scopeId: String(req.user.sub || req.user._id) };
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

function resolvePublicStateScope(req) {
  const headerClientId = req.headers["x-client-id"];
  const queryClientId = req.query?.client_id;
  const clientId = sanitizeClientId(
    typeof headerClientId === "string"
      ? headerClientId
      : typeof queryClientId === "string"
        ? queryClientId
        : "",
  );

  return { scopeType: "guest", scopeId: clientId };
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function parseMaxStateBytes() {
  const configured = Number.parseInt(process.env.USER_STATE_MAX_BYTES || "262144", 10);
  return Number.isFinite(configured) && configured > 1024 ? configured : 262144;
}

function isDatabaseReadyForUserState() {
  const db = getDatabaseHealth();
  return db.state === "connected";
}

function buildEmptySetupStateResponse(scope) {
  return {
    scope_type: scope.scopeType,
    scope_id: scope.scopeId,
    schema_version: 1,
    revision: 0,
    updated_at: null,
    client_updated_at: null,
    state: {},
  };
}

function sanitizeStrategyId(input) {
  return String(input || "").trim().slice(0, 128);
}

function parseBaseRevision(input) {
  const value = Number.parseInt(String(input ?? ""), 10);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
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
  } catch {
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

    await Users.create({
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
      .select("state schemaVersion revision updatedAt clientUpdatedAt lastSourceClientId")
      .lean();

    if (!doc) {
      return res.status(200).json({
        scope_type: scope.scopeType,
      scope_id: scope.scopeId,
      schema_version: 1,
      revision: 0,
      updated_at: null,
      client_updated_at: null,
      state: {},
    });
  }

    return res.status(200).json({
      scope_type: scope.scopeType,
      scope_id: scope.scopeId,
      schema_version: doc.schemaVersion || 1,
      revision: Number.isFinite(Number(doc.revision)) ? Number(doc.revision) : 0,
      updated_at: doc.updatedAt || null,
      client_updated_at: doc.clientUpdatedAt || null,
      state: isPlainObject(doc.state) ? doc.state : {},
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getPublicUserSetupState = async (req, res) => {
  try {
    const scope = resolvePublicStateScope(req);
    if (!isDatabaseReadyForUserState()) {
      return res.status(200).json(buildEmptySetupStateResponse(scope));
    }

    const doc = await userStateModel
      .findOne({ scopeType: scope.scopeType, scopeId: scope.scopeId })
      .select("state schemaVersion revision updatedAt clientUpdatedAt lastSourceClientId")
      .lean();

    if (!doc) {
      return res.status(200).json(buildEmptySetupStateResponse(scope));
    }

    return res.status(200).json({
      scope_type: scope.scopeType,
      scope_id: scope.scopeId,
      schema_version: doc.schemaVersion || 1,
      revision: Number.isFinite(Number(doc.revision)) ? Number(doc.revision) : 0,
      updated_at: doc.updatedAt || null,
      client_updated_at: doc.clientUpdatedAt || null,
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
    const sourceClientId = sanitizeClientId(req.headers["x-client-id"] || req.query?.client_id || req.body?.source_client_id);
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
    const baseRevision = parseBaseRevision(req.body?.base_revision);
    const clientUpdatedAtValue = Date.parse(String(req.body?.client_updated_at || ""));
    const clientUpdatedAt = Number.isFinite(clientUpdatedAtValue) ? new Date(clientUpdatedAtValue) : new Date();

    const existing = await userStateModel
      .findOne({ scopeType: scope.scopeType, scopeId: scope.scopeId })
      .select("state schemaVersion revision updatedAt clientUpdatedAt")
      .lean();

    const existingRevision = Number.isFinite(Number(existing?.revision)) ? Number(existing.revision) : 0;
    const existingClientUpdatedAtValue = Date.parse(String(existing?.clientUpdatedAt || ""));
    if (
      Number.isFinite(baseRevision) &&
      baseRevision !== existingRevision
    ) {
      return res.status(409).json({
        message: "state_conflict_revision_mismatch",
        scope_type: scope.scopeType,
        scope_id: scope.scopeId,
        schema_version: existing?.schemaVersion || 1,
        revision: existingRevision,
        updated_at: existing?.updatedAt || null,
        client_updated_at: existing?.clientUpdatedAt || null,
        state: isPlainObject(existing?.state) ? existing.state : {},
      });
    }

    if (
      !Number.isFinite(baseRevision) &&
      Number.isFinite(existingClientUpdatedAtValue) &&
      existingClientUpdatedAtValue > clientUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        message: "state_ignored_stale_client",
        scope_type: scope.scopeType,
        scope_id: scope.scopeId,
        schema_version: existing?.schemaVersion || 1,
        revision: existingRevision,
        updated_at: existing?.updatedAt || null,
        client_updated_at: existing?.clientUpdatedAt || null,
        state: isPlainObject(existing?.state) ? existing.state : {},
      });
    }

    let doc = null;
    if (!existing) {
      try {
        doc = await userStateModel.create({
          scopeType: scope.scopeType,
          scopeId: scope.scopeId,
          state,
          schemaVersion,
          revision: 1,
          clientUpdatedAt,
          lastSourceClientId: sourceClientId,
          lastSyncedAt: new Date(),
        });
      } catch (error) {
        // Another writer likely created the row first; fallback to conditional update path.
        if (error?.code !== 11000) throw error;
      }
    }

    if (!doc) {
      const updateFilter = { scopeType: scope.scopeType, scopeId: scope.scopeId };
      if (Number.isFinite(baseRevision)) {
        updateFilter.revision = baseRevision;
      } else {
        updateFilter.$or = [
          { clientUpdatedAt: { $exists: false } },
          { clientUpdatedAt: null },
          { clientUpdatedAt: { $lte: clientUpdatedAt } },
        ];
      }

      doc = await userStateModel.findOneAndUpdate(
        updateFilter,
        {
          $set: {
            state,
            schemaVersion,
            clientUpdatedAt,
            lastSourceClientId: sourceClientId,
            lastSyncedAt: new Date(),
          },
          $inc: { revision: 1 },
        },
        {
          new: true,
        },
      );
    }

    if (!doc) {
      const latest = await userStateModel
        .findOne({ scopeType: scope.scopeType, scopeId: scope.scopeId })
        .select("state schemaVersion revision updatedAt clientUpdatedAt")
        .lean();
      return res.status(409).json({
        message: Number.isFinite(baseRevision) ? "state_conflict_revision_mismatch" : "state_ignored_stale_client",
        scope_type: scope.scopeType,
        scope_id: scope.scopeId,
        schema_version: latest?.schemaVersion || 1,
        revision: Number.isFinite(Number(latest?.revision)) ? Number(latest.revision) : 0,
        updated_at: latest?.updatedAt || null,
        client_updated_at: latest?.clientUpdatedAt || null,
        state: isPlainObject(latest?.state) ? latest.state : {},
      });
    }

    return res.status(200).json({
      message: "state_saved",
      scope_type: scope.scopeType,
      scope_id: scope.scopeId,
      schema_version: doc.schemaVersion || schemaVersion,
      revision: Number.isFinite(Number(doc.revision)) ? Number(doc.revision) : 0,
      updated_at: doc.updatedAt || new Date().toISOString(),
      client_updated_at: doc.clientUpdatedAt || clientUpdatedAt.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const upsertPublicUserSetupState = async (req, res) => {
  try {
    const scope = resolvePublicStateScope(req);
    const sourceClientId = sanitizeClientId(req.headers["x-client-id"] || req.query?.client_id || req.body?.source_client_id);
    if (!isDatabaseReadyForUserState()) {
      return res.status(202).json({
        message: "state_skipped_db_unavailable",
        scope_type: scope.scopeType,
        scope_id: scope.scopeId,
        schema_version: 1,
        updated_at: null,
        client_updated_at: null,
      });
    }

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
    const baseRevision = parseBaseRevision(req.body?.base_revision);
    const clientUpdatedAtValue = Date.parse(String(req.body?.client_updated_at || ""));
    const clientUpdatedAt = Number.isFinite(clientUpdatedAtValue) ? new Date(clientUpdatedAtValue) : new Date();

    const existing = await userStateModel
      .findOne({ scopeType: scope.scopeType, scopeId: scope.scopeId })
      .select("state schemaVersion revision updatedAt clientUpdatedAt")
      .lean();

    const existingRevision = Number.isFinite(Number(existing?.revision)) ? Number(existing.revision) : 0;
    const existingClientUpdatedAtValue = Date.parse(String(existing?.clientUpdatedAt || ""));
    if (
      Number.isFinite(baseRevision) &&
      baseRevision !== existingRevision
    ) {
      return res.status(409).json({
        message: "state_conflict_revision_mismatch",
        scope_type: scope.scopeType,
        scope_id: scope.scopeId,
        schema_version: existing?.schemaVersion || 1,
        revision: existingRevision,
        updated_at: existing?.updatedAt || null,
        client_updated_at: existing?.clientUpdatedAt || null,
        state: isPlainObject(existing?.state) ? existing.state : {},
      });
    }

    if (
      !Number.isFinite(baseRevision) &&
      Number.isFinite(existingClientUpdatedAtValue) &&
      existingClientUpdatedAtValue > clientUpdatedAt.getTime()
    ) {
      return res.status(409).json({
        message: "state_ignored_stale_client",
        scope_type: scope.scopeType,
        scope_id: scope.scopeId,
        schema_version: existing?.schemaVersion || 1,
        revision: existingRevision,
        updated_at: existing?.updatedAt || null,
        client_updated_at: existing?.clientUpdatedAt || null,
        state: isPlainObject(existing?.state) ? existing.state : {},
      });
    }

    let doc = null;
    if (!existing) {
      try {
        doc = await userStateModel.create({
          scopeType: scope.scopeType,
          scopeId: scope.scopeId,
          state,
          schemaVersion,
          revision: 1,
          clientUpdatedAt,
          lastSourceClientId: sourceClientId,
          lastSyncedAt: new Date(),
        });
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }
    }

    if (!doc) {
      const updateFilter = { scopeType: scope.scopeType, scopeId: scope.scopeId };
      if (Number.isFinite(baseRevision)) {
        updateFilter.revision = baseRevision;
      } else {
        updateFilter.$or = [
          { clientUpdatedAt: { $exists: false } },
          { clientUpdatedAt: null },
          { clientUpdatedAt: { $lte: clientUpdatedAt } },
        ];
      }

      doc = await userStateModel.findOneAndUpdate(
        updateFilter,
        {
          $set: {
            state,
            schemaVersion,
            clientUpdatedAt,
            lastSourceClientId: sourceClientId,
            lastSyncedAt: new Date(),
          },
          $inc: { revision: 1 },
        },
        {
          new: true,
        },
      );
    }

    if (!doc) {
      const latest = await userStateModel
        .findOne({ scopeType: scope.scopeType, scopeId: scope.scopeId })
        .select("state schemaVersion revision updatedAt clientUpdatedAt")
        .lean();
      return res.status(409).json({
        message: Number.isFinite(baseRevision) ? "state_conflict_revision_mismatch" : "state_ignored_stale_client",
        scope_type: scope.scopeType,
        scope_id: scope.scopeId,
        schema_version: latest?.schemaVersion || 1,
        revision: Number.isFinite(Number(latest?.revision)) ? Number(latest.revision) : 0,
        updated_at: latest?.updatedAt || null,
        client_updated_at: latest?.clientUpdatedAt || null,
        state: isPlainObject(latest?.state) ? latest.state : {},
      });
    }

    return res.status(200).json({
      message: "state_saved",
      scope_type: scope.scopeType,
      scope_id: scope.scopeId,
      schema_version: doc.schemaVersion || schemaVersion,
      revision: Number.isFinite(Number(doc.revision)) ? Number(doc.revision) : 0,
      updated_at: doc.updatedAt || new Date().toISOString(),
      client_updated_at: doc.clientUpdatedAt || clientUpdatedAt.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createPublicTradeLog = async (req, res) => {
  try {
    const payload = sanitizeTradeLogPayload(req.body);
    if (!payload.strategy_id || !payload.symbol || !payload.entry_price || payload.lot_size <= 0) {
      return res.status(400).json({ error: "invalid_trade_log_payload" });
    }

    const created = await tradeLogModel.create(payload);
    return res.status(201).json(created.toObject());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getPublicTradeStats = async (req, res) => {
  try {
    const strategyId = sanitizeStrategyId(req.query?.strategy_id);
    if (!strategyId) return res.status(200).json(buildEmptyTradeStats());

    const stats = await computeTradeStats(strategyId);
    return res.status(200).json(stats);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updatePublicTradeExit = async (req, res) => {
  try {
    const strategyId = sanitizeStrategyId(req.body?.strategy_id);
    const symbol = String(req.body?.symbol || "").trim();
    const exitPrice = Number(req.body?.exit_price);
    if (!strategyId || !symbol || !Number.isFinite(exitPrice)) {
      return res.status(400).json({ error: "invalid_trade_exit_payload" });
    }

    const entry = await tradeLogModel
      .findOne({
        strategy_id: strategyId,
        symbol,
        exit_price: null,
      })
      .sort({ timestamp: -1 });

    if (!entry) {
      return res.status(404).json({ error: "trade_log_not_found" });
    }

    const side = entry.type === "BUY" ? 1 : -1;
    const pnl = (exitPrice - Number(entry.entry_price || 0)) * side * (Number(entry.lot_size || 0) * 100000);
    entry.exit_price = exitPrice;
    entry.pnl = pnl;
    entry.mae = req.body?.metadata?.mae ?? entry.mae;
    entry.mfe = req.body?.metadata?.mfe ?? entry.mfe;
    entry.exit_reason = req.body?.metadata?.exit_reason || entry.exit_reason || "SIGNAL";

    await entry.save();
    return res.status(200).json(entry.toObject());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

function requireAuthedUser(req, res) {
  if (req.auth?.type !== "user" || !req.auth?.userId) {
    const fallbackUserId = req.user?.sub || req.user?._id;
    if (fallbackUserId) return String(fallbackUserId);
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return String(req.auth.userId);
}

function normalizeTelegramPreferences(input) {
  const source = input && typeof input === "object" ? input : {};
  return {
    signals: source.signals !== false,
    orderEvents: source.orderEvents !== false,
    alertHits: source.alertHits !== false,
    system: source.system === true,
  };
}

export const getTelegramStatus = async (req, res) => {
  try {
    const userId = requireAuthedUser(req, res);
    if (!userId) return;

    const { botUsername, enabled } = getTelegramConfig();
    const user = await userModel.findById(userId).select("telegram");
    if (!user?._id) return res.status(404).json({ error: "User not found" });

    const tg = user.telegram || {};
    return res.status(200).json({
      enabled,
      bot_username: botUsername || "",
      linked: Boolean(tg.isActive && tg.chatId),
      chat_id_masked: tg.chatId ? `***${String(tg.chatId).slice(-4)}` : "",
      username: tg.username || "",
      first_name: tg.firstName || "",
      linked_at: tg.linkedAt || null,
      preferences: normalizeTelegramPreferences(tg.preferences),
      has_pending_link: Boolean(tg.pendingLinkTokenHash && tg.pendingLinkExpiresAt && new Date(tg.pendingLinkExpiresAt).getTime() > Date.now()),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const startTelegramLink = async (req, res) => {
  try {
    const userId = requireAuthedUser(req, res);
    if (!userId) return;

    const { botUsername, enabled } = getTelegramConfig();
    if (!enabled || !botUsername) {
      return res.status(400).json({ error: "Telegram bot is not configured" });
    }

    const payload = buildTelegramStartPayload();
    const payloadHash = hashTelegramPayload(payload);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const updated = await userModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          "telegram.pendingLinkTokenHash": payloadHash,
          "telegram.pendingLinkExpiresAt": expiresAt,
          "telegram.preferences": normalizeTelegramPreferences(req.body?.preferences),
        },
      },
      { new: true },
    ).select("_id telegram.pendingLinkExpiresAt");

    if (!updated?._id) return res.status(404).json({ error: "User not found" });

    return res.status(200).json({
      ok: true,
      expires_at: updated.telegram?.pendingLinkExpiresAt || expiresAt,
      bot_deep_link: buildTelegramDeepLink({ botUsername, payload }),
      start_payload: payload,
      instruction: "Open the deep link and press Start in Telegram bot to finish linking.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateTelegramPreferences = async (req, res) => {
  try {
    const userId = requireAuthedUser(req, res);
    if (!userId) return;

    const preferences = normalizeTelegramPreferences(req.body?.preferences);
    const user = await userModel.findByIdAndUpdate(
      userId,
      { $set: { "telegram.preferences": preferences } },
      { new: true },
    ).select("_id telegram.preferences");

    if (!user?._id) return res.status(404).json({ error: "User not found" });
    return res.status(200).json({ ok: true, preferences: normalizeTelegramPreferences(user.telegram?.preferences) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const sendTelegramTest = async (req, res) => {
  try {
    const userId = requireAuthedUser(req, res);
    if (!userId) return;

    const user = await userModel.findById(userId).select("username telegram");
    if (!user?._id) return res.status(404).json({ error: "User not found" });

    const chatId = String(user.telegram?.chatId || "");
    if (!user.telegram?.isActive || !chatId) {
      return res.status(400).json({ error: "Telegram is not linked" });
    }

    const result = await sendTelegramMessage({
      chatId,
      text: `✅ Telegram connected for <b>${String(user.username || "user")}</b>\nTime: ${new Date().toISOString()}`,
    });

    if (!result.ok) {
      return res.status(502).json({ ok: false, error: result.error || "Failed to send test message" });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const unlinkTelegram = async (req, res) => {
  try {
    const userId = requireAuthedUser(req, res);
    if (!userId) return;

    const user = await userModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          "telegram.chatId": "",
          "telegram.telegramUserId": "",
          "telegram.username": "",
          "telegram.firstName": "",
          "telegram.linkedAt": null,
          "telegram.isActive": false,
          "telegram.pendingLinkTokenHash": "",
          "telegram.pendingLinkExpiresAt": null,
        },
      },
      { new: true },
    ).select("_id");

    if (!user?._id) return res.status(404).json({ error: "User not found" });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
