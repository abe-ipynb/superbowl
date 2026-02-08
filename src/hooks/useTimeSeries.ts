import { useEffect, useRef, type RefObject } from 'react';
import { createChart, AreaSeries, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import type { PinnedGroup } from '../lib/types';
import { etTickFormatter, etTooltipFormatter } from '../lib/timeFormat';

export function useTimeSeries(containerRef: RefObject<HTMLDivElement | null>, pinned: PinnedGroup) {
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const lastLenRef = useRef(0);
  const firstTsRef = useRef(0);

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
      }),
    });

    chartRef.current = chart;
    seriesRef.current = series;
    lastLenRef.current = 0;
    firstTsRef.current = 0;

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

    if (wasReplaced || lastLenRef.current === 0) {
      const data = timeSeries.map(t => ({
        time: Math.floor(t.timestamp / 1000) as UTCTimestamp,
        value: t.price,
      }));
      series.setData(data);
      lastLenRef.current = timeSeries.length;
      firstTsRef.current = firstTs;
    } else if (timeSeries.length > lastLenRef.current) {
      for (let i = lastLenRef.current; i < timeSeries.length; i++) {
        series.update({
          time: Math.floor(timeSeries[i].timestamp / 1000) as UTCTimestamp,
          value: timeSeries[i].price,
        });
      }
      lastLenRef.current = timeSeries.length;
    }

    const isUp = currentPrice >= sessionOpenPrice;
    series.applyOptions({
      lineColor: isUp ? '#16A34A' : '#DC2626',
      topColor: isUp ? 'rgba(22, 163, 74, 0.15)' : 'rgba(220, 38, 38, 0.15)',
      bottomColor: isUp ? 'rgba(22, 163, 74, 0.02)' : 'rgba(220, 38, 38, 0.02)',
    });
  }, [pinned]);
}
