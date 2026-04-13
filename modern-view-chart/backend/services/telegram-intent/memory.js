import telegramPhraseMemoryModel from "../../model/telegram_phrase_memory.js";
import { ALERT_INTENTS, normalizeIntentOutput, stripDiacritics } from "./shared.js";

const SIMILARITY_MIN = Math.min(0.95, Math.max(0.5, Number.parseFloat(process.env.TELEGRAM_PHRASE_SIMILARITY_MIN || "0.78") || 0.78));
const SIMILARITY_SCAN_LIMIT = Math.min(500, Math.max(20, Number.parseInt(process.env.TELEGRAM_PHRASE_SCAN_LIMIT || "120", 10) || 120));

function normalizePatternKey(text) {
  const normalized = stripDiacritics(String(text || "").toLowerCase())
    .replace(/[^a-z0-9%\s#<>_=.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized
    .replace(/\bhet\b/g, "tat ca")
    .replace(/\btoan bo\b/g, "tat ca")
    .replace(/\bcanh bao\b/g, "alert")
    .replace(/\s+/g, " ")
    .trim();
}

function toTokenSet(patternKey) {
  const list = String(patternKey || "").split(" ").map((s) => s.trim()).filter(Boolean);
  return new Set(list);
}

function jaccardSimilarity(aKey, bKey) {
  const a = toTokenSet(aKey);
  const b = toTokenSet(bKey);
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const token of a) {
    if (b.has(token)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

export async function lookupPhraseMemory(userId, text) {
  if (!userId) return null;
  const patternKey = normalizePatternKey(text);
  if (!patternKey) return null;
  const hit = await telegramPhraseMemoryModel.findOne({ userId: String(userId), patternKey }).lean();
  if (hit) {
    await telegramPhraseMemoryModel.updateOne({ _id: hit._id }, { $set: { lastUsedAt: new Date() }, $inc: { hitCount: 1 } }).catch(() => null);
    return normalizeIntentOutput({ type: hit.intentType, payload: hit.payload || {} });
  }

  const candidates = await telegramPhraseMemoryModel
    .find({ userId: String(userId) })
    .sort({ lastUsedAt: -1 })
    .limit(SIMILARITY_SCAN_LIMIT)
    .lean();

  let best = null;
  let bestScore = 0;
  for (const c of candidates) {
    const score = jaccardSimilarity(patternKey, c.patternKey);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  if (!best || bestScore < SIMILARITY_MIN) return null;
  await telegramPhraseMemoryModel.updateOne(
    { _id: best._id },
    { $set: { lastUsedAt: new Date(), confidence: Math.max(Number(best.confidence || 0.7), bestScore) }, $inc: { hitCount: 1 } },
  ).catch(() => null);
  return normalizeIntentOutput({ type: best.intentType, payload: best.payload || {} });
}

export async function savePhraseMemory(userId, text, intentResult) {
  if (!userId) return;
  const normalized = normalizeIntentOutput(intentResult);
  if (normalized.type === "unknown" || !ALERT_INTENTS.has(normalized.type)) return;

  const patternKey = normalizePatternKey(text);
  if (!patternKey) return;

  await telegramPhraseMemoryModel.updateOne(
    { userId: String(userId), patternKey },
    {
      $set: {
        rawText: String(text || "").trim(),
        intentType: normalized.type,
        payload: normalized.payload || {},
        confidence: Math.max(0.7, Number(normalized?.confidence || 0)),
        lastUsedAt: new Date(),
      },
      $inc: { hitCount: 1 },
      $setOnInsert: { userId: String(userId), patternKey },
    },
    { upsert: true },
  );
}
