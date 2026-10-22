import { describe, expect, it } from 'vitest';
import { DEFAULT_ARRIVAL, INITIAL_ARRIVAL, updateArrival } from './arrival';
import { tourDuration } from './duration';
import { createStop, createTour } from './factory';
import { formatDistance, formatMinutes, haversineM } from './geo';
import { parseDataset, serializeDataset, DatasetError } from '../storage/backup';
import { parseOsrm } from '../routing/osrm';
import { instructionList } from '../routing/instructions';

describe('arrival detection', () => {
  it('triggers once on entry, ignores jitter inside, re-arms after exit and cooldown', () => {
    let s = INITIAL_ARRIVAL;
    let r = updateArrival(s, 25, 10, 0); s = r.state;
    expect(r.triggered).toBe(true);
    r = updateArrival(s, 40, 10, 5_000); s = r.state; // between enter and exit radius: still inside
    expect(r.triggered).toBe(false);
    expect(s.inside).toBe(true);
    r = updateArrival(s, 60, 10, 10_000); s = r.state; // exit
    expect(s.inside).toBe(false);
    r = updateArrival(s, 20, 10, 20_000); s = r.state; // re-entry within cooldown
    expect(r.triggered).toBe(false);
    r = updateArrival(s, 60, 10, 30_000); s = r.state;
    r = updateArrival(s, 20, 10, 20_000 + DEFAULT_ARRIVAL.cooldownMs + 1);
    expect(r.triggered).toBe(true);
  });

  it('ignores inaccurate fixes', () => {
    const r = updateArrival(INITIAL_ARRIVAL, 5, 120, 0);
    expect(r).toEqual({ state: INITIAL_ARRIVAL, triggered: false, usable: false });
  });
});

describe('duration', () => {
  it('sums speaking, computed walking and breaks; counts missing legs', () => {
    const t = createTour();
    const [a, b, c] = [createStop('l1'), createStop('l2'), createStop('l3')];
    a.speakingMinutes = 10; b.speakingMinutes = 5; c.speakingMinutes = 0;
    t.stops = [a, b, c];
    t.breakMinutes = 15;
    t.legs = [{ fromStopId: a.id, toStopId: b.id, distanceM: 800, durationS: 600, geometry: [], steps: [], provider: 'x', computedAt: '' }];
    expect(tourDuration(t)).toEqual({ speakingMin: 15, walkingMin: 10, breakMin: 15, totalMin: 40, walkingDistanceM: 800, missingLegs: 1 });
  });

  it('ignores legs whose stop order no longer matches', () => {
    const t = createTour();
    const [a, b] = [createStop('l1'), createStop('l2')];
    t.stops = [b, a];
    t.legs = [{ fromStopId: a.id, toStopId: b.id, distanceM: 1, durationS: 60, geometry: [], steps: [], provider: 'x', computedAt: '' }];
    expect(tourDuration(t).missingLegs).toBe(1);
  });
});

describe('geo formatting', () => {
  it('computes great-circle distance', () => {
    // 0.001° latitude ≈ 111 m anywhere.
    expect(haversineM({ lat: 41.69, lng: 44.8 }, { lat: 41.691, lng: 44.8 })).toBeCloseTo(111.2, 0);
  });
  it('formats in Dutch', () => {
    expect(formatDistance(234)).toBe('230 m');
    expect(formatDistance(1530)).toBe('1,5 km');
    expect(formatMinutes(95)).toBe('1 u 35 min');
  });
});

describe('backup format', () => {
  it('round-trips and drops tombstones on export', () => {
    const t = createTour('A');
    const gone = { ...createTour('B'), deleted: true };
    const parsed = parseDataset(serializeDataset({ tours: [t, gone], landmarks: [], products: [], departures: [], bookings: [] }, { includeDeleted: false }));
    expect(parsed.tours.map((x) => x.title)).toEqual(['A']);
  });
  it('rejects invalid files with a clear message', () => {
    expect(() => parseDataset('nope')).toThrow(DatasetError);
    expect(() => parseDataset('{"schemaVersion":99,"tours":[],"landmarks":[]}')).toThrow(/schemaversie/);
    expect(() =>
      parseDataset('{"schemaVersion":1,"tours":[],"landmarks":[{"id":"x","createdAt":"a","updatedAt":"a","name":"n","position":{"lat":"x"}}]}'),
    ).toThrow(/coördinaten/);
  });
});

describe('OSRM parsing (synthetic response)', () => {
  const step = (type: string, modifier: string, name: string, distance: number, coords: [number, number][]) => ({
    distance, name, maneuver: { type, modifier }, geometry: { coordinates: coords },
  });
  it('builds per-leg geometry as [lat, lng] without duplicates', () => {
    const legs = parseOsrm(
      {
        code: 'Ok',
        routes: [{ legs: [{ distance: 100, duration: 80, steps: [
          step('depart', '', 'Straat A', 50, [[1, 2], [3, 4]]),
          step('turn', 'left', 'Straat B', 50, [[3, 4], [5, 6]]),
          step('arrive', '', '', 0, [[5, 6]]),
        ] }] }],
      },
      1,
    );
    expect(legs[0].geometry).toEqual([[2, 1], [4, 3], [6, 5]]);
    expect(instructionList(legs[0].steps).map((s) => s.text)).toEqual(['Vertrek via Straat A', 'Ga linksaf naar Straat B', 'Aangekomen bij de stop']);
  });
  it('reports no route', () => {
    expect(() => parseOsrm({ code: 'NoRoute' }, 1)).toThrow(/Geen looproute/);
  });
});
