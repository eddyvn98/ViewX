import { Router } from "express";
import {
  googleLogin,
  inspectTelegramWebhook,
  issueWsTicket,
  login,
  logout,
  refresh,
  revokeSessions,
  setupTelegramWebhook,
  telegramWebhook,
} from "./auth.controller.js";

const router = new Router();

router.post("/login", login);
router.post("/google", googleLogin);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/revoke", revokeSessions);
router.get("/ws-ticket", issueWsTicket);
router.post("/telegram/webhook", telegramWebhook);
router.post("/telegram/webhook/setup", setupTelegramWebhook);
router.get("/telegram/webhook/info", inspectTelegramWebhook);

export default router;
