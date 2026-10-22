import { describe, expect, it } from 'vitest';
import drafts from '../data/research-drafts.json';
import { CATALOG, landmarkFromCatalog } from './catalog';
import { createLandmark } from './factory';
import {
  createClaim, draftResearch, isWebUrl, linkedClaim, mergedResearch, researchCounts, talkingPointFromClaim,
  withClaim, withoutClaim, withoutSource, withSource,
} from './research';

const SITE = 'vrijheidsplein';
const catalogLandmark = () => landmarkFromCatalog(CATALOG.find((s) => s.id === SITE)!);

describe('research drafts data', () => {
  it('belongs to catalogue sites; every claim has sources that resolve and none is Wikipedia or Wikidata', () => {
    const ids = new Set(CATALOG.map((s) => s.id));
    for (const site of Object.keys(drafts.sites)) {
      expect(ids.has(site), site).toBe(true);
      const r = draftResearch(site);
      const sourceIds = new Set(r.sources.map((s) => s.id));
      expect(r.claims.length, site).toBeGreaterThan(0);
      for (const c of r.claims) {
        expect(c.text.trim(), c.id).not.toBe('');
        expect(c.evidence?.trim(), c.id).toBeTruthy();
        expect(['feit', 'interpretatie', 'anekdote', 'onzeker']).toContain(c.kind);
        expect(c.sourceIds.length, c.id).toBeGreaterThan(0);
        for (const id of c.sourceIds) expect(sourceIds.has(id), `${c.id} → ${id}`).toBe(true);
      }
      for (const s of r.sources) {
        expect(isWebUrl(s.url), s.url).toBe(true);
        expect(s.url).not.toMatch(/wikipedia\.org|wikidata\.org/);
        expect(s.title.trim()).not.toBe('');
      }
    }
  });
});

describe('mergedResearch', () => {
  it('gives concept drafts with stable namespaced ids for a site that was never saved', () => {
    const r = mergedResearch(undefined, SITE);
    expect(r.claims[0].id).toBe(`cat:${SITE}:c1`);
    expect(r.claims.every((c) => c.status === 'concept' && c.origin === 'claude')).toBe(true);
    expect(mergedResearch(catalogLandmark())).toEqual(r);
  });

  it('swaps saved versions in place and appends own claims', () => {
    const drafts = draftResearch(SITE).claims;
    const own = { ...createClaim(), text: 'Eigen punt' };
    const lm = withClaim(withClaim(catalogLandmark(), { ...drafts[1], status: 'geverifieerd' }), own);
    const r = mergedResearch(lm);
    expect(r.claims).toHaveLength(drafts.length + 1);
    expect(r.claims[1]).toMatchObject({ id: drafts[1].id, status: 'geverifieerd' });
    expect(r.claims.at(-1)).toBe(own);
    expect(researchCounts(r)).toMatchObject({ concept: drafts.length, geverifieerd: 1, afgewezen: 0 });
    // Removing a saved draft shows the concept again.
    expect(mergedResearch(withoutClaim(lm, drafts[1].id)).claims[1].status).toBe('concept');
  });

  it('own landmarks only have their own research', () => {
    const lm = withSource(createLandmark('Eigen plek', null, null), { id: 's', title: 'Boek', url: '', type: 'boek', language: 'nl' });
    expect(mergedResearch(lm)).toEqual({ sources: lm.sources, claims: [] });
  });

  it('withoutSource unlinks the source from saved claims', () => {
    const src = { id: 's', title: 'Boek', url: '', type: 'boek', language: 'nl' };
    const claim = { ...createClaim(), text: 'x', sourceIds: ['s', 'cat:x:s1'] };
    const lm = withoutSource(withClaim(withSource(createLandmark('Plek', null, null), src), claim), 's');
    expect(lm.sources).toEqual([]);
    expect(lm.claims?.[0].sourceIds).toEqual(['cat:x:s1']);
  });
});

describe('talking points from claims', () => {
  it('copies text, kind and source titles and keeps the link', () => {
    const r = draftResearch(SITE);
    const c = r.claims[0];
    const tp = talkingPointFromClaim(c, r.sources);
    expect(tp).toMatchObject({ text: c.text, kind: c.kind, claimId: c.id });
    expect(tp.source).toContain(r.sources.find((s) => s.id === c.sourceIds[0])!.title);
    expect(linkedClaim(tp, r)).toBe(c);
    expect(linkedClaim({ ...tp, claimId: undefined }, r)).toBeUndefined();
  });
});

describe('isWebUrl', () => {
  it('accepts only http(s) links', () => {
    expect(isWebUrl('https://memkvidreoba.gov.ge/x')).toBe(true);
    expect(isWebUrl('javascript:alert(1)')).toBe(false);
    expect(isWebUrl('')).toBe(false);
  });
});
