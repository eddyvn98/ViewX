export function normalizeTelegramPreferences(input) {
  const source = input && typeof input === "object" ? input : {};
  return {
    signals: source.signals !== false,
    orderEvents: source.orderEvents !== false,
    alertHits: source.alertHits !== false,
    system: source.system === true,
  };
}
