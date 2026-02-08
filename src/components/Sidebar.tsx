import { useAppState, useAppDispatch } from '../state/context';

export default function Sidebar() {
  const { allGroups, pinnedGroups, searchQuery, sidebarCollapsed } = useAppState();
  const dispatch = useAppDispatch();

  if (sidebarCollapsed) return null;

  const filtered = allGroups.filter(g =>
    g.eventTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.markets.some(m => m.question.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const pinnedIds = new Set(pinnedGroups.map(p => p.group.eventId));

  return (
    <aside className="w-80 min-w-80 bg-sidebar border-r border-border flex flex-col overflow-hidden">
      <div className="p-4 border-b border-border">
        <input
          type="text"
          placeholder="Search markets..."
          value={searchQuery}
          onChange={e => dispatch({ type: 'SET_SEARCH_QUERY', query: e.target.value })}
          className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-gray-900 placeholder-muted focus:outline-none focus:border-up"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="p-4 text-muted text-sm">
            {allGroups.length === 0
              ? 'Loading markets...'
              : 'No markets match your search.'}
          </p>
        )}
        {filtered.map(group => {
          const isPinned = pinnedIds.has(group.eventId);
          const lead = group.markets[0];
          const leadPriceVal = parseFloat(lead?.outcomePrices[0]) || 0;
          const leadName = lead?.groupItemTitle || lead?.outcomes[0] || '';
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
              className={`w-full text-left p-4 border-b border-border hover:bg-gray-100 transition-colors ${
                isPinned ? 'bg-green-50' : ''
              }`}
            >
              <div className="flex items-start gap-2">
                {isPinned && (
                  <span className="mt-1 w-2 h-2 rounded-full bg-up flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight line-clamp-2 text-gray-900">
                    {group.eventTitle}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    {group.markets.length === 1
                      ? `${lead.outcomes[0]} ${Math.round(leadPriceVal * 100)}¢`
                      : `${group.markets.length} outcomes · ${leadName} ${Math.round(leadPriceVal * 100)}¢`
                    }
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
