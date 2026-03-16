import Express from "express";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { normalizeUserRole } from "../auth/roles.js";

const router = Express.Router();

router.use(cookieParser());

const checkLogin = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = jwt.verify(token, process.env.JWT);
    const userId = String(result?.sub || result?._id || "").trim();
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.user = result;
    req.auth = {
      type: "user",
      userId,
      role: normalizeUserRole(result?.role),
      sessionVersion: Number.isFinite(Number(result?.sv)) ? Number(result.sv) : 1,
    };

    next();
  } catch {
    res.status(401).json({ error: "Chua dang nhap" });
  }
};

export default checkLogin;
