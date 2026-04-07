import { userModel } from "../../model/user.js";
import {
  inferPlanFromModules,
  normalizeEntitlementModules,
  resolveUserEntitlements,
} from "../../auth/modules.js";

function getAuthUserId(req) {
  const fromAuth = String(req?.auth?.userId || "").trim();
  if (fromAuth) return fromAuth;
  return String(req?.user?.sub || req?.user?._id || "").trim();
}

export async function getUserModules(req, res) {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const user = await userModel.findById(userId).select("_id modules subscription");
  if (!user?._id) return res.status(404).json({ error: "User not found" });

  const ent = resolveUserEntitlements(user);
  return res.status(200).json({
    ok: true,
    plan: ent.plan,
    modules: ent.modules,
    subscription: {
      plan: ent.plan,
      modules: ent.modules,
      validUntil: ent.validUntil,
    },
  });
}

export async function upsertUserModules(req, res) {
  const userId = getAuthUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const requestedModules = normalizeEntitlementModules(req?.body?.modules);
  const nextPlan = inferPlanFromModules(requestedModules);
  const nextValidUntil = requestedModules.length > 0 ? new Date("2099-12-31T23:59:59.000Z") : null;

  const updated = await userModel.findByIdAndUpdate(
    userId,
    {
      $set: {
        plan: nextPlan,
        modules: requestedModules,
        "subscription.plan": nextPlan,
        "subscription.modules": requestedModules,
        "subscription.status": "active",
        "subscription.validUntil": nextValidUntil,
      },
    },
    { new: true, projection: "_id modules subscription" },
  );

  if (!updated?._id) return res.status(404).json({ error: "User not found" });

  const ent = resolveUserEntitlements(updated);
  return res.status(200).json({
    ok: true,
    plan: ent.plan,
    modules: ent.modules,
    subscription: {
      plan: ent.plan,
      modules: ent.modules,
      validUntil: ent.validUntil,
    },
  });
}
