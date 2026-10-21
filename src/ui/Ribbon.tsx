// Signature pattern: the walk-and-talk ribbon (.interface-design/system.md).
import { findLeg, tourDuration } from '../domain/duration';
import { formatDistance, formatMinutes } from '../domain/geo';
import type { Tour } from '../domain/types';

export function Ribbon({ tour, compact }: { tour: Tour; compact?: boolean }) {
  const d = tourDuration(tour);
  const segments: { kind: 'talk' | 'walk' | 'gap' | 'break'; min: number; key: string }[] = [];
  tour.stops.forEach((s, i) => {
    if (i > 0) {
      const leg = findLeg(tour, tour.stops[i - 1].id, s.id);
      segments.push(leg ? { kind: 'walk', min: leg.durationS / 60, key: `w${s.id}` } : { kind: 'gap', min: 3, key: `g${s.id}` });
    }
    segments.push({ kind: 'talk', min: Math.max(s.speakingMinutes, 0.5), key: `t${s.id}` });
  });
  if (d.breakMin > 0) segments.push({ kind: 'break', min: d.breakMin, key: 'pauze' });

  return (
    <div class="ribbon" aria-label={`Tourduur ${formatMinutes(d.totalMin)}`}>
      {segments.length > 0 && (
        <div class="ribbon__bar" aria-hidden="true">
          {segments.map((s) => <div key={s.key} class={`ribbon__seg ribbon__seg--${s.kind}`} style={{ flexGrow: s.min }} />)}
        </div>
      )}
      <div class="ribbon__meta">
        <span>vertellen {formatMinutes(d.speakingMin)} · lopen {formatMinutes(d.walkingMin)}{d.breakMin ? ` · pauze ${formatMinutes(d.breakMin)}` : ''}</span>
        <span class="ribbon__total">{d.missingLegs ? '≥ ' : ''}{formatMinutes(d.totalMin)}</span>
      </div>
      {!compact && d.missingLegs > 0 && (
        <p class="hint hint--warn">{d.missingLegs} looptraject(en) zonder berekende route: looptijd daarvan ontbreekt in het totaal.</p>
      )}
      {!compact && d.walkingDistanceM > 0 && <p class="hint">Loopafstand {formatDistance(d.walkingDistanceM)} (berekende voetgangersroute).</p>}
    </div>
  );
}
