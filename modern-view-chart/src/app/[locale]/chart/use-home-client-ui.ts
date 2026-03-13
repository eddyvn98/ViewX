'use client';

import React from "react";
import { formatTabPrice, resolvePriceDigits } from "./home-client-helpers";

export function useViewportState() {
  const [viewport, setViewport] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const updateViewport = () => {
      const source = window.visualViewport;
      const width = Math.round(source?.width ?? window.innerWidth);
      const height = Math.round(source?.height ?? window.innerHeight);
      setViewport({ width, height });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
    };
  }, []);

  return viewport;
}

export function useKeyboardDismissOnViewportReset(
  isInputFocused: boolean,
  setInputFocused: (value: boolean) => void
) {
  React.useEffect(() => {
    if (!window.visualViewport) return;

    const handleResize = () => {
      const isKeyboardVisible = window.visualViewport!.height < window.innerHeight * 0.85;
      if (!isKeyboardVisible && isInputFocused) {
        setInputFocused(false);
        (document.activeElement as HTMLElement | null)?.blur();
      }
    };

    window.visualViewport.addEventListener("resize", handleResize);
    return () => window.visualViewport?.removeEventListener("resize", handleResize);
  }, [isInputFocused, setInputFocused]);
}

export function useRightSidebarWidth(setRightSidebarWidth: (value: number) => void) {
  React.useEffect(() => {
    const raw = Number(window.localStorage.getItem("right-sidebar-width") || 320);
    if (!Number.isFinite(raw)) return;
    setRightSidebarWidth(raw);
  }, [setRightSidebarWidth]);
}

export function useChartDocumentTitle(params: {
  symbol?: string;
  interval?: string;
  price?: number;
  changePercent?: number;
  digits?: number;
}) {
  const { symbol, interval, price, changePercent, digits } = params;

  React.useEffect(() => {
    const resolvedSymbol = symbol || "XAUUSDm";
    const resolvedInterval = interval || "1";
    const resolvedDigits = resolvePriceDigits(resolvedSymbol, digits);

    if (!Number.isFinite(price)) {
      document.title = `${resolvedSymbol} ${resolvedInterval}m | vivutrade Chart`;
      return;
    }

    const arrow = (changePercent || 0) >= 0 ? "▲" : "▼";
    const pct = `${(changePercent || 0) >= 0 ? "+" : ""}${(changePercent || 0).toFixed(2)}%`;
    document.title = `${resolvedSymbol} ${formatTabPrice(price as number, resolvedDigits)} ${arrow} ${pct} | vivutrade`;
  }, [symbol, interval, price, changePercent, digits]);
}

export function usePanelScrollState(setIsScrollingPanel: (value: boolean) => void) {
  const scrollTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleScroll = React.useCallback(() => {
    setIsScrollingPanel(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrollingPanel(false);
    }, 1500);
  }, [setIsScrollingPanel]);

  React.useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      setIsScrollingPanel(false);
    };
  }, [setIsScrollingPanel]);

  return handleScroll;
}
