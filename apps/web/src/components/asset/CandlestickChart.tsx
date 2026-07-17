"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useTheme } from "next-themes";
import { Bar, AssetIndicators } from "@/lib/market-api";
import { IndicatorState } from "./IndicatorToggle";

// Cores de candles/overlays (mesmos tokens semânticos do app)
const UP_COLOR = "#059669";
const DOWN_COLOR = "#EF4444";
const SMA_COLORS: Record<number, string> = { 20: "#7C3AED", 50: "#D97706", 200: "#0891B2" };
const EMA_COLOR = "#DB2777";
const BOLLINGER_COLOR = "#64748B";
const MACD_COLOR = "#2563EB";
const MACD_SIGNAL_COLOR = "#D97706";
const RSI_COLOR = "#7C3AED";

interface CandlestickChartProps {
  bars: Bar[];
  indicators?: AssetIndicators;
  state: IndicatorState;
}

function toTime(iso: string): UTCTimestamp {
  return Math.floor(new Date(iso).getTime() / 1000) as UTCTimestamp;
}

export function CandlestickChart({ bars, indicators, state }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { resolvedTheme } = useTheme();

  const paneCount = useMemo(
    () => 1 + (state.rsi ? 1 : 0) + (state.macd ? 1 : 0),
    [state.rsi, state.macd]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || bars.length === 0) return;

    const styles = getComputedStyle(document.documentElement);
    const textMuted = styles.getPropertyValue("--text-muted").trim() || "#94A3B8";
    const border = styles.getPropertyValue("--border").trim() || "#E2E8F0";

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: textMuted,
        panes: { separatorColor: border, separatorHoverColor: border },
      },
      grid: {
        vertLines: { color: border, style: 1 },
        horzLines: { color: border, style: 1 },
      },
      rightPriceScale: { borderColor: border },
      timeScale: { borderColor: border, timeVisible: false },
      autoSize: true,
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    // Candles + volume no pane principal
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      borderDownColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
    });
    candleSeries.setData(
      bars.map((b) => ({ time: toTime(b.date), open: b.open, high: b.high, low: b.low, close: b.close }))
    );

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: "volume",
      priceFormat: { type: "volume" },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volumeSeries.setData(
      bars.map((b) => ({
        time: toTime(b.date),
        value: b.volume,
        color: b.close >= b.open ? `${UP_COLOR}66` : `${DOWN_COLOR}66`,
      }))
    );

    const addLine = (
      points: { date: string; value: number | null }[],
      color: string,
      paneIndex = 0,
      lineWidth: 1 | 2 = 2,
      style: number = 0,
    ) => {
      const series = chart.addSeries(
        LineSeries,
        {
          color,
          lineWidth,
          lineStyle: style,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerRadius: 3,
        },
        paneIndex
      );
      series.setData(
        points
          .filter((p) => p.value !== null)
          .map((p) => ({ time: toTime(p.date), value: p.value as number }))
      );
      return series;
    };

    // Overlays no pane principal
    if (indicators) {
      if (state.sma) {
        for (const series of indicators.sma) {
          addLine(series.points, SMA_COLORS[series.period] ?? "#64748B", 0, 1);
        }
      }
      if (state.ema) {
        for (const series of indicators.ema) {
          addLine(series.points, EMA_COLOR, 0, 1);
        }
      }
      if (state.bollinger) {
        addLine(indicators.bollinger.map((p) => ({ date: p.date, value: p.upper })), BOLLINGER_COLOR, 0, 1, 2);
        addLine(indicators.bollinger.map((p) => ({ date: p.date, value: p.middle })), BOLLINGER_COLOR, 0, 1, 0);
        addLine(indicators.bollinger.map((p) => ({ date: p.date, value: p.lower })), BOLLINGER_COLOR, 0, 1, 2);
      }

      // Panes secundários
      let nextPane = 1;
      if (state.rsi) {
        const rsiPane = nextPane++;
        const rsiSeries = addLine(
          indicators.rsi.map((p) => ({ date: p.date, value: p.rsi })),
          RSI_COLOR,
          rsiPane
        );
        rsiSeries.createPriceLine({ price: 70, color: textMuted, lineWidth: 1, lineStyle: 2, title: "70" });
        rsiSeries.createPriceLine({ price: 30, color: textMuted, lineWidth: 1, lineStyle: 2, title: "30" });
      }
      if (state.macd) {
        const macdPane = nextPane++;
        const histSeries = chart.addSeries(
          HistogramSeries,
          { priceLineVisible: false, lastValueVisible: false },
          macdPane
        );
        histSeries.setData(
          indicators.macd
            .filter((p) => p.histogram !== null)
            .map((p) => ({
              time: toTime(p.date),
              value: p.histogram as number,
              color: (p.histogram as number) >= 0 ? `${UP_COLOR}99` : `${DOWN_COLOR}99`,
            }))
        );
        addLine(indicators.macd.map((p) => ({ date: p.date, value: p.macd })), MACD_COLOR, macdPane, 1);
        addLine(indicators.macd.map((p) => ({ date: p.date, value: p.signal })), MACD_SIGNAL_COLOR, macdPane, 1);
      }

      // Pane principal maior que os secundários
      const panes = chart.panes();
      if (panes.length > 1) {
        panes[0].setStretchFactor(3);
        for (let i = 1; i < panes.length; i++) panes[i].setStretchFactor(1);
      }
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, indicators, state, resolvedTheme]);

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{ height: 360 + (paneCount - 1) * 110 }}
      role="img"
      aria-label={
        bars.length
          ? `Gráfico de candles com ${bars.length} períodos; último fechamento ${bars[bars.length - 1].close}`
          : "Gráfico de candles sem dados"
      }
    />
  );
}
