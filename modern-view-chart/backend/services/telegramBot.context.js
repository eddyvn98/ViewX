import { createTelegramBotMarketData } from "./telegramBot.marketData.js";
import { createTelegramBotRenderers } from "./telegramBot.renderers.js";
import { normalizeSymbol, timeframeToFeedInterval, normalizeMatrixTimeframe, buildMatrixScopeKey, formatPrice, formatTimestamp, escapeHtml, escapeDot, escapeXml } from "./telegramBot.helpers.js";
import { getStrategies, getSignals, getVirtualPositions } from "./telegramBot.state.js";
import { getScopedMt5Price } from "../websocket/mt5Scope.js";
import { mt5Prices } from "../websocket/index.js";
import { getVietnamGoldQuotes, getVietnamGoldCandles } from "./vnGoldService.js";
import { getVangTodayLatestQuotes, getVangTodayCandles } from "./vangTodayService.js";
import { candleBuffers } from "../websocket/handlers/subscribeHandler.js";
import {
  sendTelegramPhoto,
  sendTelegramPhotoBuffer,
  sendTelegramDocument,
  sendTelegramDocumentBuffer,
} from "./telegram.js";

export const { fetchCurrentPrice, fetchCandles } = createTelegramBotMarketData({
  normalizeSymbol,
  timeframeToFeedInterval,
  getScopedMt5Price,
  mt5Prices,
  getVietnamGoldQuotes,
  getVangTodayLatestQuotes,
  getVietnamGoldCandles,
  getVangTodayCandles,
  candleBuffers,
});

export const {
  renderSignalsText,
  summarizeScannerSignals,
  renderScannerMatrixText,
  sendScannerMatrixSnapshot,
} = createTelegramBotRenderers({
  escapeHtml,
  escapeDot,
  escapeXml,
  formatTimestamp,
  formatPrice,
  getStrategies,
  getSignals,
  getVirtualPositions,
  normalizeSymbol,
  normalizeMatrixTimeframe,
  buildMatrixScopeKey,
  sendTelegramPhotoBuffer,
  sendTelegramDocumentBuffer,
  sendTelegramDocument,
  sendTelegramPhoto,
});
