import { useAppDispatch } from '../state/context';
import { formatGameClock } from '../lib/espn';
import type { GameScore } from '../lib/espn';

interface HeaderProps {
  onRefresh: () => void;
  game: GameScore | null;
}

export default function Header({ onRefresh, game }: HeaderProps) {
  const dispatch = useAppDispatch();
  return (
    <header className="relative overflow-hidden bg-gradient-to-r from-indigo-950 via-purple-900 to-indigo-950 px-8 py-4">
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 text-[120px] leading-none select-none">🏈</div>
        <div className="absolute bottom-0 right-1/4 text-[100px] leading-none select-none">🐰</div>
      </div>

      <div className="relative flex items-center justify-between gap-6">
        {/* Title block */}
        <div className="flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🏈</span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">
                ABE'S SUPER BOWL LX
              </h1>
              <p className="text-sm font-semibold text-purple-300 tracking-widest uppercase">
                Watch Party 🐰 🌴 🎶
              </p>
            </div>
          </div>
        </div>

        {/* Scoreboard */}
        {game && (
          <div className="flex items-center gap-5 bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-3">
            {/* Away team */}
            <div className="flex items-center gap-3">
              <img
                src={game.away.logo}
                alt={game.away.abbreviation}
                className="w-14 h-14 object-contain drop-shadow-lg"
              />
              <div className="text-right">
                <div className="text-xs font-bold text-purple-300 tracking-wide">{game.away.abbreviation}</div>
                <div className="text-4xl font-black text-white leading-tight tabular-nums">{game.away.score}</div>
              </div>
            </div>

            {/* Game clock */}
            <div className="flex flex-col items-center min-w-32">
              <div className={`text-sm font-bold px-4 py-1 rounded-full ${
                game.status.name === 'STATUS_IN_PROGRESS'
                  ? 'bg-red-500/80 text-white'
                  : game.status.name === 'STATUS_HALFTIME'
                    ? 'bg-yellow-500/80 text-white'
                    : game.status.name === 'STATUS_FINAL'
                      ? 'bg-white/20 text-white'
                      : 'bg-blue-500/80 text-white'
              }`}>
                {formatGameClock(game.status)}
              </div>
              {game.status.name === 'STATUS_IN_PROGRESS' && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-red-300 uppercase tracking-widest">Live</span>
                </div>
              )}
            </div>

            {/* Home team */}
            <div className="flex items-center gap-3">
              <div className="text-left">
                <div className="text-xs font-bold text-purple-300 tracking-wide">{game.home.abbreviation}</div>
                <div className="text-4xl font-black text-white leading-tight tabular-nums">{game.home.score}</div>
              </div>
              <img
                src={game.home.logo}
                alt={game.home.abbreviation}
                className="w-14 h-14 object-contain drop-shadow-lg"
              />
            </div>
          </div>
        )}

        {/* Right section: Spotify + buttons */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-semibold text-white transition-colors"
            title="Refresh markets (R)"
          >
            Refresh
          </button>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            className="px-4 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-semibold text-white transition-colors"
            title="Toggle sidebar (S)"
          >
            Sidebar
          </button>
        </div>
      </div>
    </header>
  );
}
