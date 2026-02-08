import type { AppState, MarketGroup, PriceTick, PinnedGroup, OutcomeSeries, TimeRange } from '../lib/types';

const MAX_TICKS = 3600;
export const MAX_OUTCOMES = 5;

export type Action =
  | { type: 'SET_GROUPS'; groups: MarketGroup[] }
  | { type: 'PIN_GROUP'; group: MarketGroup }
  | { type: 'UNPIN_GROUP'; eventId: string }
  | { type: 'SET_HISTORY'; eventId: string; ticks: PriceTick[] }
  | { type: 'SET_OUTCOME_HISTORY'; eventId: string; marketId: string; ticks: PriceTick[] }
  | { type: 'PRICE_TICK'; clobTokenId: string; tick: PriceTick }
  | { type: 'SET_WS_STATUS'; status: AppState['wsStatus'] }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_TIME_RANGE'; eventId: string; timeRange: TimeRange };

export const initialState: AppState = {
  allGroups: [],
  pinnedGroups: [],
  wsStatus: 'disconnected',
  lastTickTime: null,
  sidebarCollapsed: false,
  searchQuery: '',
};

function buildOutcomeSeries(group: MarketGroup): OutcomeSeries[] {
  const now = Date.now();
  return group.markets.slice(0, MAX_OUTCOMES).map(m => {
    const price = parseFloat(m.outcomePrices[0]) || 0;
    return {
      marketId: m.id,
      label: m.groupItemTitle || m.question,
      tokenId: m.clobTokenIds[0] || '',
      ticks: [{ price, timestamp: now }],
      currentPrice: price,
    };
  });
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_GROUPS':
      return { ...state, allGroups: action.groups };

    case 'PIN_GROUP': {
      if (state.pinnedGroups.length >= 8) return state;
      if (state.pinnedGroups.some(p => p.group.eventId === action.group.eventId)) return state;
      const lead = action.group.markets[0];
      const price = parseFloat(lead?.outcomePrices[0]) || 0;
      const isMulti = action.group.markets.length > 1;
      const pinned: PinnedGroup = {
        group: action.group,
        timeRange: '1w',
        timeSeries: [{ price, timestamp: Date.now() }],
        sessionOpenPrice: price,
        currentPrice: price,
        outcomeSeries: isMulti ? buildOutcomeSeries(action.group) : [],
      };
      return { ...state, pinnedGroups: [...state.pinnedGroups, pinned] };
    }

    case 'UNPIN_GROUP':
      return {
        ...state,
        pinnedGroups: state.pinnedGroups.filter(p => p.group.eventId !== action.eventId),
      };

    case 'SET_HISTORY': {
      const idx = state.pinnedGroups.findIndex(p => p.group.eventId === action.eventId);
      if (idx === -1 || action.ticks.length === 0) return state;
      const existing = state.pinnedGroups[idx];
      const lastTick = action.ticks[action.ticks.length - 1];
      const updated: PinnedGroup = {
        ...existing,
        timeSeries: action.ticks,
        sessionOpenPrice: action.ticks[0].price,
        currentPrice: lastTick.price,
      };
      const newPinned = [...state.pinnedGroups];
      newPinned[idx] = updated;
      return { ...state, pinnedGroups: newPinned };
    }

    case 'SET_OUTCOME_HISTORY': {
      const idx = state.pinnedGroups.findIndex(p => p.group.eventId === action.eventId);
      if (idx === -1 || action.ticks.length === 0) return state;
      const existing = state.pinnedGroups[idx];
      const osIdx = existing.outcomeSeries.findIndex(o => o.marketId === action.marketId);
      if (osIdx === -1) return state;
      const os = existing.outcomeSeries[osIdx];
      const updatedOs: OutcomeSeries = {
        ...os,
        ticks: action.ticks,
        currentPrice: action.ticks[action.ticks.length - 1].price,
      };
      const newOs = [...existing.outcomeSeries];
      newOs[osIdx] = updatedOs;
      const updated: PinnedGroup = { ...existing, outcomeSeries: newOs };
      const newPinned = [...state.pinnedGroups];
      newPinned[idx] = updated;
      return { ...state, pinnedGroups: newPinned };
    }

    case 'PRICE_TICK': {
      let changed = false;
      const newPinned = state.pinnedGroups.map(pg => {
        // Single-market: match lead token
        if (pg.group.markets.length === 1) {
          if (pg.group.markets[0]?.clobTokenIds[0] !== action.clobTokenId) return pg;
          changed = true;
          let newSeries = [...pg.timeSeries, action.tick];
          if (newSeries.length > MAX_TICKS) newSeries = newSeries.slice(-MAX_TICKS);
          return { ...pg, timeSeries: newSeries, currentPrice: action.tick.price };
        }
        // Multi-market: match any tracked outcome
        const osIdx = pg.outcomeSeries.findIndex(o => o.tokenId === action.clobTokenId);
        if (osIdx === -1) return pg;
        changed = true;
        const os = pg.outcomeSeries[osIdx];
        let newTicks = [...os.ticks, action.tick];
        if (newTicks.length > MAX_TICKS) newTicks = newTicks.slice(-MAX_TICKS);
        const newOs = [...pg.outcomeSeries];
        newOs[osIdx] = { ...os, ticks: newTicks, currentPrice: action.tick.price };
        return { ...pg, outcomeSeries: newOs };
      });
      if (!changed) return state;
      return { ...state, pinnedGroups: newPinned, lastTickTime: action.tick.timestamp };
    }

    case 'SET_TIME_RANGE': {
      const idx = state.pinnedGroups.findIndex(p => p.group.eventId === action.eventId);
      if (idx === -1) return state;
      const existing = state.pinnedGroups[idx];
      if (existing.timeRange === action.timeRange) return state;
      const now = Date.now();
      const updated: PinnedGroup = {
        ...existing,
        timeRange: action.timeRange,
        // Reset series so history re-fetch fills them
        timeSeries: [{ price: existing.currentPrice, timestamp: now }],
        outcomeSeries: existing.outcomeSeries.map(os => ({
          ...os,
          ticks: [{ price: os.currentPrice, timestamp: now }],
        })),
      };
      const newPinned = [...state.pinnedGroups];
      newPinned[idx] = updated;
      return { ...state, pinnedGroups: newPinned };
    }

    case 'SET_WS_STATUS':
      return { ...state, wsStatus: action.status };

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query };

    default:
      return state;
  }
}
