import { useState } from 'react';
import { countBroadcast, countRequest } from '../../messages';

/*
 * Counter state flows through the background service worker as a hub:
 *
 *   view click
 *     → setCount (optimistic local update for instant feedback)
 *     → countRequest.send  (view → background)
 *     → background logs + countBroadcast.send  (background → ALL views)
 *     → countBroadcast.useMessageEffect fires in every open view
 *     → setCount(confirmed value) keeps all views in sync
 */
interface UseCounterReturn {
  count: number;
  add: () => void;
  minus: () => void;
}

export function useCounter(): UseCounterReturn {
  const [count, setCount] = useState(0);

  // Receive confirmed count from background and sync local state.
  countBroadcast.useMessageEffect((data) => {
    setCount(data.value);
  });

  const add = () => {
    const next = count + 1;
    setCount(next); // optimistic update
    countRequest.send({ value: next }).catch(console.error);
  };

  const minus = () => {
    if (count > 0) {
      const next = count - 1;
      setCount(next); // optimistic update
      countRequest.send({ value: next }).catch(console.error);
    }
  };

  return { count, add, minus };
}
