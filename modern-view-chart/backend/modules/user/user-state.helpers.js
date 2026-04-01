import { getDatabaseHealth } from "../../services/database.js";
import { createHash } from "crypto";

export function sanitizeClientId(input) {
  const raw = String(input || "").trim();
  if (!raw) return "public";
  const safe = raw.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 128);
  return safe || "public";
}

export function resolveStateScope(req) {
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

export function resolvePublicStateScope(req) {
  const headerClientId = req.headers["x-client-id"];
  const queryClientId = req.query?.client_id;
  const clientId = sanitizeClientId(
    typeof headerClientId === "string"
      ? headerClientId
      : typeof queryClientId === "string"
        ? queryClientId
        : "",
  );

  if (clientId && clientId !== "public") {
    return { scopeType: "guest", scopeId: `cid:${clientId}` };
  }

  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)[0] || "";
  const directIp = String(req.ip || req.socket?.remoteAddress || "").trim();
  const userAgent = String(req.headers["user-agent"] || "").trim();
  const ipSource = forwarded || directIp || "unknown";
  const fingerprint = `${ipSource}|${userAgent}`;
  const digest = createHash("sha256").update(fingerprint).digest("hex").slice(0, 24);

  return { scopeType: "guest", scopeId: `fp:${digest}` };
}

export function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function parseMaxStateBytes() {
  const configured = Number.parseInt(process.env.USER_STATE_MAX_BYTES || "262144", 10);
  return Number.isFinite(configured) && configured > 1024 ? configured : 262144;
}

export function parseMaxDrawingsBytes() {
  const configured = Number.parseInt(process.env.USER_DRAWINGS_MAX_BYTES || "2097152", 10);
  return Number.isFinite(configured) && configured > 1024 ? configured : 2097152;
}

export function isDatabaseReadyForUserState() {
  const db = getDatabaseHealth();
  return db.state === "connected";
}

export function buildEmptySetupStateResponse(scope) {
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

export function sanitizeStrategyId(input) {
  return String(input || "").trim().slice(0, 128);
}

export function parseBaseRevision(input) {
  const value = Number.parseInt(String(input ?? ""), 10);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}
