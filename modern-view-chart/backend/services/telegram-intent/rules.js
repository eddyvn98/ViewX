import { stripDiacritics } from "./shared.js";
import {
  parseDeleteIntent,
  parseIndicatorIntent,
  parseMaCrossIntent,
  parsePriceAbsoluteIntent,
  parsePricePercentIntent,
  parseRsiIntent,
} from "./templates.js";

export function parseRuleIntent(text) {
  const trimmed = String(text || "").trim();
  const plain = stripDiacritics(trimmed).toLowerCase();
  const templateInput = plain;
  if (!trimmed) return { type: "unknown", payload: {} };

  if (/^(?:\/)?(?:menu|start)$/i.test(trimmed)) return { type: "show_menu", payload: {} };
  if (/^(?:\/)?(?:m|mn)$/i.test(trimmed) || /^(?:mo|open)\s*menu$/i.test(plain)) return { type: "show_menu", payload: {} };
  if (/^(?:\/)?(?:help|trogiup|huongdan)$/i.test(trimmed) || /^(?:\/)?(?:help|tro giup|huong dan)$/i.test(plain)) {
    return { type: "help", payload: {} };
  }
  if (/^(?:\/)?(?:h|\?)$/i.test(trimmed)) return { type: "help", payload: {} };
  if (/^(?:\/)?(?:alerts?|list)$/i.test(trimmed) || /^(?:danh\s*sach\s*(?:canh\s*bao|alerts?)|list\s*alerts?)$/i.test(plain)) {
    return { type: "list_alerts", payload: {} };
  }
  if (/^(?:\/)?(?:la|ls)$/i.test(trimmed) || /^(?:xem|show|get)\s*(alerts?|canh bao)$/i.test(plain)) {
    return { type: "list_alerts", payload: {} };
  }
  if (/^(?:xoa|huy|delete|clear).{0,16}(tat ca|all).{0,16}(canh bao|alert)/i.test(plain)) {
    return { type: "delete_all_alerts", payload: {} };
  }
  if (/^(?:\/)?(?:da|clr)$/i.test(trimmed) || /^(?:remove)\s*all\s*alerts?$/i.test(plain)) {
    return { type: "delete_all_alerts", payload: {} };
  }
  if (/(bao nhieu|tong|so luong).{0,24}canh bao|canh bao.{0,24}(bao nhieu|hien tai)/i.test(plain)) {
    return { type: "list_alerts", payload: {} };
  }
  if (/matrix|scanner|ma tran|ma_tran/i.test(plain)) {
    const idxMatch = plain.match(/(?:\bso\b|\bindex\b|\b#)?\s*(\d{1,3})/i);
    const rawIndex = idxMatch ? Number(idxMatch[1]) : 0;
    return { type: "show_scanner_matrix", payload: { index: Number.isFinite(rawIndex) && rawIndex > 0 ? rawIndex : 0 } };
  }
  if (/^(?:\/)?(?:mx|sc)$/i.test(trimmed)) return { type: "show_scanner_matrix", payload: { index: 0 } };

  return (
    parseDeleteIntent(templateInput) ||
    parseMaCrossIntent(templateInput) ||
    parseRsiIntent(templateInput) ||
    parseIndicatorIntent(templateInput) ||
    parsePriceAbsoluteIntent(templateInput) ||
    parsePricePercentIntent(templateInput) ||
    { type: "unknown", payload: {} }
  );
}
