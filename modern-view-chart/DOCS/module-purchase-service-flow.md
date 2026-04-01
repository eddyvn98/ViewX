# Module Purchase Service Flow

```mermaid
mindmap
  root((Module-based Access Flow))
    User
      Open Pricing Page
      Select Needed Modules
        MT5 Trade
        Binance Trade
        Telegram Notify
        Telegram Control
        AI Assistant
      Click Save
    Frontend
      PUT /api/user/modules
        Send Bearer Access Token
        Send modules[]
      Update local auth_user
        plan inferred from modules
        subscription mirrored
      Reconnect WebSocket
        auth payload includes modules
    Backend API
      Auth Guard
        verify JWT access token
        resolve userId
      Upsert User Modules
        normalize modules
        infer plan
        set subscription.validUntil
      Response
        return plan modules subscription
    Backend WebSocket
      Resolve Auth Context
        attach plan modules to client meta
      Command Entitlement Guard
        mt5_command trading -> require mt5_trade
        binance_command trading -> require binance_trade
        expired subscription -> block
        missing module -> block
      Allow or Reject
        allow route to bridge
        reject with module_required code
    Runtime Usage
      Terminal UI
        show MT5 trade features only if mt5_trade
      Trading Actions
        only enabled for purchased modules
      AI Features
        enabled when ai_assistant exists
    Migration
      Script
        scripts/migrations/backfill-user-modules.mjs
      Dry Run
        npm run migrate:modules:dry
      Apply
        npm run migrate:modules:apply
      Note
        Mongo Atlas IP whitelist must allow current server IP
```

