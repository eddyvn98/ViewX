import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "vivutrade | Trading Chart & Strategy";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px",
          background:
            "linear-gradient(135deg, #eff6ff 0%, #ffffff 45%, #dbeafe 100%)",
          color: "#0f172a",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#1e3a8a",
          }}
        >
          vivutrade
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1 }}>
            Trading Chart & Strategy
          </div>
          <div style={{ fontSize: 30, color: "#334155", maxWidth: 900 }}>
            Realtime chart workspace, strategy matrix monitor và backtest
            analytics.
          </div>
        </div>
        <div style={{ fontSize: 24, color: "#1d4ed8", fontWeight: 600 }}>
          /landing
        </div>
      </div>
    ),
    { ...size }
  );
}
