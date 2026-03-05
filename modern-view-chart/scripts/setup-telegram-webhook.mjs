#!/usr/bin/env node
/* eslint-disable no-console */

function readEnv(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function resolveBackendOrigin() {
  return readEnv("BACKEND_ORIGIN", "http://127.0.0.1:8091");
}

function resolveWebhookUrl() {
  const explicit = readEnv("TELEGRAM_WEBHOOK_URL");
  if (explicit) return explicit;

  const base =
    readEnv("APP_PUBLIC_URL") ||
    readEnv("PUBLIC_APP_URL") ||
    readEnv("NEXT_PUBLIC_APP_URL");
  if (!base) return "";
  try {
    const u = new URL(base);
    u.pathname = "/api/auth/telegram/webhook";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return "";
  }
}

async function main() {
  const backendOrigin = resolveBackendOrigin();
  const accessToken = readEnv("ACCESS_TOKEN");
  const webhookUrl = resolveWebhookUrl();

  if (!accessToken) {
    console.error("Missing ACCESS_TOKEN.");
    process.exit(1);
  }
  if (!webhookUrl) {
    console.error("Missing webhook URL. Set TELEGRAM_WEBHOOK_URL or APP_PUBLIC_URL/NEXT_PUBLIC_APP_URL.");
    process.exit(1);
  }

  const endpoint = new URL("/api/auth/telegram/webhook/setup", backendOrigin).toString();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      webhook_url: webhookUrl,
      drop_pending_updates: false,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    console.error("Webhook setup failed:", data?.error || `HTTP ${res.status}`);
    if (data) console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log("Webhook configured successfully.");
  console.log(`Webhook URL: ${data.webhook_url}`);
  if (data.webhook_info) {
    console.log("Webhook info:");
    console.log(JSON.stringify(data.webhook_info, null, 2));
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error?.message || error);
  process.exit(1);
});
