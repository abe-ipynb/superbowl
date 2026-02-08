import { useAppState } from '../state/context';
import MarketCard from './MarketCard';

const gridClass: Record<number, string> = {
  0: '',
  1: 'grid-cols-1 grid-rows-1',
  2: 'grid-cols-2 grid-rows-1',
  3: 'grid-cols-2 grid-rows-2',
  4: 'grid-cols-2 grid-rows-2',
  5: 'grid-cols-3 grid-rows-2',
  6: 'grid-cols-3 grid-rows-2',
  7: 'grid-cols-4 grid-rows-2',
  8: 'grid-cols-4 grid-rows-2',
};

export default function DashboardGrid() {
  const { pinnedGroups } = useAppState();
  const count = pinnedGroups.length;

  if (count === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted">
        <div className="text-center">
          <p className="text-2xl mb-2">🏈</p>
          <p className="text-lg font-medium">No markets pinned</p>
          <p className="text-sm">Select markets from the sidebar to track live odds</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 grid gap-4 p-4 ${gridClass[count] || gridClass[8]}`}>
      {pinnedGroups.map(pinned => (
        <MarketCard key={pinned.group.eventId} pinned={pinned} />
      ))}
    </div>
  );
}
