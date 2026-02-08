import { useEffect, useRef } from 'react';
import { AppProvider, useAppState, useAppDispatch } from './state/context';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import DashboardGrid from './components/DashboardGrid';
import StatusBar from './components/StatusBar';
import { useGammaMarkets } from './hooks/useGammaMarkets';
import { usePolymarketWS } from './hooks/usePolymarketWS';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { fetchPriceHistory } from './lib/gamma';

function Dashboard() {
  const { refresh } = useGammaMarkets();
  usePolymarketWS();
  useKeyboardShortcuts(refresh);
  useFetchHistoryOnPin();

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header onRefresh={refresh} />
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

export default function App() {
  return (
    <AppProvider>
      <Dashboard />
    </AppProvider>
  );
}
