import {
  getUnknownNluClusters,
  labelNluCluster,
  listNluEvents,
} from "../../services/telegramBot.nluLearning.js";

function readActor(req) {
  const fromAuth = String(req.auth?.userId || "").trim();
  const fromLegacy = String(req.user?._id || req.user?.sub || "").trim();
  return fromAuth || fromLegacy;
}

export const listTelegramNluUnknowns = async (req, res) => {
  try {
    const days = Number(req.query.days || 7);
    const limit = Number(req.query.limit || 50);
    const ownerUserId = String(req.query.ownerUserId || "").trim();
    const includeLabeled = String(req.query.includeLabeled || "false").trim().toLowerCase() === "true";
    const rows = await getUnknownNluClusters({ days, limit, ownerUserId, includeLabeled });
    return res.status(200).json({
      ok: true,
      days,
      count: rows.length,
      items: rows,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "failed_to_list_unknown_nlu" });
  }
};

export const listTelegramNluEvents = async (req, res) => {
  try {
    const days = Number(req.query.days || 7);
    const limit = Number(req.query.limit || 100);
    const ownerUserId = String(req.query.ownerUserId || "").trim();
    const status = String(req.query.status || "all").trim().toLowerCase();
    const rows = await listNluEvents({ days, limit, ownerUserId, status });
    return res.status(200).json({
      ok: true,
      days,
      status,
      count: rows.length,
      items: rows,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "failed_to_list_nlu_events" });
  }
};

export const labelTelegramNluUnknown = async (req, res) => {
  try {
    const normalizedText = String(req.body?.normalizedText || "").trim();
    const labelIntentType = String(req.body?.labelIntentType || "").trim();
    const labelPayload = req.body?.labelPayload && typeof req.body.labelPayload === "object" ? req.body.labelPayload : {};
    const labelNote = String(req.body?.labelNote || "").trim();
    const scope = String(req.body?.scope || "global").trim().toLowerCase() === "user" ? "user" : "global";
    const ownerUserId = String(req.body?.ownerUserId || "").trim();
    const labeledBy = readActor(req);
    const result = await labelNluCluster({
      normalizedText,
      labelIntentType,
      labelPayload,
      labelNote,
      labeledBy,
      ownerUserId,
      scope,
    });
    return res.status(200).json({
      ok: true,
      matchedCount: Number(result?.matchedCount || 0),
      modifiedCount: Number(result?.modifiedCount || 0),
    });
  } catch (error) {
    const code = String(error?.message || "");
    const status = code === "normalized_text_required" || code === "label_intent_type_required" ? 400 : 500;
    return res.status(status).json({ ok: false, error: code || "failed_to_label_nlu_cluster" });
  }
};

