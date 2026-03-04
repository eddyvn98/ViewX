"use client";

import { useEffect, useRef, useState } from "react";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleButtonTheme = "outline" | "filled_blue" | "filled_black";

type Props = {
  className?: string;
  redirectTo?: string;
  theme?: GoogleButtonTheme;
  text?: "signin_with" | "signup_with" | "continue_with";
  size?: "large" | "medium" | "small";
  width?: number;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: GoogleButtonTheme;
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: number;
            },
          ) => void;
        };
      };
    };
  }
}

const GOOGLE_GSI_SRC = "https://accounts.google.com/gsi/client";

export function GoogleSignInButton({
  className = "",
  redirectTo = "/chart",
  theme = "outline",
  text = "continue_with",
  size = "large",
  width = 280,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isHandlingAuthRef = useRef(false);
  const isAuthenticatedRef = useRef(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const existingToken = (localStorage.getItem("auth_access_token") || "").trim();
      if (existingToken) {
        isAuthenticatedRef.current = true;
      }
    }

    let mounted = true;

    const resolveClientId = async (): Promise<string> => {
      try {
        const response = await fetch("/api/auth/google-config", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json().catch(() => null);
          const fromApi = typeof data?.client_id === "string" ? data.client_id.trim() : "";
          if (fromApi) return fromApi;
        }
      } catch {
        // Fallback to public env below.
      }

      const fromPublicEnv = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
      return fromPublicEnv;
    };

    const mountButton = (clientId: string) => {
      if (!window.google?.accounts?.id || !containerRef.current) return;
      containerRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: GoogleCredentialResponse) => {
          if (isAuthenticatedRef.current || isHandlingAuthRef.current) return;
          const idToken = (response?.credential || "").trim();
          if (!idToken) {
            if (isAuthenticatedRef.current) return;
            setError("Khong nhan duoc Google credential.");
            return;
          }

          isHandlingAuthRef.current = true;
          setLoading(true);
          setError("");
          try {
            const res = await fetch("/api/auth/google", {
              method: "POST",
              headers: { "content-type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ id_token: idToken }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.access_token) {
              throw new Error(data?.error || "Dang nhap Google that bai");
            }

            localStorage.setItem("auth_access_token", String(data.access_token));
            localStorage.setItem("auth_user", JSON.stringify(data.user || {}));
            isAuthenticatedRef.current = true;
            window.location.href = redirectTo;
          } catch (e) {
            if (isAuthenticatedRef.current) return;
            const message = e instanceof Error ? e.message : "Dang nhap Google that bai";
            setError(message);
          } finally {
            isHandlingAuthRef.current = false;
            setLoading(false);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        type: "standard",
        theme,
        size,
        text,
        shape: "rectangular",
        logo_alignment: "left",
        width,
      });
    };

    const boot = async () => {
      const clientId = await resolveClientId();
      if (!mounted) return;
      if (!clientId) {
        setError("Google login chua duoc cau hinh.");
        return;
      }

      if (window.google?.accounts?.id) {
        mountButton(clientId);
        return;
      }

      const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_GSI_SRC}"]`);
      if (existing) {
        const onLoad = () => mountButton(clientId);
        existing.addEventListener("load", onLoad, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = GOOGLE_GSI_SRC;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", () => mountButton(clientId), { once: true });
      script.addEventListener("error", () => setError("Khong tai duoc Google Identity script."), { once: true });
      document.head.appendChild(script);
    };

    void boot();

    return () => {
      mounted = false;
    };
  }, [redirectTo, text, theme, size, width]);

  return (
    <div className={className}>
      <div ref={containerRef} />
      {loading ? <p className="mt-2 text-xs text-slate-600">Dang dang nhap...</p> : null}
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
