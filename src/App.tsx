import { useEffect, useRef } from 'react';
import { AppProvider, useAppState, useAppDispatch } from './state/context';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import DashboardGrid from './components/DashboardGrid';
import StatusBar from './components/StatusBar';
import { useGammaMarkets } from './hooks/useGammaMarkets';
import { usePolymarketWS } from './hooks/usePolymarketWS';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useGameScore } from './hooks/useGameScore';
import { fetchPriceHistory } from './lib/gamma';
import type { GameScore } from './lib/espn';

function Dashboard() {
  const { refresh } = useGammaMarkets();
  const game = useGameScore();
  usePolymarketWS();
  useKeyboardShortcuts(refresh);
  useFetchHistoryOnPin();
  useQuarterTracker(game);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header onRefresh={refresh} game={game} />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <DashboardGrid />
      </div>
      <StatusBar />
    </div>
  );
}

function useFetchHistoryOnPin() {
  const { pinnedGroups } = useAppState();
  const dispatch = useAppDispatch();
  const fetchedRef = useRef(new Set<string>());

  useEffect(() => {
    // Prune stale keys so switching back to a previous range re-fetches
    const currentKeys = new Set(pinnedGroups.map(pg => `${pg.group.eventId}:${pg.timeRange}`));
    for (const key of fetchedRef.current) {
      if (!currentKeys.has(key)) fetchedRef.current.delete(key);
    }

    for (const pg of pinnedGroups) {
      const key = `${pg.group.eventId}:${pg.timeRange}`;
      if (fetchedRef.current.has(key)) continue;
      fetchedRef.current.add(key);

      const eventId = pg.group.eventId;
      const range = pg.timeRange;

      if (pg.group.markets.length === 1) {
        const tokenId = pg.group.markets[0]?.clobTokenIds[0];
        if (!tokenId) continue;
        fetchPriceHistory(tokenId, range).then(ticks => {
          if (ticks.length > 0) {
            dispatch({ type: 'SET_HISTORY', eventId, ticks });
          }
        }).catch(() => {});
      } else {
        for (const os of pg.outcomeSeries) {
          if (!os.tokenId) continue;
          fetchPriceHistory(os.tokenId, range).then(ticks => {
            if (ticks.length > 0) {
              dispatch({ type: 'SET_OUTCOME_HISTORY', eventId, marketId: os.marketId, ticks });
            }
          }).catch(() => {});
        }
      }
    }
  }, [pinnedGroups, dispatch]);
}

// Track game quarter transitions and record timestamps as chart markers
function useQuarterTracker(game: GameScore | null) {
  const dispatch = useAppDispatch();
  const prevRef = useRef<{ period: number; status: string }>({ period: 0, status: '' });

  useEffect(() => {
    if (!game) return;
    const prev = prevRef.current;
    const { status } = game;

    if (status.name === prev.status && status.period === prev.period) return;

    let label = '';
    if (status.name === 'STATUS_HALFTIME' && prev.status !== 'STATUS_HALFTIME') {
      label = 'HT';
    } else if (status.name === 'STATUS_FINAL' && prev.status !== 'STATUS_FINAL') {
      label = 'Final';
    } else if (status.name === 'STATUS_IN_PROGRESS' && status.period !== prev.period) {
      if (prev.period === 0) {
        label = 'Kick';
      } else {
        const names: Record<number, string> = { 2: 'Q2', 3: 'Q3', 4: 'Q4' };
        label = names[status.period] || (status.period > 4 ? 'OT' : `Q${status.period}`);
      }
    }

    if (label) {
      dispatch({ type: 'ADD_QUARTER_MARKER', marker: { label, timestamp: Date.now() } });
    }

    prevRef.current = { period: status.period, status: status.name };
  }, [game, dispatch]);
}


export default function App() {
  return (
    <AppProvider>
      <Dashboard />
    </AppProvider>
  );
}
