// Arrival detection with hysteresis and cooldown (PRODUCT_SPEC §3).
// It only *suggests* arrival; the guide confirms.

export interface ArrivalConfig {
  enterRadiusM: number;
  exitRadiusM: number;
  /** Fixes worse than this are ignored (GPS drift). */
  maxAccuracyM: number;
  cooldownMs: number;
}

export const DEFAULT_ARRIVAL: ArrivalConfig = {
  enterRadiusM: 30,
  exitRadiusM: 50,
  maxAccuracyM: 40,
  cooldownMs: 60_000,
};

export interface ArrivalState {
  inside: boolean;
  /** When the last arrival suggestion fired, for the cooldown. */
  lastTriggerAt: number | null;
}

export const INITIAL_ARRIVAL: ArrivalState = { inside: false, lastTriggerAt: null };

export interface ArrivalResult {
  state: ArrivalState;
  /** True exactly when a new arrival suggestion should be shown. */
  triggered: boolean;
  /** False when the fix was too inaccurate to use. */
  usable: boolean;
}

export function updateArrival(
  state: ArrivalState,
  distanceM: number,
  accuracyM: number,
  now: number,
  cfg: ArrivalConfig = DEFAULT_ARRIVAL,
): ArrivalResult {
  if (!Number.isFinite(accuracyM) || accuracyM > cfg.maxAccuracyM) {
    return { state, triggered: false, usable: false };
  }
  if (state.inside) {
    if (distanceM > cfg.exitRadiusM) return { state: { ...state, inside: false }, triggered: false, usable: true };
    return { state, triggered: false, usable: true };
  }
  if (distanceM <= cfg.enterRadiusM) {
    const cooling = state.lastTriggerAt !== null && now - state.lastTriggerAt < cfg.cooldownMs;
    return { state: { inside: true, lastTriggerAt: cooling ? state.lastTriggerAt : now }, triggered: !cooling, usable: true };
  }
  return { state, triggered: false, usable: true };
}
