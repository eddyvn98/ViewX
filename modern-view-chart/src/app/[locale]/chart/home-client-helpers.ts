export const DESKTOP_SCALE_BASE_WIDTH = 1440;
export const DESKTOP_SCALE_BASE_HEIGHT = 900;
export const DESKTOP_BREAKPOINT = 768;
export const DESKTOP_SCALE_HEIGHT_THRESHOLD = 540;

export function resolvePriceDigits(symbol?: string, digits?: number): number {
  if (Number.isFinite(digits)) return Number(digits);
  const s = String(symbol || "").toUpperCase();
  if (s.includes("JPY")) return 3;
  if (s.includes("XAU") || s.includes("XAG")) return 3;
  if (s.includes("USDT") || s.includes("USD")) return 2;
  return 4;
}

export function formatTabPrice(price: number, digits: number): string {
  if (!Number.isFinite(price)) return "--";
  return price.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function getChartHomeLayoutState(viewport: { width: number; height: number }) {
  const isLandscape = viewport.width > viewport.height;
  const isDesktopViewport = viewport.width >= DESKTOP_BREAKPOINT;
  const isHeightConstrainedLandscape =
    isLandscape && viewport.height > 0 && viewport.height < DESKTOP_SCALE_HEIGHT_THRESHOLD;
  const isScaledDesktopMode = isLandscape && (!isDesktopViewport || isHeightConstrainedLandscape);
  const showDesktopLayout = isDesktopViewport || isScaledDesktopMode;
  const showMobileLayout = !showDesktopLayout;
  const showDesktopHeader = showDesktopLayout && !isScaledDesktopMode;
  const showDesktopSidebarRail = showDesktopLayout;
  const desktopScale = isScaledDesktopMode
    ? Math.min(
        viewport.width / DESKTOP_SCALE_BASE_WIDTH,
        viewport.height / DESKTOP_SCALE_BASE_HEIGHT,
        1
      )
    : 1;
  const scaledDesktopOffsetX = isScaledDesktopMode
    ? Math.max((viewport.width - DESKTOP_SCALE_BASE_WIDTH * desktopScale) / 2, 0)
    : 0;
  const scaledDesktopOffsetY = isScaledDesktopMode
    ? Math.max((viewport.height - DESKTOP_SCALE_BASE_HEIGHT * desktopScale) / 2, 0)
    : 0;

  return {
    isLandscape,
    isDesktopViewport,
    isHeightConstrainedLandscape,
    isScaledDesktopMode,
    showDesktopLayout,
    showMobileLayout,
    showDesktopHeader,
    showDesktopSidebarRail,
    desktopScale,
    scaledDesktopOffsetX,
    scaledDesktopOffsetY,
  };
}
