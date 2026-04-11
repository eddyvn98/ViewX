import { getModuleAccessSnapshot } from "./moduleCommerce.js";
import { TELEGRAM_REQUIRED_MODULES } from "./telegramBot.constants.js";

export function hasTelegramModuleAccess(user) {
  return TELEGRAM_REQUIRED_MODULES.some((moduleName) => getModuleAccessSnapshot(user, moduleName).canUse);
}
