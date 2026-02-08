import { useEffect } from 'react';
import { useAppDispatch } from '../state/context';

export function useKeyboardShortcuts(onRefresh: () => void) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Ignore when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case 's':
          e.preventDefault();
          dispatch({ type: 'TOGGLE_SIDEBAR' });
          break;
        case 'r':
          e.preventDefault();
          onRefresh();
          break;
        case 'escape':
          dispatch({ type: 'SET_SEARCH_QUERY', query: '' });
          break;
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch, onRefresh]);
}
