import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSuperBowlMarkets, getCachedGroups } from '../lib/gamma';
import { useAppDispatch } from '../state/context';

export function useGammaMarkets() {
  const dispatch = useAppDispatch();
  const fetching = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    setError(null);
    setLoading(true);
    try {
      const groups = await fetchSuperBowlMarkets();
      dispatch({ type: 'SET_GROUPS', groups });
      if (groups.length === 0) {
        setError('No Super Bowl markets found. Try refreshing.');
      }
    } catch (e) {
      console.error('Failed to fetch markets:', e);
      const cached = getCachedGroups();
      if (cached) {
        dispatch({ type: 'SET_GROUPS', groups: cached });
      } else {
        setError(`Failed to load markets: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    } finally {
      fetching.current = false;
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  return { refresh: load, error, loading };
}
