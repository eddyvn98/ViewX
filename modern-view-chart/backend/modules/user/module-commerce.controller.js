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

function normalizeModuleName(value) {
    const key = String(value || "").trim().toLowerCase();
    if (key === "mt5_trade") return "your_mt5";
    return key;
}

function getAuthUserId(req) {
    return String(req?.auth?.userId || req?.user?.sub || req?.user?._id || "").trim();
}

function getAuthRole(req) {
    return String(req?.auth?.role || req?.user?.role || "").trim().toLowerCase();
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
    const moduleName = normalizeModuleName(req.body?.module);
    try {
        const order = await createModuleOrder({ userId, moduleName });
        return res.status(201).json({
            ok: true,
            order: {
                id: String(order._id),
                orderCode: order.orderCode,
                module: order.module,
                amount: order.amount,
                currency: order.currency,
                status: order.status,
                transferContent: order.transferContent,
                qrUrl: order.qrUrl,
                bankCode: order.bankCode,
                bankAccountNo: order.bankAccountNo,
                bankAccountName: order.bankAccountName,
                createdAt: order.createdAt,
            },
        });
    } catch (error) {
        return res.status(400).json({ error: error?.message || "create_order_failed" });
    }
}

export async function listMyModuleOrders(req, res) {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const orders = await moduleOrderModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
    return res.status(200).json({ ok: true, orders });
}

export async function listAdminModuleOrders(req, res) {
    const role = getAuthRole(req);
    if (role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const status = String(req.query?.status || "pending").trim().toLowerCase();
    const filter = status ? { status } : {};
    const orders = await moduleOrderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();
    return res.status(200).json({ ok: true, orders, catalog: MODULE_CATALOG });
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
        userModel.countDocuments({
            moduleAccess: {
                $elemMatch: {
                    activeUntil: { $gt: now },
                },
            },
        }),
        userModel.countDocuments({
            moduleAccess: {
                $elemMatch: {
                    activeUntil: { $gt: now, $lte: endOfToday },
                },
            },
        }),
        moduleOrderModel.aggregate([
            { $match: { status: "paid", paidAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
    ]);

    const monthlyRevenue = Number(monthlyRevenueAgg?.[0]?.total || 0);
    return res.status(200).json({
        ok: true,
        stats: {
            pendingOrders,
            paidOrders,
            activeMembers,
            expiringToday,
            monthlyRevenue,
        },
    });
}

export async function confirmAdminModuleOrder(req, res) {
    const role = getAuthRole(req);
    if (role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const orderId = String(req.params?.orderId || "").trim();
    const order = await moduleOrderModel.findById(orderId);
    if (!order?._id) return res.status(404).json({ error: "order_not_found" });
    const activated = await activateOrder({
        order,
        confirmedBy: `admin:${String(req.auth?.userId || "unknown")}`,
    });
    emitModuleActivated({
        userId: String(order.userId),
        module: String(order.module || ""),
        orderCode: String(order.orderCode || ""),
        source: "admin_manual",
    });
    return res.status(200).json({ ok: true, order: activated });
}

export async function rejectAdminModuleOrder(req, res) {
    const role = getAuthRole(req);
    if (role !== "admin") return res.status(403).json({ error: "Forbidden" });
    const orderId = String(req.params?.orderId || "").trim();
    const order = await moduleOrderModel.findById(orderId);
    if (!order?._id) return res.status(404).json({ error: "order_not_found" });
    if (String(order.status) !== "pending") {
        return res.status(400).json({ error: "order_not_pending" });
    }
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
    const users = await userModel
        .find(filter)
        .select("_id username displayName role moduleAccess")
        .sort({ updatedAt: -1 })
        .limit(300)
        .lean();
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
    const base = current?.activeUntil && new Date(current.activeUntil).getTime() > now.getTime()
        ? new Date(current.activeUntil)
        : now;
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
    user.subscription = {
        ...(user.subscription || {}),
        modules: user.modules,
    };
    await user.save();

    emitModuleActivated({
        userId: String(user._id),
        module: moduleName,
        orderCode: "",
        source: "admin_extend",
    });
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
    emitModuleActivated({
        userId: String(user._id),
        module: moduleName,
        orderCode: "",
        source: "admin_expire",
    });
    return res.status(200).json({ ok: true, userId: String(user._id), module: moduleName });
}

export async function sepayWebhook(req, res) {
    const secret = String(process.env.SEPAY_WEBHOOK_SECRET || "").trim();
    const provided = String(req.headers["x-sepay-signature"] || req.headers["x-webhook-secret"] || "").trim();
    if (secret && provided !== secret) return res.status(401).json({ ok: false, error: "invalid_signature" });

    const payload = req.body || {};
    const paymentStatus = String(
        payload.status || payload.transactionStatus || payload.state || payload.result || ""
    ).trim().toLowerCase();
    const isSuccessStatus = ["success", "paid", "completed", "00", "1"].includes(paymentStatus) || paymentStatus === "";
    if (!isSuccessStatus) {
        return res.status(200).json({ ok: true, skipped: "payment_not_success", status: paymentStatus || null });
    }

    const content = String(payload.transferContent || payload.content || payload.description || "").trim();
    if (!content) return res.status(200).json({ ok: true, skipped: "no_content" });

    const matched = content.match(/MO[0-9A-Z]+/);
    if (!matched) return res.status(200).json({ ok: true, skipped: "order_code_not_found" });
    const orderCode = matched[0];
    const order = await moduleOrderModel.findOne({ orderCode });
    if (!order?._id) return res.status(200).json({ ok: true, skipped: "order_not_found", orderCode });

    if (String(order.status) === "paid") {
        return res.status(200).json({ ok: true, skipped: "already_paid", orderCode });
    }

    const paidAmountRaw =
        payload.transferAmount ??
        payload.amount ??
        payload.value ??
        payload.creditAmount ??
        payload.transactionAmount;
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

    await activateOrder({
        order,
        confirmedBy: "sepay:webhook",
        rawWebhookPayload: payload,
    });
    emitModuleActivated({
        userId: String(order.userId),
        module: String(order.module || ""),
        orderCode: String(order.orderCode || ""),
        source: "sepay_webhook",
    });
    return res.status(200).json({ ok: true, activated: true, orderCode });
}
