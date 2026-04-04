# Mindmap Tính Năng AI (ViewX)

Mở file này trong VSCode để đọc. Nếu bạn dùng extension Mermaid/Markdown Preview Enhanced thì mindmap sẽ hiển thị trực quan.

```mermaid
mindmap
  root((AI trong ViewX))
    Kích hoạt
      Biến môi trường Backend
        AI_ENABLED=1
        GEMINI_API_KEY=...
        GEMINI_MODEL=gemini-2.5-flash
      Biến môi trường Frontend
        NEXT_PUBLIC_AI_ENABLED=true
      Docker
        docker compose --profile staging up -d --build backend frontend
    AI Bridge Backend
      Endpoint
        POST /api/ai/bridge/task
        GET /api/ai/bridge/history
        GET /api/ai/bridge/pending
        POST /api/ai/bridge/result
      Chế độ Direct
        Gọi Gemini generateContent
      Chế độ Fallback
        Queue pending/result
      Tách theo người dùng
        Queue theo actor
        History theo actor
        Kiểm tra quyền sở hữu task
    Credit AI Chat
      Quy tắc
        100 lượt chat khi kích hoạt module ai_assistant
        Trừ 1 credit khi source=chat và AI trả lời thành công
        Lỗi hoặc timeout thì không trừ
      API
        GET /api/user/ai-credits
      Hiển thị UI
        Badge Credits trong tab AI Chat
    Frontend AI
      Tab AI Chat
        Gửi prompt source=chat
        Poll history
        Hiển thị log hệ thống
      AI Analyzer
        PRE_TRADE
        POST_TRADE
        Parse JSON reasoning
      AI Guard Heuristic
        Lọc tín hiệu
        Chấm confidence
        Gợi ý rủi ro
    Pricing và Module
      Module ai_assistant
        Kích hoạt qua order hoặc trial
        Quản lý moduleAccess
      Luồng Admin
        Xác nhận order
        Cộng credits
    Kiểm thử nhanh
      Health
        GET /api/health
      Smoke test AI
        POST /api/ai/bridge/task source=system
      Kiểm tra credits
        GET /api/user/ai-credits
      Chat test
        source=chat cần user auth
```

## Cách sử dụng nhanh

1. Bật biến môi trường AI trong `.env`.
2. Deploy lại Docker với profile `staging`.
3. Đăng nhập user đã có module `ai_assistant`.
4. Mở tab AI Chat và kiểm tra badge `Credits`.
5. Gửi 1 câu chat để xác nhận credit giảm 1 sau khi AI trả lời thành công.

## Lệnh test mẫu (PowerShell)

```powershell
# Health
Invoke-RestMethod http://127.0.0.1:18091/api/health

# AI smoke (service token)
$token=(Get-Content .env | Select-String '^ACCESS_TOKEN=' | % { $_.Line.Substring(13) })
$headers=@{ Authorization = "Bearer $token"; "Content-Type"="application/json" }
$body='{"prompt":"Trả lời chính xác: AI smoke test OK","source":"system","timeout":60000}'
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:18091/api/ai/bridge/task -Headers $headers -Body $body
```

