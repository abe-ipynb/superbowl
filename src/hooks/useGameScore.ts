import { useEffect, useRef, useState } from 'react';
import { fetchGameScore, getPollInterval, type GameScore } from '../lib/espn';

export function useGameScore() {
  const [game, setGame] = useState<GameScore | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const score = await fetchGameScore();
      if (cancelled) return;
      if (score) setGame(score);

      const interval = getPollInterval(score?.status);
      if (interval > 0 && !cancelled) {
        timerRef.current = setTimeout(poll, interval);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return game;
}
