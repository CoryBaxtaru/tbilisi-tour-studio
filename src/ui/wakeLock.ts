// Keeps the phone screen on while guiding. When the screen goes dark the browser stops GPS updates, so the
// arrival check would miss the next stop. The browser drops the lock when the tab is hidden; it is asked again
// when the tab comes back. Free browser API; does nothing where it is missing.
import { useEffect, useState } from 'preact/hooks';

interface Sentinel { release(): Promise<void>; addEventListener(type: 'release', fn: () => void): void }
type WakeLockApi = { request(type: 'screen'): Promise<Sentinel> };

export type WakeState = 'aan' | 'uit' | 'niet-ondersteund';

export function useWakeLock(): WakeState {
  const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
  const [state, setState] = useState<WakeState>(api ? 'uit' : 'niet-ondersteund');

  useEffect(() => {
    if (!api) return;
    let sentinel: Sentinel | null = null;
    let gone = false;
    const ask = async () => {
      if (gone || sentinel || document.visibilityState !== 'visible') return;
      try {
        const s = await api.request('screen');
        if (gone) return void s.release();
        sentinel = s;
        setState('aan');
        s.addEventListener('release', () => { sentinel = null; if (!gone) setState('uit'); });
      } catch {
        setState('uit'); // e.g. battery saver refuses it
      }
    };
    void ask();
    document.addEventListener('visibilitychange', ask);
    return () => {
      gone = true;
      document.removeEventListener('visibilitychange', ask);
      void sentinel?.release().catch(() => undefined);
    };
  }, []);

  return state;
}
