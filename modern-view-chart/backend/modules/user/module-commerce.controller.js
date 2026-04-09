import { moduleOrderModel } from "../../model/module_order.js";
import { userModel } from "../../model/user.js";
import {
  activateOrder,
  createModuleOrder,
  getModuleAccessSnapshot,
  getModuleCatalog,
  MODULE_CATALOG,
  startModuleTrial,
} from "../../services/moduleCommerce.js";
import { emitModuleActivated } from "../../services/moduleEvents.js";

const ORDER_EXPIRE_MS = 15 * 60 * 1000;

function normalizeModuleName(value) {
  const key = String(value || "").trim().toLowerCase();
  if (key === "mt5_trade") return "your_mt5";
  return key;
}

function normalizeModuleNames(value) {
  const raw = Array.isArray(value) ? value : [value];
  const out = [];
  for (const item of raw) {
    const key = normalizeModuleName(item);
    if (!key || out.includes(key)) continue;
    out.push(key);
  }
  return out;
}

function getAuthUserId(req) {
  return String(req?.auth?.userId || req?.user?.sub || req?.user?._id || "").trim();
}

function getAuthRole(req) {
  return String(req?.auth?.role || req?.user?.role || "").trim().toLowerCase();
}

function computeExpireMeta(order) {
  const createdAtMs = new Date(order?.createdAt || Date.now()).getTime();
  const expiresAtMs = createdAtMs + ORDER_EXPIRE_MS;
  const remainingMs = Math.max(0, expiresAtMs - Date.now());
  return {
    expiresAt: new Date(expiresAtMs).toISOString(),
    remainingSeconds: Math.ceil(remainingMs / 1000),
    isExpiredByTime: remainingMs <= 0,
  };
}

async function expireOrderIfNeeded(order) {
  if (!order?._id) return order;
  if (String(order.status) !== "pending") return order;
  const meta = computeExpireMeta(order);
  if (!meta.isExpiredByTime) return order;
  order.status = "expired";
  order.confirmedBy = "auto_expire_15m";
  order.confirmedAt = new Date();
  await order.save();
  return order;
}

function toClientOrder(order) {
  const meta = computeExpireMeta(order);
  const modules = Array.isArray(order.modules) && order.modules.length > 0
    ? order.modules.map(normalizeModuleName)
    : [normalizeModuleName(order.module)].filter(Boolean);
  return {
    id: String(order._id),
    _id: String(order._id),
    orderCode: order.orderCode,
    module: order.module,
    modules,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    transferContent: order.transferContent,
    qrUrl: order.qrUrl,
    bankCode: order.bankCode,
    bankAccountNo: order.bankAccountNo,
    bankAccountName: order.bankAccountName,
    createdAt: order.createdAt,
    expiresAt: meta.expiresAt,
    remainingSeconds: String(order.status) === "pending" ? meta.remainingSeconds : 0,
  };
}

export async function getMyModuleStatus(req, res) {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const moduleName = normalizeModuleName(req.query?.module);
  if (!getModuleCatalog(moduleName)) return res.status(400).json({ error: "module_not_supported" });

  const user = await userModel.findById(userId).select("_id moduleAccess");
  if (!user?._id) return res.status(404).json({ error: "User not found" });
  const status = getModuleAccessSnapshot(user, moduleName);
  return res.status(200).json({ ok: true, ...status });
}

export async function getMyAiCredits(req, res) {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const user = await userModel.findById(userId).select("_id moduleAccess aiAssistantCredits aiAssistantCreditsUpdatedAt");
  if (!user?._id) return res.status(404).json({ error: "User not found" });

  const status = getModuleAccessSnapshot(user, "ai_assistant");
  return res.status(200).json({
    ok: true,
    module: "ai_assistant",
    canUse: status.canUse,
    status: status.status,
    remainingCredits: Number(user.aiAssistantCredits || 0),
    updatedAt: user.aiAssistantCreditsUpdatedAt || null,
  });
}

export async function startMyModuleTrial(req, res) {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const moduleName = normalizeModuleName(req.body?.module);
  try {
    const status = await startModuleTrial({ userId, moduleName });
    return res.status(200).json({ ok: true, ...status });
  } catch (error) {
    return res.status(400).json({ error: error?.message || "trial_failed" });
  }
}

export async function createMyModuleOrder(req, res) {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const moduleNames = normalizeModuleNames(req.body?.modules?.length ? req.body.modules : req.body?.module);
  try {
    const order = await createModuleOrder({ userId, moduleName: moduleNames[0], moduleNames });
    return res.status(201).json({
      ok: true,
      order: toClientOrder(order),
    });
  } catch (error) {
    return res.status(400).json({ error: error?.message || "create_order_failed" });
  }
}

export async function listMyModuleOrders(req, res) {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const orders = await moduleOrderModel.find({ userId }).sort({ createdAt: -1 }).limit(50);
  for (const order of orders) {
    await expireOrderIfNeeded(order);
  }
  return res.status(200).json({ ok: true, orders: orders.map(toClientOrder) });
}

export async function cancelMyModuleOrder(req, res) {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const orderId = String(req.params?.orderId || "").trim();
  if (!orderId) return res.status(400).json({ error: "order_id_required" });

  const order = await moduleOrderModel.findOne({ _id: orderId, userId });
  if (!order?._id) return res.status(404).json({ error: "order_not_found" });

  await expireOrderIfNeeded(order);
  if (String(order.status) !== "pending") {
    return res.status(400).json({ error: "order_not_pending", order: toClientOrder(order) });
  }

  order.status = "canceled";
  order.confirmedBy = "user_cancel";
  order.confirmedAt = new Date();
  await order.save();
  return res.status(200).json({ ok: true, order: toClientOrder(order) });
}

export async function listAdminModuleOrders(req, res) {
  const role = getAuthRole(req);
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const status = String(req.query?.status || "pending").trim().toLowerCase();
  const filter = status ? { status } : {};
  const orders = await moduleOrderModel.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  const normalizedOrders = [];
  for (const order of orders) {
    const hydrated = await moduleOrderModel.findById(order._id);
    if (!hydrated?._id) continue;
    await expireOrderIfNeeded(hydrated);
    if (status && String(hydrated.status) !== status) continue;
    normalizedOrders.push(toClientOrder(hydrated));
  }
  return res.status(200).json({ ok: true, orders: normalizedOrders, catalog: MODULE_CATALOG });
}

export async function getMyMt5Consent(req, res) {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const accountScope = String(req.query?.accountScope || "").trim();
  if (!accountScope) return res.status(400).json({ error: "account_scope_required" });

  const user = await userModel.findById(userId).select("_id mt5Consents");
  if (!user?._id) return res.status(404).json({ error: "User not found" });

  const record = Array.isArray(user.mt5Consents)
    ? user.mt5Consents.find((item) => String(item?.accountScope || "").trim() === accountScope)
    : null;

  return res.status(200).json({
    ok: true,
    accountScope,
    riskAccepted: Boolean(record?.riskAccepted),
    accountAccepted: Boolean(record?.accountAccepted),
    accepted: Boolean(record?.accepted),
    updatedAt: record?.updatedAt || null,
  });
}

export async function saveMyMt5Consent(req, res) {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const accountScope = String(req.body?.accountScope || "").trim();
  if (!accountScope) return res.status(400).json({ error: "account_scope_required" });

  const riskAccepted = Boolean(req.body?.riskAccepted);
  const accountAccepted = Boolean(req.body?.accountAccepted);
  const accepted = riskAccepted && accountAccepted;

  const user = await userModel.findById(userId);
  if (!user?._id) return res.status(404).json({ error: "User not found" });

  const now = new Date();
  const next = {
    accountScope,
    riskAccepted,
    accountAccepted,
    accepted,
    updatedAt: now,
  };

  const records = Array.isArray(user.mt5Consents) ? [...user.mt5Consents] : [];
  const idx = records.findIndex((item) => String(item?.accountScope || "").trim() === accountScope);
  if (idx >= 0) records[idx] = next;
  else records.push(next);

  user.mt5Consents = records;
  await user.save();

  return res.status(200).json({ ok: true, ...next });
}

export async function getAdminModuleStats(req, res) {
  const role = getAuthRole(req);
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const [pendingOrders, paidOrders, activeMembers, expiringToday, monthlyRevenueAgg] = await Promise.all([
    moduleOrderModel.countDocuments({ status: "pending" }),
    moduleOrderModel.countDocuments({ status: "paid" }),
    userModel.countDocuments({ moduleAccess: { $elemMatch: { activeUntil: { $gt: now } } } }),
    userModel.countDocuments({ moduleAccess: { $elemMatch: { activeUntil: { $gt: now, $lte: endOfToday } } } }),
    moduleOrderModel.aggregate([
      { $match: { status: "paid", paidAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  return res.status(200).json({
    ok: true,
    stats: {
      pendingOrders,
      paidOrders,
      activeMembers,
      expiringToday,
      monthlyRevenue: Number(monthlyRevenueAgg?.[0]?.total || 0),
    },
  });
}

export async function confirmAdminModuleOrder(req, res) {
  const role = getAuthRole(req);
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const orderId = String(req.params?.orderId || "").trim();
  const order = await moduleOrderModel.findById(orderId);
  if (!order?._id) return res.status(404).json({ error: "order_not_found" });
  await expireOrderIfNeeded(order);
  if (String(order.status) !== "pending") return res.status(400).json({ error: "order_not_pending" });
  const activated = await activateOrder({
    order,
    confirmedBy: `admin:${String(req.auth?.userId || "unknown")}`,
  });
  const modules = Array.isArray(order.modules) && order.modules.length > 0 ? order.modules : [order.module];
  for (const moduleName of modules) {
    emitModuleActivated({
      userId: String(order.userId),
      module: String(moduleName || ""),
      orderCode: String(order.orderCode || ""),
      source: "admin_manual",
    });
  }
  return res.status(200).json({ ok: true, order: activated });
}

export async function rejectAdminModuleOrder(req, res) {
  const role = getAuthRole(req);
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const orderId = String(req.params?.orderId || "").trim();
  const order = await moduleOrderModel.findById(orderId);
  if (!order?._id) return res.status(404).json({ error: "order_not_found" });
  await expireOrderIfNeeded(order);
  if (String(order.status) !== "pending") return res.status(400).json({ error: "order_not_pending" });
  order.status = "canceled";
  order.confirmedBy = `admin_reject:${String(req.auth?.userId || "unknown")}`;
  order.confirmedAt = new Date();
  await order.save();
  return res.status(200).json({ ok: true, order });
}

export async function listAdminModuleMembers(req, res) {
  const role = getAuthRole(req);
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const moduleName = normalizeModuleName(req.query?.module);
  const filter = moduleName ? { moduleAccess: { $elemMatch: { module: moduleName } } } : { moduleAccess: { $exists: true, $ne: [] } };
  const users = await userModel.find(filter).select("_id username displayName role moduleAccess").sort({ updatedAt: -1 }).limit(300).lean();
  return res.status(200).json({ ok: true, members: users });
}

export async function adminExtendMemberModule(req, res) {
  const role = getAuthRole(req);
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const userId = String(req.params?.userId || "").trim();
  const moduleName = normalizeModuleName(req.body?.module);
  const days = Math.max(1, Number.parseInt(String(req.body?.days || "30"), 10) || 30);
  if (!getModuleCatalog(moduleName)) return res.status(400).json({ error: "module_not_supported" });

  const user = await userModel.findById(userId);
  if (!user?._id) return res.status(404).json({ error: "user_not_found" });

  const now = new Date();
  const access = Array.isArray(user.moduleAccess) ? [...user.moduleAccess] : [];
  const idx = access.findIndex((x) => normalizeModuleName(x?.module) === moduleName);
  const current = idx >= 0 ? access[idx] : null;
  const base = current?.activeUntil && new Date(current.activeUntil).getTime() > now.getTime() ? new Date(current.activeUntil) : now;
  const activeUntil = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  const next = {
    module: moduleName,
    trialStartedAt: current?.trialStartedAt || null,
    trialEndsAt: current?.trialEndsAt || null,
    activeUntil,
    status: "active",
    source: "manual",
    lastOrderCode: current?.lastOrderCode || "",
    updatedAt: now,
  };
  if (idx >= 0) access[idx] = next;
  else access.push(next);
  user.moduleAccess = access;
  const normalizedModules = Array.isArray(user.modules) ? user.modules.map((item) => normalizeModuleName(item)) : [];
  if (!normalizedModules.includes(moduleName)) normalizedModules.push(moduleName);
  user.modules = normalizedModules;
  user.subscription = { ...(user.subscription || {}), modules: user.modules };
  await user.save();

  emitModuleActivated({ userId: String(user._id), module: moduleName, orderCode: "", source: "admin_extend" });
  return res.status(200).json({ ok: true, userId: String(user._id), module: moduleName, activeUntil });
}

export async function adminExpireMemberModule(req, res) {
  const role = getAuthRole(req);
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });
  const userId = String(req.params?.userId || "").trim();
  const moduleName = normalizeModuleName(req.body?.module);
  if (!getModuleCatalog(moduleName)) return res.status(400).json({ error: "module_not_supported" });
  const user = await userModel.findById(userId);
  if (!user?._id) return res.status(404).json({ error: "user_not_found" });

  const now = new Date();
  const access = Array.isArray(user.moduleAccess) ? [...user.moduleAccess] : [];
  const idx = access.findIndex((x) => normalizeModuleName(x?.module) === moduleName);
  if (idx >= 0) {
    access[idx] = {
      ...access[idx],
      activeUntil: now,
      trialEndsAt: now,
      status: "expired",
      updatedAt: now,
    };
  }
  user.moduleAccess = access;
  await user.save();
  emitModuleActivated({ userId: String(user._id), module: moduleName, orderCode: "", source: "admin_expire" });
  return res.status(200).json({ ok: true, userId: String(user._id), module: moduleName });
}

export async function sepayWebhook(req, res) {
  const secret = String(process.env.SEPAY_WEBHOOK_SECRET || "").trim();
  const provided = String(req.headers["x-sepay-signature"] || req.headers["x-webhook-secret"] || "").trim();
  if (secret && provided !== secret) return res.status(401).json({ ok: false, error: "invalid_signature" });

  const payload = req.body || {};
  const paymentStatus = String(payload.status || payload.transactionStatus || payload.state || payload.result || "").trim().toLowerCase();
  const isSuccessStatus = ["success", "paid", "completed", "00", "1"].includes(paymentStatus) || paymentStatus === "";
  if (!isSuccessStatus) return res.status(200).json({ ok: true, skipped: "payment_not_success", status: paymentStatus || null });

  const content = String(payload.transferContent || payload.content || payload.description || "").trim();
  if (!content) return res.status(200).json({ ok: true, skipped: "no_content" });

  const matched = content.match(/MO[0-9A-Z]+/);
  if (!matched) return res.status(200).json({ ok: true, skipped: "order_code_not_found" });
  const orderCode = matched[0];
  const order = await moduleOrderModel.findOne({ orderCode });
  if (!order?._id) return res.status(200).json({ ok: true, skipped: "order_not_found", orderCode });
  if (String(order.status) === "paid") return res.status(200).json({ ok: true, skipped: "already_paid", orderCode });

  const paidAmountRaw = payload.transferAmount ?? payload.amount ?? payload.value ?? payload.creditAmount ?? payload.transactionAmount;
  const paidAmount = Number(paidAmountRaw || 0);
  if (Number.isFinite(paidAmount) && paidAmount > 0 && paidAmount < Number(order.amount || 0)) {
    return res.status(200).json({
      ok: true,
      skipped: "insufficient_amount",
      orderCode,
      paidAmount,
      requiredAmount: Number(order.amount || 0),
    });
  }

  await activateOrder({ order, confirmedBy: "sepay:webhook", rawWebhookPayload: payload });
  const modules = Array.isArray(order.modules) && order.modules.length > 0 ? order.modules : [order.module];
  for (const moduleName of modules) {
    emitModuleActivated({
      userId: String(order.userId),
      module: String(moduleName || ""),
      orderCode: String(order.orderCode || ""),
      source: "sepay_webhook",
    });
  }
  return res.status(200).json({ ok: true, activated: true, orderCode });
}
