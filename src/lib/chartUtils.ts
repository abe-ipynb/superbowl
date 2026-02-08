import type { UTCTimestamp } from 'lightweight-charts';
import type { PriceTick } from './types';

/**
 * Convert PriceTicks to lightweight-charts data, deduplicating by second.
 * Keeps the last value for each second, ensures ascending order.
 */
export function dedupTicks(ticks: PriceTick[]): { time: UTCTimestamp; value: number }[] {
  const map = new Map<number, number>();
  for (const t of ticks) {
    const sec = Math.floor(t.timestamp / 1000);
    map.set(sec, t.price); // last-write-wins for same second
  }
  const entries = Array.from(map.entries());
  entries.sort((a, b) => a[0] - b[0]);
  return entries.map(([sec, price]) => ({
    time: sec as UTCTimestamp,
    value: price,
  }));
}
