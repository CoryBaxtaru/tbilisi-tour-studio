import { describe, expect, it } from 'vitest';
import { buildDeck, CATALOG } from './catalog';
import { byDistance, candidatesFor, orderChronological, orderShortest, pathLength, suggestTour, TEMPLATES } from './suggest';
import { ERAS } from './tags';

const deck = buildDeck([]);

describe('ordering', () => {
  it('finds the obvious straight-line order on a line of points', () => {
    const pts = [0, 4, 1, 3, 2].map((k) => ({ k, lat: 41.69 + k * 0.001, lng: 44.8 }));
    expect(orderShortest(pts).map((p) => p.k).join('')).toMatch(/^(01234|43210)$/);
  });

  it('is never longer than the catalogue order', () => {
    const pool = candidatesFor(deck, {}, false);
    expect(pathLength(orderShortest(pool))).toBeLessThan(pathLength(pool));
  });

  it('chronological order never goes back in time', () => {
    const idx = new Map(ERAS.map((e, i) => [e.id, i]));
    const firstEra = (tags: string[]) => Math.min(...tags.map((t) => idx.get(t) ?? Infinity));
    const out = orderChronological(candidatesFor(deck, { themes: ['historisch'] }, false)).map((c) => firstEra(c.tags));
    expect(out).toEqual(out.slice().sort((a, b) => a - b));
  });
});

describe('suggestions', () => {
  it('every template matches enough sites to make a tour', () => {
    for (const t of TEMPLATES) expect(candidatesFor(deck, t.filter, false).length, t.id).toBeGreaterThanOrEqual(5);
  });

  it('the complete tour includes every central site exactly once', () => {
    const all = suggestTour(deck, {}, { max: null, includeOutside: false, order: 'kortste' });
    const central = CATALOG.filter((s) => s.district !== 'buiten');
    expect(all).toHaveLength(central.length);
    expect(new Set(all.map((c) => c.key)).size).toBe(central.length);
  });

  it('respects the maximum and the filter, and excludes outside sites unless asked', () => {
    const out = suggestTour(deck, { eras: ['sovjet'] }, { max: 6, includeOutside: false, order: 'kortste' });
    expect(out).toHaveLength(6);
    for (const c of out) {
      expect(c.tags).toContain('sovjet');
      expect(c.district).not.toBe('buiten');
    }
    expect(candidatesFor(deck, { eras: ['sovjet'] }, true).length).toBeGreaterThan(candidatesFor(deck, { eras: ['sovjet'] }, false).length);
  });

  it('a capped selection is compact (shorter than the same number of random-order sites)', () => {
    const out = suggestTour(deck, { themes: ['historisch'] }, { max: 8, includeOutside: false, order: 'kortste' });
    const naive = candidatesFor(deck, { themes: ['historisch'] }, false).slice(0, 8);
    expect(pathLength(out)).toBeLessThan(pathLength(naive));
  });
});

describe('proximity sort', () => {
  it('puts the nearest card first and cards without position last', () => {
    const cards = [{ id: 'far', lat: 41.72, lng: 44.8 }, { id: 'none', lat: null, lng: null }, { id: 'near', lat: 41.6901, lng: 44.8 }];
    const out = byDistance(cards, { lat: 41.69, lng: 44.8 });
    expect(out.map((x) => x.card.id)).toEqual(['near', 'far', 'none']);
    expect(out[0].distanceM).toBeCloseTo(11, 0);
  });
});

describe('catalogue background info', () => {
  it('has sourced info with licence-ready links for most sites', () => {
    const withInfo = CATALOG.filter((s) => s.info);
    expect(withInfo.length).toBeGreaterThanOrEqual(50);
    for (const s of withInfo) {
      expect(s.info!.wikidata, s.id).toMatch(/^Q\d+$/);
      if (s.info!.wiki) {
        expect(s.info!.wiki.url, s.id).toMatch(/^https:\/\/(nl|en)\.wikipedia\.org\/wiki\//);
        expect(s.info!.wiki.extract.length, s.id).toBeLessThanOrEqual(1400);
      }
    }
  });
});
