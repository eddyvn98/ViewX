'use client';

import React from 'react';
import { useUserPlan } from '@/hooks/use-user-plan';
import { cn } from '@/lib/utils';
import {
    Check,
    X,
    Zap,
    Shield,
    Sparkles,
    Bot,
    TrendingUp,
    Bell,
    Globe,
    ArrowRight,
    Crown
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const FEATURES = [
    { name: 'Biểu đồ kỹ thuật (HTML5)', free: true, pro: true, pro_plus: true },
    { name: 'Dữ liệu thời gian thực', free: true, pro: true, pro_plus: true },
    { name: 'Chỉ báo kỹ thuật cơ bản', free: true, pro: true, pro_plus: true },
    { name: 'Lưu trữ bố cục biểu đồ', free: true, pro: true, pro_plus: true },
    { name: 'Giao dịch thật (MT5 Bridge)', free: false, pro: true, pro_plus: true },
    { name: 'Thông báo Telegram (Giá/Tín hiệu)', free: false, pro: true, pro_plus: true },
    { name: 'Điều khiển lệnh qua Telegram', free: false, pro: true, pro_plus: true },
    { name: 'Tín hiệu chiến lược tự động', free: false, pro: true, pro_plus: true },
    { name: 'Phân tích thị trường AI', free: false, pro: false, pro_plus: true },
    { name: 'Trợ lý ảo Gemini AI 2.0', free: false, pro: false, pro_plus: true },
    { name: 'Backtest chiến lược với AI', free: false, pro: false, pro_plus: true },
];

export default function PricingPage() {
    const { plan, isAuthenticated } = useUserPlan();

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-primary/30 py-20 px-4 overflow-hidden relative">
            {/* Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-purple-600/5 blur-[150px] rounded-full pointer-events-none" />

            <div className="max-w-6xl mx-auto relative z-10">
                {/* Header */}
                <div className="text-center mb-20">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent italic">
                            CHỌN GÓI CỦA BẠN
                        </h1>
                        <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto font-medium">
                            Nâng tầm trải nghiệm giao dịch với các công cụ chuyên nghiệp và trí tuệ nhân tạo hàng đầu.
                        </p>
                    </motion.div>
                </div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
                    {/* FREE PLAN */}
                    <div className={cn(
                        "relative group rounded-3xl p-8 border border-white/5 bg-white/[0.02] backdrop-blur-xl transition-all duration-500 hover:border-white/10",
                        plan === 'free' && isAuthenticated && "ring-2 ring-slate-500/50 bg-slate-500/5 border-slate-500/20"
                    )}>
                        {plan === 'free' && isAuthenticated && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-slate-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
                                Gói hiện tại
                            </div>
                        )}
                        <div className="mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Shield className="text-slate-400" size={24} />
                            </div>
                            <h2 className="text-2xl font-black italic tracking-tight">FREE</h2>
                            <div className="flex items-baseline gap-1 mt-2">
                                <span className="text-4xl font-black italic">0đ</span>
                                <span className="text-muted-foreground text-sm font-bold uppercase tracking-widest">/ vĩnh viễn</span>
                            </div>
                        </div>
                        <ul className="space-y-4 mb-10">
                            <FeatureItem text="Biểu đồ HTML5 siêu mượt" active={true} />
                            <FeatureItem text="Dữ liệu Real-time" active={true} />
                            <FeatureItem text="Chỉ báo cơ bản" active={true} />
                            <FeatureItem text="Giao dịch thật" active={false} />
                            <FeatureItem text="Thông báo Telegram" active={false} />
                        </ul>
                        <Button variant="outline" className="w-full h-12 rounded-2xl font-black italic tracking-widest border-white/10 hover:bg-white/5">
                            SỬ DỤNG MIỄN PHÍ
                        </Button>
                    </div>

                    {/* PRO PLAN */}
                    <div className={cn(
                        "relative group rounded-3xl p-8 border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-xl transition-all duration-500 hover:border-emerald-500/40 shadow-2xl shadow-emerald-500/10",
                        plan === 'pro' && isAuthenticated && "ring-2 ring-emerald-500"
                    )}>
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-emerald-500/20">
                            {plan === 'pro' && isAuthenticated ? "Gói hiện tại" : "Phổ biến nhất"}
                        </div>
                        <div className="mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Zap className="text-emerald-500" size={24} />
                            </div>
                            <h2 className="text-2xl font-black italic tracking-tight">PRO</h2>
                            <div className="flex items-baseline gap-1 mt-2">
                                <span className="text-4xl font-black italic text-emerald-500">30k</span>
                                <span className="text-muted-foreground text-sm font-bold uppercase tracking-widest">/ tháng</span>
                            </div>
                        </div>
                        <ul className="space-y-4 mb-10">
                            <FeatureItem text="Tất cả tính năng FREE" active={true} />
                            <FeatureItem text="Giao dịch thật qua MT5 Bridge" active={true} />
                            <FeatureItem text="Thông báo giá Telegram" active={true} />
                            <FeatureItem text="Điều lệnh trực tiếp TMA" active={true} />
                            <FeatureItem text="Tín hiệu chiến lược tự động" active={true} />
                        </ul>
                        <Button className="w-full h-12 rounded-2xl font-black italic tracking-widest bg-emerald-500 hover:bg-emerald-600 text-black shadow-lg shadow-emerald-500/20">
                            NÂNG CẤP NGAY
                        </Button>
                    </div>

                    {/* PRO PLUS PLAN */}
                    <div className={cn(
                        "relative group rounded-3xl p-8 border border-amber-500/20 bg-amber-500/5 backdrop-blur-xl transition-all duration-500 hover:border-amber-500/40 shadow-2xl shadow-amber-500/10",
                        plan === 'pro_plus' && isAuthenticated && "ring-2 ring-amber-500"
                    )}>
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-amber-500/20">
                            {plan === 'pro_plus' && isAuthenticated ? "Gói hiện tại" : "Công nghệ AI AI"}
                        </div>
                        <div className="mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Sparkles className="text-amber-500" size={24} />
                            </div>
                            <h2 className="text-2xl font-black italic tracking-tight">PRO PLUS</h2>
                            <div className="flex items-baseline gap-1 mt-2">
                                <span className="text-4xl font-black italic text-amber-500">100k</span>
                                <span className="text-muted-foreground text-sm font-bold uppercase tracking-widest">/ tháng</span>
                            </div>
                        </div>
                        <ul className="space-y-4 mb-10">
                            <FeatureItem text="Tất cả tính năng PRO" active={true} />
                            <FeatureItem text="Trợ lý ảo phân tích Gemini 2.0" active={true} />
                            <FeatureItem text="Chat tư vấn đầu tư 24/7" active={true} />
                            <FeatureItem text="Backtest chiến lược AI" active={true} />
                            <FeatureItem text="Tối ưu danh mục tự động" active={true} />
                        </ul>
                        <Button className="w-full h-12 rounded-2xl font-black italic tracking-widest bg-amber-500 hover:bg-amber-600 text-black shadow-lg shadow-amber-500/20">
                            TRẢI NGHIỆM AI
                        </Button>
                    </div>
                </div>

                {/* Detailed Comparison */}
                <div className="hidden md:block">
                    <h2 className="text-3xl font-black italic tracking-tighter mb-10 text-center">SO SÁNH CHI TIẾT</h2>
                    <div className="rounded-3xl border border-white/5 bg-white/[0.01] backdrop-blur-2xl overflow-hidden shadow-2xl">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="p-6 text-sm font-bold uppercase tracking-widest text-muted-foreground">Tính năng</th>
                                    <th className="p-6 text-sm font-bold uppercase tracking-widest text-center text-slate-400">FREE</th>
                                    <th className="p-6 text-sm font-bold uppercase tracking-widest text-center text-emerald-500">PRO</th>
                                    <th className="p-6 text-sm font-bold uppercase tracking-widest text-center text-amber-500">PRO PLUS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {FEATURES.map((f, i) => (
                                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="p-6 text-sm font-medium">{f.name}</td>
                                        <td className="p-6 text-center">
                                            {f.free ? <Check size={18} className="mx-auto text-emerald-500" /> : <X size={18} className="mx-auto text-red-500/30" />}
                                        </td>
                                        <td className="p-6 text-center">
                                            {f.pro ? <Check size={18} className="mx-auto text-emerald-500" /> : <X size={18} className="mx-auto text-red-500/30" />}
                                        </td>
                                        <td className="p-6 text-center">
                                            {f.pro_plus ? <Check size={18} className="mx-auto text-amber-500" /> : <X size={18} className="mx-auto text-red-500/30" />}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* FAQ / Simple CTA */}
                <div className="mt-20 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/5 bg-white/5 text-sm font-bold text-muted-foreground cursor-pointer hover:bg-white/10 transition-all">
                        <Bot size={16} className="text-blue-500" />
                        Có câu hỏi? Chat ngay với hỗ trợ
                    </div>
                </div>
            </div>
        </div>
    );
}

function FeatureItem({ text, active }: { text: string; active: boolean }) {
    return (
        <li className={cn(
            "flex items-center gap-3 text-sm font-medium",
            active ? "text-foreground" : "text-muted-foreground/40"
        )}>
            <div className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                active ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/5 text-red-500/20"
            )}>
                {active ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
            </div>
            {text}
        </li>
    );
}
