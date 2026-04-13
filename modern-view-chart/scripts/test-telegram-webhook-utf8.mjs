import process from "node:process";

const baseUrl = String(process.env.TEST_TELEGRAM_WEBHOOK_BASE_URL || "http://127.0.0.1:18091").replace(/\/+$/, "");
const secret = String(process.env.TEST_TELEGRAM_WEBHOOK_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
const chatId = Number(process.env.TEST_TELEGRAM_CHAT_ID || "1116836781");
const text = process.argv.slice(2).join(" ").trim() || "them canh bao gia btcusdm vuot muc 73000";
const updateId = Number(process.env.TEST_TELEGRAM_UPDATE_ID || `${Math.floor(Date.now() / 1000) + 900000}`);

const body = {
  update_id: updateId,
  message: {
    message_id: updateId,
    date: Math.floor(Date.now() / 1000),
    text,
    chat: { id: chatId, type: "private" },
    from: { id: chatId, is_bot: false, first_name: "Codex", username: "codex_test" },
  },
};

const headers = {
  "content-type": "application/json; charset=utf-8",
};
if (secret) headers["x-telegram-bot-api-secret-token"] = secret;

const res = await fetch(`${baseUrl}/api/auth/telegram/webhook`, {
  method: "POST",
  headers,
  body: JSON.stringify(body),
});

const responseText = await res.text();
console.log(JSON.stringify({ ok: res.ok, status: res.status, updateId, text, responseText }, null, 2));
