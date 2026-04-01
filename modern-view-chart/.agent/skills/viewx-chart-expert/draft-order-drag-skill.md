# Skill Note: Draft Order Drag (Entry/SL/TP)

## Muc tieu
- Tao va thao tac lenh nhap tren chart:
  - Bam `BUY/SELL` de tao draft line.
  - Keo `SL/TP` de tao line SL/TP theo dung huong.
  - Keo `Entry` de chuyen tu market sang pending (`isMarket=false`).
  - Bam `Confirm` de gui lenh va xoa draft.

## File chinh
- `src/features/chart/components/ChartContainer.tsx`
- `src/features/chart/hooks/use-chart-interaction.ts`
- `src/features/chart/hooks/interaction/pointer-handlers.ts`
- `src/features/chart/components/order-line-tags/tag-interactions.ts`
- `src/features/chart/logic/tag-renderer-factory.ts`
- `src/features/chart/logic/tag-renderer-visuals.ts`
- `src/features/chart/logic/tag-renderer-visuals.draft.ts`
- `src/features/terminal/components/OrderForm.tsx`

## Flow dung
1. Start draft
- Nguon tao draft: `ChartTradingOverlay` (BUY/SELL tren chart) hoac `OrderForm`.
- Draft can co:
  - `symbol`, `type`, `volume`
  - `isMarket=true` khi vua tao
  - `sl=0`, `tp=0` neu chua set

2. Drag line
- `SL/TP`:
  - Keo moi tao gia tri.
  - Neu chua keo thi khong gui SL/TP.
  - Validate theo side:
    - Buy: `SL < Entry < TP`
    - Sell: `TP < Entry < SL`
- `Entry`:
  - Keo Entry thi set `price` moi va `isMarket=false`.

3. Confirm
- Bam `Confirm` tren draft group:
  - Validate SL/TP.
  - Build payload `mt5_command/order`.
  - Gui qua `sendMessage`.
  - `setDraftOrder(null)` de clear draft.

## Cac loi da gap va cach fix
1. Khong keo duoc Entry/SL/TP
- Nguyen nhan goc:
  - Toa do drag map sai series/container nen `coordinateToPrice()` ra `null`.
  - Chart type custom co the khong map toa do gia on dinh.
- Fix:
  - Dung `coordinateSeries` (candlestick marker series) de convert toa do<->gia.
  - Dung `priceContainerRef` cho he toa do gia.
  - Bat event pointer o capture + document level de tranh bi chart nuot event.

2. Kéo o vung lot khong phan hoi Entry
- Nguyen nhan:
  - `lot-container` bi gan `data-type="volume"` nhung khong co logic drag volume.
- Fix:
  - Gan lai `lot-container` thanh `data-type="entry"` de keo duoc Entry.

3. Bam Confirm khong co tac dung
- Nguyen nhan:
  - `confirm-btn` tren draft tag khong co handler.
- Fix:
  - Add handler trong `tag-interactions.ts`:
    - validate
    - gui payload
    - clear draft

4. Draft bi clear ngoai y muon
- Nguyen nhan:
  - `OrderForm` clear `draftOrder` khi `isDrafting=false`.
- Fix:
  - Chi sync draft tu `OrderForm` khi dang drafting thuc su.

## Checklist test nhanh
1. Tao draft
- Bam BUY/SELL -> thay `draft-group`.

2. Drag TP
- Keo `TP` -> thay `draft-tp` + line TP.

3. Drag SL
- Keo `SL` -> thay `draft-sl` + line SL.

4. Drag Entry
- Keo tren `lot` hoac `price-box` -> Entry line di chuyen.
- Sau drag Entry, draft phai o pending mode (`isMarket=false` trong state).

5. Confirm
- Bam `Confirm` -> draft group bien mat.
- Kiem tra payload gui lenh co:
  - `command: "order"`
  - `is_market` dung voi state
  - `price/sl/tp` dung theo case.

## Script smoke test goi y (Playwright)
- Kiem tra TP drag:
  - tao draft
  - drag `.tp-btn[data-ticket="draft"]`
  - assert `window order-line-drag` > 0
  - assert ton tai `[data-tag-id="draft-tp"]`

- Kiem tra confirm:
  - tao draft
  - click `[data-tag-id="draft-group"] .confirm-btn`
  - assert khong con `[data-tag-id="draft-group"]`

## Ghi chu tai su dung
- Neu doi chart type/custom series, uu tien giu nguyen `coordinateSeries` de map gia.
- Neu sua UI draft-group, giu:
  - `data-draggable`, `data-type`, `data-ticket`
  - class `.tp-btn`, `.sl-btn`, `.confirm-btn`, `.lot-container`, `.price-box`
- Neu thay doi flow confirm, test lai ca desktop + mobile (portrait/landscape).
