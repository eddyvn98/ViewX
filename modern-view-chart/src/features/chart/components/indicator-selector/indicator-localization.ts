export const INDICATOR_I18N: Record<string, { vi: string; en: string; aliases?: string[] }> = {
    EMA: { vi: 'Đường trung bình lũy thừa', en: 'Exponential Moving Average', aliases: ['ema', 'exponential moving average', 'duong trung binh luy thua'] },
    SuperTrend: { vi: 'Siêu xu hướng', en: 'SuperTrend', aliases: ['supertrend', 'sieu xu huong'] },
    VWAP: { vi: 'Giá trung bình theo khối lượng', en: 'VWAP', aliases: ['vwap', 'volume weighted average price', 'gia trung binh theo khoi luong'] },
    SMA: { vi: 'Đường trung bình đơn giản', en: 'Simple Moving Average', aliases: ['sma', 'simple moving average', 'duong trung binh don gian'] },
    HMA: { vi: 'Đường trung bình Hull', en: 'Hull Moving Average', aliases: ['hma', 'hull moving average', 'duong trung binh hull'] },
    Ichimoku: { vi: 'Mây Ichimoku', en: 'Ichimoku Cloud', aliases: ['ichimoku', 'ichimoku cloud', 'may ichimoku'] },
    SAR: { vi: 'Parabolic SAR', en: 'Parabolic SAR', aliases: ['sar', 'parabolic sar'] },
    RSI: { vi: 'Chỉ số sức mạnh tương đối (RSI)', en: 'Relative Strength Index (RSI)', aliases: ['rsi', 'relative strength index', 'chi so suc manh tuong doi'] },
    Stochastic: { vi: 'Dao động ngẫu nhiên', en: 'Stochastic Oscillator', aliases: ['stochastic', 'stochastic oscillator', 'dao dong ngau nhien'] },
    ADX: { vi: 'Chỉ số định hướng trung bình (ADX)', en: 'Average Directional Index (ADX)', aliases: ['adx', 'average directional index', 'chi so dinh huong trung binh'] },
    MACD: { vi: 'Hội tụ phân kỳ trung bình động (MACD)', en: 'MACD', aliases: ['macd', 'moving average convergence divergence', 'hoi tu phan ky trung binh dong'] },
    BollingerBands: { vi: 'Dải Bollinger', en: 'Bollinger Bands', aliases: ['bollinger', 'bollinger bands', 'dai bollinger'] },
    ATR: { vi: 'Biên độ thực trung bình', en: 'Average True Range', aliases: ['atr', 'average true range', 'bien do thuc trung binh'] },
    TrendLines: { vi: 'Đường xu hướng', en: 'Trend Lines', aliases: ['trend lines', 'duong xu huong'] },
    MarketStructure: { vi: 'Nhãn cấu trúc thị trường', en: 'Market Structure Labels', aliases: ['market structure', 'market structure labels', 'cau truc thi truong'] },
    BreakoutRays: { vi: 'Tia ngang phá vỡ', en: 'Breakout Horizontal Rays', aliases: ['breakout rays', 'breakout horizontal rays', 'tia ngang pha vo'] },
    OrderBlock: { vi: 'Khối lệnh (OB)', en: 'Order Blocks (OB)', aliases: ['order block', 'order blocks', 'khoi lenh', 'ob'] },
    FVG: { vi: 'Khoảng trống giá trị hợp lý (FVG)', en: 'Fair Value Gaps (FVG)', aliases: ['fvg', 'fair value gaps', 'khoang trong gia tri hop ly'] },
    Fibonacci: { vi: 'Thoái lui Fibonacci', en: 'Fibonacci Retracement', aliases: ['fibonacci', 'fibonacci retracement', 'thoai lui fibonacci'] },
    FibonacciExtension: { vi: 'Mở rộng Fibonacci theo xu hướng', en: 'Trend-Based Fibonacci Extension', aliases: ['fibonacci extension', 'trend based fibonacci extension', 'mo rong fibonacci'] },
};

export const CATEGORY_I18N: Record<string, { vi: string; en: string; aliases?: string[] }> = {
    averages: { vi: 'Đường trung bình', en: 'Moving Averages', aliases: ['moving averages', 'duong trung binh'] },
    oscillators: { vi: 'Dao động', en: 'Oscillators', aliases: ['oscillators', 'dao dong'] },
    volatility: { vi: 'Độ biến động', en: 'Volatility Indicators', aliases: ['volatility', 'volatility indicators', 'do bien dong'] },
    'smart-analysis': { vi: 'Phân tích thông minh', en: 'Smart Analysis', aliases: ['smart analysis', 'phan tich thong minh'] },
    fibonacci: { vi: 'Công cụ Fibonacci', en: 'Fibonacci Tools', aliases: ['fibonacci tools', 'cong cu fibonacci'] },
};

export function normalizeSearchText(value: string): string {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}
