import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { buildDeck, CATALOG, catalogLandmarkId, landmarkFromCatalog, type DeckCard } from '../domain/catalog';
import { findLeg, stopPairs } from '../domain/duration';
import { createLandmark, nowIso } from '../domain/factory';
import { formatDistance, formatMinutes } from '../domain/geo';
import { EMPTY_FILTER, matchesFilter, type DeckFilter } from '../domain/tags';
import { insertStop, moveStop, removeStop } from '../domain/tourOps';
import type { Landmark, LatLng, Tour, TourStatus } from '../domain/types';
import { fossgisFoot } from '../routing/osrm';
import { RoutingError } from '../routing/provider';
import { currentTour, deleteTour, ensureLandmark, saveLandmark, saveTour, useAppState } from '../state/store';
import { CardDeck, type Anchor, type DeckSort } from './CardDeck';
import { MapView, type MapDot, type MapStop } from './MapView';
import { Ribbon } from './Ribbon';
import { StopCard } from './StopCard';
import { navigate } from './router';
import { useRouteSortable } from './sortable';
import { useMapStored } from '../map/offlineMap';

type Pick = { mode: 'nieuw' } | { mode: 'positie'; landmarkId: string } | null;

// Kept across navigation within the session.
let lastFilter: DeckFilter = EMPTY_FILTER;
let deckOpen = true;
let lastSort: DeckSort = 'laatste';
const AUTO_ROUTE_DELAY_MS = 1500;

export function TourEditor({ id }: { id: string }) {
  const { tours, landmarks, online } = useAppState();
  const tour = tours.find((t) => t.id === id && !t.deleted);
  const [pick, setPick] = useState<Pick>(null);
  const [routeMsg, setRouteMsg] = useState<{ text: string; warn?: boolean } | null>(null);
  const [routing, setRouting] = useState(false);
  const [filter, setFilterState] = useState<DeckFilter>(lastFilter);
  const [showDeck, setShowDeck] = useState(deckOpen);
  const [sort, setSortState] = useState<DeckSort>(lastSort);
  const [focus, setFocus] = useState<{ key: string; position: LatLng; n: number } | null>(null);
  const mapSection = useRef<HTMLElement>(null);
  const mapStored = useMapStored();
  const lmById = useMemo(() => new Map(landmarks.map((l) => [l.id, l])), [landmarks]);
  const deck = useMemo(() => buildDeck(landmarks), [landmarks]);

  // ---- edits always start from the latest saved tour, never a stale render copy ----
  const edit = (fn: (t: Tour) => Tour) => {
    const t = currentTour(id);
    return t ? saveTour(fn(t)) : Promise.resolve();
  };

  async function addLandmarkAt(landmarkId: string, index?: number) {
    const site = CATALOG.find((s) => catalogLandmarkId(s.id) === landmarkId);
    if (site) await ensureLandmark(landmarkFromCatalog(site));
    await edit((t) => (t.stops.some((s) => s.landmarkId === landmarkId) ? t : insertStop(t, landmarkId, index)));
  }

  const listRef = useRouteSortable({
    onAdd: (landmarkId, index) => void addLandmarkAt(landmarkId, index),
    onMove: (from, to) => void edit((t) => moveStop(t, from, to)),
  });

  // ---- route calculation (manual button + automatic after changes) ----
  const routeSignature = tour
    ? tour.stops.map((s) => { const p = lmById.get(s.landmarkId)?.position; return `${s.id}@${p ? `${p.lat},${p.lng}` : '-'}`; }).join('|')
    : '';
  const missingLegs = tour ? stopPairs(tour).filter(([a, b]) => !findLeg(tour, a, b)).length : 0;
  const allPositioned = !!tour && tour.stops.every((s) => lmById.get(s.landmarkId)?.position);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    if (!online || !missingLegs || !allPositioned || routing) return;
    autoTimer.current = setTimeout(() => void computeRoute(true), AUTO_ROUTE_DELAY_MS);
    return () => { if (autoTimer.current) clearTimeout(autoTimer.current); };
  }, [routeSignature, online, missingLegs, allPositioned]);

  async function computeRoute(auto = false) {
    const t = currentTour(id);
    if (!t) return;
    const pts = t.stops.map((s) => lmById.get(s.landmarkId)?.position ?? null);
    if (pts.length < 2) return auto ? undefined : setRouteMsg({ text: 'Minstens twee stops nodig.', warn: true });
    if (pts.some((p) => !p)) return setRouteMsg({ text: 'Elke stop heeft een positie nodig voordat de route berekend kan worden.', warn: true });
    const order = t.stops.map((s) => s.id).join();
    setRouting(true);
    setRouteMsg(null);
    try {
      const legs = await fossgisFoot.route(pts as LatLng[]);
      const latest = currentTour(id);
      // The order changed while we waited: drop this result; the auto-router will run again.
      if (!latest || latest.stops.map((s) => s.id).join() !== order) return;
      const now = nowIso();
      await saveTour({
        ...latest,
        legs: legs.map((l, i) => ({ ...l, fromStopId: latest.stops[i].id, toStopId: latest.stops[i + 1].id, provider: fossgisFoot.id, computedAt: now })),
      });
      setRouteMsg({ text: auto ? 'Looproute bijgewerkt.' : 'Looproute berekend en opgeslagen (ook offline beschikbaar).' });
    } catch (e) {
      setRouteMsg({ text: e instanceof RoutingError ? e.message : 'Route berekenen mislukt.', warn: true });
    } finally {
      setRouting(false);
    }
  }

  // ---- map placement ----
  async function onMapClick(p: LatLng) {
    if (!pick) return;
    if (pick.mode === 'nieuw') {
      const lm = createLandmark(`Nieuwe stop ${(currentTour(id)?.stops.length ?? 0) + 1}`, p, 'kaart');
      await saveLandmark(lm);
      await edit((t) => insertStop(t, lm.id));
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
      const fresh = currentTour(t.id)!;
      const legs = fresh.legs.filter((l) => !stopIds.has(l.fromStopId) && !stopIds.has(l.toStopId));
      if (legs.length !== fresh.legs.length) await saveTour({ ...fresh, legs });
    }
  }

  // ---- derived view data (memoised so the map doesn't redraw on every keystroke) ----
  const usedAt = useMemo(() => new Map(tour?.stops.map((s, i) => [s.landmarkId, i + 1]) ?? []), [tour?.stops]);
  const dots: MapDot[] = useMemo(
    () => (showDeck ? deck : [])
      .filter((c) => c.lat !== null && !usedAt.has(c.landmarkId) && matchesFilter(c, filter))
      .map((c) => ({ key: c.landmarkId, label: c.name, position: { lat: c.lat!, lng: c.lng! } })),
    [deck, usedAt, filter, showDeck],
  );
  const mapStops: MapStop[] = useMemo(() => (tour?.stops ?? []).flatMap((s, i) => {
    const pos = lmById.get(s.landmarkId)?.position;
    return pos ? [{ id: s.id, label: String(i + 1), position: pos }] : [];
  }), [tour?.stops, lmById]);
  const routes = useMemo(() => (tour ? stopPairs(tour).map(([a, b]) => findLeg(tour, a, b)?.geometry ?? []).filter((g) => g.length > 1) : []), [tour?.stops, tour?.legs]);
  const gaps = useMemo(() => (tour ? stopPairs(tour).flatMap(([a, b]): [LatLng, LatLng][] => {
    if (findLeg(tour, a, b)) return [];
    const pa = lmById.get(tour.stops.find((s) => s.id === a)!.landmarkId)?.position;
    const pb = lmById.get(tour.stops.find((s) => s.id === b)!.landmarkId)?.position;
    return pa && pb ? [[pa, pb]] : [];
  }) : []), [tour?.stops, tour?.legs, lmById]);

  if (!tour) return <main class="page"><p>Tour niet gevonden. <a href="#/">Terug naar tours</a></p></main>;

  const update = (patch: Partial<Tour>) => edit((t) => ({ ...t, ...patch }));
  const usage = (landmarkId: string) => tours.filter((t) => !t.deleted && t.stops.some((s) => s.landmarkId === landmarkId)).length;
  const setFilter = (f: DeckFilter) => { lastFilter = f; setFilterState(f); };
  const toggleDeck = () => { deckOpen = !showDeck; setShowDeck(!showDeck); };
  const setSort = (s: DeckSort) => { lastSort = s; setSortState(s); };
  const focusCard = (c: DeckCard) => {
    if (c.lat === null || c.lng === null) return;
    setFocus((f) => ({ key: c.landmarkId, position: { lat: c.lat!, lng: c.lng! }, n: (f?.n ?? 0) + 1 }));
    // On a phone the map sits above the list: bring it into view.
    const r = mapSection.current?.getBoundingClientRect();
    if (r && (r.bottom < 60 || r.top > innerHeight)) mapSection.current!.scrollIntoView({ block: 'start' }); // instant: a long smooth scroll feels slow
  };
  const anchorFor = (i: number): Anchor | null => {
    const s = tour.stops[i];
    const lm = s && lmById.get(s.landmarkId);
    return lm?.position ? { position: lm.position, label: lm.name } : null;
  };
  const anchors = { first: anchorFor(0), last: anchorFor(tour.stops.length - 1) };

  return (
    <main class={`editor ${showDeck ? 'editor--deck' : ''}`}>
      <section class="editor__panel">
        <div class="page__head">
          <a href="#/" class="back">← Tours</a>
          <div class="row row--tight">
            <button class={`btn ${showDeck ? 'btn--active' : ''}`} onClick={toggleDeck} aria-pressed={showDeck}>Kaartendeck</button>
            <a class="btn btn--primary" href={`#/gids/${tour.id}`}>Gidsen</a>
          </div>
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
        <details class="tour-meta">
          <summary>Thema en beschrijving</summary>
          <label>Thema<input value={tour.theme} onInput={(e) => update({ theme: e.currentTarget.value })} /></label>
          <label>Beschrijving<textarea rows={2} value={tour.description} onInput={(e) => update({ description: e.currentTarget.value })} /></label>
        </details>

        <Ribbon tour={tour} />
        <div class="route-status">
          {routing ? <span class="hint">Looproute berekenen…</span>
            : !online && missingLegs ? <span class="hint hint--warn">Offline: route wordt berekend zodra er internet is.</span>
            : missingLegs && !allPositioned ? <span class="hint hint--warn">Niet elke stop heeft een positie.</span>
            : routeMsg ? <span class={`hint ${routeMsg.warn ? 'hint--warn' : ''}`}>{routeMsg.text}</span>
            : null}
          {routeMsg?.warn && online && <button class="btn btn--small" onClick={() => computeRoute()}>Opnieuw</button>}
        </div>

        <h2>Route</h2>
        <ol class={`stop-list ${tour.stops.length ? '' : 'stop-list--empty'}`} ref={listRef} data-empty-text="Sleep hier kaarten uit het deck naartoe">
          {tour.stops.map((s, i) => {
            const prev = i > 0 ? tour.stops[i - 1] : null;
            const leg = prev ? findLeg(tour, prev.id, s.id) : undefined;
            return (
              <StopCard
                key={s.id}
                index={i}
                count={tour.stops.length}
                stop={s}
                landmark={lmById.get(s.landmarkId)}
                usedInTours={usage(s.landmarkId)}
                picking={pick?.mode === 'positie' && pick.landmarkId === s.landmarkId}
                legInfo={prev ? (leg ? { text: `${formatMinutes(leg.durationS / 60)} lopen · ${formatDistance(leg.distanceM)}`, missing: false } : { text: 'looproute nog niet berekend', missing: true }) : null}
                onStop={(ns) => edit((t) => ({ ...t, stops: t.stops.map((x) => (x.id === ns.id ? ns : x)) }))}
                onLandmark={(l: Landmark) => saveLandmark(l)}
                onMove={(dir) => edit((t) => moveStop(t, i, i + dir))}
                onRemove={() => edit((t) => removeStop(t, s.id))}
                onPickPosition={() => setPick({ mode: 'positie', landmarkId: s.landmarkId })}
              />
            );
          })}
        </ol>
        <div class="add-stop">
          <button class={`btn ${pick?.mode === 'nieuw' ? 'btn--active' : ''}`} onClick={() => setPick(pick?.mode === 'nieuw' ? null : { mode: 'nieuw' })}>
            {pick?.mode === 'nieuw' ? 'Klik op de kaart om de stop te plaatsen…' : 'Eigen stop op de kaart'}
          </button>
        </div>

        <details class="danger-zone">
          <summary>Tour verwijderen</summary>
          <p class="hint">Bezienswaardigheden en hun gedeelde kennis blijven bewaard.</p>
          <button class="btn btn--danger" onClick={async () => { await deleteTour(tour); navigate('/'); }}>Tour definitief verwijderen</button>
        </details>
      </section>

      {showDeck && (
        <CardDeck
          cards={deck}
          filter={filter}
          onFilter={setFilter}
          sort={sort}
          onSort={setSort}
          anchors={anchors}
          usedAt={usedAt}
          onAdd={(c) => void addLandmarkAt(c.landmarkId)}
          onFocus={focusCard}
          focusedKey={focus?.key ?? null}
        />
      )}

      <section class={`editor__map ${pick ? 'editor__map--picking' : ''}`} ref={mapSection}>
        {pick && <div class="map-banner">Klik op de kaart om {pick.mode === 'nieuw' ? 'een eigen stop te plaatsen' : 'de positie te kiezen'} · <button class="link" onClick={() => setPick(null)}>Annuleren</button></div>}
        {!online && mapStored === false && <div class="map-banner map-banner--warn">Offline en geen opgeslagen kaart: alleen stops en opgeslagen routes. Sla de kaart op via Instellingen.</div>}
        <MapView
          stops={mapStops}
          dots={dots}
          onDotAdd={(key) => void addLandmarkAt(key)}
          focus={focus}
          routes={routes}
          gaps={gaps}
          onMapClick={onMapClick}
          fitKey={`${tour.id}:${mapStops.length}`}
          attribution={fossgisFoot.attribution}
        />
      </section>
    </main>
  );
}
