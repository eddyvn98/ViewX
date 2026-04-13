import telegramUpdateModel from "../model/telegram_update.js";
import { logError, logInfo, logWarn } from "../logger.js";
import { processTelegramWebhookUpdate } from "./telegramWebhookProcessor.js";

const MAX_RETRY = Math.max(1, Number.parseInt(process.env.TELEGRAM_WEBHOOK_MAX_RETRY || "5", 10) || 5);
const POLL_INTERVAL_MS = Math.max(250, Number.parseInt(process.env.TELEGRAM_WEBHOOK_POLL_MS || "400", 10) || 400);
const LEASE_MS = Math.max(5_000, Number.parseInt(process.env.TELEGRAM_WEBHOOK_LEASE_MS || "15000", 10) || 15_000);
const RETRY_BASE_MS = Math.max(250, Number.parseInt(process.env.TELEGRAM_WEBHOOK_RETRY_BASE_MS || "1000", 10) || 1000);

let workerTimer = null;
let workerActive = false;

function nextRetryDelayMs(attempts) {
  const n = Math.max(1, Number(attempts || 1));
  const exponential = RETRY_BASE_MS * Math.pow(2, Math.min(6, n - 1));
  return Math.min(60_000, exponential);
}

function getUpdateId(rawUpdate) {
  const id = Number(rawUpdate?.update_id);
  return Number.isFinite(id) ? id : null;
}

export async function enqueueTelegramWebhookUpdate(rawUpdate) {
  const updateId = getUpdateId(rawUpdate);
  if (updateId == null) return { accepted: false, reason: "missing_update_id" };

  try {
    await telegramUpdateModel.create({
      updateId,
      status: "queued",
      attempts: 0,
      payload: rawUpdate,
      nextRetryAt: new Date(),
    });
    return { accepted: true, duplicate: false, updateId };
  } catch (error) {
    if (error?.code === 11000) {
      return { accepted: true, duplicate: true, updateId };
    }
    throw error;
  }
}

async function claimNextUpdate() {
  const now = new Date();
  const leaseUntil = new Date(Date.now() + LEASE_MS);
  return telegramUpdateModel.findOneAndUpdate(
    {
      status: "queued",
      $and: [
        { $or: [{ nextRetryAt: null }, { nextRetryAt: { $lte: now } }] },
        { $or: [{ leaseUntil: null }, { leaseUntil: { $lte: now } }] },
      ],
    },
    {
      $set: { status: "processing", leaseUntil },
      $inc: { attempts: 1 },
    },
    { sort: { createdAt: 1 }, new: true },
  );
}

async function processOneClaimed() {
  const claimed = await claimNextUpdate();
  if (!claimed?._id) return false;

  try {
    await processTelegramWebhookUpdate(claimed.payload);
    await telegramUpdateModel.updateOne(
      { _id: claimed._id },
      { $set: { status: "done", processedAt: new Date(), leaseUntil: null, lastError: "" } },
    );
    return true;
  } catch (error) {
    const attempts = Number(claimed.attempts || 1);
    const shouldRetry = attempts < MAX_RETRY;
    const retryAt = new Date(Date.now() + nextRetryDelayMs(attempts));
    await telegramUpdateModel.updateOne(
      { _id: claimed._id },
      {
        $set: {
          status: shouldRetry ? "queued" : "failed",
          leaseUntil: null,
          nextRetryAt: shouldRetry ? retryAt : null,
          lastError: String(error?.message || error || "unknown_error"),
        },
      },
    );
    if (shouldRetry) {
      logWarn("telegram.webhook_update.retry_scheduled", { update_id: claimed.updateId, attempts, retry_at: retryAt.toISOString() });
    } else {
      logError("telegram.webhook_update.failed_permanently", { update_id: claimed.updateId, attempts, error: error?.message || error });
    }
    return true;
  }
}

async function drainLoopTick() {
  if (workerActive) return;
  workerActive = true;
  try {
    for (let i = 0; i < 30; i += 1) {
      const consumed = await processOneClaimed();
      if (!consumed) break;
    }
  } catch (error) {
    logError("telegram.webhook_queue.tick_failed", { error: error?.message || error });
  } finally {
    workerActive = false;
  }
}

export function startTelegramWebhookQueueWorker() {
  if (workerTimer) return { stop: stopTelegramWebhookQueueWorker };
  workerTimer = setInterval(() => {
    drainLoopTick().catch(() => null);
  }, POLL_INTERVAL_MS);
  if (typeof workerTimer.unref === "function") workerTimer.unref();
  logInfo("telegram.webhook_queue.started", { poll_interval_ms: POLL_INTERVAL_MS, lease_ms: LEASE_MS, max_retry: MAX_RETRY });
  return { stop: stopTelegramWebhookQueueWorker };
}

export function stopTelegramWebhookQueueWorker() {
  if (!workerTimer) return;
  clearInterval(workerTimer);
  workerTimer = null;
  logInfo("telegram.webhook_queue.stopped", {});
}
