import { useEffect, useRef, type RefObject } from 'react';
import { createChart, AreaSeries, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import type { PinnedGroup } from '../lib/types';
import { etTickFormatter, etTooltipFormatter } from '../lib/timeFormat';
import { dedupTicks } from '../lib/chartUtils';

export function useTimeSeries(containerRef: RefObject<HTMLDivElement | null>, pinned: PinnedGroup) {
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const lastLenRef = useRef(0);
  const firstTsRef = useRef(0);
  const lastTimeRef = useRef(0);

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
        margins: { above: 0, below: 0 },
      }),
    });

    chartRef.current = chart;
    seriesRef.current = series;
    lastLenRef.current = 0;
    firstTsRef.current = 0;
    lastTimeRef.current = 0;

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
  }, [pinned]);
}
