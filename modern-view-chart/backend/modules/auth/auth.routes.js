import { Router } from "express";
import {
  googleLogin,
  issueWsTicket,
  login,
  logout,
  refresh,
  revokeSessions,
} from "./auth.controller.js";

const router = new Router();
const telegramTemporarilyDisabled = (req, res) => {
  return res.status(503).json({
    ok: false,
    error: "Telegram integration is temporarily disabled",
    code: "telegram_temporarily_disabled",
  });
};

router.post("/login", login);
router.post("/google", googleLogin);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/revoke", revokeSessions);
router.get("/ws-ticket", issueWsTicket);
router.post("/telegram/webhook", telegramTemporarilyDisabled);
router.post("/telegram/webhook/setup", telegramTemporarilyDisabled);
router.get("/telegram/webhook/info", telegramTemporarilyDisabled);

export default router;
