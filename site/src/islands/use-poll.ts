// Why: the live parts of the studio ask again on their own, but only while the page is in view: a hidden tab
// asks nothing, and coming back to it asks at once. Each ask says how long to wait before the next, or null
// to stop (a finished run has nothing more to say).
import { useEffect } from 'react';

export function usePoll(ask: () => Promise<number | null>): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let done = false;
    const tick = async (): Promise<void> => {
      if (document.visibilityState === 'hidden') return;
      const wait = await ask();
      if (stopped) return;
      if (wait === null) {
        done = true;
        return;
      }
      timer = setTimeout(() => void tick(), wait);
    };
    const onVisible = (): void => {
      if (document.visibilityState !== 'visible' || done) return;
      clearTimeout(timer);
      void tick();
    };
    void tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ask]);
}
