// Reusable research per landmark: sources and claims with the guide's verdict (docs/RESEARCH.md).
// Catalogue sites ship with concept claims (src/data/research-drafts.json): checked against the original sources
// by Claude, still to be verified by the guide. Drafts stay virtual; a draft is saved on the landmark only when the
// guide verifies, rejects or edits it, so untouched drafts never cause sync conflicts.
import drafts from '../data/research-drafts.json';
import { newId } from './factory';
import type { Claim, ClaimKind, ClaimStatus, Landmark, SourceRef, TalkingPoint } from './types';

export interface Research {
  sources: SourceRef[];
  claims: Claim[];
}

interface DraftSite {
  sources: SourceRef[];
  claims: { id: string; kind: string; text: string; sourceIds: string[]; evidence: string; note?: string }[];
}

const SITES = drafts.sites as Record<string, DraftSite>;
export const DRAFTS_METHOD: string = drafts.method;

/** Labels for SourceRef.type; an unknown type is shown as-is. */
export const SOURCE_TYPES: Record<string, string> = {
  overheid: 'Overheid',
  naslagwerk: 'Naslagwerk',
  academisch: 'Wetenschappelijk',
  archief: 'Archief',
  instelling: 'Instelling',
  architectuur: 'Architectuur',
  tijdschrift: 'Tijdschrift',
  nieuws: 'Nieuws',
  boek: 'Boek',
  reisgids: 'Reisgids',
  reisverhaal: 'Reisverhaal',
  reisblog: 'Reisblog',
  website: 'Website',
};

export const LANGUAGES: Record<string, string> = {
  nl: 'Nederlands', en: 'Engels', ka: 'Georgisch', ru: 'Russisch', de: 'Duits', fr: 'Frans', hy: 'Armeens',
};

export const CLAIM_STATUS: Record<ClaimStatus, string> = { concept: 'Concept', geverifieerd: 'Geverifieerd', afgewezen: 'Afgewezen' };

const EMPTY: Research = { sources: [], claims: [] };
const cache = new Map<string, Research>();

/** Concept research for a catalogue site. Ids are namespaced per site (cat:<site>:c1), so they match on every device. */
export function draftResearch(siteId: string | undefined): Research {
  const d = siteId ? SITES[siteId] : undefined;
  if (!siteId || !d) return EMPTY;
  let r = cache.get(siteId);
  if (!r) {
    const id = (x: string) => `cat:${siteId}:${x}`;
    r = {
      sources: d.sources.map((s) => ({ ...s, id: id(s.id) })),
      claims: d.claims.map((c) => ({
        id: id(c.id),
        kind: c.kind as ClaimKind,
        text: c.text,
        sourceIds: c.sourceIds.map(id),
        status: 'concept',
        origin: 'claude',
        evidence: c.evidence,
        ...(c.note ? { note: c.note } : {}),
      })),
    };
    cache.set(siteId, r);
  }
  return r;
}

/** Drafts with the guide's saved versions swapped in (same id, same place), followed by the guide's own additions. */
export function mergedResearch(lm: Landmark | null | undefined, siteId = lm?.catalogId): Research {
  const d = draftResearch(siteId);
  return { sources: overlay(d.sources, lm?.sources), claims: overlay(d.claims, lm?.claims) };
}

function overlay<T extends { id: string }>(base: T[], saved: T[] = []): T[] {
  if (!saved.length) return base;
  const byId = new Map(saved.map((x) => [x.id, x]));
  const inBase = new Set(base.map((x) => x.id));
  return [...base.map((x) => byId.get(x.id) ?? x), ...saved.filter((x) => !inBase.has(x.id))];
}

/** Saves a claim on the landmark: adds it, or replaces the saved version with the same id. */
export function withClaim(lm: Landmark, claim: Claim): Landmark {
  return { ...lm, claims: upsert(lm.claims ?? [], claim) };
}

/** Removes a saved claim. For a draft that means it shows as a concept again, so the UI only offers this for own claims. */
export function withoutClaim(lm: Landmark, id: string): Landmark {
  return { ...lm, claims: (lm.claims ?? []).filter((c) => c.id !== id) };
}

export function withSource(lm: Landmark, source: SourceRef): Landmark {
  return { ...lm, sources: upsert(lm.sources ?? [], source) };
}

/** Removes an own source and unlinks it from the saved claims. */
export function withoutSource(lm: Landmark, id: string): Landmark {
  const next: Landmark = { ...lm, sources: (lm.sources ?? []).filter((s) => s.id !== id) };
  if (lm.claims) next.claims = lm.claims.map((c) => (c.sourceIds.includes(id) ? { ...c, sourceIds: c.sourceIds.filter((x) => x !== id) } : c));
  return next;
}

export function createClaim(): Claim {
  return { id: newId(), kind: 'onzeker', text: '', sourceIds: [], status: 'concept', origin: 'gids' };
}

export function createSource(): SourceRef {
  return { id: newId(), title: '', url: '', type: 'website', language: 'nl' };
}

/** Only http(s) links are rendered, so a typed `javascript:` URL can never run. */
export function isWebUrl(url: string): boolean {
  return /^https?:\/\/\S+$/i.test(url.trim());
}

/** A talking point copied from a claim. The claimId keeps the link, so the point shows the claim's current status. */
export function talkingPointFromClaim(claim: Claim, sources: SourceRef[]): TalkingPoint {
  const titles = claim.sourceIds.flatMap((id) => sources.find((s) => s.id === id)?.title ?? []);
  return { id: newId(), text: claim.text, kind: claim.kind, source: titles.join('; '), claimId: claim.id };
}

const KIND_ORDER: ClaimKind[] = ['feit', 'anekdote', 'interpretatie', 'onzeker'];

/**
 * Talking points for a new stop: the best `n` claims that are not rejected. Verified claims come first, then by
 * kind (feit, anekdote, interpretatie, onzeker), otherwise in research order. Copies keep their claim link, so
 * guide mode shows "niet geverifieerd" until the guide confirms the claim.
 */
export function starterPoints(research: Research, n = 3): TalkingPoint[] {
  const rank = (c: Claim) => (c.status === 'geverifieerd' ? 0 : 10) + KIND_ORDER.indexOf(c.kind);
  return research.claims
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.status !== 'afgewezen')
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .slice(0, n)
    .map(({ c }) => talkingPointFromClaim(c, research.sources));
}

/** The claim a talking point was copied from, if it still exists. */
export function linkedClaim(tp: TalkingPoint, research: Research): Claim | undefined {
  return tp.claimId ? research.claims.find((c) => c.id === tp.claimId) : undefined;
}

export function researchCounts(r: Research): Record<ClaimStatus, number> & { sources: number } {
  const n = { concept: 0, geverifieerd: 0, afgewezen: 0, sources: r.sources.length };
  for (const c of r.claims) n[c.status]++;
  return n;
}

function upsert<T extends { id: string }>(xs: T[], x: T): T[] {
  return xs.some((y) => y.id === x.id) ? xs.map((y) => (y.id === x.id ? x : y)) : [...xs, x];
}
