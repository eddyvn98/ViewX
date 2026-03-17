import { normalizeUserRole } from "../auth/roles.js";
import { verifyAccessToken } from "../auth/userJwt.js";

const checkLogin = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = verifyAccessToken(token);
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
