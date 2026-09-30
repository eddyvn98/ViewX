import { getDatabaseHealth } from "../../services/database.js";

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

  return { scopeType: "guest", scopeId: clientId };
}

export function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function parseMaxStateBytes() {
  const configured = Number.parseInt(process.env.USER_STATE_MAX_BYTES || "4194304", 10);
  return Number.isFinite(configured) && configured > 1024 ? configured : 4194304;
}

export function parseMaxDrawingsBytes() {
  const configured = Number.parseInt(process.env.USER_DRAWINGS_MAX_BYTES || "4194304", 10);
  return Number.isFinite(configured) && configured > 1024 ? configured : 4194304;
}

export function isDatabaseReadyForUserState() {
  const db = getDatabaseHealth();
  return db.state === "connected";
}

export function buildEmptySetupStateResponse(scope) {
  return {
    scope_type: scope.scopeType,
    scope_id: scope.scopeId,
    schema_version: 2,
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
