import { memo, useEffect, useRef, useState } from 'react';
import type { PinnedGroup, PriceTick, QuarterMarker, TimeRange } from '../lib/types';
import { useAppDispatch } from '../state/context';
import { useTimeSeries } from '../hooks/useTimeSeries';
import { useMultiSeries, COLORS } from '../hooks/useMultiSeries';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'live', label: 'Live' },
  { value: '1h', label: '1H' },
  { value: '1d', label: '24h' },
  { value: '1w', label: '1W' },
  { value: '1m', label: '1M' },
];

const SWING_THRESHOLD = 0.05; // 5¢
const SWING_WINDOW = 30_000; // 30 seconds

function hasSwing(ticks: PriceTick[]): boolean {
  if (ticks.length < 2) return false;
  const latest = ticks[ticks.length - 1];
  const cutoff = latest.timestamp - SWING_WINDOW;
  for (let i = ticks.length - 2; i >= 0; i--) {
    if (ticks[i].timestamp < cutoff) break;
    if (Math.abs(latest.price - ticks[i].price) >= SWING_THRESHOLD) return true;
  }
  return false;
}

function useSwingFlash(pinned: PinnedGroup): boolean {
  const [flash, setFlash] = useState(false);
  const wasSwinging = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const swinging = pinned.group.markets.length === 1
    ? hasSwing(pinned.timeSeries)
    : pinned.outcomeSeries.some(os => hasSwing(os.ticks));

  // Run every render — timer lives in a ref so re-renders don't kill it
  useEffect(() => {
    if (swinging && !wasSwinging.current) {
      setFlash(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setFlash(false), 1500);
    }
    wasSwinging.current = swinging;
  });

  // Cleanup only on unmount
  useEffect(() => () => clearTimeout(timerRef.current), []);

  return flash;
}

interface MarketCardProps {
  pinned: PinnedGroup;
  quarterMarkers: QuarterMarker[];
}

const SingleMarketCard = memo(function SingleMarketCard({ pinned, quarterMarkers }: MarketCardProps) {
  const dispatch = useAppDispatch();
  const chartRef = useRef<HTMLDivElement>(null);
  const lead = pinned.group.markets[0];
  const priceInCents = Math.round(pinned.currentPrice * 100);
  const isUp = pinned.currentPrice >= pinned.sessionOpenPrice;
  const flash = useSwingFlash(pinned);

  useTimeSeries(chartRef, pinned, quarterMarkers);

  return (
    <div className={`border border-border rounded-xl p-4 flex flex-col overflow-hidden shadow-sm transition-colors duration-500 ${
      flash ? 'bg-green-100 border-green-400' : 'bg-white'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-lg font-semibold leading-tight line-clamp-2 flex-1 mr-2 text-gray-900">
          {pinned.group.eventTitle}
        </h3>
        <button
          onClick={() => dispatch({ type: 'UNPIN_GROUP', eventId: pinned.group.eventId })}
          className="text-muted hover:text-gray-900 text-xl leading-none flex-shrink-0"
        >
          &times;
        </button>
      </div>
      <div className="mb-1">
        <span className={`text-4xl font-bold ${isUp ? 'text-up' : 'text-down'}`}>
          {priceInCents}¢
        </span>
      </div>
      <p className="text-sm text-muted mb-2">{lead?.outcomes[0]}</p>
      <div className="flex gap-1 mb-2">
        {TIME_RANGES.map(r => (
          <button
            key={r.value}
            onClick={() => dispatch({ type: 'SET_TIME_RANGE', eventId: pinned.group.eventId, timeRange: r.value })}
            className={`px-2 py-0.5 text-xs rounded font-medium ${
              pinned.timeRange === r.value
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-muted hover:bg-gray-200'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div ref={chartRef} className="flex-1 min-h-0" />
    </div>
  );
});

const MultiMarketCard = memo(function MultiMarketCard({ pinned, quarterMarkers }: MarketCardProps) {
  const dispatch = useAppDispatch();
  const chartRef = useRef<HTMLDivElement>(null);
  const { outcomeSeries } = pinned;
  const flash = useSwingFlash(pinned);

  useMultiSeries(chartRef, outcomeSeries, pinned.timeRange, quarterMarkers);

  return (
    <div className={`border border-border rounded-xl p-4 flex flex-col overflow-hidden shadow-sm transition-colors duration-500 ${
      flash ? 'bg-green-100 border-green-400' : 'bg-white'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-lg font-semibold leading-tight line-clamp-2 flex-1 mr-2 text-gray-900">
          {pinned.group.eventTitle}
        </h3>
        <button
          onClick={() => dispatch({ type: 'UNPIN_GROUP', eventId: pinned.group.eventId })}
          className="text-muted hover:text-gray-900 text-xl leading-none flex-shrink-0"
        >
          &times;
        </button>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-sm">
        {outcomeSeries.map((os, i) => (
          <div key={os.marketId} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="text-gray-700 truncate max-w-32">{os.label}</span>
            <span className="font-semibold text-gray-900">{Math.round(os.currentPrice * 100)}¢</span>
          </div>
        ))}
      </div>
      <div className="flex gap-1 mb-2">
        {TIME_RANGES.map(r => (
          <button
            key={r.value}
            onClick={() => dispatch({ type: 'SET_TIME_RANGE', eventId: pinned.group.eventId, timeRange: r.value })}
            className={`px-2 py-0.5 text-xs rounded font-medium ${
              pinned.timeRange === r.value
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-muted hover:bg-gray-200'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div ref={chartRef} className="flex-1 min-h-0" />
    </div>
  );
});

export default memo(function MarketCard({ pinned, quarterMarkers }: MarketCardProps) {
  if (pinned.group.markets.length === 1) {
    return <SingleMarketCard pinned={pinned} quarterMarkers={quarterMarkers} />;
  }
  return <MultiMarketCard pinned={pinned} quarterMarkers={quarterMarkers} />;
});
