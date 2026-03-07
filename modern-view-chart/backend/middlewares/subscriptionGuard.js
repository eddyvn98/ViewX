/**
 * Middleware to check if user has the required subscription plan.
 * @param {string[]} requiredPlans - List of allowed plans (e.g., ['pro', 'pro_plus'])
 */
export const requireSubscription = (requiredPlans = []) => {
    return (req, res, next) => {
        try {
            const user = req.user; // Set by auth middleware

            if (!user) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            // Admins and owners bypass all subscription checks
            if (user.role === "admin" || user.role === "owner") {
                return next();
            }

            const userPlan = user.subscription?.plan || "free";
            const validUntil = user.subscription?.validUntil;

            // Check if plan has expired
            if (userPlan !== "free" && validUntil && new Date() > new Date(validUntil)) {
                return res.status(403).json({
                    error: "Subscription Expired",
                    code: "SUBSCRIPTION_EXPIRED",
                    message: "Gói cước của bạn đã hết hạn. Vui lòng gia hạn để tiếp tục sử dụng."
                });
            }

            // If specific plans are required, check if user matches
            if (requiredPlans.length > 0 && !requiredPlans.includes(userPlan)) {
                // Special case: Pro Plus users can access Pro features
                if (requiredPlans.includes("pro") && userPlan === "pro_plus") {
                    return next();
                }

                return res.status(403).json({
                    error: "Upgrade Required",
                    code: "UPGRADE_REQUIRED",
                    message: "Tính năng này yêu cầu gói " + requiredPlans.join(" hoặc ") + ".",
                    requiredPlans
                });
            }

            next();
        } catch (error) {
            console.error("[SubscriptionGuard] Error:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    };
};
