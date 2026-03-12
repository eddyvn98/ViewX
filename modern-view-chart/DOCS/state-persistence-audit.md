# State Persistence Audit

Muc tieu: khi user da dang nhap mo lai web thi workspace duoc khoi phuc toi da, khong phai thao tac lai.

| Nhom trang thai | Vi du tren UI | Truoc khi sua | Hien tai | Noi luu |
| --- | --- | --- | --- | --- |
| Watchlist | Danh sach symbol ben phai | Da luu | Da luu | `UserState.state.watchlist` |
| Workspace tabs | `Workspace 1`, tab dang active | Da luu | Da luu | `UserState.state.tabs`, `activeTabId` |
| Chia man hinh | `1x1`, `2x2`, so row/col | Da luu | Da luu | `UserState.state.tabs[*].layoutMode/rows/cols` |
| Cau hinh chart | Symbol, timeframe, source, group, timezone, chart type | Da luu | Da luu | `UserState.state.tabs[*].charts[*]` |
| Subchart eye toggle | An/hien subchart cua chart | Da luu | Da luu | `UserState.state.tabs[*].charts[*].isSubchartVisible` |
| Indicators | Indicator da chon, params, style, visible, pane | Da luu | Da luu | `UserState.state.chartIndicators` |
| Drawings | Line/Fib/Rectangle, visible, locked, params | Da luu | Da luu | `UserState.state.chartDrawings` |
| Alerts | Danh sach alert va trang thai | Da luu | Da luu | `UserState.state.alerts` |
| Layout co ban | Left/right sidebar open, active right tab, terminal visible/collapsed/height | Da luu 1 phan | Da luu day du hon | `UserState.state.ui`, `terminal` |
| Right sidebar width | Resize chieu rong panel phai | Chua luu DB | Da luu DB | `UserState.state.ui.rightSidebarWidth` |
| Strategy tab con | `Signals / My Bot / AI Chat` | Chi state cuc bo | Da luu DB | `UserState.state.ui.strategyPanelView` |
| Signal range | `Ngay / Tuan / Thang` | Chi state cuc bo | Da luu DB | `UserState.state.ui.signalHistoryRange` |
| Watchlist search/filter | `Quick search`, `ALL/CRYPTO/FOREX` | Chi state cuc bo | Da luu DB | `UserState.state.ui.marketListSearchQuery`, `marketListSourceTab` |
| Trade form draft | `market/pending`, `buy/sell`, `volume`, `SL`, `TP` | Chi state cuc bo | Da luu DB | `UserState.state.terminal.orderForm` |
| Strategy builder draft | Dang sua bot nhung chua save | Chi state cuc bo | Da luu DB | `UserState.state.ui.strategyBuilderDraft`, `strategyEditingStrategyId` |
| Strategy definitions | Bot da tao, on/off, AI guard | Chi localStorage | Da luu DB va localStorage | `UserState.state.strategy.strategies` |
| Signal boards | Bang theo doi tin hieu / matrix scanners | Chi localStorage | Da luu DB va localStorage | `UserState.state.strategy.matrixScanners` |
| Virtual positions/signals | Recent signals, vi the ao, so du ao | Chi localStorage | Da luu DB va localStorage | `UserState.state.strategy.*` |
| History markers toggle | Hien/an marker lich su | Chi localStorage | Da luu DB va localStorage | `UserState.state.strategy.showHistoryMarkers` |

## Ghi chu

- Strategy workspace van giu localStorage de khoi phuc nhanh tren cung browser, nhung da duoc mirror them vao DB theo user.
- Public guest state da duoc sua schema de chap nhan `scopeType = "guest"` cho nhanh luu public state khi can.
- Du lieu live runtime nhu gia realtime, account live, positions/orders live tu bridge khong duoc persist vao `UserState`; chung duoc nap lai tu websocket/backend.
