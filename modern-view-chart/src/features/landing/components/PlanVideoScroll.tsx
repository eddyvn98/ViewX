'use client';

import React, { useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useRouter } from '@/i18n/routing';

interface FeatureSlide {
    id: string;
    title: string;
    description: string;
    videoUrl?: string;
    poster?: string;
    color: string;
}

const PLAN_DATA: Record<string, FeatureSlide[]> = {
    free: [
        { id: 'f1', title: 'Không giới hạn cảnh báo', description: 'Đừng để lỡ cơ hội! Hệ thống cảnh báo giá realtime của chúng tôi không giới hạn số lượng, hoạt động 24/7 ngay cả khi bạn tắt trình duyệt. Nhận thông báo tức thì qua Web, Desktop và Telegram.', color: 'bg-slate-900', videoUrl: '/videos/free_b1.mp4', poster: '/images/features/unlimited_alerts_preview.png' },
        { id: 'f2', title: 'Đa biểu đồ trên mỗi tab', description: 'Tối ưu hóa không gian làm việc của bạn. Mở đồng thời nhiều biểu đồ trên cùng một tab, hỗ trợ đồng bộ khung thời gian và con trỏ chuột. Một trải nghiệm đa nhiệm thực thụ vượt xa mọi nền tảng khác.', color: 'bg-slate-800', videoUrl: '/videos/free_b2.mp4', poster: '/images/features/multi_chart_preview.png' },
        { id: 'f3', title: 'Không giới hạn chỉ báo', description: 'Quyền năng phân tích tuyệt đối trong tay bạn. Thêm bao nhiêu chỉ báo kỹ thuật tùy thích trên một biểu đồ đơn nhất. Phối hợp MA, RSI, MACD và các chỉ báo SMC mà không cần lo lắng về chi phí nâng cấp.', color: 'bg-slate-900', videoUrl: '/videos/free_b3.mp4', poster: '/images/features/unlimited_indicators_preview.png' },
        { id: 'f4', title: 'Tạo chiến lược dễ dàng', description: 'Số hóa tư duy giao dịch chỉ trong vài phút. Giao diện thiết kế Logic trực quan giúp bạn xây dựng bộ quy tắc vào lệnh - chốt lời - cắt lỗ mà không cần biết lập trình.', color: 'bg-slate-800', videoUrl: '/videos/free_b4.mp4', poster: '/images/features/strategy_builder_preview.png' },
        { id: 'f5', title: 'Bảng tín hiệu độc quyền', description: 'Cái nhìn toàn cảnh về thị trường. Bảng Matrix quét hàng trăm mã giao dịch đồng thời trên đa khung thời gian, lọc ra những tín hiệu hội tụ mạnh mẽ nhất theo chiến lược của riêng bạn.', color: 'bg-slate-900', videoUrl: '/videos/free_b5.mp4', poster: '/images/features/signal_matrix_preview.png' },
        { id: 'f6', title: 'Dashboard đánh giá', description: 'Biến dữ liệu thành lợi nhuận. Hệ thống thống kê chuyên sâu giúp bạn nhìn thấu hiệu suất của chiến lược, từ tỷ lệ thắng đến đường cong tăng trưởng vốn ảo trước khi quyết định giao dịch thật.', color: 'bg-slate-800', videoUrl: '', poster: '/images/features/performance_dashboard_preview.png' },
        { id: 'f7', title: 'Lớp hiển thị thông minh', description: 'Thị giác hóa cấu trúc thị trường. Các lớp Overlay tự động nhận diện vùng Cung - Cầu, thanh khoản và các vùng giá quan trọng, giúp bạn đưa ra quyết định dựa trên dữ liệu thay vì cảm xúc.', color: 'bg-slate-900', videoUrl: '', poster: '/images/features/smart_overlay_preview.png' },
        { id: 'f8', title: 'Nến Kim Cương độc quyền', description: 'Công nghệ lọc nhiễu đỉnh cao. Khác với nến Nhật truyền thống, nến Diamond tập trung vào biến động giá thực tế, giúp bạn giữ lệnh lâu hơn trong xu hướng và thoát lệnh kịp thời khi thị trường đảo chiều.', color: 'bg-slate-800', videoUrl: '', poster: '/images/features/diamond_candles_preview.png' },
    ],
    pro: [
        { id: 'p1', title: 'Kết nối MT5 Extension', description: 'Cầu nối hoàn hảo giữa Phân tích và Thực thi. Chỉ với một cú click, toàn bộ dữ liệu từ MT5 local của bạn sẽ được truyền tải mượt mà lên nền tảng Web hiện đại.', color: 'bg-emerald-900', videoUrl: '', poster: '/images/features/mt5_extension_preview.png' },
        { id: 'p2', title: 'Đồng bộ Symbol & Data', description: 'Chính xác trên từng Tick giá. Dữ liệu nến và danh sách mã giao dịch (Symbols) được lấy trực tiếp từ Broker của bạn thông qua MT5, đảm bảo không có sai lệch giữa phân tích và thực tế.', color: 'bg-emerald-800', videoUrl: '', poster: '/images/features/symbol_sync_preview.png' },
        { id: 'p3', title: 'Web Terminal Account', description: 'Mọi thứ bạn cần trên một màn hình. Quản lý số dư, theo dõi các vị thế đang mở và quản lý lệnh chờ trực tiếp trên giao diện Web chuẩn TradingView thay vì cửa sổ MT5 lỗi thời.', color: 'bg-emerald-900', videoUrl: '', poster: '/images/features/web_terminal_preview.png' },
        { id: 'p4', title: 'Workflow Thao tác nhanh', description: 'Tốc độ là lợi thế cạnh tranh. Quy trình vào lệnh và quản lý SL/TP được tối ưu hóa chỉ với phím tắt và cử chỉ vuốt chạm, đặc biệt hiệu quả cho các trader trường phái Scalping.', color: 'bg-emerald-800', videoUrl: '', poster: '/images/features/fast_workflow_preview.png' },
        { id: 'p5', title: 'Thay thế MT5 truyền thống', description: 'Tạm biệt những cú click chuột rườm rà. Bạn vẫn dùng Broker cũ nhưng với một trải nghiệm người dùng đẳng cấp hơn, mượt mà hơn và đầy đủ tính năng hiện đại của năm 2026.', color: 'bg-emerald-900', videoUrl: '', poster: '/images/features/modern_trading_preview.png' },
    ],
    'pro-plus': [
        { id: 'pp1', title: 'Bao gồm toàn bộ tính năng Pro', description: 'Sở hữu nền tảng Web Trading mạnh mẽ nhất kết hợp cùng sức mạnh từ trí tuệ nhân tạo thế hệ mới của Vivutrade.', color: 'bg-amber-900', videoUrl: '', poster: '/images/features/pro_plus_all_preview.png' },
        { id: 'pp2', title: 'Phân tích AI chuyên sâu', description: 'Người cộng sự thông minh kề vai sát cánh. AI sẽ phân tích ngữ cảnh thị trường, giải thích nguyên nhân giá chạy và đưa ra mức độ tự tin (Confidence Score) cho mỗi thiết lập giao dịch.', color: 'bg-amber-800', videoUrl: '', poster: '/images/features/ai_analysis_preview.png' },
        { id: 'pp3', title: 'Tối ưu Rule & Quản trị rủi ro', description: 'AI không chỉ phân tích, nó còn học hỏi. Dựa trên lịch sử của bạn, AI sẽ đề xuất cải thiện các quy tắc vào lệnh và tính toán khối lượng Lot tối ưu để bảo vệ vốn một cách khoa học nhất.', color: 'bg-amber-900', videoUrl: '', poster: '/images/features/ai_optimization_preview.png' },
        { id: 'pp4', title: 'Hiệu suất theo ngữ cảnh', description: 'Thấu hiểu mọi ngóc ngách của thị trường. Hệ thống đánh giá hiệu suất lệnh theo từng phiên giao dịch (Á, Âu, Mỹ) và mức độ biến động (ATR), giúp bạn biết mình mạnh nhất ở điều kiện nào.', color: 'bg-amber-800', videoUrl: '', poster: '/images/features/ai_performance_preview.png' },
        { id: 'pp5', title: 'Bộ công cụ Power User', description: 'Đặc quyền dành riêng cho chuyên gia. Tiếp cận các module quét tín hiệu AI nâng cao, tích hợp Webhook tùy biến và các tính năng thử nghiệm sớm nhất của đội ngũ Vivutrade.', color: 'bg-amber-900', videoUrl: '', poster: '/images/features/power_user_preview.png' },
    ]
};

export function PlanVideoScroll({ planKey }: { planKey: string }) {
    const slides = PLAN_DATA[planKey] || [];
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const router = useRouter();

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const index = Math.round(scrollRef.current.scrollTop / window.innerHeight);
        setActiveIndex(index);
    };

    const getBrandColor = () => {
        if (planKey === 'free') return 'bg-slate-600';
        if (planKey === 'pro') return 'bg-emerald-600';
        return 'bg-amber-600'; // pro-plus
    };

    const getGlowColor = () => {
        if (planKey === 'free') return 'hsla(215, 16%, 47%, 0.3)';
        if (planKey === 'pro') return 'var(--glow-success)';
        return 'var(--glow-warning)'; // pro-plus
    };

    return (
        <div className="relative h-screen w-full touch-none overflow-hidden selection:bg-primary/30">
            {/* Overlay Navigation */}
            <div className="absolute left-6 top-8 z-50">
                <button 
                   onClick={() => router.back()}
                   className="group flex h-12 w-12 items-center justify-center rounded-full bg-background/20 backdrop-blur-xl text-foreground border border-white/10 transition-all hover:bg-background/40 hover:scale-110 active:scale-95 shadow-ethereal"
                >
                    <ArrowLeft className="h-6 w-6 transition-transform group-hover:-translate-x-1" />
                </button>
            </div>

            {/* Vertical Scroll Container */}
            <div 
                ref={scrollRef}
                onScroll={handleScroll}
                className="h-full w-full snap-y snap-mandatory overflow-y-scroll no-scrollbar scroll-smooth"
            >
                {slides.map((slide, index) => (
                    <section 
                        key={slide.id}
                        className="relative h-screen w-full snap-start overflow-hidden bg-background"
                    >
                        {/* Dynamic Background logic */}
                        <div className={`absolute inset-0 opacity-20 ${slide.color} transition-colors duration-1000`} />
                        
                        {/* Video or Image Background */}
                        {slide.poster ? (
                            <div className="absolute inset-0 h-full w-full">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img 
                                    src={slide.poster} 
                                    alt={slide.title}
                                    className="h-full w-full object-cover opacity-60 contrast-[1.05] brightness-[0.9]"
                                />
                                {slide.videoUrl && (
                                    <video 
                                        autoPlay 
                                        loop 
                                        muted 
                                        playsInline
                                        className="absolute inset-0 h-full w-full object-cover opacity-100"
                                    >
                                        <source src={slide.videoUrl} type="video/mp4" />
                                    </video>
                                )}
                            </div>
                        ) : slide.videoUrl && (
                            <video 
                                autoPlay 
                                loop 
                                muted 
                                playsInline
                                className="absolute inset-0 h-full w-full object-cover opacity-40 contrast-[1.1] brightness-[0.8]"
                                poster={`/images/poster_${planKey}_${activeIndex}.jpg`}
                            >
                                <source src={slide.videoUrl} type="video/mp4" />
                            </video>
                        )}

                        {/* Content Overlay */}
                        <div className="absolute inset-x-0 bottom-36 z-20 px-8 text-foreground animate-in fade-in slide-in-from-bottom-12 duration-1000 ease-out">
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`h-[2px] w-8 ${getBrandColor()}`} style={{ boxShadow: `0 0 10px ${getGlowColor()}` }} />
                                <span className="text-xs font-bold tracking-[0.2em] uppercase opacity-70">
                                    Feature {index + 1}
                                </span>
                            </div>
                            
                            <h2 className="text-3xl md:text-5xl font-extrabold mb-5 leading-[1.1] tracking-tight">
                                <span className="block">{slide.title.split(' ')[0]}</span>
                                <span className="block premium-gradient-text">{slide.title.split(' ').slice(1).join(' ')}</span>
                            </h2>
                            
                            <p className="text-base md:text-lg text-muted-foreground/90 max-w-[95%] md:max-w-[75%] font-medium leading-relaxed balance">
                                {slide.description}
                            </p>
                        </div>

                        {/* Premium Gradient bottom */}
                        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/60 to-transparent z-10" />
                    </section>
                ))}
            </div>

            {/* Progress Indicators (TikTok-like) */}
            <div className="absolute right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-4">
                {slides.map((_, i) => (
                    <div 
                        key={i}
                        className={`w-1 rounded-full transition-all duration-500 ${
                            i === activeIndex 
                            ? `h-10 ${getBrandColor()}` 
                            : 'h-2 bg-foreground/10'
                        }`}
                        style={i === activeIndex ? { boxShadow: `0 0 15px ${getGlowColor()}` } : {}}
                    />
                ))}
            </div>

            {/* Bottom Action */}
            <div className="absolute bottom-10 inset-x-0 z-50 px-8 flex justify-center">
                 <button 
                    onClick={() => router.push('/chart')}
                    className={`group relative w-full max-w-md overflow-hidden rounded-2xl ${getBrandColor()} px-8 py-5 text-sm font-bold uppercase tracking-widest text-white transition-all hover:scale-[1.02] active:scale-95`}
                    style={{ boxShadow: `0 0 30px ${getGlowColor()}` }}
                 >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                        Bắt đầu với {planKey.toUpperCase()} ngay
                        <CheckCircle2 className="h-5 w-5" />
                    </span>
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                 </button>
            </div>
        </div>
    );
}


