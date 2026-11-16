import { describe, expect, it } from 'vitest';
import { CATALOG, catalogLandmarkId } from './catalog';
import { createStop, createTour } from './factory';
import { reorderStops, stopPosition, withStandpoint } from './tourOps';
import { buildTourPrompt, CLASSIC_TOUR, OLD_TOWN_TOUR, parseTourReply, READY_TOURS, tourFromReply, TourReplyError } from './tourRequest';

describe('tour on request', () => {
  it('puts the wish, the length and every catalogue site in the prompt', () => {
    const p = buildTourPrompt({ wish: 'zes mensen, geschiedenis', minutes: 120 });
    expect(p).toContain('zes mensen, geschiedenis');
    expect(p).toContain('ongeveer 120 minuten');
    for (const s of CATALOG) expect(p).toContain(`${s.id} | ${s.name}`);
    expect(p).toContain('=== TOUR ===');
  });

  it('reads the answer, keeps order, accepts names, skips repeats and reports unknown places', () => {
    const r = parseTourReply(`Hier is je tour.
=== TOUR ===
TITEL: Oud Tbilisi
UITLEG: Alles over de oude stad.
STOP: vrijheidsplein | 5 | Begin |
- STOP: Narikala-vesting | 10 min | Uitzicht |
STOP: moeder-georgie | 6 | Beeld | Vanaf de muren van Narikala
STOP: narikala | 3 | Dubbel |
STOP: eiffeltoren | 5 | Bestaat niet |
=== EINDE ===`);
    expect(r.title).toBe('Oud Tbilisi');
    expect(r.stops.map((s) => s.siteId)).toEqual(['vrijheidsplein', 'narikala', 'moeder-georgie']);
    expect(r.stops[1].minutes).toBe(10);
    expect(r.stops[2].standpoint).toBe('Vanaf de muren van Narikala');
    expect(r.unknown).toEqual(['STOP: eiffeltoren | 5 | Bestaat niet |']);
  });

  it('refuses an answer without stops', () => {
    expect(() => parseTourReply('Sorry, ik weet het niet.')).toThrow(TourReplyError);
  });

  it('makes a tour with story points, the reasons and the standpoint idea as guide notes', () => {
    const { tour, newLandmarks } = tourFromReply(CLASSIC_TOUR, { wish: '', minutes: 120 }, []);
    expect(tour.title).toBe('Klassiek Tbilisi in 2 uur');
    expect(tour.stops.map((s) => s.landmarkId)).toEqual(CLASSIC_TOUR.stops.map((s) => catalogLandmarkId(s.siteId)));
    expect(newLandmarks).toHaveLength(CLASSIC_TOUR.stops.length);
    expect(tour.stops.every((s) => s.talkingPoints.length > 0)).toBe(true);
    const kartlis = tour.stops[6];
    expect(kartlis.guideNotes).toContain('Standpunt (kies de plek op de kaart): Op de muren van Narikala');
    expect(kartlis.speakingMinutes).toBeGreaterThanOrEqual(5);
  });

  it('the ready-made tours use only catalogue sites, each once', () => {
    const ids = new Set(CATALOG.map((s) => s.id));
    for (const { tour } of READY_TOURS) {
      expect(tour.stops.filter((s) => !ids.has(s.siteId))).toEqual([]);
      expect(new Set(tour.stops.map((s) => s.siteId)).size).toBe(tour.stops.length);
    }
  });

  it("the founder's tour keeps its order, minutes and picked standpoints", () => {
    const { tour } = tourFromReply(OLD_TOWN_TOUR, { wish: '', minutes: 150 }, []);
    expect(tour.title).toBe('Oude stad en Sololaki in 2,5 uur');
    expect(tour.stops.map((s) => s.landmarkId)).toEqual(OLD_TOWN_TOUR.stops.map((s) => catalogLandmarkId(s.siteId)));
    expect(tour.stops.every((s) => s.talkingPoints.length > 0)).toBe(true);
    const narikala = tour.stops[9];
    expect(narikala.standpoint).toEqual({ position: { lat: 41.689961, lng: 44.808981 }, note: '' });
    expect(narikala.guideNotes).toContain('Waarom in deze tour: Verteld vanaf beneden');
    expect(narikala.guideNotes).not.toContain('kies de plek op de kaart');
    expect(tour.stops.filter((s) => s.standpoint).length).toBe(5);
    expect(tour.stops[0].standpoint).toBeUndefined();
    // Stops where the site itself has a position near the standpoint: within 600 m, so no slip of a digit.
    for (const s of OLD_TOWN_TOUR.stops.filter((x) => x.standpointAt)) {
      const site = CATALOG.find((c) => c.id === s.siteId)!;
      const km = Math.hypot((site.lat - s.standpointAt!.lat) * 111, (site.lng - s.standpointAt!.lng) * 83);
      expect(km).toBeLessThan(0.6);
    }
  });
});

describe('standpoint', () => {
  it('takes the standpoint over the site, and drops the routes of that stop', () => {
    const [a, b, c] = [createStop('l1'), createStop('l2'), createStop('l3')];
    const leg = (x: { id: string }, y: { id: string }) => ({ fromStopId: x.id, toStopId: y.id, distanceM: 1, durationS: 1, geometry: [], steps: [], provider: 'x', computedAt: '' });
    const tour = { ...createTour('t'), stops: [a, b, c], legs: [leg(a, b), leg(b, c)] };
    const site = { position: { lat: 1, lng: 1 } } as never;
    const spot = { position: { lat: 2, lng: 2 }, note: 'Vanaf de brug' };
    const moved = withStandpoint(tour, b.id, spot);
    expect(moved.legs).toEqual([]);
    expect(stopPosition(moved.stops[1], site)).toEqual({ lat: 2, lng: 2 });
    expect(stopPosition(moved.stops[0], site)).toEqual({ lat: 1, lng: 1 });
    const back = withStandpoint(moved, b.id, null);
    expect(back.stops[1].standpoint).toBeUndefined();
    expect(stopPosition(back.stops[1], site)).toEqual({ lat: 1, lng: 1 });
  });
});

describe('reorder', () => {
  it('follows the given ids, keeps unnamed stops at the end and keeps stored routes', () => {
    const [a, b, c] = [createStop('l1'), createStop('l2'), createStop('l3')];
    const leg = { fromStopId: a.id, toStopId: b.id, distanceM: 1, durationS: 1, geometry: [], steps: [], provider: 'x', computedAt: '' };
    const tour = { ...createTour('t'), stops: [a, b, c], legs: [leg] };
    const r = reorderStops(tour, [a.id, c.id, 'weg']);
    expect(r.stops.map((s) => s.id)).toEqual([a.id, c.id, b.id]);
    expect(r.legs).toEqual([leg]);
  });
});
