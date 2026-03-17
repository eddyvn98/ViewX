# Pro/Free Runtime Design (MT5 Extension Model)

## Product Intent
- Free users use the web app as a TradingView-like experience with server-fed market data.
- Pro users unlock MT5 execution/data via a local extension bridge; the web remains UI-first.

## Current Enforcement Added
- Frontend entitlements are derived from role/plan in local session payload.
- Free users can still use MT5 and Binance symbols in web charting/trading UX.
- Free write-trade commands are routed to a server-side virtual simulator (no real broker/MT5 execution).
- Pro/trader roles still use the real MT5/bridge execution path.
- Terminal panel is hidden for Free users on desktop and mobile.
- Default new workspace/chart source is now `BINANCE` with `BTCUSDT`.

## Why This Matches the Target
- Free mode remains usable with server market feed plus virtual trading on web.
- Pro mode upgrades to real execution via extension/bridge flow.

## Next Recommended Steps
1. Add explicit `account_tier` in JWT claims from backend (`free`/`pro`) instead of relying on localStorage shape.
2. Introduce `ws_client_mode` handshake (`web_free`, `web_pro_extension`, `service_bridge`) and log/audit by mode.
3. Split MT5 bridge transport:
   - `public-bridge` for internal service tasks only.
   - `pro-extension` channel for user-owned MT5 integration.
4. Add Pro onboarding checks in UI:
   - extension installed
   - extension connected
   - account linked
5. Add feature flags:
   - `NEXT_PUBLIC_ENABLE_PRO_MT5`
   - `WS_ENABLE_MT5_FOR_PRO_ONLY`
