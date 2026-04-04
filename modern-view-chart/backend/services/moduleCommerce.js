import crypto from "crypto";
import { moduleOrderModel } from "../model/module_order.js";
import { userModel } from "../model/user.js";
import { normalizeEntitlementModules } from "../auth/modules.js";

export const MODULE_CATALOG = {
    your_mt5: { amount: 30000, durationDays: 30, trialDays: 7, label: "Your MT5" },
    binance_trade: { amount: 20000, durationDays: 30, trialDays: 7, label: "Binance Trade" },
    telegram_notify: { amount: 15000, durationDays: 30, trialDays: 7, label: "Telegram Notify" },
    telegram_control: { amount: 20000, durationDays: 30, trialDays: 7, label: "Telegram Control" },
    ai_assistant: { amount: 70000, durationDays: 30, trialDays: 7, label: "AI Assistant" },
};

const MODULE_ALIASES = new Map([
    ["mt5_trade", "your_mt5"],
]);

function normalizeModuleKey(moduleName) {
    const key = String(moduleName || "").trim().toLowerCase();
    return MODULE_ALIASES.get(key) || key;
}

export function getModuleCatalog(moduleName) {
    const key = normalizeModuleKey(moduleName);
    return MODULE_CATALOG[key] || null;
}

function toDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
}

export function getModuleAccessSnapshot(user, moduleName) {
    const key = normalizeModuleKey(moduleName);
    const now = Date.now();
    const record = Array.isArray(user?.moduleAccess)
        ? user.moduleAccess.find((x) => normalizeModuleKey(x?.module) === key)
        : null;

    const trialEndsAt = toDate(record?.trialEndsAt);
    const activeUntil = toDate(record?.activeUntil);
    const inTrial = trialEndsAt ? trialEndsAt.getTime() > now : false;
    const activePaid = activeUntil ? activeUntil.getTime() > now : false;
    const effectiveStatus = activePaid ? "active" : inTrial ? "trial" : "inactive";
    const canTrade = effectiveStatus === "active" || effectiveStatus === "trial";

    return {
        module: key,
        status: effectiveStatus,
        canUse: canTrade,
        trialStartedAt: toDate(record?.trialStartedAt),
        trialEndsAt,
        activeUntil,
        source: String(record?.source || ""),
        lastOrderCode: String(record?.lastOrderCode || ""),
    };
}

export async function startModuleTrial({ userId, moduleName }) {
    const key = normalizeModuleKey(moduleName);
    const catalog = getModuleCatalog(key);
    if (!catalog) throw new Error("module_not_supported");

    const user = await userModel.findById(userId);
    if (!user?._id) throw new Error("user_not_found");

    const now = new Date();
    const access = Array.isArray(user.moduleAccess) ? [...user.moduleAccess] : [];
    const idx = access.findIndex((x) => normalizeModuleKey(x?.module) === key);
    const exists = idx >= 0 ? access[idx] : null;
    const alreadyTried = Boolean(exists?.trialStartedAt);
    if (alreadyTried) {
        return getModuleAccessSnapshot(user, key);
    }

    const trialEndsAt = new Date(now.getTime() + catalog.trialDays * 24 * 60 * 60 * 1000);
    const next = {
        module: key,
        trialStartedAt: now,
        trialEndsAt,
        activeUntil: exists?.activeUntil || null,
        status: "trial",
        source: "trial",
        lastOrderCode: exists?.lastOrderCode || "",
        updatedAt: now,
    };
    if (idx >= 0) access[idx] = next;
    else access.push(next);

    const normalizedModules = normalizeEntitlementModules([...(user.modules || []), key]);
    user.moduleAccess = access;
    user.modules = normalizedModules;
    user.subscription = {
        ...(user.subscription || {}),
        modules: normalizedModules,
    };
    await user.save();
    return getModuleAccessSnapshot(user, key);
}

function buildOrderCode() {
    const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `MO${Date.now().toString(36).toUpperCase()}${rand}`;
}

export function buildPaymentArtifacts({ orderCode, amount }) {
    const bankCode = String(process.env.PAYMENT_BANK_CODE || "").trim();
    const bankAccountNo = String(process.env.PAYMENT_BANK_ACCOUNT_NO || "").trim();
    const bankAccountName = String(process.env.PAYMENT_BANK_ACCOUNT_NAME || "").trim();
    const transferContent = `VIVU ${orderCode}`;
    let qrUrl = "";
    if (bankCode && bankAccountNo) {
        qrUrl = `https://img.vietqr.io/image/${encodeURIComponent(bankCode)}-${encodeURIComponent(bankAccountNo)}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(bankAccountName || "VIVUTRADE")}`;
    }
    return { transferContent, qrUrl, bankCode, bankAccountNo, bankAccountName };
}

export async function createModuleOrder({ userId, moduleName }) {
    const key = normalizeModuleKey(moduleName);
    const catalog = getModuleCatalog(key);
    if (!catalog) throw new Error("module_not_supported");

    const orderCode = buildOrderCode();
    const payment = buildPaymentArtifacts({ orderCode, amount: catalog.amount });
    const order = await moduleOrderModel.create({
        userId,
        module: key,
        orderCode,
        amount: catalog.amount,
        durationDays: catalog.durationDays,
        transferContent: payment.transferContent,
        qrUrl: payment.qrUrl,
        bankCode: payment.bankCode,
        bankAccountNo: payment.bankAccountNo,
        bankAccountName: payment.bankAccountName,
        status: "pending",
    });
    return order;
}

export async function activateOrder({ order, confirmedBy = "admin_manual", rawWebhookPayload = null }) {
    if (!order || !order._id) throw new Error("order_not_found");
    if (String(order.status) === "paid") return order;

    const user = await userModel.findById(order.userId);
    if (!user?._id) throw new Error("user_not_found");

    const now = new Date();
    const durationDays = Number.isFinite(Number(order.durationDays)) ? Number(order.durationDays) : 30;
    const newActiveUntil = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const key = normalizeModuleKey(order.module);
    const isAiAssistantModule = key === "ai_assistant";

    const access = Array.isArray(user.moduleAccess) ? [...user.moduleAccess] : [];
    const idx = access.findIndex((x) => normalizeModuleKey(x?.module) === key);
    const prevActiveUntil = idx >= 0 ? toDate(access[idx]?.activeUntil) : null;
    const baseMs = prevActiveUntil && prevActiveUntil.getTime() > now.getTime() ? prevActiveUntil.getTime() : now.getTime();
    const extendedActiveUntil = new Date(baseMs + durationDays * 24 * 60 * 60 * 1000);

    const next = {
        module: key,
        trialStartedAt: idx >= 0 ? access[idx]?.trialStartedAt || null : null,
        trialEndsAt: idx >= 0 ? access[idx]?.trialEndsAt || null : null,
        activeUntil: prevActiveUntil ? extendedActiveUntil : newActiveUntil,
        status: "active",
        source: confirmedBy.includes("sepay") ? "sepay" : "manual",
        lastOrderCode: String(order.orderCode || ""),
        updatedAt: now,
    };
    if (idx >= 0) access[idx] = next;
    else access.push(next);

    const normalizedModules = normalizeEntitlementModules([...(user.modules || []), key]);
    user.moduleAccess = access;
    if (isAiAssistantModule) {
        const currentCredits = Number(user.aiAssistantCredits || 0);
        user.aiAssistantCredits = currentCredits + 100;
        user.aiAssistantCreditsUpdatedAt = now;
    }
    user.modules = normalizedModules;
    user.subscription = {
        ...(user.subscription || {}),
        modules: normalizedModules,
    };
    await user.save();

    order.status = "paid";
    order.confirmedBy = confirmedBy;
    order.confirmedAt = now;
    order.paidAt = now;
    if (rawWebhookPayload) {
        order.rawWebhookPayload = rawWebhookPayload;
    }
    await order.save();
    return order;
}
