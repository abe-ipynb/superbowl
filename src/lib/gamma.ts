import type { Market, MarketGroup, PriceTick, TimeRange } from './types';

const EVENTS_URL = '/api/gamma/events';
const CLOB_HISTORY_URL = 'https://clob.polymarket.com/prices-history';
const CACHE_KEY = 'superbowl-groups';
const FETCH_TIMEOUT = 10_000;

const SB_KEYWORDS = ['big game', 'super bowl', 'halftime', 'national anthem'];

interface GammaMarket {
  id: string;
  question: string;
  description: string;
  outcomes: string;
  outcomePrices: string;
  image: string;
  conditionId: string;
  clobTokenIds: string;
  slug: string;
  active: boolean;
  closed: boolean;
  groupItemTitle: string;
}

interface GammaEvent {
  id: string;
  title: string;
  slug: string;
  markets: GammaMarket[];
}

function parseMarket(raw: GammaMarket): Market {
  return {
    id: raw.id,
    question: raw.question,
    description: raw.description || '',
    outcomes: JSON.parse(raw.outcomes || '[]'),
    outcomePrices: JSON.parse(raw.outcomePrices || '[]'),
    image: raw.image || '',
    conditionId: raw.conditionId || '',
    clobTokenIds: JSON.parse(raw.clobTokenIds || '[]'),
    slug: raw.slug || '',
    groupItemTitle: raw.groupItemTitle || '',
  };
}

function isSuperBowlEvent(event: GammaEvent): boolean {
  const text = `${event.title} ${event.slug}`.toLowerCase();
  return SB_KEYWORDS.some(kw => text.includes(kw));
}

function leadPrice(m: Market): number {
  return parseFloat(m.outcomePrices[0]) || 0;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSuperBowlMarkets(): Promise<MarketGroup[]> {
  const url = `${EVENTS_URL}?limit=500&order=volume24hr&ascending=false`;
  const res = await fetchWithTimeout(url);
  const events: GammaEvent[] = await res.json();

  const groups: MarketGroup[] = [];

  for (const event of events) {
    if (!isSuperBowlEvent(event)) continue;
    const markets = event.markets
      .filter(m => m.active && !m.closed)
      .map(parseMarket)
      .sort((a, b) => leadPrice(b) - leadPrice(a));
    if (markets.length === 0) continue;
    groups.push({
      eventId: event.id.toString(),
      eventTitle: event.title,
      markets,
    });
  }

  if (groups.length > 0) {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(groups));
  }

  return groups;
}

export function getCachedGroups(): MarketGroup[] | null {
  const cached = sessionStorage.getItem(CACHE_KEY);
  return cached ? JSON.parse(cached) : null;
}

const RANGE_PARAMS: Record<string, { interval: string; fidelity: number }> = {
  'live': { interval: '1h', fidelity: 1 },
  '1h': { interval: '1h', fidelity: 1 },
  '1d': { interval: '1d', fidelity: 5 },
  '1w': { interval: '1w', fidelity: 60 },
  '1m': { interval: '1m', fidelity: 360 },
};

const LIVE_WINDOW = 10 * 60 * 1000; // 10 minutes

export async function fetchPriceHistory(clobTokenId: string, range: TimeRange = '1w'): Promise<PriceTick[]> {
  const { interval, fidelity } = RANGE_PARAMS[range];
  const url = `${CLOB_HISTORY_URL}?market=${clobTokenId}&interval=${interval}&fidelity=${fidelity}`;
  const res = await fetchWithTimeout(url);
  const data: { history: { t: number; p: number }[] } = await res.json();
  let ticks = data.history.map(h => ({
    price: h.p,
    timestamp: h.t * 1000,
  }));
  if (range === 'live') {
    const cutoff = Date.now() - LIVE_WINDOW;
    const recent = ticks.filter(t => t.timestamp >= cutoff);
    ticks = recent.length >= 2 ? recent : ticks.slice(-5);
  }
  return ticks;
}
