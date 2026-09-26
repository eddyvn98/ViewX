import Users from "../../model/user.js";

export function resolveAuthenticatedUserId(auth) {
    const value = auth?.userId ?? auth?.id;
    return typeof value === "string" ? value.trim() : "";
}

/**
 * Update UI preferences for the authenticated user
 * POST /api/user/ui-preferences
 */
export const updateUiPreferences = async (req, res) => {
    try {
        const userId = resolveAuthenticatedUserId(req.auth);
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { voiceAlertsEnabled, voiceAlertsUsePreGeneratedAudio, themeColor } = req.body;

        const user = await Users.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Initialize uiPreferences if not exists
        if (!user.uiPreferences) {
            user.uiPreferences = {};
        }

        // Update fields if provided in request body
        if (typeof voiceAlertsEnabled === 'boolean') {
            user.uiPreferences.voiceAlertsEnabled = voiceAlertsEnabled;
        }
        if (typeof voiceAlertsUsePreGeneratedAudio === 'boolean') {
            user.uiPreferences.voiceAlertsUsePreGeneratedAudio = voiceAlertsUsePreGeneratedAudio;
        }
        if (typeof themeColor === 'string') {
            user.uiPreferences.themeColor = themeColor;
        }

        // Mark as modified if it's a subdocument or Mixed type
        user.markModified('uiPreferences');
        await user.save();

        return res.status(200).json({
            success: true,
            uiPreferences: user.uiPreferences
        });
    } catch (error) {
        console.error("updateUiPreferences.error", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

/**
 * Get UI preferences for the authenticated user
 * GET /api/user/ui-preferences
 */
export const getUiPreferences = async (req, res) => {
    try {
        const userId = resolveAuthenticatedUserId(req.auth);
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const user = await Users.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({
            uiPreferences: user.uiPreferences || {
                voiceAlertsEnabled: true,
                voiceAlertsUsePreGeneratedAudio: true,
                themeColor: 'green'
            }
        });
    } catch (error) {
        console.error("getUiPreferences.error", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
