import { IChartApi, ILineSeriesApi, SeriesMarker, Time } from 'lightweight-charts';

/**
 * Mẫu Indicator Chuẩn ViewX
 * 1. Khởi tạo series trong constructor
 * 2. Tách biệt logic tính toán và logic hiển thị
 * 3. Hỗ trợ cập nhật real-time dữ liệu nến
 */
export class BaseIndicator {
    protected series: ILineSeriesApi | null = null;

    constructor(protected chart: IChartApi, color: string, title: string) {
        this.series = chart.addLineSeries({
            color,
            lineWidth: 2,
            title,
            priceScaleId: 'right', // Hoặc 'indicator-scale' nếu dùng sub-chart
        });
    }

    // Logic tính toán chuyên biệt (luôn giữ dưới 50 dòng)
    updateData(data: { time: Time, value: number }[]) {
        if (this.series) {
            this.series.setData(data);
        }
    }

    destroy() {
        if (this.series) {
            this.chart.removeSeries(this.series);
        }
    }
}
