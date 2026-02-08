import { useAppState } from '../state/context';

const statusConfig = {
  connected: { color: 'bg-up', label: 'Connected' },
  disconnected: { color: 'bg-down', label: 'Disconnected' },
  reconnecting: { color: 'bg-yellow-500', label: 'Reconnecting' },
} as const;

export default function StatusBar() {
  const { wsStatus, pinnedGroups, lastTickTime } = useAppState();
  const config = statusConfig[wsStatus];

  return (
    <footer className="flex items-center gap-6 px-8 py-2 bg-white border-t border-border text-xs text-muted">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${config.color}`} />
        <span>WS: {config.label}</span>
      </div>
      <span>{pinnedGroups.length}/8 markets live</span>
      {lastTickTime && (
        <span>Last tick: {new Date(lastTickTime).toLocaleTimeString('en-US', { timeZone: 'America/New_York' })} ET</span>
      )}
      <span className="ml-auto">S: sidebar &middot; R: refresh &middot; Esc: clear search</span>
    </footer>
  );
}
