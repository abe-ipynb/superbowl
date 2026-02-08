import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSuperBowlMarkets, getCachedGroups } from '../lib/gamma';
import { useAppDispatch } from '../state/context';

const AUTO_PIN_COUNT = 4;
const POLL_INTERVAL = 15_000; // 15 seconds

export function useGammaMarkets() {
  const dispatch = useAppDispatch();
  const fetching = useRef(false);
  const autoPinned = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (isPolling = false) => {
    if (fetching.current) return;
    fetching.current = true;
    if (!isPolling) {
      setError(null);
      setLoading(true);
    }
    try {
      const groups = await fetchSuperBowlMarkets();
      if (isPolling) {
        // Periodic refresh: sync prices into pinned groups
        dispatch({ type: 'SYNC_PRICES', groups });
      } else {
        dispatch({ type: 'SET_GROUPS', groups });
      }
      if (groups.length === 0 && !isPolling) {
        setError('No Super Bowl markets found. Try refreshing.');
      }
      // Auto-pin top markets on first load only
      if (!autoPinned.current && groups.length > 0) {
        autoPinned.current = true;
        const toPin = groups.slice(0, AUTO_PIN_COUNT);
        for (const group of toPin) {
          dispatch({ type: 'PIN_GROUP', group });
        }
      }
    } catch (e) {
      if (!isPolling) {
        console.error('Failed to fetch markets:', e);
        const cached = getCachedGroups();
        if (cached) {
          dispatch({ type: 'SET_GROUPS', groups: cached });
        } else {
          setError(`Failed to load markets: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      }
    } finally {
      fetching.current = false;
      if (!isPolling) setLoading(false);
    }
  }, [dispatch]);

  // Initial load
  useEffect(() => {
    load();
  }, [load]);

  // Periodic price polling
  useEffect(() => {
    const timer = setInterval(() => load(true), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [load]);

  return { refresh: () => load(false), error, loading };
}
