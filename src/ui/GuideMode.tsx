// Mobile live-guiding view. Works offline from local data; GPS is opt-in and its state is always shown.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { INITIAL_ARRIVAL, updateArrival, type ArrivalState } from '../domain/arrival';
import { findLeg, stopPairs } from '../domain/duration';
import { formatDistance, formatMinutes, haversineM } from '../domain/geo';
import type { Departure, LatLng } from '../domain/types';
import { instructionList } from '../routing/instructions';
import { fossgisFoot } from '../routing/osrm';
import { currentRecord, saveRecord, useAppState } from '../state/store';
import { tourMinutes } from '../domain/quickBooking';
import { isoDate } from '../domain/agenda';
import { departureForGuide } from '../domain/checkin';
import { CheckIn, useHeadcount } from './CheckIn';
import { PracticalLine } from './Practical';
import { MapView, type MapStop } from './MapView';
import { SiteInfo } from './SiteInfo';
import { OfflineMapControl } from './OfflineMapControl';
import { useMapStored } from '../map/offlineMap';
import { CATALOG } from '../domain/catalog';
import { linkedClaim, mergedResearch } from '../domain/research';
import { WikiText } from './WikiText';

/** Where the guide is: walking to stops[index], or standing at it (here). Saved per tour, so a reload keeps the place. */
interface Progress {
  index: number;
  done: string[];
  here?: boolean;
  ended?: boolean;
  /** When the guide arrived at the first stop (ms), to compare the time with the plan. */
  startedAt?: number;
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

/** The guest list while guiding: open before the tour starts, then folded to just the headcount. */
function GuestSection({ departure, open }: { departure: Departure; open: boolean }) {
  const headcount = useHeadcount(departure.id);
  return (
    <details class="guide__section guide__guests" open={open}>
      <summary>Gasten: {headcount}</summary>
      <CheckIn departure={departure} hideTotal />
      <p class="hint">Komt er iemand zonder boeking? <a href={`#/vertrek/${departure.id}`}>Voeg een boeking toe</a>.</p>
    </details>
  );
}

export function GuideMode({ id, departureId }: { id: string; departureId?: string }) {
  const { tours, landmarks, online, products, departures } = useAppState();
  const departure = departureForGuide(id, products, departures, isoDate(new Date()), departureId);
  const tour = tours.find((t) => t.id === id && !t.deleted);
  const lmById = useMemo(() => new Map(landmarks.map((l) => [l.id, l])), [landmarks]);
  const [progress, setProgress] = useState<Progress>(() => loadProgress(id));
  const [gps, setGps] = useState<GpsState>('uit');
  const [fix, setFix] = useState<Fix | null>(null);
  const [arrivalHint, setArrivalHint] = useState(false);
  // The GPS explanation shows once, at the start of a tour; after that it sits behind the ⓘ button.
  const [gpsInfo, setGpsInfo] = useState<boolean | null>(null);
  const [now, setNow] = useState(Date.now());
  const watchId = useRef<number | null>(null);
  const arrival = useRef<ArrivalState>(INITIAL_ARRIVAL);
  const mapStored = useMapStored();

  useEffect(() => { localStorage.setItem(progressKey(id), JSON.stringify(progress)); }, [id, progress]);
  useEffect(() => () => stopGps(), []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, []);

  const stops = tour?.stops ?? [];
  const index = Math.min(progress.index, Math.max(stops.length - 1, 0));
  const here = !!progress.here;
  const stop = stops[index];
  const next = stops[index + 1];
  const landmark = stop ? lmById.get(stop.landmarkId) : undefined;
  const nextLandmark = next ? lmById.get(next.landmarkId) : undefined;
  const target = landmark?.position ?? null;
  const prev = index > 0 ? stops[index - 1] : undefined;
  const leg = tour && prev && stop ? findLeg(tour, prev.id, stop.id) : undefined;
  const nextLeg = tour && next && stop ? findLeg(tour, stop.id, next.id) : undefined;

  // Arrival detection for the stop being walked to. Standing at a stop, there is nothing to detect.
  useEffect(() => { arrival.current = INITIAL_ARRIVAL; setArrivalHint(false); }, [stop?.id, here]);
  useEffect(() => {
    if (!fix || !target || here) return;
    const r = updateArrival(arrival.current, haversineM(fix.position, target), fix.accuracyM, fix.at);
    arrival.current = r.state;
    if (r.triggered) setArrivalHint(true);
  }, [fix, target, here]);

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

  const top = () => window.scrollTo({ top: 0, behavior: 'auto' });
  /** Standing at a stop: its story is on screen until the guide moves on. */
  function arrived() {
    setArrivalHint(false);
    setProgress((p) => ({ index, here: true, ended: false, startedAt: p.startedAt ?? Date.now(), done: p.done.includes(stop.id) ? p.done : [...p.done, stop.id] }));
    top();
  }
  function moveOn() {
    if (!next) {
      setProgress((p) => ({ ...p, ended: true }));
      // The departure is done too, so Vandaag and the messages know the tour has happened.
      const cur = departure && currentRecord('departures', departure.id);
      if (cur && cur.status !== 'geannuleerd' && cur.status !== 'afgerond') void saveRecord('departures', { ...cur, status: 'afgerond' });
    }
    else setProgress((p) => ({ ...p, index: index + 1, here: false }));
    top();
  }
  function skip() {
    if (next) setProgress((p) => ({ ...p, index: index + 1, here: false }));
    top();
  }
  /** Back always lands on a stop's story: from the walk to stop 3, or from stop 3 itself, back to stop 2. */
  function back() {
    if (progress.ended) setProgress((p) => ({ ...p, ended: false, here: true }));
    else if (index > 0) setProgress((p) => ({ ...p, index: index - 1, here: true }));
    top();
  }

  const showGpsInfo = gpsInfo ?? (gps === 'uit' && index === 0 && !progress.done.length);
  const ended = !!progress.ended;
  const distToTarget = fix && target ? haversineM(fix.position, target) : null;
  const fixAgeS = fix ? Math.round((now - fix.at) / 1000) : null;
  const steps = leg ? instructionList(leg.steps) : [];
  const research = mergedResearch(landmark);
  const starting = index === 0 && !progress.done.length && !here;
  const product = departure ? products.find((p) => p.id === departure.productId) : undefined;
  const plannedMin = product?.durationMin ?? tourMinutes(tour);
  const elapsedMin = progress.startedAt ? Math.max(0, Math.round((now - progress.startedAt) / 60000)) : null;
  const late = elapsedMin !== null && plannedMin !== null && elapsedMin > plannedMin;
  const clock = elapsedMin !== null && (
    <p class={`next-card__time ${late ? 'is-late' : ''}`}>{ended ? `Duurde ${elapsedMin} min` : `${elapsedMin} min bezig`}{plannedMin ? ` · gepland ${plannedMin} min` : ''}</p>
  );

  const mapStops: MapStop[] = stops.flatMap((s, i) => {
    const pos = lmById.get(s.landmarkId)?.position;
    return pos ? [{ id: s.id, label: String(i + 1), position: pos, state: !ended && i === index ? 'actief' : progress.done.includes(s.id) ? 'klaar' : 'normaal' }] : [];
  });
  const routes = stopPairs(tour).map(([a, b]) => findLeg(tour, a, b)?.geometry ?? []).filter((g) => g.length > 1);

  const points = (
    <ul class="points">
      {stop.talkingPoints.map((tp) => {
        // Points copied from research show when their claim is not verified (yet).
        const status = linkedClaim(tp, research)?.status;
        return (
          <li key={tp.id}>
            <span class="points__stamps">
              <span class={`stamp stamp--${tp.kind}`}>{tp.kind}</span>
              {status && status !== 'geverifieerd' && <span class={`stamp stamp--${status}`}>{status === 'concept' ? 'niet geverifieerd' : 'afgewezen'}</span>}
            </span>
            <span class="lit"><WikiText text={tp.text} /></span>
          </li>
        );
      })}
      {!stop.talkingPoints.length && <li class="meta">Geen vertelpunten.</li>}
    </ul>
  );

  const gpsControls = (
    <>
      <div class="next-card__nav">
        <button class="btn btn--ghost" onClick={back} disabled={index === 0 && !ended}>← Vorige</button>
        <span class="next-card__gps">
          {gps === 'uit' || gps === 'geweigerd' || gps === 'fout' || gps === 'niet-ondersteund'
            ? <button class="btn btn--ghost" onClick={startGps}>GPS aanzetten</button>
            : <button class="btn btn--ghost" onClick={stopGps}>GPS uit</button>}
          <button class="icon-btn" aria-label="Uitleg over GPS" aria-expanded={showGpsInfo} onClick={() => setGpsInfo(!showGpsInfo)}>ⓘ</button>
        </span>
      </div>
      {showGpsInfo && <p class="hint">GPS wordt alleen gebruikt om je afstand tot de volgende stop te tonen. Er wordt geen locatiegeschiedenis bewaard.</p>}
      {gps === 'geweigerd' && <p class="hint hint--warn">Locatietoegang geweigerd. Sta locatie toe in de browserinstellingen; handmatig gidsen werkt gewoon.</p>}
      {gps === 'niet-ondersteund' && <p class="hint hint--warn">Dit apparaat ondersteunt geen GPS in de browser.</p>}
    </>
  );

  return (
    <main class="guide">
      {/* Minimal header: the app menu is hidden while guiding (App.tsx), so a stray tap never leaves the tour. */}
      <header class="guide__top">
        {departure
          ? <a href={`#/vertrek/${departure.id}`} class="back">← Vertrek</a>
          : <a href={`#/tour/${tour.id}`} class="back">← Tour</a>}
        <span class="guide__count">{ended ? 'Afgerond' : `${index + 1} / ${stops.length}`}</span>
        <GpsBadge state={gps} fix={fix} ageS={fixAgeS} />
      </header>
      <div class="guide__progress" role="progressbar" aria-label="Voortgang van de tour" aria-valuemin={0} aria-valuemax={stops.length} aria-valuenow={progress.done.length}>
        <span style={{ width: `${(progress.done.length / stops.length) * 100}%` }} />
      </div>

      {departure && <GuestSection departure={departure} open={starting} />}

      {ended ? (
        <section class="next-card">
          <div class="next-card__label"><span>Tour afgerond</span></div>
          <h1 class="next-card__name lit">{tour.title}</h1>
          <p class="next-card__dist">{progress.done.length} van {stops.length} stops</p>
          {clock}
          {departure && (
            <div class="next-card__actions next-card__actions--one">
              <a class="btn btn--primary btn--big" href={`#/vertrek/${departure.id}`}>Betaling en terugblik</a>
            </div>
          )}
          {gpsControls}
        </section>
      ) : here ? (
        <>
          <section class="next-card next-card--here">
            <div class="next-card__label"><span>Je bent hier · stop {index + 1} van {stops.length}</span></div>
            {clock}
            <h1 class="next-card__name lit">{landmark?.name ?? 'Onbekende stop'}</h1>
            {landmark?.nameKa && <p class="next-card__ka" lang="ka">{landmark.nameKa}</p>}
            {stop.arrivalNote && <p class="next-card__note lit">{stop.arrivalNote}</p>}
          </section>

          <section class="guide__section guide__story" aria-label="Vertellen">
            {points}
            {stop.guideNotes && (
              <details class="guide__notes">
                <summary>Vragen en notities</summary>
                <p class="lit">{stop.guideNotes}</p>
              </details>
            )}
          </section>

          <section class="next-card guide__onward">
            {stop.transition && <p class="guide__transition lit">{stop.transition}</p>}
            <div class="next-card__actions next-card__actions--one">
              <button class="btn btn--primary btn--big" onClick={moveOn}>
                {nextLandmark ? `Verder naar ${nextLandmark.name}` : 'Tour afronden'}
              </button>
            </div>
            {nextLeg && <p class="next-card__dist">{formatMinutes(nextLeg.durationS / 60)} lopen · {formatDistance(nextLeg.distanceM)}</p>}
            {gpsControls}
          </section>
        </>
      ) : (
        <>
          <section class="next-card">
            <div class="next-card__label">
              <span>{starting ? 'Eerste stop' : 'Onderweg naar'}</span>
            </div>
            <h1 class="next-card__name lit">{landmark?.name ?? 'Onbekende stop'}</h1>
            {landmark?.nameKa && <p class="next-card__ka" lang="ka">{landmark.nameKa}</p>}
            <p class="next-card__dist">
              {leg ? `${formatMinutes(leg.durationS / 60)} lopen · ${formatDistance(leg.distanceM)}` : prev ? 'Geen berekende route' : 'Startpunt'}
              {distToTarget !== null && <span> · nog {formatDistance(distToTarget)} hemelsbreed</span>}
            </p>
            {!target && <p class="hint hint--warn">Deze stop heeft geen positie; GPS-aankomst werkt hier niet.</p>}
            {starting && product?.meetingPoint && <p class="next-card__meet"><span class="label">Verzamelen</span> {product.meetingPoint}</p>}
            {!starting && clock}
            {arrivalHint && (
              <div class="arrival">
                <span>Je lijkt bij {landmark?.name} te zijn.</span>
                <button class="btn btn--primary" onClick={arrived}>Bevestigen</button>
                <button class="btn" onClick={() => setArrivalHint(false)}>Nee</button>
              </div>
            )}
            {stop.arrivalNote && <p class="next-card__note lit">{stop.arrivalNote}</p>}
            <div class="next-card__actions">
              <button class="btn btn--primary btn--big" onClick={arrived}>Aangekomen</button>
              <button class="btn btn--big" onClick={skip} disabled={!next}>Overslaan</button>
            </div>
            {gpsControls}
          </section>

          <details class="guide__section">
            <summary>Vooruitkijken: vertelpunten ({stop.talkingPoints.length})</summary>
            {points}
          </details>
        </>
      )}

      {!ended && !!landmark?.practical?.length && (
        <details class="guide__section">
          <summary>Praktisch ({landmark.practical.length})</summary>
          <ul class="practical__list">{landmark.practical.map((n) => <li key={n.id}><div class="practical__text"><PracticalLine note={n} /></div></li>)}</ul>
        </details>
      )}

      {!ended && here && landmark?.catalogId && (
        <details class="guide__section guide__info">
          <summary>Achtergrond</summary>
          <SiteInfo info={CATALOG.find((c) => c.id === landmark.catalogId)?.info ?? null} osm={landmark.osm} />
        </details>
      )}

      {!ended && !here && steps.length > 0 && (
        <details class="guide__section">
          <summary>Looproute naar deze stop ({steps.length} stappen)</summary>
          <ol class="steps">{steps.map((s, i) => <li key={i}><span>{s.text}</span><span class="meta">{s.distance}</span></li>)}</ol>
          <p class="hint">Aanwijzingen uit de opgeslagen route ({fossgisFoot.attribution}); controleer ter plekke.</p>
        </details>
      )}

      <OfflineMapControl compact />

      <section class="guide__map">
        {!online && mapStored === false && <div class="map-banner map-banner--warn">Offline en geen opgeslagen kaart: alleen stops, route en je positie.</div>}
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
