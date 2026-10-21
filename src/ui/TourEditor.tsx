import { useMemo, useState } from 'preact/hooks';
import { stopPairs, findLeg } from '../domain/duration';
import { createLandmark, createStop, nowIso } from '../domain/factory';
import type { Landmark, LatLng, Tour, TourStatus, TourStop } from '../domain/types';
import { fossgisFoot } from '../routing/osrm';
import { RoutingError } from '../routing/provider';
import { deleteTour, saveLandmark, saveTour, useAppState } from '../state/store';
import { MapView, type MapStop } from './MapView';
import { Ribbon } from './Ribbon';
import { StopCard } from './StopCard';
import { navigate } from './router';

type Pick = { mode: 'nieuw' } | { mode: 'positie'; landmarkId: string } | null;

export function TourEditor({ id }: { id: string }) {
  const { tours, landmarks, online } = useAppState();
  const tour = tours.find((t) => t.id === id && !t.deleted);
  const [pick, setPick] = useState<Pick>(null);
  const [routeMsg, setRouteMsg] = useState<{ text: string; warn?: boolean } | null>(null);
  const [routing, setRouting] = useState(false);
  const lmById = useMemo(() => new Map(landmarks.map((l) => [l.id, l])), [landmarks]);

  if (!tour) return <main class="page"><p>Tour niet gevonden. <a href="#/">Terug naar tours</a></p></main>;

  const update = (patch: Partial<Tour>) => saveTour({ ...tour, ...patch });
  const setStops = (stops: TourStop[]) => update({ stops });

  const usage = (landmarkId: string) => tours.filter((t) => !t.deleted && t.stops.some((s) => s.landmarkId === landmarkId)).length;

  async function onMapClick(p: LatLng) {
    if (!pick) return;
    if (pick.mode === 'nieuw') {
      const lm = createLandmark(`Nieuwe stop ${tour!.stops.length + 1}`, p, 'kaart');
      await saveLandmark(lm);
      await setStops([...tour!.stops, createStop(lm.id)]);
    } else {
      const lm = lmById.get(pick.landmarkId);
      if (lm) {
        await saveLandmark({ ...lm, position: p, positionSource: 'kaart' });
        await invalidateLegsFor(lm.id);
      }
    }
    setPick(null);
  }

  /** A moved landmark makes stored routes to/from it wrong in every tour that uses it. */
  async function invalidateLegsFor(landmarkId: string) {
    for (const t of tours.filter((x) => !x.deleted)) {
      const stopIds = new Set(t.stops.filter((s) => s.landmarkId === landmarkId).map((s) => s.id));
      if (!stopIds.size) continue;
      const legs = t.legs.filter((l) => !stopIds.has(l.fromStopId) && !stopIds.has(l.toStopId));
      if (legs.length !== t.legs.length) await saveTour({ ...t, legs });
    }
  }

  function move(i: number, dir: -1 | 1) {
    const stops = tour!.stops.slice();
    [stops[i], stops[i + dir]] = [stops[i + dir], stops[i]];
    void setStops(stops);
  }

  async function computeRoute() {
    const pts = tour!.stops.map((s) => lmById.get(s.landmarkId)?.position ?? null);
    if (pts.length < 2) return setRouteMsg({ text: 'Minstens twee stops nodig.', warn: true });
    if (pts.some((p) => !p)) return setRouteMsg({ text: 'Elke stop heeft een positie nodig voordat de route berekend kan worden.', warn: true });
    setRouting(true);
    setRouteMsg(null);
    try {
      const legs = await fossgisFoot.route(pts as LatLng[]);
      const now = nowIso();
      await update({
        legs: legs.map((l, i) => ({ ...l, fromStopId: tour!.stops[i].id, toStopId: tour!.stops[i + 1].id, provider: fossgisFoot.id, computedAt: now })),
      });
      setRouteMsg({ text: 'Looproute berekend en opgeslagen (ook offline beschikbaar).' });
    } catch (e) {
      setRouteMsg({ text: e instanceof RoutingError ? e.message : 'Route berekenen mislukt.', warn: true });
    } finally {
      setRouting(false);
    }
  }

  const mapStops: MapStop[] = tour.stops.flatMap((s, i) => {
    const pos = lmById.get(s.landmarkId)?.position;
    return pos ? [{ id: s.id, label: String(i + 1), position: pos }] : [];
  });
  const routes = stopPairs(tour).map(([a, b]) => findLeg(tour, a, b)?.geometry ?? []).filter((g) => g.length > 1);
  const gaps = stopPairs(tour).flatMap(([a, b]): [LatLng, LatLng][] => {
    if (findLeg(tour, a, b)) return [];
    const pa = lmById.get(tour.stops.find((s) => s.id === a)!.landmarkId)?.position;
    const pb = lmById.get(tour.stops.find((s) => s.id === b)!.landmarkId)?.position;
    return pa && pb ? [[pa, pb]] : [];
  });
  const usedIds = new Set(tour.stops.map((s) => s.landmarkId));
  const reusable = landmarks.filter((l) => !l.deleted && !usedIds.has(l.id)).sort((a, b) => a.name.localeCompare(b.name, 'nl'));

  return (
    <main class="editor">
      <section class="editor__panel">
        <div class="page__head">
          <a href="#/" class="back">← Tours</a>
          <a class="btn btn--primary" href={`#/gids/${tour.id}`}>Gidsen</a>
        </div>
        <input class="title-input lit" value={tour.title} aria-label="Titel" onInput={(e) => update({ title: e.currentTarget.value })} />
        <div class="row">
          <label>Status
            <select value={tour.status} onChange={(e) => update({ status: e.currentTarget.value as TourStatus })}>
              <option value="concept">Concept</option>
              <option value="beoordeeld">Beoordeeld</option>
              <option value="klaar">Klaar om te gidsen</option>
            </select>
          </label>
          <label class="narrow">Pauzes (min)
            <input type="number" min={0} step={5} value={tour.breakMinutes} onInput={(e) => update({ breakMinutes: Math.max(0, Number(e.currentTarget.value) || 0) })} />
          </label>
        </div>
        <label>Thema<input value={tour.theme} onInput={(e) => update({ theme: e.currentTarget.value })} /></label>
        <label>Beschrijving<textarea rows={2} value={tour.description} onInput={(e) => update({ description: e.currentTarget.value })} /></label>

        <Ribbon tour={tour} />
        <div class="row">
          <button class="btn" disabled={routing || !online} onClick={computeRoute}>{routing ? 'Berekenen…' : 'Looproute berekenen'}</button>
          {!online && <span class="hint hint--warn">Route berekenen vereist internet.</span>}
        </div>
        {routeMsg && <p class={`hint ${routeMsg.warn ? 'hint--warn' : ''}`}>{routeMsg.text}</p>}

        <h2>Stops</h2>
        <ol class="stop-list">
          {tour.stops.map((s, i) => (
            <StopCard
              key={s.id}
              index={i}
              count={tour.stops.length}
              stop={s}
              landmark={lmById.get(s.landmarkId)}
              usedInTours={usage(s.landmarkId)}
              picking={pick?.mode === 'positie' && pick.landmarkId === s.landmarkId}
              onStop={(ns) => setStops(tour.stops.map((x) => (x.id === ns.id ? ns : x)))}
              onLandmark={(l: Landmark) => saveLandmark(l)}
              onMove={(dir) => move(i, dir)}
              onRemove={() => setStops(tour.stops.filter((x) => x.id !== s.id))}
              onPickPosition={() => setPick({ mode: 'positie', landmarkId: s.landmarkId })}
            />
          ))}
        </ol>
        <div class="add-stop">
          <button class={`btn ${pick?.mode === 'nieuw' ? 'btn--active' : ''}`} onClick={() => setPick(pick?.mode === 'nieuw' ? null : { mode: 'nieuw' })}>
            {pick?.mode === 'nieuw' ? 'Klik op de kaart om de stop te plaatsen…' : 'Nieuwe stop op de kaart'}
          </button>
          {reusable.length > 0 && (
            <select aria-label="Bestaande bezienswaardigheid toevoegen" value="" onChange={(e) => {
              const v = e.currentTarget.value;
              if (v) void setStops([...tour.stops, createStop(v)]);
            }}>
              <option value="">Bestaande bezienswaardigheid…</option>
              {reusable.map((l) => <option value={l.id}>{l.name}</option>)}
            </select>
          )}
        </div>

        <details class="danger-zone">
          <summary>Tour verwijderen</summary>
          <p class="hint">Bezienswaardigheden en hun gedeelde kennis blijven bewaard.</p>
          <button class="btn btn--danger" onClick={async () => { await deleteTour(tour); navigate('/'); }}>Tour definitief verwijderen</button>
        </details>
      </section>

      <section class={`editor__map ${pick ? 'editor__map--picking' : ''}`}>
        {pick && <div class="map-banner">Klik op de kaart om {pick.mode === 'nieuw' ? 'een nieuwe stop te plaatsen' : 'de positie te kiezen'} · <button class="link" onClick={() => setPick(null)}>Annuleren</button></div>}
        {!online && <div class="map-banner map-banner--warn">Offline: kaartachtergrond niet beschikbaar; stops en opgeslagen routes wel.</div>}
        <MapView stops={mapStops} routes={routes} gaps={gaps} onMapClick={onMapClick} fitKey={`${tour.id}:${mapStops.length}`} attribution={fossgisFoot.attribution} />
      </section>
    </main>
  );
}
