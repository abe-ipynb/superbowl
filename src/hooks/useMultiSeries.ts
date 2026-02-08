import { useEffect, useRef, type RefObject } from 'react';
import { createChart, LineSeries, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import type { OutcomeSeries } from '../lib/types';
import { etTickFormatter, etTooltipFormatter } from '../lib/timeFormat';

const COLORS = ['#2563EB', '#DC2626', '#16A34A', '#D97706', '#7C3AED'];

interface SeriesState {
  series: ISeriesApi<'Line'>;
  lastLen: number;
  firstTs: number;
}

export function useMultiSeries(containerRef: RefObject<HTMLDivElement | null>, outcomeSeries: OutcomeSeries[]) {
  const chartRef = useRef<IChartApi | null>(null);
  const seriesMapRef = useRef<Map<string, SeriesState>>(new Map());

  // Create chart once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { color: '#FFFFFF' },
        textColor: '#6B7280',
        fontFamily: 'Inter, sans-serif',
      },
      grid: {
        vertLines: { color: '#F3F4F6' },
        horzLines: { color: '#F3F4F6' },
      },
      width: el.clientWidth,
      height: el.clientHeight,
      rightPriceScale: {
        borderColor: '#E5E7EB',
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#E5E7EB',
        tickMarkFormatter: etTickFormatter,
      },
      localization: {
        timeFormatter: etTooltipFormatter,
      },
      crosshair: {
        horzLine: { color: '#9CA3AF' },
        vertLine: { color: '#9CA3AF' },
      },
    });

    chartRef.current = chart;

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) chart.resize(width, height);
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesMapRef.current.clear();
    };
  }, [containerRef]);

  // Sync series with outcomeSeries data
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    for (let i = 0; i < outcomeSeries.length; i++) {
      const os = outcomeSeries[i];
      const color = COLORS[i % COLORS.length];
      let state = seriesMapRef.current.get(os.marketId);

      // Create series if it doesn't exist yet
      if (!state) {
        const series = chart.addSeries(LineSeries, {
          color,
          lineWidth: 2,
          priceFormat: {
            type: 'custom',
            formatter: (price: number) => `${Math.round(price * 100)}¢`,
          },
          autoscaleInfoProvider: () => ({
            priceRange: { minValue: 0, maxValue: 1 },
          }),
        });
        state = { series, lastLen: 0, firstTs: 0 };
        seriesMapRef.current.set(os.marketId, state);
      }

      if (os.ticks.length === 0) continue;

      const firstTs = os.ticks[0].timestamp;
      const wasReplaced = firstTs !== state.firstTs;

      if (wasReplaced || state.lastLen === 0) {
        const data = os.ticks.map(t => ({
          time: Math.floor(t.timestamp / 1000) as UTCTimestamp,
          value: t.price,
        }));
        state.series.setData(data);
        state.lastLen = os.ticks.length;
        state.firstTs = firstTs;
      } else if (os.ticks.length > state.lastLen) {
        for (let j = state.lastLen; j < os.ticks.length; j++) {
          state.series.update({
            time: Math.floor(os.ticks[j].timestamp / 1000) as UTCTimestamp,
            value: os.ticks[j].price,
          });
        }
        state.lastLen = os.ticks.length;
      }
    }
  }, [outcomeSeries]);
}

export { COLORS };
