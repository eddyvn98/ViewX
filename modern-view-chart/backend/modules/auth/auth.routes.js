import { Router } from "express";
import { issueWsTicket, login, logout, refresh, revokeSessions } from "./auth.controller.js";

const router = new Router();

router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/revoke", revokeSessions);
router.get("/ws-ticket", issueWsTicket);

export default router;
