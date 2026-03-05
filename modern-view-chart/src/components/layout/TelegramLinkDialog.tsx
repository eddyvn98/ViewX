import React from "react";

type TelegramPreferences = {
  signals: boolean;
  orderEvents: boolean;
  alertHits: boolean;
  system: boolean;
};

type TelegramStatus = {
  enabled: boolean;
  bot_username: string;
  linked: boolean;
  chat_id_masked: string;
  username: string;
  first_name: string;
  linked_at: string | null;
  preferences: TelegramPreferences;
  has_pending_link: boolean;
};

const defaultPreferences: TelegramPreferences = {
  signals: true,
  orderEvents: true,
  alertHits: true,
  system: false,
};

function getAuthHeaders(): Record<string, string> {
  const token = (typeof window !== "undefined" ? localStorage.getItem("auth_access_token") : "") || "";
  const auth = String(token).trim();
  if (!auth) return {};
  return { authorization: `Bearer ${auth}` };
}

export function TelegramLinkDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [status, setStatus] = React.useState<TelegramStatus | null>(null);
  const [preferences, setPreferences] = React.useState<TelegramPreferences>(defaultPreferences);

  const loadStatus = React.useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/user/telegram/status", {
        method: "GET",
        headers: {
          "content-type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.error || "Failed to load Telegram status");
        return;
      }
      setStatus(data as TelegramStatus);
      setPreferences((data as TelegramStatus).preferences || defaultPreferences);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load Telegram status");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    void loadStatus();
  }, [open, loadStatus]);

  const onConnect = React.useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/user/telegram/link/start", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({ preferences }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.error || "Failed to start Telegram link");
        return;
      }
      const deepLink = String(data?.bot_deep_link || "");
      if (deepLink && typeof window !== "undefined") {
        window.open(deepLink, "_blank", "noopener,noreferrer");
      }
      setMessage("Opened Telegram bot. Press Start in bot, then click Refresh.");
      await loadStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to start Telegram link");
    } finally {
      setLoading(false);
    }
  }, [loadStatus, preferences]);

  const onSavePreferences = React.useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/user/telegram/preferences", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({ preferences }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.error || "Failed to save preferences");
        return;
      }
      setMessage("Preferences saved.");
      await loadStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save preferences");
    } finally {
      setLoading(false);
    }
  }, [loadStatus, preferences]);

  const onSendTest = React.useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/user/telegram/test", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.error || "Failed to send test message");
        return;
      }
      setMessage("Test message sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to send test message");
    } finally {
      setLoading(false);
    }
  }, []);

  const onUnlink = React.useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/user/telegram/unlink", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.error || "Failed to unlink Telegram");
        return;
      }
      setMessage("Telegram unlinked.");
      await loadStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to unlink Telegram");
    } finally {
      setLoading(false);
    }
  }, [loadStatus]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[220] bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-xl">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Telegram Notifications</div>
            <div className="text-[11px] text-muted-foreground">
              Link personal Telegram to receive private alerts.
            </div>
          </div>
          <button onClick={onClose} className="text-xs px-2 py-1 rounded hover:bg-secondary/70">
            Close
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-xs text-muted-foreground">
            Status:{" "}
            <span className={status?.linked ? "text-emerald-500 font-semibold" : "text-amber-500 font-semibold"}>
              {status?.linked ? "Connected" : "Not connected"}
            </span>
            {status?.chat_id_masked ? ` (${status.chat_id_masked})` : ""}
          </div>

          <div className="text-xs text-muted-foreground">
            Bot: <span className="text-foreground">{status?.bot_username ? `@${status.bot_username}` : "Not configured"}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferences.signals}
                onChange={(e) => setPreferences((s) => ({ ...s, signals: e.target.checked }))}
              />
              Signals
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferences.orderEvents}
                onChange={(e) => setPreferences((s) => ({ ...s, orderEvents: e.target.checked }))}
              />
              Order Events
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferences.alertHits}
                onChange={(e) => setPreferences((s) => ({ ...s, alertHits: e.target.checked }))}
              />
              Alert Hits
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={preferences.system}
                onChange={(e) => setPreferences((s) => ({ ...s, system: e.target.checked }))}
              />
              System
            </label>
          </div>

          {message ? <div className="text-xs text-primary">{message}</div> : null}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={onConnect}
              disabled={loading || !status?.enabled}
              className="px-3 py-1.5 rounded text-xs bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-50"
            >
              Connect Telegram
            </button>
            <button
              onClick={loadStatus}
              disabled={loading}
              className="px-3 py-1.5 rounded text-xs bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              onClick={onSavePreferences}
              disabled={loading}
              className="px-3 py-1.5 rounded text-xs bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50"
            >
              Save Preferences
            </button>
            <button
              onClick={onSendTest}
              disabled={loading || !status?.linked}
              className="px-3 py-1.5 rounded text-xs bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 disabled:opacity-50"
            >
              Send Test
            </button>
            <button
              onClick={onUnlink}
              disabled={loading || !status?.linked}
              className="px-3 py-1.5 rounded text-xs bg-red-500/15 text-red-500 hover:bg-red-500/25 disabled:opacity-50"
            >
              Unlink
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
