// Mobile live-guiding view. Works offline from local data; GPS is opt-in and its state is always shown.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { INITIAL_ARRIVAL, updateArrival, type ArrivalState } from '../domain/arrival';
import { findLeg, stopPairs } from '../domain/duration';
import { formatDistance, formatMinutes, haversineM } from '../domain/geo';
import type { LatLng } from '../domain/types';
import { instructionList } from '../routing/instructions';
import { fossgisFoot } from '../routing/osrm';
import { useAppState } from '../state/store';
import { MapView, type MapStop } from './MapView';
import { SiteInfo } from './SiteInfo';
import { CATALOG } from '../domain/catalog';

interface Progress {
  index: number;
  done: string[];
}

interface Fix {
  position: LatLng;
  accuracyM: number;
  at: number;
}

type GpsState = 'uit' | 'zoeken' | 'actief' | 'geweigerd' | 'fout' | 'niet-ondersteund';

const progressKey = (id: string) => `gids:${id}`;

function loadProgress(id: string): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(progressKey(id)) ?? '');
    if (typeof p.index === 'number' && Array.isArray(p.done)) return p;
  } catch { /* none saved */ }
  return { index: 0, done: [] };
}

export function GuideMode({ id }: { id: string }) {
  const { tours, landmarks, online } = useAppState();
  const tour = tours.find((t) => t.id === id && !t.deleted);
  const lmById = useMemo(() => new Map(landmarks.map((l) => [l.id, l])), [landmarks]);
  const [progress, setProgress] = useState<Progress>(() => loadProgress(id));
  const [gps, setGps] = useState<GpsState>('uit');
  const [fix, setFix] = useState<Fix | null>(null);
  const [arrivalHint, setArrivalHint] = useState(false);
  const [showPoints, setShowPoints] = useState(true);
  const [now, setNow] = useState(Date.now());
  const watchId = useRef<number | null>(null);
  const arrival = useRef<ArrivalState>(INITIAL_ARRIVAL);

  useEffect(() => { localStorage.setItem(progressKey(id), JSON.stringify(progress)); }, [id, progress]);
  useEffect(() => () => stopGps(), []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, []);

  const stops = tour?.stops ?? [];
  const index = Math.min(progress.index, Math.max(stops.length - 1, 0));
  const stop = stops[index];
  const landmark = stop ? lmById.get(stop.landmarkId) : undefined;
  const target = landmark?.position ?? null;
  const prev = index > 0 ? stops[index - 1] : undefined;
  const leg = tour && prev && stop ? findLeg(tour, prev.id, stop.id) : undefined;

  // Arrival detection for the current target.
  useEffect(() => { arrival.current = INITIAL_ARRIVAL; setArrivalHint(false); }, [stop?.id]);
  useEffect(() => {
    if (!fix || !target) return;
    const r = updateArrival(arrival.current, haversineM(fix.position, target), fix.accuracyM, fix.at);
    arrival.current = r.state;
    if (r.triggered && !progress.done.includes(stop!.id)) setArrivalHint(true);
  }, [fix, target]);

  if (!tour) return <main class="guide"><p>Tour niet gevonden. <a href="#/">Terug</a></p></main>;
  if (!stops.length) return <main class="guide"><p>Deze tour heeft nog geen stops. <a href={`#/tour/${tour.id}`}>Bewerken</a></p></main>;

  function startGps() {
    if (!('geolocation' in navigator)) return setGps('niet-ondersteund');
    setGps('zoeken');
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        setFix({ position: { lat: p.coords.latitude, lng: p.coords.longitude }, accuracyM: p.coords.accuracy, at: p.timestamp });
        setGps('actief');
      },
      (err) => setGps(err.code === err.PERMISSION_DENIED ? 'geweigerd' : 'fout'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
  }

  function stopGps() {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setGps('uit');
    setFix(null); // no location history is kept
  }

  function go(to: number) {
    setProgress((p) => ({ ...p, index: Math.max(0, Math.min(stops.length - 1, to)) }));
  }

  function arrived() {
    setArrivalHint(false);
    setProgress((p) => ({ index: Math.min(stops.length - 1, index + 1), done: p.done.includes(stop.id) ? p.done : [...p.done, stop.id] }));
  }

  const isDone = progress.done.includes(stop.id);
  const allDone = stops.every((s) => progress.done.includes(s.id));
  const distToTarget = fix && target ? haversineM(fix.position, target) : null;
  const fixAgeS = fix ? Math.round((now - fix.at) / 1000) : null;
  const steps = leg ? instructionList(leg.steps) : [];

  const mapStops: MapStop[] = stops.flatMap((s, i) => {
    const pos = lmById.get(s.landmarkId)?.position;
    return pos ? [{ id: s.id, label: String(i + 1), position: pos, state: i === index ? 'actief' : progress.done.includes(s.id) ? 'klaar' : 'normaal' }] : [];
  });
  const routes = stopPairs(tour).map(([a, b]) => findLeg(tour, a, b)?.geometry ?? []).filter((g) => g.length > 1);

  return (
    <main class="guide">
      <div class="guide__top">
        <a href={`#/tour/${tour.id}`} class="back">← Bewerken</a>
        <span class="meta">{index + 1} / {stops.length}{allDone ? ' · tour afgerond' : ''}</span>
      </div>

      <section class="next-card">
        <div class="next-card__label">
          <span>{isDone ? 'Afgerond' : index === 0 && !progress.done.length ? 'Eerste stop' : 'Volgende stop'}</span>
          <GpsBadge state={gps} fix={fix} ageS={fixAgeS} />
        </div>
        <h1 class="next-card__name lit">{landmark?.name ?? 'Onbekende stop'}</h1>
        {landmark?.nameKa && <p class="next-card__ka" lang="ka">{landmark.nameKa}</p>}
        <p class="next-card__dist">
          {leg ? `${formatMinutes(leg.durationS / 60)} lopen · ${formatDistance(leg.distanceM)}` : prev ? 'Geen berekende route' : 'Startpunt'}
          {distToTarget !== null && <span> · nog {formatDistance(distToTarget)} hemelsbreed</span>}
        </p>
        {!target && <p class="hint hint--warn">Deze stop heeft geen positie; GPS-aankomst werkt hier niet.</p>}
        {arrivalHint && (
          <div class="arrival">
            <span>Je lijkt bij {landmark?.name} te zijn.</span>
            <button class="btn btn--primary" onClick={arrived}>Bevestigen</button>
            <button class="btn" onClick={() => setArrivalHint(false)}>Nee</button>
          </div>
        )}
        {stop.arrivalNote && <p class="next-card__note lit">{stop.arrivalNote}</p>}
        <div class="next-card__actions">
          <button class="btn btn--primary btn--big" onClick={arrived}>{isDone ? 'Verder' : 'Aangekomen'}</button>
          <button class="btn btn--big" onClick={() => go(index + 1)} disabled={index === stops.length - 1}>Overslaan</button>
        </div>
        <div class="next-card__nav">
          <button class="btn btn--ghost" onClick={() => go(index - 1)} disabled={index === 0}>← Vorige</button>
          {gps === 'uit' || gps === 'geweigerd' || gps === 'fout' || gps === 'niet-ondersteund'
            ? <button class="btn btn--ghost" onClick={startGps}>GPS aanzetten</button>
            : <button class="btn btn--ghost" onClick={stopGps}>GPS uit</button>}
        </div>
        {gps === 'uit' && <p class="hint">GPS wordt alleen gebruikt om je afstand tot de volgende stop te tonen. Er wordt geen locatiegeschiedenis bewaard.</p>}
        {gps === 'geweigerd' && <p class="hint hint--warn">Locatietoegang geweigerd. Sta locatie toe in de browserinstellingen; handmatig gidsen werkt gewoon.</p>}
        {gps === 'niet-ondersteund' && <p class="hint hint--warn">Dit apparaat ondersteunt geen GPS in de browser.</p>}
      </section>

      <section class="guide__section">
        <button class="section-toggle" onClick={() => setShowPoints(!showPoints)} aria-expanded={showPoints}>Vertelpunten ({stop.talkingPoints.length})</button>
        {showPoints && (
          <ul class="points">
            {stop.talkingPoints.map((tp) => (
              <li key={tp.id}><span class={`stamp stamp--${tp.kind}`}>{tp.kind}</span><span class="lit">{tp.text}</span></li>
            ))}
            {!stop.talkingPoints.length && <li class="meta">Geen vertelpunten.</li>}
          </ul>
        )}
        {stop.transition && <p class="guide__transition"><span class="label">Overgang</span> {stop.transition}</p>}
        {stop.guideNotes && <p class="guide__transition"><span class="label">Notities</span> {stop.guideNotes}</p>}
      </section>

      {landmark?.catalogId && (
        <details class="guide__section guide__info">
          <summary>Achtergrond</summary>
          <SiteInfo info={CATALOG.find((c) => c.id === landmark.catalogId)?.info ?? null} osm={landmark.osm} />
        </details>
      )}

      {steps.length > 0 && (
        <details class="guide__section">
          <summary>Looproute naar deze stop ({steps.length} stappen)</summary>
          <ol class="steps">{steps.map((s, i) => <li key={i}><span>{s.text}</span><span class="meta">{s.distance}</span></li>)}</ol>
          <p class="hint">Aanwijzingen uit de opgeslagen route ({fossgisFoot.attribution}); controleer ter plekke.</p>
        </details>
      )}

      <section class="guide__map">
        {!online && <div class="map-banner map-banner--warn">Offline: geen kaartachtergrond. Stops, route en je positie worden wel getoond.</div>}
        <MapView dark stops={mapStops} routes={routes} user={fix} fitKey={`${tour.id}:${mapStops.length}`} attribution={fossgisFoot.attribution} />
      </section>
    </main>
  );
}

function GpsBadge({ state, fix, ageS }: { state: GpsState; fix: Fix | null; ageS: number | null }) {
  if (state === 'actief' && fix) {
    const stale = ageS !== null && ageS > 30;
    return <span class={`gps ${stale ? 'gps--stale' : 'gps--on'}`}>GPS ± {Math.round(fix.accuracyM)} m{stale ? ` · ${ageS}s oud` : ''}</span>;
  }
  if (state === 'zoeken') return <span class="gps">GPS zoeken…</span>;
  return <span class="gps gps--off">GPS uit</span>;
}
