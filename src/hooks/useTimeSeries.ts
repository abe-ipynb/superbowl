import { useEffect, useRef, type RefObject } from 'react';
import { createChart, AreaSeries, MismatchDirection, type IChartApi, type ISeriesApi, type IPriceLine, type UTCTimestamp } from 'lightweight-charts';
import type { PinnedGroup, QuarterMarker } from '../lib/types';
import { etTickFormatter, etTooltipFormatter } from '../lib/timeFormat';
import { dedupTicks } from '../lib/chartUtils';

export function useTimeSeries(containerRef: RefObject<HTMLDivElement | null>, pinned: PinnedGroup, quarterMarkers: QuarterMarker[] = []) {
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const lastLenRef = useRef(0);
  const firstTsRef = useRef(0);
  const lastTimeRef = useRef(0);
  const tempPriceLineRef = useRef<IPriceLine | null>(null);

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

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#16A34A',
      topColor: 'rgba(22, 163, 74, 0.15)',
      bottomColor: 'rgba(22, 163, 74, 0.02)',
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

    chartRef.current = chart;
    seriesRef.current = series;
    lastLenRef.current = 0;
    firstTsRef.current = 0;
    lastTimeRef.current = 0;

    // Guard: applyOptions triggers _internal_updateCrosshair which re-fires
    // this handler, causing infinite recursion without a re-entrancy guard.
    let inHandler = false;
    chart.subscribeCrosshairMove((param) => {
      if (inHandler) return;
      inHandler = true;
      try {
        const s = seriesRef.current;
        if (!s) return;

        // Remove previous temp price line
        if (tempPriceLineRef.current) {
          try { s.removePriceLine(tempPriceLineRef.current); } catch { /* already removed */ }
          tempPriceLineRef.current = null;
        }

        if (param.time && param.logical !== undefined) {
          // Hide live labels
          s.applyOptions({ lastValueVisible: false, priceLineVisible: false });

          // Create colored price label at hovered time
          const data = s.dataByIndex(param.logical, MismatchDirection.NearestLeft);
          if (data && 'value' in data) {
            const opts = s.options();
            const color = (opts as { lineColor?: string }).lineColor || '#16A34A';
            tempPriceLineRef.current = s.createPriceLine({
              price: (data as { value: number }).value,
              color: color,
              lineVisible: false,
              axisLabelVisible: true,
              axisLabelColor: color,
              axisLabelTextColor: '#FFFFFF',
            });
          }
        } else {
          // Mouse left chart — restore live labels
          s.applyOptions({ lastValueVisible: true, priceLineVisible: true });
        }
      } finally {
        inHandler = false;
      }
    });

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          chart.resize(width, height);
        }
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [containerRef]);

  // Update data
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const { timeSeries, sessionOpenPrice, currentPrice } = pinned;

    if (timeSeries.length === 0) return;

    const firstTs = timeSeries[0].timestamp;
    const wasReplaced = firstTs !== firstTsRef.current;

    try {
      if (wasReplaced || lastLenRef.current === 0) {
        const data = dedupTicks(timeSeries);
        series.setData(data);
        lastLenRef.current = timeSeries.length;
        firstTsRef.current = firstTs;
        lastTimeRef.current = data.length > 0 ? (data[data.length - 1].time as number) : 0;
        if (pinned.timeRange !== 'live' && chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }
      } else if (timeSeries.length > lastLenRef.current) {
        for (let i = lastLenRef.current; i < timeSeries.length; i++) {
          const time = Math.floor(timeSeries[i].timestamp / 1000) as UTCTimestamp;
          if ((time as number) > lastTimeRef.current) {
            series.update({ time, value: timeSeries[i].price });
            lastTimeRef.current = time as number;
          }
        }
        lastLenRef.current = timeSeries.length;
        if (pinned.timeRange !== 'live' && chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }
      }
    } catch (e) {
      // Recovery: full setData on next render
      console.warn('Chart update error, will recover:', e);
      lastLenRef.current = 0;
      firstTsRef.current = 0;
      lastTimeRef.current = 0;
    }

    const isUp = currentPrice >= sessionOpenPrice;
    series.applyOptions({
      lineColor: isUp ? '#16A34A' : '#DC2626',
      topColor: isUp ? 'rgba(22, 163, 74, 0.15)' : 'rgba(220, 38, 38, 0.15)',
      bottomColor: isUp ? 'rgba(22, 163, 74, 0.02)' : 'rgba(220, 38, 38, 0.02)',
    });

    // Quarter markers
    if (quarterMarkers.length > 0) {
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
        series.setMarkers(markers);
      } catch { /* ignore if markers outside data range */ }
    }
  }, [pinned, quarterMarkers]);
}
