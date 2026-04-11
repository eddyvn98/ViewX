import type { Metadata } from "next";
import { GoldChartClient } from "./GoldChartClient";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Biểu đồ vàng Việt Nam | vivutrade",
    description: "Trang chart vàng riêng từ nhiều nguồn vang.today với chế độ giá mua hoặc giá bán.",
  };
}

export default function GoldChartPage() {
  return <GoldChartClient />;
}

