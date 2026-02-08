import { useEffect, useRef } from 'react';
import { PolymarketWS } from '../lib/ws';
import { useAppState, useAppDispatch } from '../state/context';

export function usePolymarketWS() {
  const { pinnedGroups } = useAppState();
  const dispatch = useAppDispatch();
  const wsRef = useRef<PolymarketWS | null>(null);
  const subscribedRef = useRef(new Set<string>());

  useEffect(() => {
    const ws = new PolymarketWS(
      (clobTokenId, price, timestamp) => {
        dispatch({ type: 'PRICE_TICK', clobTokenId, tick: { price, timestamp } });
      },
      (status) => {
        dispatch({ type: 'SET_WS_STATUS', status });
      }
    );
    wsRef.current = ws;
    return () => {
      ws.destroy();
      wsRef.current = null;
    };
  }, [dispatch]);

  // Subscribe to all tracked tokens across all pinned groups
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    const desired = new Set<string>();
    for (const pg of pinnedGroups) {
      if (pg.group.markets.length === 1) {
        const tok = pg.group.markets[0]?.clobTokenIds[0];
        if (tok) desired.add(tok);
      } else {
        for (const os of pg.outcomeSeries) {
          if (os.tokenId) desired.add(os.tokenId);
        }
      }
    }

    const current = subscribedRef.current;
    for (const id of desired) {
      if (!current.has(id)) ws.subscribe(id);
    }
    for (const id of current) {
      if (!desired.has(id)) ws.unsubscribe(id);
    }
    subscribedRef.current = desired;
  }, [pinnedGroups]);
}
