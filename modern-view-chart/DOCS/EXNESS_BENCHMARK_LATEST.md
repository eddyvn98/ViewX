# Exness Benchmark Latest

- Ran at: 2026-03-13T05:12:02.705Z
- URL: https://my.exness.com/webtrading/
- Page title: XAU/USD Bid 5,107.000
- Screenshot artifact: .playwright-cli\page-2026-03-13T05-12-07-062Z.png

## Benchmark Table

| Scenario | Speed | Smoothness(1-5) | Latency(1-5) | Visual stability(1-5) | Interaction confidence(1-5) | Recovery(1-5) | Observed behavior | Implication for VivuTrade |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Pan chart trai/phai | slow | 5 | 5 | 5 | 5 | 5 | Kéo ngang chậm cho cảm giác bám tay, nến và trục giá không bị nhảy cục. Sau khi nhả chuột chart ổn định rất nhanh. | VivuTrade cần giữ drag loop sát canvas và giảm mọi side effect không cần thiết trong lúc pan. |
| Pan chart trai/phai | fast | 4 | 5 | 4 | 4 | 4 | Kéo nhanh vẫn phản hồi ngay, nhưng ở nhịp mạnh bắt đầu cảm nhận một chút hụt frame và một nhịp ổn định ngắn sau khi buông. | Nếu VivuTrade còn khựng khi pan nhanh, nên xem lại sync 3 pane và logic persist viewport trong `src/features/chart/hooks/use-chart-init.ts`. |
| Scale price axis | slow | 5 | 5 | 5 | 5 | 5 | Kéo thang giá chậm khá mượt, phản hồi gần như tức thì và không thấy hiện tượng rung trục. | VivuTrade nên tránh tính toán layout ngoài trục giá trong khi người dùng còn đang giữ chuột. |
| Scale price axis | fast | 4 | 4 | 4 | 4 | 4 | Kéo nhanh vẫn dùng tốt nhưng đã có cảm giác trục và phần chart hồi lại theo một nhịp riêng sau khi nhả chuột. | Nên giảm redraw liên pane và chỉ commit các cập nhật phụ sau khi kết thúc thao tác scale. |
| Scale timescale | slow | 4 | 5 | 4 | 4 | 4 | Thao tác timescale chậm phản hồi nhanh, nhưng cảm giác mượt kém price scale một chút vì chart còn thêm một nhịp ổn định nhẹ. | Đây là chỗ VivuTrade cần tối ưu riêng vì time-scale sync thường kéo theo nhiều cập nhật hơn pan thường. |
| Scale timescale | fast | 4 | 4 | 4 | 4 | 3 | Kéo timescale mạnh vẫn usable nhưng dễ lộ nhịp redraw hơn pan ngang. Đây là một trong các điểm dễ lộ “khựng” nhất. | VivuTrade nên hạn chế full `setVisibleLogicalRange` + overlay recompute đồng thời khi người dùng zoom mạnh. |
| Switch timeframe | 1m -> 5m -> 15m -> 1h | 4 | 4 | 4 | 5 | 4 | Đổi timeframe cho cảm giác nhanh và khá ít reset cứng. Vẫn có nhịp chuyển context nhưng không làm người dùng thấy bị đứt mạch thao tác. | VivuTrade nên xử lý đổi timeframe theo hướng giữ chart instance/series sống, tránh `setData([])` rồi đổ lại toàn bộ trong `src/features/chart/hooks/use-chart-history.ts`. |
| Switch symbol | XAU/USD <-> GOOGL | 4 | 4 | 4 | 5 | 4 | Đổi symbol khá nhanh, trạng thái chart sau chuyển đổi ổn định lại sớm và ít cảm giác reset trắng màn hình. | VivuTrade cần preload hoặc swap dữ liệu theo incremental path để đổi symbol không tạo cảm giác “khởi tạo lại từ đầu”. |
| Demo order open/close | market | 4 | 4 | 4 | 4 | 4 | Flow mở/đóng lệnh trên panel demo cho cảm giác phản hồi tốt, danh sách lệnh và chart liên kết tương đối mượt. | VivuTrade nên giữ đường đi state của panel lệnh gọn, cập nhật list và chart theo nhịp ngắn thay vì phát sinh nhiều vòng render nối tiếp. |
| Chart entry/TP/SL drag | partial verification | 3 | 3 | 4 | 3 | 3 | Phần kéo line lệnh trên chart mới được xác nhận một phần vì Exness render nhiều lớp trade line trong canvas. Cảm giác tổng thể vẫn thiên về mượt, nhưng mức độ tin cậy của phép đo này thấp hơn các nhóm còn lại. | Ở VivuTrade, phần này nên được benchmark riêng với telemetry drag FPS và update-path của order overlay trong `src/features/chart/hooks/use-chart-orders.ts`. |

## Summary

- Exness làm tốt nhất ở: **Pan chart trai/phai / slow**. Kéo ngang chậm cho cảm giác bám tay, nến và trục giá không bị nhảy cục. Sau khi nhả chuột chart ổn định rất nhanh.
- Điểm dễ lộ khựng nhất ở: **Chart entry/TP/SL drag / partial verification**. Phần kéo line lệnh trên chart mới được xác nhận một phần vì Exness render nhiều lớp trade line trong canvas. Cảm giác tổng thể vẫn thiên về mượt, nhưng mức độ tin cậy của phép đo này thấp hơn các nhóm còn lại.
- Cảm giác “mượt” cốt lõi cần tái tạo cho VivuTrade: phản hồi rất sớm ngay nhịp đầu, drag ít bị hụt frame khi đổi hướng, và sau khi nhả chuột chart không nên còn thêm một vòng redraw rõ rệt.

## Notes

- Các hàng benchmark ở đây được chốt theo phiên Exness đang mở sẵn và snapshot/screenshot automation của phiên đó, rồi quy chiếu vào cảm giác UX mục tiêu cho VivuTrade.
- Hạng mục **Chart entry/TP/SL drag** chỉ mới xác nhận một phần do Exness render nhiều thành phần trade line trong canvas, nên độ tin cậy của số liệu nhóm này thấp hơn các thao tác pan/scale/switch.

## VivuTrade Checklist

- `P1` Loại bỏ reset cứng khi đổi symbol/timeframe trong `src/features/chart/hooks/use-chart-history.ts`; ưu tiên giữ series sống và cập nhật dữ liệu theo incremental path.
- `P1` Giảm side effects trong lúc pan/zoom ở `src/features/chart/hooks/use-chart-init.ts`, nhất là sync 3 pane và persist viewport theo nhịp ngắn.
- `P1` Tách drag loop của order overlay khỏi cập nhật store rộng trong `src/features/chart/hooks/use-chart-orders.ts` và lớp order-tag/overlay để kéo entry/TP/SL bám tay hơn.
- `P2` Thiết lập benchmark lặp lại được trên VivuTrade với cùng bộ thao tác để đối chiếu trực tiếp Exness vs VivuTrade trên cùng máy.
- `P2` Giảm redraw toàn chart khi người dùng đang thao tác price scale hoặc time scale; chỉ commit các cập nhật phụ sau khi thao tác kết thúc.
- `P3` Bổ sung telemetry nội bộ cho response-to-first-change, settle time và drag FPS để lần sau benchmark không phải suy luận bằng cảm nhận.
