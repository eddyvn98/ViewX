import { Router } from "express";
import * as User from "./user.controller.js";
import checkLogin from "../../middlewares/checkLogin.js";
import checkAdmin from "../../middlewares/checkAdmin.js";
import { calcBollingerBands, calcRSI } from "../../services/indicators.js";

const router = new Router();
const telegramTemporarilyDisabled = (req, res) => {
  return res.status(503).json({
    ok: false,
    error: "Telegram integration is temporarily disabled",
    code: "telegram_temporarily_disabled",
  });
};

//Get all users
router.route("/").get(checkLogin, User.getListUsers);

//Register
router.route("/register").post(User.createUser);

//Đăng nhập
router.route("/login").post(User.login);

//Xóa user
router.route("/").delete(checkAdmin, User.deleteUser);

//Đổi mật khẩu
router.route("/:id/update-password").put(checkLogin, User.updatePassword);
router.route("/state").get(checkLogin, User.getUserSetupState).put(checkLogin, User.upsertUserSetupState);
router.route("/state/public").get(User.getPublicUserSetupState).put(User.upsertPublicUserSetupState);
router.route("/trade-logs/public").post(User.createPublicTradeLog).patch(User.updatePublicTradeExit);
router.route("/trade-stats/public").get(User.getPublicTradeStats);
router.route("/telegram/status").get(telegramTemporarilyDisabled);
router.route("/telegram/link/start").post(telegramTemporarilyDisabled);
router.route("/telegram/preferences").put(telegramTemporarilyDisabled);
router.route("/telegram/test").post(telegramTemporarilyDisabled);
router.route("/telegram/unlink").post(telegramTemporarilyDisabled);
router.route("/modules").get(checkLogin, User.getUserModules).put(checkLogin, User.upsertUserModules);
router.route("/module-status").get(checkLogin, User.getMyModuleStatus);
router.route("/module-trial/start").post(checkLogin, User.startMyModuleTrial);
router.route("/module-orders").get(checkLogin, User.listMyModuleOrders).post(checkLogin, User.createMyModuleOrder);
router.route("/admin/module-orders").get(checkLogin, User.listAdminModuleOrders);
router.route("/admin/module-stats").get(checkLogin, User.getAdminModuleStats);
router.route("/admin/module-members").get(checkLogin, User.listAdminModuleMembers);
router.route("/admin/module-orders/:orderId/confirm").post(checkLogin, User.confirmAdminModuleOrder);
router.route("/admin/module-orders/:orderId/reject").post(checkLogin, User.rejectAdminModuleOrder);
router.route("/admin/module-members/:userId/extend").post(checkLogin, User.adminExtendMemberModule);
router.route("/admin/module-members/:userId/expire").post(checkLogin, User.adminExpireMemberModule);
router.route("/payments/sepay/webhook").post(User.sepayWebhook);

router.route("/data").post(async (req, res) => {
  const { symbol, interval } = req.body;

  // Check if MT5 symbol (ends with 'm')
  if (symbol.endsWith("m") || symbol.endsWith("M")) {
    // Return empty for now as we don't have MT5 History API
    return res.json([]);
  }

  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=500`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      // If Binance returns error (e.g. invalid symbol), return empty
      return res.json([]);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.route("/prices").get(async (req, res) => {
  const defaultSymbols = ["BTCUSDT", "ETHUSDT", "ADAUSDT", "BNBUSDT", "XRPUSDT"];
  let symbols = defaultSymbols;

  // Check if client sent symbols in query
  if (req.query.symbols) {
    try {
      const parsed = decodeURIComponent(req.query.symbols).split(',');
      // Filter to valid ones (simple regex check or just allow)
      // Also filter out MT5 symbols which we handle differently or just ignore here
      symbols = parsed.filter(s => !s.endsWith('m') && !s.endsWith('M'));
      // Merge defaults if needed, or just replace. Let's merge to ensure defaults always show
      symbols = [...new Set([...defaultSymbols, ...symbols])];
    } catch { }
  }

  try {
    const promises = symbols.map((sym) =>
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`)
        .then(async (response) => {
          if (!response.ok) return null;
          return response.json();
        })
        .catch(() => null)
    );

    const pricesRaw = await Promise.all(promises);
    const prices = pricesRaw.filter(p => p !== null);

    const result = prices.map((r) => ({
      symbol: r.symbol,
      price: parseFloat(r.lastPrice).toFixed(4),
      change: parseFloat(r.priceChangePercent).toFixed(2),
    }));

    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Error fetching market data" });
  }
});

router.route("/symbols").get(async (req, res) => {
  try {
    const response = await fetch("https://api.binance.com/api/v3/exchangeInfo");
    const data = await response.json();

    const binanceSymbols = data.symbols
      .filter((s) => s.symbol.endsWith("USDT") && s.status === "TRADING")
      .map((s) => s.symbol);

    const mt5Symbols = ["XAUUSDm", "BTCUSDm", "ETHUSDm", "EURUSDm", "GBPUSDm"];
    const symbols = [...mt5Symbols, ...binanceSymbols].sort();

    res.json(symbols);
  } catch (err) {
    console.error("Lỗi khi lấy danh sách symbols:", err.message);
    res
      .status(500)
      .json({ error: "Không thể lấy danh sách symbol từ Binance" });
  }
});

router.post("/bollinger", async (req, res) => {
  const { candles } = req.body;
  if (!candles || !Array.isArray(candles)) {
    return res.status(400).json({ error: "Candles is required." });
  }

  try {
    const bands = calcBollingerBands(candles);
    res.json(bands);
  } catch (err) {
    console.error("Lỗi tính BB:", err.message);
    res.status(500).json({ error: "Lỗi tính Bollinger Bands." });
  }
});

// routes/user.js
router.post("/rsi", async (req, res) => {
  const { candles, interval } = req.body;

  if (!candles || !Array.isArray(candles)) {
    return res.status(400).json({ error: "Candles is required." });
  }

  if (!interval || typeof interval !== "string") {
    return res.status(400).json({ error: "Interval is required." });
  }

  try {
    const result = calcRSI(candles);
    res.json(result);
  } catch (err) {
    console.error("❌ Lỗi tính RSI:", err.message);
    res.status(500).json({ error: "Lỗi tính RSI." });
  }
});

export default router;
