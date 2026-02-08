export interface Market {
  id: string;
  question: string;
  description: string;
  outcomes: string[];
  outcomePrices: string[];
  image: string;
  conditionId: string;
  clobTokenIds: string[];
  slug: string;
  groupItemTitle: string;
}

export interface MarketGroup {
  eventId: string;
  eventTitle: string;
  markets: Market[]; // sorted by lead price descending
}

export interface PriceTick {
  price: number;
  timestamp: number;
}

export interface OutcomeSeries {
  marketId: string;
  label: string;
  tokenId: string;
  ticks: PriceTick[];
  currentPrice: number;
}

export type TimeRange = 'live' | '1h' | '1d' | '1w' | '1m';

export interface PinnedGroup {
  group: MarketGroup;
  timeRange: TimeRange;
  // Single-market: chart from timeSeries
  timeSeries: PriceTick[];
  sessionOpenPrice: number;
  currentPrice: number;
  // Multi-market: multiple outcome lines
  outcomeSeries: OutcomeSeries[];
}

export interface QuarterMarker {
  label: string;
  timestamp: number; // ms
}

export interface AppState {
  allGroups: MarketGroup[];
  pinnedGroups: PinnedGroup[];
  wsStatus: 'connected' | 'disconnected' | 'reconnecting';
  lastTickTime: number | null;
  sidebarCollapsed: boolean;
  searchQuery: string;
  quarterMarkers: QuarterMarker[];
}
