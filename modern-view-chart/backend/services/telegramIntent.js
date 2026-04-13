import { resolveTelegramIntent } from "./telegram-intent/pipeline.js";

export async function parseTelegramIntent(text, pendingIntent = null, userId = "") {
  return resolveTelegramIntent({ text, pendingIntent, userId: userId ? String(userId) : "" });
}
