import { useState, memo } from 'react';
import { useAppState, useAppDispatch } from '../state/context';
import { useSparklines } from '../hooks/useSparklines';

type SortMode = 'volume' | 'price' | 'alpha';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'volume', label: 'Vol' },
  { value: 'price', label: 'Price' },
  { value: 'alpha', label: 'A-Z' },
];

const Sparkline = memo(function Sparkline({ prices }: { prices: number[] }) {
  if (prices.length < 2) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 0.01;
  const w = 56, h = 20;
  const points = prices.map((p, i) =>
    `${(i / (prices.length - 1)) * w},${h - ((p - min) / range) * h}`
  ).join(' ');
  const isUp = prices[prices.length - 1] >= prices[0];
  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? '#16A34A' : '#DC2626'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});

export default function Sidebar() {
  const { allGroups, pinnedGroups, searchQuery, sidebarCollapsed } = useAppState();
  const dispatch = useAppDispatch();
  const [sort, setSort] = useState<SortMode>('volume');
  const sparklines = useSparklines(allGroups);

  if (sidebarCollapsed) return null;

  const filtered = allGroups.filter(g =>
    g.eventTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.markets.some(m => m.question.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'price') {
      const pa = parseFloat(a.markets[0]?.outcomePrices[0]) || 0;
      const pb = parseFloat(b.markets[0]?.outcomePrices[0]) || 0;
      return pb - pa;
    }
    if (sort === 'alpha') {
      return a.eventTitle.localeCompare(b.eventTitle);
    }
    return 0; // volume = original API order
  });

  const pinnedIds = new Set(pinnedGroups.map(p => p.group.eventId));

  return (
    <aside className="w-80 min-w-80 bg-sidebar border-r border-border flex flex-col overflow-hidden">
      <div className="p-4 border-b border-border space-y-3">
        <input
          type="text"
          placeholder="Search markets..."
          value={searchQuery}
          onChange={e => dispatch({ type: 'SET_SEARCH_QUERY', query: e.target.value })}
          className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-gray-900 placeholder-muted focus:outline-none focus:border-up"
        />
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold text-muted uppercase tracking-wide mr-1">Sort:</span>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              className={`px-2 py-0.5 text-[11px] rounded font-medium transition-colors ${
                sort === opt.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-muted hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-muted">{filtered.length} markets</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <p className="p-4 text-muted text-sm">
            {allGroups.length === 0
              ? 'Loading markets...'
              : 'No markets match your search.'}
          </p>
        )}
        {sorted.map(group => {
          const isPinned = pinnedIds.has(group.eventId);
          const lead = group.markets[0];
          const leadPriceVal = parseFloat(lead?.outcomePrices[0]) || 0;
          const leadName = lead?.groupItemTitle || lead?.outcomes[0] || '';
          const sparkPrices = sparklines.get(group.eventId);
          return (
            <button
              key={group.eventId}
              onClick={() => {
                if (isPinned) {
                  dispatch({ type: 'UNPIN_GROUP', eventId: group.eventId });
                } else {
                  dispatch({ type: 'PIN_GROUP', group });
                }
              }}
              className={`w-full text-left p-3 border-b border-border hover:bg-gray-100 transition-colors ${
                isPinned ? 'bg-green-50' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                {isPinned && (
                  <span className="w-2 h-2 rounded-full bg-up flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight line-clamp-2 text-gray-900">
                    {group.eventTitle}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {group.markets.length === 1
                      ? `${lead.outcomes[0]} ${Math.round(leadPriceVal * 100)}¢`
                      : `${group.markets.length} outcomes · ${leadName} ${Math.round(leadPriceVal * 100)}¢`
                    }
                  </p>
                </div>
                {sparkPrices && <Sparkline prices={sparkPrices} />}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
