import telegramNluEventModel from "../model/telegram_nlu_event.js";

function normalizeText(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

export async function trackTelegramNluEvent({
  ownerUserId,
  chatId,
  text,
  intent,
  lang = "vi",
  hasPending = false,
}) {
  if (!ownerUserId || !chatId || !String(text || "").trim()) return null;
  const intentType = String(intent?.type || "unknown").trim().toLowerCase() || "unknown";
  const doc = {
    ownerUserId: String(ownerUserId),
    chatId: String(chatId),
    messageText: String(text || "").trim(),
    normalizedText: normalizeText(text),
    intentType,
    intentSource: String(intent?.meta?.source || ""),
    intentSummary: String(intent?.summary || ""),
    lang: String(lang || "vi"),
    hasPending: Boolean(hasPending),
    isUnknown: intentType === "unknown",
    suggestion: String(intent?.suggestion || ""),
    payload: intent?.payload && typeof intent.payload === "object" ? intent.payload : {},
  };
  return telegramNluEventModel.create(doc);
}

export async function getUnknownNluClusters({
  days = 7,
  limit = 50,
  ownerUserId = "",
  includeLabeled = false,
}) {
  const safeDays = Math.max(1, Math.min(Number(days) || 7, 90));
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
  const fromDate = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
  const match = {
    isUnknown: true,
    createdAt: { $gte: fromDate },
    normalizedText: { $ne: "" },
  };
  if (ownerUserId) match.ownerUserId = String(ownerUserId);
  if (!includeLabeled) match.labelStatus = "unlabeled";

  return telegramNluEventModel.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$normalizedText",
        count: { $sum: 1 },
        users: { $addToSet: "$ownerUserId" },
        chats: { $addToSet: "$chatId" },
        latestAt: { $max: "$createdAt" },
        samples: { $push: "$messageText" },
      },
    },
    { $sort: { count: -1, latestAt: -1 } },
    { $limit: safeLimit },
    {
      $project: {
        _id: 0,
        normalizedText: "$_id",
        count: 1,
        uniqueUsers: { $size: "$users" },
        uniqueChats: { $size: "$chats" },
        latestAt: 1,
        sampleMessages: { $slice: ["$samples", 5] },
      },
    },
  ]);
}

export async function labelNluCluster({
  normalizedText,
  labelIntentType,
  labelPayload = {},
  labelNote = "",
  labeledBy = "",
  ownerUserId = "",
  scope = "global",
}) {
  const key = normalizeText(normalizedText);
  if (!key) throw new Error("normalized_text_required");
  const intentType = String(labelIntentType || "").trim().toLowerCase();
  if (!intentType) throw new Error("label_intent_type_required");

  const filter = { normalizedText: key };
  if (scope === "user" && ownerUserId) filter.ownerUserId = String(ownerUserId);

  const update = {
    $set: {
      labelStatus: "labeled",
      labelIntentType: intentType,
      labelPayload: labelPayload && typeof labelPayload === "object" ? labelPayload : {},
      labelNote: String(labelNote || ""),
      labeledBy: String(labeledBy || ""),
      labeledAt: new Date(),
    },
  };

  return telegramNluEventModel.updateMany(filter, update);
}

export async function listNluEvents({
  days = 7,
  limit = 100,
  ownerUserId = "",
  status = "all",
}) {
  const safeDays = Math.max(1, Math.min(Number(days) || 7, 90));
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 300));
  const fromDate = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
  const query = { createdAt: { $gte: fromDate } };
  if (ownerUserId) query.ownerUserId = String(ownerUserId);
  if (status === "unknown") query.isUnknown = true;
  if (status === "unlabeled") query.labelStatus = "unlabeled";
  if (status === "labeled") query.labelStatus = "labeled";
  return telegramNluEventModel.find(query).sort({ createdAt: -1 }).limit(safeLimit).lean();
}

