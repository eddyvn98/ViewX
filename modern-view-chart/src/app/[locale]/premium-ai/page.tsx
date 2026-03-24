import Image from "next/image";
import { Link } from "@/i18n/routing";
import { ArrowLeft } from "lucide-react";
import { useLocale } from "next-intl";

export default function PremiumAIVisionPage() {
  const locale = useLocale();

  if (locale === 'en') {
    return <EnglishContent />;
  }

  return <VietnameseContent />;
}

function EnglishContent() {
  return (
    <div className="h-[100dvh] overflow-y-auto bg-gradient-to-b from-slate-50 via-white to-sky-50/30 text-slate-900 [font-family:Outfit,Segoe_UI,Arial,sans-serif] selection:bg-sky-500/30 custom-scrollbar">
      {/* Abstract Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/10 blur-[120px] rounded-full" />
      </div>

      <main className="relative max-w-4xl mx-auto py-16 px-6 sm:px-8">
        <Link 
          href={"/" as any} 
          className="group inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-10"
        >
          <div className="p-2 rounded-full bg-white group-hover:bg-slate-50 transition-colors mr-3 border border-slate-200">
            <ArrowLeft className="w-4 h-4" />
          </div>
          Back to Home
        </Link>
        
        <header className="mb-12">
          <div className="inline-flex items-center px-3 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold tracking-wide mb-6 uppercase">
            Coming Soon
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight leading-tight">
            Exclusive AI Assistant: <br/> Visual Technical Analysis
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-2xl font-medium">
            A quantum leap in trading technology. AI does not just read data—it <strong>sees</strong> exactly what you see on the chart.
          </p>
        </header>
        
        <div className="rounded-3xl overflow-hidden mb-16 border border-sky-100 shadow-2xl ring-1 ring-slate-900/5 bg-white group">
          <div className="relative w-full aspect-[16/9]">
            <Image 
              src="/images/premium_ai_mockup_v2.png" 
              alt="Premium AI Vision Mockup" 
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {/* Subtle overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent opacity-60" />
            <div className="absolute bottom-6 left-6 right-6">
              <div className="inline-block backdrop-blur-md bg-white/90 border border-slate-200 px-4 py-2 rounded-xl shadow-lg">
                <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                  Premium AI Panel Preview
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-16 text-lg leading-relaxed text-slate-600">
          <section>
            <h2 className="text-3xl font-black text-slate-900 mb-6 tracking-tight">The Current Flaw in Trading AI</h2>
            <div className="prose prose-lg text-slate-600 max-w-none">
              <p>
                Most AI tools in the trading market today suffer from a massive limitation: <strong>Spatial Blindness</strong>.
                When a trader asks ChatGPT or Claude: <em>"Why did my Gold trade hit Stoploss?"</em>, the trader has to painstakingly describe: <em>"I'm using Heikin-Ashi on the 15m timeframe, price touched 2340 while RSI was at 72..."</em>. 
              </p>
              <p>
                This manual approach is inaccurate, time-consuming, and most importantly, it loses 80% of the most critical trading information: <strong>Price Action, candlestick patterns, and wave formations</strong>.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-3xl font-black text-slate-900 mb-6 tracking-tight">The Vision: AI That "Sees" The Chart</h2>
            <div className="prose prose-lg text-slate-600 max-w-none mb-8">
              <p>
                With the upcoming Premium update, the Vivutrade system won't just send dry numbers. It will directly <strong>"take a snapshot"</strong> of the chart exactly from your current perspective.
              </p>
              <p>
                The magic lies in our core technology: <strong>Dynamic Vision Context</strong>. The AI engine is deeply integrated into the interface and operates on a dual flow:
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 mt-8">
              <div className="bg-white p-8 rounded-3xl border border-sky-100 hover:border-blue-200 hover:shadow-xl transition-all shadow-sm">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6 text-2xl shadow-sm border border-blue-100">📊</div>
                <h3 className="text-xl font-black text-slate-900 mb-3">Penetrating Context Gathering</h3>
                <p className="text-slate-600 text-base font-medium">The system silently scans and identifies your candle types, active indicators (SMA, Bollinger Bands, MACD...), and exact price levels at that precise millisecond.</p>
              </div>
              <div className="bg-white p-8 rounded-3xl border border-sky-100 hover:border-purple-200 hover:shadow-xl transition-all shadow-sm">
                <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-6 text-2xl shadow-sm border border-purple-100">👁️</div>
                <h3 className="text-xl font-black text-slate-900 mb-3">Visual Perception Activation</h3>
                <p className="text-slate-600 text-base font-medium">Instantly captures a crystal-clear optical snapshot of your chart the moment you ask a question, feeding it directly into the AI's analysis chamber.</p>
              </div>
            </div>
          </section>

          <section className="relative overflow-hidden bg-gradient-to-br from-indigo-900 to-blue-950 p-8 md:p-10 rounded-3xl shadow-2xl border border-indigo-500/30">
            <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
              <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2zm0 3.8l7.1 14.2H4.9L12 5.8z"/></svg>
            </div>
            <h3 className="text-2xl font-black text-white mb-8 flex items-center gap-3">
              <span className="text-yellow-400 text-3xl drop-shadow-md">💡</span> 
              Exclusive Premium Experiences
            </h3>
            <ul className="space-y-6 relative z-10">
              <li className="flex gap-4 items-start bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-lg">
                <div className="shrink-0 bg-blue-500 text-white font-black px-3 py-1.5 rounded-lg text-sm mt-1 shadow-sm">Mon AM</div>
                <div>
                  <p className="text-indigo-50 font-medium">
                    You draw a manual Trendline and enable RSI. Click "Analyze". AI instantly replies:
                    <br/><span className="italic text-indigo-300">"The upward Trendline you just drew beautifully converges with the RSI oversold zone. This is an excellent Long Entry with a backtested 72% win rate on the H1 timeframe."</span>
                  </p>
                </div>
              </li>
              <li className="flex gap-4 items-start bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-lg">
                <div className="shrink-0 bg-purple-500 text-white font-black px-3 py-1.5 rounded-lg text-sm mt-1 shadow-sm">Thu AM</div>
                <div>
                  <p className="text-indigo-50 font-medium">
                    You remove RSI and use Bollinger Bands alone. Click "Analyze". The AI observes and warns:
                    <br/><span className="italic text-indigo-300">"The 3rd candle just aggressively pierced the Lower Band. However, this red candle lacks accompanying Volume. Be extremely cautious of a Bear Trap."</span>
                  </p>
                </div>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-3xl font-black text-slate-900 mb-8 tracking-tight">Core Benefits of Premium AI</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-4 bg-slate-50 w-14 h-14 rounded-2xl flex items-center justify-center border border-slate-100">💬</div>
                <h4 className="text-lg font-black text-slate-900 mb-2">Chat with the Chart</h4>
                <p className="text-sm text-slate-600 font-medium">A modern AI side-panel hugging the right edge, assisting you at all times.</p>
              </div>
              <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-4 bg-slate-50 w-14 h-14 rounded-2xl flex items-center justify-center border border-slate-100">📈</div>
                <h4 className="text-lg font-black text-slate-900 mb-2">Adapts to Any Setup</h4>
                <p className="text-sm text-slate-600 font-medium">No matter how unique your layout is, the AI can see and decode 100% of it.</p>
              </div>
              <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-4 bg-slate-50 w-14 h-14 rounded-2xl flex items-center justify-center border border-slate-100">🔍</div>
                <h4 className="text-lg font-black text-slate-900 mb-2">Trade Autopsy</h4>
                <p className="text-sm text-slate-600 font-medium">Upload screenshots of trades that hit Stoploss, and the AI will detail exact mistakes.</p>
              </div>
            </div>
          </section>

          <div className="mt-16 pt-8 border-t border-slate-200 text-center">
             <div className="inline-block bg-white px-6 py-4 rounded-2xl border border-sky-100 shadow-sm">
                <p className="text-sm font-bold text-slate-700 flex items-center justify-center">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 mr-3 animate-pulse"></span>
                  Currently in Development - Limited Early Premium registration opening soon.
                </p>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function VietnameseContent() {
  return (
    <div className="h-[100dvh] overflow-y-auto bg-gradient-to-b from-slate-50 via-white to-sky-50/30 text-slate-900 [font-family:Outfit,Segoe_UI,Arial,sans-serif] selection:bg-sky-500/30 custom-scrollbar">
      {/* Abstract Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/10 blur-[120px] rounded-full" />
      </div>

      <main className="relative max-w-4xl mx-auto py-16 px-6 sm:px-8">
        <Link 
          href={"/" as any} 
          className="group inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-10"
        >
          <div className="p-2 rounded-full bg-white group-hover:bg-slate-50 transition-colors mr-3 border border-slate-200">
            <ArrowLeft className="w-4 h-4" />
          </div>
          Quay lại trang chủ (Chart)
        </Link>
        
        <header className="mb-12">
          <div className="inline-flex items-center px-3 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold tracking-wide mb-6 uppercase">
            Sắp ra mắt
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight leading-tight">
            Trợ Lý AI Độc Quyền: <br/> Phân Tích Kỹ Thuật Bằng Thị Giác
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-2xl font-medium">
            Bước nhảy vọt trong công nghệ giao dịch. AI không chỉ đọc dữ liệu, mà còn <strong>nhìn thấy</strong> những gì bạn thấy trên biểu đồ.
          </p>
        </header>
        
        <div className="rounded-3xl overflow-hidden mb-16 border border-sky-100 shadow-2xl ring-1 ring-slate-900/5 bg-white group">
          <div className="relative w-full aspect-[16/9]">
            <Image 
              src="/images/premium_ai_mockup_v2.png" 
              alt="Premium AI Vision Mockup" 
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {/* Subtle overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent opacity-60" />
            <div className="absolute bottom-6 left-6 right-6">
              <div className="inline-block backdrop-blur-md bg-white/90 border border-slate-200 px-4 py-2 rounded-xl shadow-lg">
                <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                  Giao diện mẫu của Premium AI Panel
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-16 text-lg leading-relaxed text-slate-600">
          <section>
            <h2 className="text-3xl font-black text-slate-900 mb-6 tracking-tight">Vấn Đề Hiện Tại Của Bot AI Giao Dịch</h2>
            <div className="prose prose-lg text-slate-600 max-w-none">
              <p>
                Đa số các công cụ AI hiện nay trên thị trường giao dịch đều mắc phải một giới hạn cực lớn: <strong>AI bị "mù" không gian</strong>.
                Khi một Trader hỏi AI trên ChatGPT hay Claude: <em>"Tại sao lệnh Vàng này của tôi bị dính Stoploss?"</em>, Trader phải mất công mô tả <em>"Tôi đang dùng nến Heikin-Ashi khung 15m, giá chạm mốc 2340 trong khi RSI đang ở mức 72..."</em>. 
              </p>
              <p>
                Cách làm thủ công này vừa thiếu chính xác (vì con người có thể mô tả thiếu), vừa tốn thời gian, và quan trọng nhất là đánh mất đi 80% thông tin quan trọng nhất của Trading: <strong>Hành vi giá (Price Action), mô hình nến, và Hình thái của sóng</strong>.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-3xl font-black text-slate-900 mb-6 tracking-tight">Tầm Nhìn Hàng Đầu: AI "Nhìn Thấy" Biểu Đồ</h2>
            <div className="prose prose-lg text-slate-600 max-w-none mb-8">
              <p>
                Với bản cập nhật Premium sắp tới, hệ thống của Vivutrade không chỉ gửi các con số khô khan, mà còn trực tiếp <strong>"chụp ảnh"</strong> biểu đồ y như góc nhìn chân thực của bạn lúc này.
              </p>
              <p>
                Sự kỳ diệu nằm ở cốt lõi công nghệ <strong>Cá Nhân Hóa Động (Dynamic Vision Context)</strong>. Cỗ máy AI được tích hợp sâu vào giao diện và hoạt động theo dòng chảy kép:
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 mt-8">
              <div className="bg-white p-8 rounded-3xl border border-sky-100 hover:border-blue-200 hover:shadow-xl transition-all shadow-sm">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6 text-2xl shadow-sm border border-blue-100">📊</div>
                <h3 className="text-xl font-black text-slate-900 mb-3">Thu thập Ngữ Cảnh Xuyên Thấu</h3>
                <p className="text-slate-600 text-base font-medium">Hệ thống ngầm quét và định vị loại nến bạn xài, các Indicator như (SMA, Bollinger Bands, MACD...), và mức giá tham chiếu của từng công cụ ngay tại tíc-tắc đó.</p>
              </div>
              <div className="bg-white p-8 rounded-3xl border border-sky-100 hover:border-purple-200 hover:shadow-xl transition-all shadow-sm">
                <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-6 text-2xl shadow-sm border border-purple-100">👁️</div>
                <h3 className="text-xl font-black text-slate-900 mb-3">Kích Hoạt Nhãn Quan Hình Ảnh</h3>
                <p className="text-slate-600 text-base font-medium">Hệ thống lập tức "chụp" một bức ảnh quang học sắc nét màn hình biểu đồ ngay khoảnh khắc bạn đặt câu hỏi, đưa vào buồng phân tích của AI.</p>
              </div>
            </div>
          </section>

          <section className="relative overflow-hidden bg-gradient-to-br from-indigo-900 to-blue-950 p-8 md:p-10 rounded-3xl shadow-2xl border border-indigo-500/30">
            <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
              <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2zm0 3.8l7.1 14.2H4.9L12 5.8z"/></svg>
            </div>
            <h3 className="text-2xl font-black text-white mb-8 flex items-center gap-3">
              <span className="text-yellow-400 text-3xl drop-shadow-md">💡</span> 
              Trải Nghiệm Độc Quyền Của Cấp Bậc Premium
            </h3>
            <ul className="space-y-6 relative z-10">
              <li className="flex gap-4 items-start bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-lg">
                <div className="shrink-0 bg-blue-500 text-white font-black px-3 py-1.5 rounded-lg text-sm mt-1 shadow-sm">Sáng T2</div>
                <div>
                  <p className="text-indigo-50 font-medium">
                    Bạn đánh một đường Trendline tay và bật RSI. Bấm nút "Phân Tích". AI trả lời ngay lập tức: 
                    <br/><span className="italic text-indigo-300">"Đường Trendline dốc lên bạn vừa vẽ có một vùng hợp lưu tuyệt đẹp với vị trí quá bán của RSI, đây là một Entry Long cực tốt với winrate backtest 72% ở khung H1."</span>
                  </p>
                </div>
              </li>
              <li className="flex gap-4 items-start bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-lg">
                <div className="shrink-0 bg-purple-500 text-white font-black px-3 py-1.5 rounded-lg text-sm mt-1 shadow-sm">Sáng T5</div>
                <div>
                  <p className="text-indigo-50 font-medium">
                    Bạn xóa RSI, dùng độc lập Bollinger Bands. Bấm "Phân Tích". AI có mắt liền báo: 
                    <br/><span className="italic text-indigo-300">"Cây nến thứ 3 vừa thọc thủng dải Lower Band rất mạnh, tuy nhiên nến đỏ này không đi kèm Volume, cực kỳ cẩn thận một cái bẫy Bear Trap."</span>
                  </p>
                </div>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-3xl font-black text-slate-900 mb-8 tracking-tight">Quyền Lợi Cốt Lõi Của Premium AI</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-4 bg-slate-50 w-14 h-14 rounded-2xl flex items-center justify-center border border-slate-100">💬</div>
                <h4 className="text-lg font-black text-slate-900 mb-2">Trò Chuyện Cùng Biểu Đồ</h4>
                <p className="text-sm text-slate-600 font-medium">Một Side-panel AI hiện đại nằm viền sát góc phải, bám theo bạn mọi lúc.</p>
              </div>
              <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-4 bg-slate-50 w-14 h-14 rounded-2xl flex items-center justify-center border border-slate-100">📈</div>
                <h4 className="text-lg font-black text-slate-900 mb-2">Thích Ứng Mọi Setup</h4>
                <p className="text-sm text-slate-600 font-medium">Dù layout của bạn "dị" đến đâu, AI đều nhìn và giải mã được 100%.</p>
              </div>
              <div className="p-6 rounded-3xl bg-white border border-sky-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-3xl mb-4 bg-slate-50 w-14 h-14 rounded-2xl flex items-center justify-center border border-slate-100">🔍</div>
                <h4 className="text-lg font-black text-slate-900 mb-2">Sám Hối Giao Dịch</h4>
                <p className="text-sm text-slate-600 font-medium">Upload hình ảnh những lệnh vừa chạm Stoploss để AI vạch ra những lầm lỗi chi tiết.</p>
              </div>
            </div>
          </section>

          <div className="mt-16 pt-8 border-t border-slate-200 text-center">
             <div className="inline-block bg-white px-6 py-4 rounded-2xl border border-sky-100 shadow-sm">
                <p className="text-sm font-bold text-slate-700 flex items-center justify-center">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500 mr-3 animate-pulse"></span>
                  Giai đoạn phát triển - Sẽ sớm mở đăng ký giới hạn cho các tài khoản Early Premium.
                </p>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}
