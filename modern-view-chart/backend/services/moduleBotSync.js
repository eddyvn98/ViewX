import { logError, logInfo, logWarn } from "../logger.js";
import { userModel } from "../model/user.js";
import { getModuleCatalog, getModuleAccessSnapshot } from "./moduleCommerce.js";
import { onModuleActivated } from "./moduleEvents.js";
import { sendTelegramMessage } from "./telegram.js";

function shouldSendOrderEvent(user) {
  const tg = user?.telegram || {};
  return Boolean(tg.isActive && tg.chatId && tg.preferences?.orderEvents !== false);
}

function formatIsoDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString();
}

async function handleModuleActivated(payload) {
  try {
    const userId = String(payload?.userId || "").trim();
    const moduleName = String(payload?.module || "").trim().toLowerCase();
    if (!userId || !moduleName) return;

    const user = await userModel.findById(userId).select("username telegram moduleAccess");
    if (!user?._id) return;
    if (!shouldSendOrderEvent(user)) return;

    const snapshot = getModuleAccessSnapshot(user, moduleName);
    const catalog = getModuleCatalog(moduleName);
    const expiry = formatIsoDate(snapshot.activeUntil || snapshot.trialEndsAt);
    const label = catalog?.label || moduleName;
    const source = String(payload?.source || "system");
    const orderCode = String(payload?.orderCode || "").trim();

    const messageLines = [
      `Module update: ${label}`,
      `Status: ${snapshot.status}`,
      expiry ? `Valid until: ${expiry}` : "",
      orderCode ? `Order: ${orderCode}` : "",
      `Source: ${source}`,
    ].filter(Boolean);

    const result = await sendTelegramMessage({
      chatId: String(user.telegram?.chatId || ""),
      text: messageLines.join("\n"),
      parseMode: "",
    });

    if (!result.ok) {
      logWarn("bot.module_activated.telegram_send_failed", {
        user_id: String(user._id),
        module: moduleName,
        error: result.error || "unknown_error",
      });
      return;
    }

    logInfo("bot.module_activated.telegram_sent", {
      user_id: String(user._id),
      module: moduleName,
      source,
    });
  } catch (error) {
    logError("bot.module_activated.handler_failed", {
      error: error?.message || error,
    });
  }
}

export function startModuleBotSync() {
  const stop = onModuleActivated((payload) => {
    void handleModuleActivated(payload);
  });
  logInfo("bot.module_sync.started", {});
  return { stop };
}

