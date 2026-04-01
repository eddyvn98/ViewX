import "../../backend/envloader.js";
import mongoose from "mongoose";
import { userModel } from "../../backend/model/user.js";
import {
  inferModulesFromPlan,
  inferPlanFromModules,
  normalizeEntitlementModules,
} from "../../backend/auth/modules.js";

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    apply: args.has("--apply"),
    limit: (() => {
      const item = argv.find((v) => String(v || "").startsWith("--limit="));
      if (!item) return 0;
      const n = Number.parseInt(String(item).split("=")[1] || "0", 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    })(),
  };
}

async function main() {
  const { apply, limit } = parseArgs(process.argv);
  const mongoUri = String(process.env.URL_MONGOOSE || "").trim();
  if (!mongoUri) {
    throw new Error("Missing URL_MONGOOSE");
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  const cursor = userModel.find({}, "_id username plan modules subscription").cursor();

  let scanned = 0;
  let wouldUpdate = 0;
  let updated = 0;

  for await (const user of cursor) {
    scanned += 1;
    if (limit > 0 && scanned > limit) break;

    const rawPlan = String(user?.subscription?.plan || user?.plan || "free").trim().toLowerCase();
    const rawModules = normalizeEntitlementModules(user?.subscription?.modules || user?.modules || []);
    const modules = rawModules.length > 0 ? rawModules : inferModulesFromPlan(rawPlan);
    const plan = inferPlanFromModules(modules.length > 0 ? modules : inferModulesFromPlan(rawPlan));
    const validUntil = modules.length > 0 ? new Date("2099-12-31T23:59:59.000Z") : null;

    const currentSubModules = normalizeEntitlementModules(user?.subscription?.modules || []);
    const currentSubPlan = String(user?.subscription?.plan || "").trim().toLowerCase();
    const currentRootModules = normalizeEntitlementModules(user?.modules || []);
    const isSame =
      currentSubPlan === plan &&
      JSON.stringify(currentSubModules) === JSON.stringify(modules) &&
      JSON.stringify(currentRootModules) === JSON.stringify(modules) &&
      (modules.length === 0
        ? !user?.subscription?.validUntil
        : new Date(user?.subscription?.validUntil || 0).getTime() === validUntil.getTime());

    if (isSame) continue;
    wouldUpdate += 1;

    if (apply) {
      await userModel.updateOne(
        { _id: user._id },
        {
          $set: {
            modules,
            "subscription.plan": plan,
            "subscription.modules": modules,
            "subscription.status": "active",
            "subscription.validUntil": validUntil,
          },
        },
      );
      updated += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        scanned,
        would_update: wouldUpdate,
        updated,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[migration] failed:", error?.message || String(error));
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
