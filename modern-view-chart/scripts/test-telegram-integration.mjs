import process from "node:process";
import mongoose from "mongoose";

const webhookBase = String(process.env.TEST_TELEGRAM_WEBHOOK_BASE_URL || "http://127.0.0.1:18091").replace(/\/+$/, "");
const webhookSecret = String(process.env.TEST_TELEGRAM_WEBHOOK_SECRET || "").trim();
const mongoUrl = String(process.env.TEST_TELEGRAM_MONGO_URL || "mongodb://127.0.0.1:27027/viewx?directConnection=true");
const chatId = Number(process.env.TEST_TELEGRAM_CHAT_ID || "1116836781");

if (!webhookSecret) {
  console.error("Missing TEST_TELEGRAM_WEBHOOK_SECRET");
  process.exit(1);
}

const scenario = String(process.argv[2] || "utf8-price").trim();

const scenarios = {
  "utf8-price": [
    "thêm cảnh báo giá btcusdm vượt mức 73000",
    "1h",
  ],
  "rsi": [
    "tạo rsi alert btc trên 70",
    "15m",
  ],
  "ma-cross": [
    "alert ema20 cross up ema50 on btc",
    "1h",
  ],
  "indicator-rule": [
    "create indicator alert ema20 above ema50 on btc",
    "15m",
  ],
};

if (!scenarios[scenario]) {
  console.error(`Unknown scenario: ${scenario}`);
  process.exit(1);
}

async function sendWebhookText(text, offset = 0) {
  const updateId = Date.now() + offset;
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
  const res = await fetch(`${webhookBase}/api/auth/telegram/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-telegram-bot-api-secret-token": webhookSecret,
    },
    body: JSON.stringify(body),
  });
  const responseText = await res.text();
  return { ok: res.ok, status: res.status, updateId, text, responseText };
}

await mongoose.connect(mongoUrl);
const users = mongoose.connection.db.collection("users");
const user = await users.findOne({ "telegram.chatId": String(chatId) }, { projection: { _id: 1, "telegram.botState.pendingIntent": 1, "telegram.botState.indicatorAlerts": 1 } });
if (!user?._id) {
  console.error("Linked Telegram user not found");
  process.exit(1);
}

await users.updateOne({ _id: user._id }, { $set: { "telegram.botState.pendingIntent": null } });

const results = [];
for (let i = 0; i < scenarios[scenario].length; i += 1) {
  results.push(await sendWebhookText(scenarios[scenario][i], i));
  await new Promise((resolve) => setTimeout(resolve, 2500));
}

const finalUser = await users.findOne({ _id: user._id }, { projection: { "telegram.botState.pendingIntent": 1, "telegram.botState.indicatorAlerts": 1 } });
console.log(JSON.stringify({
  scenario,
  results,
  pendingIntent: finalUser?.telegram?.botState?.pendingIntent || null,
  indicatorAlertCount: Array.isArray(finalUser?.telegram?.botState?.indicatorAlerts) ? finalUser.telegram.botState.indicatorAlerts.length : 0,
}, null, 2));

await mongoose.disconnect();
