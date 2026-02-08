import { useEffect, useRef, useState } from 'react';
import { useAppState } from '../state/context';

const statusConfig = {
  connected: { color: 'bg-up', label: 'Connected' },
  disconnected: { color: 'bg-down', label: 'Disconnected' },
  reconnecting: { color: 'bg-yellow-500', label: 'Reconnecting' },
} as const;

const etFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

export default function StatusBar() {
  const { wsStatus, pinnedGroups, lastTickTime } = useAppState();
  const config = statusConfig[wsStatus];
  const [flash, setFlash] = useState(false);
  const prevTickRef = useRef(lastTickTime);

  useEffect(() => {
    if (lastTickTime && lastTickTime !== prevTickRef.current) {
      prevTickRef.current = lastTickTime;
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(timer);
    }
  }, [lastTickTime]);

  return (
    <footer className="flex items-center gap-6 px-8 py-2 bg-white border-t border-border text-xs text-muted">
      <div className={`flex items-center gap-2 px-2 py-0.5 rounded transition-colors duration-300 ${
        flash ? 'bg-green-100 text-green-700' : ''
      }`}>
        <span className={`w-2 h-2 rounded-full transition-colors duration-300 ${
          flash ? 'bg-green-500' : config.color
        }`} />
        <span>WS: {config.label}</span>
      </div>
      <span>{pinnedGroups.length}/8 markets live</span>
      {lastTickTime && (
        <span>Odds updated: {etFmt.format(new Date(lastTickTime))} ET</span>
      )}
      <span className="ml-auto">S: sidebar &middot; R: refresh &middot; Esc: clear search</span>
    </footer>
  );
}
