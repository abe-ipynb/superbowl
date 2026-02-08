import { useEffect, useRef, type RefObject } from 'react';
import { createChart, LineSeries, MismatchDirection, type IChartApi, type ISeriesApi, type IPriceLine, type UTCTimestamp } from 'lightweight-charts';
import type { OutcomeSeries, TimeRange, QuarterMarker } from '../lib/types';
import { etTickFormatter, etTooltipFormatter } from '../lib/timeFormat';
import { dedupTicks } from '../lib/chartUtils';

const COLORS = ['#2563EB', '#DC2626', '#16A34A', '#D97706', '#7C3AED'];

interface SeriesState {
  series: ISeriesApi<'Line'>;
  lastLen: number;
  firstTs: number;
  lastTime: number;
}

export function useMultiSeries(containerRef: RefObject<HTMLDivElement | null>, outcomeSeries: OutcomeSeries[], timeRange: TimeRange = 'live', quarterMarkers: QuarterMarker[] = []) {
  const chartRef = useRef<IChartApi | null>(null);
  const seriesMapRef = useRef<Map<string, SeriesState>>(new Map());
  const tempPriceLinesRef = useRef<Map<string, { series: ISeriesApi<'Line'>; line: IPriceLine }>>(new Map());

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
        scaleMargins: { top: 0, bottom: 0 },
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
        horzLine: { color: '#9CA3AF', labelVisible: false },
        vertLine: { color: '#9CA3AF' },
      },
    });

    chartRef.current = chart;

    // Guard: applyOptions triggers _internal_updateCrosshair which re-fires
    // this handler, causing infinite recursion without a re-entrancy guard.
    let inHandler = false;
    chart.subscribeCrosshairMove((param) => {
      if (inHandler) return;
      inHandler = true;
      try {
        const sMap = seriesMapRef.current;
        const tempLines = tempPriceLinesRef.current;

        // Remove previous temp price lines
        for (const [, { series, line }] of tempLines) {
          try { series.removePriceLine(line); } catch { /* already removed */ }
        }
        tempLines.clear();

        if (param.time && param.logical !== undefined) {
          // Hide live labels on all series
          for (const state of sMap.values()) {
            state.series.applyOptions({ lastValueVisible: false, priceLineVisible: false });
          }

          // Create colored price labels for each series at hovered time.
          // param.seriesData may only contain the nearest series, so use
          // dataByIndex on each series to get values for all lines.
          let i = 0;
          for (const [marketId, state] of sMap) {
            const data = state.series.dataByIndex(param.logical, MismatchDirection.NearestLeft);
            if (data && 'value' in data) {
              const color = COLORS[i % COLORS.length];
              const priceLine = state.series.createPriceLine({
                price: (data as { value: number }).value,
                color: color,
                lineVisible: false,
                axisLabelVisible: true,
                axisLabelColor: color,
                axisLabelTextColor: '#FFFFFF',
              });
              tempLines.set(marketId, { series: state.series, line: priceLine });
            }
            i++;
          }
        } else {
          // Mouse left chart — restore live labels
          for (const state of sMap.values()) {
            state.series.applyOptions({ lastValueVisible: true, priceLineVisible: true });
          }
        }
      } finally {
        inHandler = false;
      }
    });

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
      tempPriceLinesRef.current.clear();
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
            margins: { above: 0, below: 0 },
          }),
        });
        state = { series, lastLen: 0, firstTs: 0, lastTime: 0 };
        seriesMapRef.current.set(os.marketId, state);
      }

      if (os.ticks.length === 0) continue;

      const firstTs = os.ticks[0].timestamp;
      const wasReplaced = firstTs !== state.firstTs;

      try {
        if (wasReplaced || state.lastLen === 0) {
          const data = dedupTicks(os.ticks);
          state.series.setData(data);
          state.lastLen = os.ticks.length;
          state.firstTs = firstTs;
          state.lastTime = data.length > 0 ? (data[data.length - 1].time as number) : 0;
        } else if (os.ticks.length > state.lastLen) {
          for (let j = state.lastLen; j < os.ticks.length; j++) {
            const time = Math.floor(os.ticks[j].timestamp / 1000) as UTCTimestamp;
            if ((time as number) > state.lastTime) {
              state.series.update({ time, value: os.ticks[j].price });
              state.lastTime = time as number;
            }
          }
          state.lastLen = os.ticks.length;
        }
      } catch (e) {
        // Recovery: full setData on next render
        console.warn('Multi-series update error, will recover:', e);
        state.lastLen = 0;
        state.firstTs = 0;
        state.lastTime = 0;
      }
    }

    // Quarter markers on first series
    if (quarterMarkers.length > 0) {
      const firstState = seriesMapRef.current.values().next().value;
      if (firstState) {
        try {
          const markers = quarterMarkers
            .map(m => ({
              time: Math.floor(m.timestamp / 1000) as UTCTimestamp,
              position: 'aboveBar' as const,
              color: '#8B5CF6',
              shape: 'circle' as const,
              text: m.label,
              size: 1,
            }))
            .sort((a, b) => (a.time as number) - (b.time as number));
          firstState.series.setMarkers(markers);
        } catch { /* ignore if markers outside data range */ }
      }
    }

    // For non-live modes, keep the full historical range visible
    if (timeRange !== 'live' && chart) {
      chart.timeScale().fitContent();
    }
  }, [outcomeSeries, timeRange, quarterMarkers]);
}

export { COLORS };
