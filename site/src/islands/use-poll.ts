// Why: the live parts of the studio ask again on their own, but only while the page is in view: a hidden tab
// asks nothing, and coming back to it asks at once. Each ask says how long to wait before the next, or null
// to stop (a finished run has nothing more to say). Only one ask is ever out at a time, so coming back to the
// tab mid-ask cannot start a second loop, and an older answer can never land after a newer one.
import { useEffect } from 'react';

export function usePoll(ask: () => Promise<number | null>): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let done = false;
    let asking = false;
    const tick = async (): Promise<void> => {
      if (done || asking || document.visibilityState === 'hidden') return;
      asking = true;
      clearTimeout(timer);
      let wait: number | null;
      try {
        wait = await ask();
      } finally {
        asking = false;
      }
      if (stopped) return;
      if (wait === null) {
        done = true;
        return;
      }
      timer = setTimeout(() => void tick(), wait);
    };
    const onVisible = (): void => {
      if (document.visibilityState !== 'visible') return;
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
