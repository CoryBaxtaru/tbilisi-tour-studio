import { describe, expect, it } from 'vitest';
import { buildDeck, CATALOG, catalogLandmarkId, landmarkFromCatalog, staleCatalogLandmarks } from './catalog';
import { createLandmark, createTour } from './factory';
import { DISTRICTS, ERAS, EMPTY_FILTER, matchesFilter, THEMES } from './tags';
import { insertStop, moveStop, removeStop } from './tourOps';

describe('catalogue data', () => {
  it('has at least 50 sites with OSM provenance and known tags', () => {
    const known = new Set([...ERAS, ...THEMES].map((t) => t.id));
    const districts = new Set(DISTRICTS.map((d) => d.id));
    expect(CATALOG.length).toBeGreaterThanOrEqual(50);
    expect(new Set(CATALOG.map((s) => s.id)).size).toBe(CATALOG.length);
    for (const s of CATALOG) {
      expect(s.osm, s.id).toMatch(/^(node|way|relation)\/\d+$/);
      // Inside a generous Tbilisi box: catches a geocoder hit in the wrong city.
      expect(s.lat, s.id).toBeGreaterThan(41.6);
      expect(s.lat, s.id).toBeLessThan(41.85);
      expect(s.lng, s.id).toBeGreaterThan(44.65);
      expect(s.lng, s.id).toBeLessThan(45.05);
      for (const t of [...s.eras, ...s.themes]) expect(known.has(t), `${s.id}: ${t}`).toBe(true);
      expect(districts.has(s.district), s.id).toBe(true);
    }
  });

  it('creates identical landmarks on every device (no sync conflict)', () => {
    const a = landmarkFromCatalog(CATALOG[0]);
    const b = landmarkFromCatalog(CATALOG[0]);
    expect(a).toEqual(b);
    expect(a.id).toBe(catalogLandmarkId(CATALOG[0].id));
    expect(a.verification).toBe('onbevestigd');
    expect(a.positionSource).toBe('osm');
  });
});

describe('deck', () => {
  it('uses the saved landmark over catalogue text and includes own landmarks', () => {
    const site = CATALOG[0];
    const edited = { ...landmarkFromCatalog(site), name: 'Eigen naam' };
    const own = createLandmark('Mijn plek', null, null);
    const deck = buildDeck([edited, own]);
    expect(deck.find((c) => c.landmarkId === edited.id)!.name).toBe('Eigen naam');
    expect(deck.find((c) => c.landmarkId === own.id)!.site).toBeNull();
    expect(deck).toHaveLength(CATALOG.length + 1);
  });

  it('filters: OR within a group, AND across groups, accent-insensitive text', () => {
    const item = { name: 'Café Ëxample', nameKa: '', tags: ['sovjet', 'kunst'], district: 'vake', summary: '' };
    expect(matchesFilter(item, EMPTY_FILTER)).toBe(true);
    expect(matchesFilter(item, { ...EMPTY_FILTER, eras: ['sovjet', 'erekle'] })).toBe(true);
    expect(matchesFilter(item, { ...EMPTY_FILTER, eras: ['sovjet'], themes: ['religieus'] })).toBe(false);
    expect(matchesFilter(item, { ...EMPTY_FILTER, districts: ['oude-stad'] })).toBe(false);
    expect(matchesFilter(item, { ...EMPTY_FILTER, query: 'cafe ex' })).toBe(true);
  });
});

describe('tour operations', () => {
  const tour = () => {
    let t = createTour();
    for (const id of ['a', 'b', 'c']) t = insertStop(t, id);
    return t;
  };
  const order = (t: ReturnType<typeof createTour>) => t.stops.map((s) => s.landmarkId).join('');

  it('inserts at a position, clamped', () => {
    expect(order(insertStop(tour(), 'x', 1))).toBe('axbc');
    expect(order(insertStop(tour(), 'x', 99))).toBe('abcx');
    expect(order(insertStop(tour(), 'x', -5))).toBe('xabc');
  });

  it('moves like a drag (from index → to index)', () => {
    expect(order(moveStop(tour(), 0, 2))).toBe('bca');
    expect(order(moveStop(tour(), 2, 0))).toBe('cab');
    expect(order(moveStop(tour(), 1, 1))).toBe('abc');
  });

  it('removes by stop id', () => {
    const t = tour();
    expect(order(removeStop(t, t.stops[1].id))).toBe('ac');
  });
});

describe('catalogue refresh', () => {
  const site = CATALOG[0];
  const current = landmarkFromCatalog(site);
  const old = { ...current, createdAt: '2000-01-01T00:00:00.000Z', updatedAt: '2000-01-01T00:00:00.000Z', position: { lat: 41.7, lng: 44.79 } };

  it('replaces an unedited older catalogue landmark and reports the move', () => {
    const out = staleCatalogLandmarks([old]);
    expect(out).toHaveLength(1);
    expect(out[0].fresh).toEqual(current);
    expect(out[0].moved).toBe(true);
  });

  it('never replaces a landmark the guide edited, or one that is already current', () => {
    const edited = { ...old, updatedAt: '2000-01-02T10:11:12.345Z', name: 'Mijn naam' };
    expect(staleCatalogLandmarks([edited, current])).toEqual([]);
  });
});
