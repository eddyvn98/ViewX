import React from "react";
import QRCode from "react-qr-code";

type TelegramPreferences = {
  signals: boolean;
  orderEvents: boolean;
  alertHits: boolean;
  system: boolean;
};

type TelegramStatus = {
  enabled: boolean;
  module_access?: boolean;
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
  const [deepLink, setDeepLink] = React.useState("");
  const [copyState, setCopyState] = React.useState<"idle" | "done" | "error">("idle");

  const linkedAccountLabel = [status?.first_name, status?.username ? `@${status.username}` : ""]
    .filter(Boolean)
    .join(" • ");
  const linkedAtLabel = status?.linked_at
    ? new Date(status.linked_at).toLocaleString("vi-VN", {
        hour12: false,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const loadStatus = React.useCallback(async () => {
    setLoading(true);
    setMessage("");
    setDeepLink("");
    setCopyState("idle");
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
        setMessage(data?.error || "Không tải được trạng thái Telegram");
        return;
      }
      setStatus(data as TelegramStatus);
      setPreferences((data as TelegramStatus).preferences || defaultPreferences);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tải được trạng thái Telegram");
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
    setCopyState("idle");
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
        setMessage(data?.error || "Không thể bắt đầu liên kết Telegram");
        return;
      }
      const nextDeepLink = String(data?.bot_deep_link || "");
      setDeepLink(nextDeepLink);
      if (nextDeepLink && typeof window !== "undefined") {
        window.open(nextDeepLink, "_blank", "noopener,noreferrer");
      }
      setMessage("Đã mở bot Telegram. Hãy bấm Start trong bot hoặc quét QR bên dưới, sau đó quay lại bấm Làm mới.");
      await loadStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể bắt đầu liên kết Telegram");
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
        setMessage(data?.error || "Không lưu được tùy chọn thông báo");
        return;
      }
      setMessage("Đã lưu tùy chọn thông báo.");
      await loadStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không lưu được tùy chọn thông báo");
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
        setMessage(data?.error || "Không gửi được tin nhắn test");
        return;
      }
      setMessage("Đã gửi tin nhắn test tới Telegram.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không gửi được tin nhắn test");
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
        setMessage(data?.error || "Không thể hủy liên kết Telegram");
        return;
      }
      setMessage("Đã hủy liên kết Telegram.");
      await loadStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể hủy liên kết Telegram");
    } finally {
      setLoading(false);
    }
  }, [loadStatus]);

  const onCopyLink = React.useCallback(async () => {
    if (!deepLink || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(deepLink);
      setCopyState("done");
    } catch {
      setCopyState("error");
    }
  }, [deepLink]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Liên kết Telegram</div>
            <div className="text-[11px] text-muted-foreground">
              Kết nối Telegram cá nhân với tài khoản đã mua module trên web.
            </div>
          </div>
          <button onClick={onClose} className="rounded px-2 py-1 text-xs hover:bg-secondary/70">
            Đóng
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <div className="text-xs font-semibold text-foreground">Quy trình kết nối</div>
            <ol className="mt-2 space-y-1 text-[11px] leading-5 text-muted-foreground">
              <li>1. Mua `Telegram Notify` hoặc `Telegram Control` trên web.</li>
              <li>2. Bấm `Mở bot Telegram` hoặc quét QR để mở đúng bot.</li>
              <li>3. Trong Telegram, bấm `Start` để xác nhận liên kết.</li>
              <li>4. Quay lại đây và bấm `Làm mới` để cập nhật trạng thái.</li>
            </ol>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-secondary/20 p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Module</div>
              <div className={status?.module_access ? "mt-1 text-sm font-semibold text-emerald-500" : "mt-1 text-sm font-semibold text-amber-500"}>
                {status?.module_access ? "Đã sẵn sàng" : "Chưa mua module Telegram"}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {status?.module_access ? "Tài khoản này đã có quyền liên kết với bot." : "Cần mua trên web trước khi liên kết với Telegram."}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-secondary/20 p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Liên kết</div>
              <div className={status?.linked ? "mt-1 text-sm font-semibold text-emerald-500" : "mt-1 text-sm font-semibold text-amber-500"}>
                {status?.linked ? "Đã kết nối" : "Chưa kết nối"}
                {status?.chat_id_masked ? ` ${status.chat_id_masked}` : ""}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {status?.linked ? "Bot sẽ gửi tin nhắn về đúng tài khoản Telegram đã liên kết." : "Liên kết một lần để bot nhận đúng tài khoản Telegram của bạn."}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/20 p-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Bot Telegram</span>
              <span className="font-medium text-foreground">{status?.bot_username ? `@${status.bot_username}` : "Chưa cấu hình"}</span>
            </div>
            {status?.linked ? (
              <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                <div>
                  Tài khoản: <span className="text-foreground">{linkedAccountLabel || "Đã liên kết"}</span>
                </div>
                {linkedAtLabel ? (
                  <div>
                    Thời gian liên kết: <span className="text-foreground">{linkedAtLabel}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {status?.module_access === false ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-5 text-amber-100">
              Bạn chưa mua module Telegram trên web, nên bot chưa thể liên kết tài khoản này.
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <div className="text-xs font-semibold text-foreground">Loại thông báo muốn nhận</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={preferences.signals}
                  onChange={(e) => setPreferences((state) => ({ ...state, signals: e.target.checked }))}
                />
                Tín hiệu
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={preferences.orderEvents}
                  onChange={(e) => setPreferences((state) => ({ ...state, orderEvents: e.target.checked }))}
                />
                Lệnh giao dịch
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={preferences.alertHits}
                  onChange={(e) => setPreferences((state) => ({ ...state, alertHits: e.target.checked }))}
                />
                Cảnh báo chạm điều kiện
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={preferences.system}
                  onChange={(e) => setPreferences((state) => ({ ...state, system: e.target.checked }))}
                />
                Hệ thống
              </label>
            </div>
          </div>

          {message ? <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-xs text-primary">{message}</div> : null}

          {deepLink ? (
            <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-3">
              <div className="space-y-1">
                <div className="text-xs font-medium text-foreground">Mở bot Telegram</div>
                <div className="text-[11px] leading-5 text-muted-foreground">
                  Quét QR bằng điện thoại, hoặc mở link trực tiếp trong Telegram. Sau khi vào bot, hãy bấm Start.
                </div>
              </div>
              <div className="flex justify-center rounded-md bg-white p-3">
                <QRCode value={deepLink} size={164} />
              </div>
              <div className="break-all text-[11px] text-muted-foreground">{deepLink}</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={onCopyLink}
                  type="button"
                  className="rounded bg-secondary px-3 py-1.5 text-xs text-foreground hover:bg-secondary/80"
                >
                  {copyState === "done" ? "Đã sao chép" : copyState === "error" ? "Lỗi sao chép" : "Sao chép link"}
                </button>
                <a
                  href={deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-primary/15 px-3 py-1.5 text-xs text-primary hover:bg-primary/25"
                >
                  Mở Telegram
                </a>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={onConnect}
              disabled={loading || !status?.enabled || status?.module_access === false}
              className="rounded bg-primary/15 px-3 py-1.5 text-xs text-primary hover:bg-primary/25 disabled:opacity-50"
            >
              Mở bot Telegram
            </button>
            <button
              onClick={loadStatus}
              disabled={loading}
              className="rounded bg-secondary px-3 py-1.5 text-xs text-foreground hover:bg-secondary/80 disabled:opacity-50"
            >
              Làm mới
            </button>
            <button
              onClick={onSavePreferences}
              disabled={loading}
              className="rounded bg-secondary px-3 py-1.5 text-xs text-foreground hover:bg-secondary/80 disabled:opacity-50"
            >
              Lưu tùy chọn
            </button>
            <button
              onClick={onSendTest}
              disabled={loading || !status?.linked}
              className="rounded bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-500 hover:bg-emerald-500/25 disabled:opacity-50"
            >
              Gửi test
            </button>
            <button
              onClick={onUnlink}
              disabled={loading || !status?.linked}
              className="rounded bg-red-500/15 px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/25 disabled:opacity-50"
            >
              Hủy liên kết
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
