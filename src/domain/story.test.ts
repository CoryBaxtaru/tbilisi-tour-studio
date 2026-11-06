import { describe, expect, it } from 'vitest';
import { CATALOG, catalogLandmarkId, landmarkFromCatalog } from './catalog';
import { draftResearch } from './research';
import { buildStoryline, PASSAGES, THREADS } from './story';
import type { Claim, Landmark } from './types';

const claimIds = (site: string) => new Set(draftResearch(site).claims.map((c) => c.id.split(':').pop()));

function landmarkWith(siteId: string, patch: (c: Claim) => Claim, claimShort: string): Landmark {
  const lm = landmarkFromCatalog(CATALOG.find((s) => s.id === siteId)!);
  const claim = draftResearch(siteId).claims.find((c) => c.id === `cat:${siteId}:${claimShort}`)!;
  return { ...lm, id: catalogLandmarkId(siteId), claims: [patch(claim)] };
}

describe('story data', () => {
  it('only refers to sites and claims that exist', () => {
    const sites = new Set(CATALOG.map((s) => s.id));
    for (const [site, p] of Object.entries(PASSAGES)) {
      expect(sites.has(site), site).toBe(true);
      for (const s of p.sentences) for (const c of s.c) expect(claimIds(site).has(c), `${site} ${c}`).toBe(true);
    }
    for (const t of THREADS) {
      expect(t.bridges.length).toBeGreaterThan(0);
      for (const b of t.bridges) expect(b, t.id).toMatch(/\{a\}.*\{b\}/s);
      for (const [site, r] of Object.entries(t.refs)) {
        expect(r.c.length, `${t.id} ${site}`).toBeGreaterThan(0);
        for (const c of r.c) expect(claimIds(site).has(c), `${t.id} ${site} ${c}`).toBe(true);
      }
    }
  });
});

describe('buildStoryline', () => {
  it('links two sites through their shared thread', () => {
    const s = buildStoryline(['narikala', 'metekhi'], 'eigen', []);
    expect(s.order).toEqual(['narikala', 'metekhi']);
    expect(s.thread?.id).toBe('kruit');
    expect(s.blocks.map((b) => b.kind)).toEqual(['opening', 'stop', 'overgang', 'stop', 'slot']);
    expect(s.blocks[2].sentences[0].text).toContain('buskruitopslag');
    expect(s.blocks[2].sentences[0].text).not.toContain('{');
  });

  it('falls back to the jump in time without a shared thread', () => {
    const s = buildStoryline(['gabriadze', 'abanotubani'], 'eigen', []);
    expect(s.thread).toBeNull();
    expect(s.blocks[2].sentences[0].text).toContain('terug in de tijd');
  });

  it('orders by time', () => {
    expect(buildStoryline(['vredesbrug', 'metekhi', 'narikala'], 'tijd', []).order).toEqual(['narikala', 'metekhi', 'vredesbrug']);
  });

  it('keeps a walkable order: the short route is never longer than the picked order', () => {
    const ids = ['vrijheidsplein', 'metekhi', 'sioni', 'narikala', 'anchiskhati'];
    expect(buildStoryline(ids, 'wandeling', []).straightM).toBeLessThanOrEqual(buildStoryline(ids, 'eigen', []).straightM);
    expect(buildStoryline(ids, 'verhaal', []).order.sort()).toEqual([...ids].sort());
  });

  it('drops sentences and links resting on a rejected claim', () => {
    const lm = landmarkWith('metekhi', (c) => ({ ...c, status: 'afgewezen' }), 'c4');
    const s = buildStoryline(['narikala', 'metekhi'], 'eigen', [lm]);
    const text = s.blocks.flatMap((b) => b.sentences.map((x) => x.text)).join(' ');
    expect(text).not.toContain('buskruitopslag');
    expect(s.thread?.id).not.toBe('kruit');
  });

  it('marks verified and edited claims', () => {
    const verified = landmarkWith('gabriadze', (c) => ({ ...c, status: 'geverifieerd' }), 'c3');
    const block = (lm: Landmark) => buildStoryline(['gabriadze'], 'eigen', [lm]).blocks[0].sentences;
    expect(block(verified)[0].state).toBe('geverifieerd');
    expect(block(landmarkWith('gabriadze', (c) => ({ ...c, text: 'Gewijzigd.' }), 'c3'))[0].state).toBe('aangepast');
  });

  it('has a written story with facts for every site', () => {
    for (const site of CATALOG) {
      const b = buildStoryline([site.id], 'eigen', []).blocks[0];
      expect(b.written, site.id).toBe(true);
      expect(b.sentences.some((s) => s.claims.length > 0), site.id).toBe(true);
    }
  });

  it('ignores unknown sites and counts speaking time', () => {
    const s = buildStoryline(['sioni', 'bestaat-niet'], 'eigen', []);
    expect(s.order).toEqual(['sioni']);
    expect(s.minutes).toBeGreaterThan(0);
  });
});
