import { useAppDispatch } from '../state/context';
import { useGameScore } from '../hooks/useGameScore';
import { formatGameClock } from '../lib/espn';

interface HeaderProps {
  onRefresh: () => void;
}

export default function Header({ onRefresh }: HeaderProps) {
  const dispatch = useAppDispatch();
  const game = useGameScore();

  return (
    <header className="flex items-center justify-between px-8 py-3 bg-white border-b border-border">
      <div className="flex items-center gap-4">
        <span className="text-3xl">🏈</span>
        <h1 className="text-2xl font-black tracking-tight text-gray-900">
          ABE'S SB LX PARTY
        </h1>
      </div>

      {/* Scoreboard */}
      {game && (
        <div className="flex items-center gap-4">
          {/* Away team */}
          <div className="flex items-center gap-2">
            <img src={game.away.logo} alt={game.away.abbreviation} className="w-10 h-10 object-contain" />
            <div className="text-right">
              <div className="text-xs font-semibold text-muted leading-tight">{game.away.abbreviation}</div>
              <div className="text-3xl font-black leading-tight tabular-nums">{game.away.score}</div>
            </div>
          </div>

          {/* Game clock */}
          <div className="flex flex-col items-center min-w-28">
            <div className={`text-sm font-bold px-3 py-0.5 rounded-full ${
              game.status.name === 'STATUS_IN_PROGRESS'
                ? 'bg-red-100 text-red-700'
                : game.status.name === 'STATUS_HALFTIME'
                  ? 'bg-yellow-100 text-yellow-700'
                  : game.status.name === 'STATUS_FINAL'
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-blue-100 text-blue-700'
            }`}>
              {formatGameClock(game.status)}
            </div>
            {game.status.name === 'STATUS_IN_PROGRESS' && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-semibold text-red-600 uppercase tracking-wide">Live</span>
              </div>
            )}
          </div>

          {/* Home team */}
          <div className="flex items-center gap-2">
            <div className="text-left">
              <div className="text-xs font-semibold text-muted leading-tight">{game.home.abbreviation}</div>
              <div className="text-3xl font-black leading-tight tabular-nums">{game.home.score}</div>
            </div>
            <img src={game.home.logo} alt={game.home.abbreviation} className="w-10 h-10 object-contain" />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
          title="Refresh markets (R)"
        >
          Refresh Markets
        </button>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
          title="Toggle sidebar (S)"
        >
          Toggle Sidebar
        </button>
      </div>
    </header>
  );
}
