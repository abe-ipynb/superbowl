import { useEffect, useRef, useState } from 'react';
import type { MarketGroup } from '../lib/types';
import { fetchPriceHistory } from '../lib/gamma';

export function useSparklines(groups: MarketGroup[]) {
  const [data, setData] = useState<Map<string, number[]>>(new Map());
  const fetchedRef = useRef(new Set<string>());
  const queueRef = useRef<MarketGroup[]>([]);
  const runningRef = useRef(false);

  useEffect(() => {
    // Queue groups that haven't been fetched yet
    for (const g of groups) {
      if (fetchedRef.current.has(g.eventId)) continue;
      fetchedRef.current.add(g.eventId);
      queueRef.current.push(g);
    }

    if (runningRef.current || queueRef.current.length === 0) return;
    runningRef.current = true;

    // Process queue with small delays to avoid hammering the API
    async function processQueue() {
      while (queueRef.current.length > 0) {
        const batch = queueRef.current.splice(0, 5);
        const results = await Promise.allSettled(
          batch.map(async g => {
            const tokenId = g.markets[0]?.clobTokenIds[0];
            if (!tokenId) return null;
            const ticks = await fetchPriceHistory(tokenId, '1d');
            return { eventId: g.eventId, prices: ticks.map(t => t.price) };
          })
        );
        setData(prev => {
          const next = new Map(prev);
          for (const r of results) {
            if (r.status === 'fulfilled' && r.value && r.value.prices.length > 1) {
              next.set(r.value.eventId, r.value.prices);
            }
          }
          return next;
        });
        if (queueRef.current.length > 0) {
          await new Promise(r => setTimeout(r, 200));
        }
      }
      runningRef.current = false;
    }

    processQueue();
  }, [groups]);

  return data;
}
