import userModel from '../../model/user.js';
import {
  buildTelegramDeepLink,
  buildTelegramStartPayload,
  getTelegramConfig,
  hashTelegramPayload,
  sendTelegramMessage,
} from '../../services/telegram.js';
import { normalizeTelegramPreferences } from './telegram-preferences.helpers.js';

function requireAuthedUser(req, res) {
  if (req.auth?.type !== 'user' || !req.auth?.userId) {
    const fallbackUserId = req.user?.sub || req.user?._id;
    if (fallbackUserId) return String(fallbackUserId);
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return String(req.auth.userId);
}

export const getTelegramStatus = async (req, res) => {
  try {
    const userId = requireAuthedUser(req, res);
    if (!userId) return;

    const { botUsername, enabled } = getTelegramConfig();
    const user = await userModel.findById(userId).select('telegram');
    if (!user?._id) return res.status(404).json({ error: 'User not found' });

    const tg = user.telegram || {};
    return res.status(200).json({
      enabled,
      bot_username: botUsername || '',
      linked: Boolean(tg.isActive && tg.chatId),
      chat_id_masked: tg.chatId ? `***${String(tg.chatId).slice(-4)}` : '',
      username: tg.username || '',
      first_name: tg.firstName || '',
      linked_at: tg.linkedAt || null,
      preferences: normalizeTelegramPreferences(tg.preferences),
      has_pending_link: Boolean(
        tg.pendingLinkTokenHash && tg.pendingLinkExpiresAt && new Date(tg.pendingLinkExpiresAt).getTime() > Date.now(),
      ),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const startTelegramLink = async (req, res) => {
  try {
    const userId = requireAuthedUser(req, res);
    if (!userId) return;

    const { botUsername, enabled } = getTelegramConfig();
    if (!enabled || !botUsername) {
      return res.status(400).json({ error: 'Telegram bot is not configured' });
    }

    const payload = buildTelegramStartPayload();
    const payloadHash = hashTelegramPayload(payload);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const updated = await userModel
      .findByIdAndUpdate(
        userId,
        {
          $set: {
            'telegram.pendingLinkTokenHash': payloadHash,
            'telegram.pendingLinkExpiresAt': expiresAt,
            'telegram.preferences': normalizeTelegramPreferences(req.body?.preferences),
          },
        },
        { new: true },
      )
      .select('_id telegram.pendingLinkExpiresAt');

    if (!updated?._id) return res.status(404).json({ error: 'User not found' });

    return res.status(200).json({
      ok: true,
      expires_at: updated.telegram?.pendingLinkExpiresAt || expiresAt,
      bot_deep_link: buildTelegramDeepLink({ botUsername, payload }),
      start_payload: payload,
      instruction: 'Open the deep link and press Start in Telegram bot to finish linking.',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTelegramPreferences = async (req, res) => {
  try {
    const userId = requireAuthedUser(req, res);
    if (!userId) return;

    const preferences = normalizeTelegramPreferences(req.body?.preferences);
    const user = await userModel
      .findByIdAndUpdate(
        userId,
        { $set: { 'telegram.preferences': preferences } },
        { new: true },
      )
      .select('_id telegram.preferences');

    if (!user?._id) return res.status(404).json({ error: 'User not found' });
    return res
      .status(200)
      .json({ ok: true, preferences: normalizeTelegramPreferences(user.telegram?.preferences) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendTelegramTest = async (req, res) => {
  try {
    const userId = requireAuthedUser(req, res);
    if (!userId) return;

    const user = await userModel.findById(userId).select('username telegram');
    if (!user?._id) return res.status(404).json({ error: 'User not found' });

    const chatId = String(user.telegram?.chatId || '');
    if (!user.telegram?.isActive || !chatId) {
      return res.status(400).json({ error: 'Telegram is not linked' });
    }

    const result = await sendTelegramMessage({
      chatId,
      text: `✓ Telegram connected for <b>${String(user.username || 'user')}</b>\nTime: ${new Date().toISOString()}`,
    });

    if (!result.ok) {
      return res.status(502).json({ ok: false, error: result.error || 'Failed to send test message' });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const unlinkTelegram = async (req, res) => {
  try {
    const userId = requireAuthedUser(req, res);
    if (!userId) return;

    const user = await userModel
      .findByIdAndUpdate(
        userId,
        {
          $set: {
            'telegram.chatId': '',
            'telegram.telegramUserId': '',
            'telegram.username': '',
            'telegram.firstName': '',
            'telegram.linkedAt': null,
            'telegram.isActive': false,
            'telegram.pendingLinkTokenHash': '',
            'telegram.pendingLinkExpiresAt': null,
          },
        },
        { new: true },
      )
      .select('_id');

    if (!user?._id) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
