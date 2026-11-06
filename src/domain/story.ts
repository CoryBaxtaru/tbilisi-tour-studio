// Study section: turns a set of sites into a spoken storyline. Runs without any AI service, in the browser and
// offline: the text is written ahead of time from the source-checked claims (story-passages.json, or an answer
// pasted back and saved on the site), and this module only chooses the order and which link fits. Every sentence
// names the claims it rests on, so a claim the guide rejects drops out. Connecting sentences add no new facts.
import data from '../data/story-passages.json';
import { CATALOG, catalogLandmarkId, landmarkFromCatalog } from './catalog';
import { createStop, createTour } from './factory';
import { haversineM } from './geo';
import { draftResearch, mergedResearch, talkingPointFromClaim } from './research';
import type { Claim, LatLng, Landmark, SavedStory, TalkingPoint, Tour, TourStop } from './types';

export type StoryOrder = 'verhaal' | 'wandeling' | 'tijd' | 'eigen';
export const STORY_ORDERS: Record<StoryOrder, string> = { verhaal: 'Verhaallijn', wandeling: 'Korte route', tijd: 'Tijdlijn', eigen: 'Mijn volgorde' };

/** verbindend = connecting text without own facts; aangepast = the guide edited the claim after this was written. */
export type SentenceState = 'verbindend' | 'concept' | 'geverifieerd' | 'aangepast';

export interface StorySentence { text: string; state: SentenceState; claims: Claim[] }
export interface StoryQuestion { question: string; answer: string; state: SentenceState }

export interface StoryBlock {
  kind: 'opening' | 'stop' | 'overgang' | 'slot';
  siteId?: string;
  name?: string;
  /** False when no passage is written yet and the block is just the site's claims in a row. */
  written?: boolean;
  /** True when the text comes from an answer pasted back and saved on the site. */
  saved?: boolean;
  sentences: StorySentence[];
  questions?: StoryQuestion[];
}

export interface Storyline {
  order: string[];
  thread: { id: string; label: string } | null;
  blocks: StoryBlock[];
  words: number;
  /** Speaking time at a calm guide's pace. */
  minutes: number;
  /** Sum of straight lines between the stops: not a walking route. */
  straightM: number;
  counts: Record<SentenceState, number>;
}

interface RawSentence { t: string; c: string[] }
interface RawQuestion { q: string; a: string; c: string[] }
interface Passage { short: string; year: number; era: string; sentences: RawSentence[]; questions?: RawQuestion[] }
interface Thread { id: string; label: string; intro: string; close: string; bridges: string[]; refs: Record<string, RawSentence> }

export const PASSAGES = data.sites as unknown as Record<string, Passage>;
export const THREADS = data.threads as unknown as Thread[];
const WORDS_PER_MINUTE = 130;
/** In the story order, a shared thread counts as this many metres closer. */
const THREAD_BONUS_M = 250;

const siteById = new Map(CATALOG.map((s) => [s.id, s]));
const positionOf = (id: string): LatLng | null => {
  const s = siteById.get(id);
  return s && typeof s.lat === 'number' && typeof s.lng === 'number' ? { lat: s.lat, lng: s.lng } : null;
};
/** Display name without the catalogue's "(voorheen ...)" addition. */
export const siteName = (id: string) => (siteById.get(id)?.name ?? id).replace(/\s*\(.*\)$/, '');
/** The key of a saved storyline: the same sites, in any order. */
export const storylineKey = (ids: string[]) => [...ids].sort().join(',');

interface Resolved { byId: Map<string, Claim>; list: Claim[]; sources: ReturnType<typeof mergedResearch>['sources']; drafts: Map<string, string>; story?: SavedStory }
type Resolve = (siteId: string) => Resolved;

function claimsResolver(landmarks: Landmark[]): Resolve {
  const byId = new Map(landmarks.filter((l) => !l.deleted).map((l) => [l.id, l]));
  const cache = new Map<string, Resolved>();
  return (siteId) => {
    let v = cache.get(siteId);
    if (!v) {
      const lm = byId.get(catalogLandmarkId(siteId));
      const merged = mergedResearch(lm, siteId);
      v = {
        byId: new Map(merged.claims.map((c) => [c.id, c])),
        list: merged.claims,
        sources: merged.sources,
        drafts: new Map(draftResearch(siteId).claims.map((c) => [c.id, c.text])),
        story: lm?.story,
      };
      cache.set(siteId, v);
    }
    return v;
  };
}

const shortName = (id: string, resolve: Resolve) => resolve(id).story?.short ?? PASSAGES[id]?.short ?? siteName(id);
const anchor = (id: string, resolve: Resolve) => {
  const s = resolve(id).story;
  const p = PASSAGES[id];
  return { year: s?.year ?? p?.year, era: s?.era ?? p?.era };
};

/** The state of a text resting on these claims, or null when one was rejected or removed. */
function stateOf(refs: string[], siteId: string, resolve: Resolve): { state: SentenceState; claims: Claim[] } | null {
  if (!refs.length) return { state: 'verbindend', claims: [] };
  const r = resolve(siteId);
  const claims: Claim[] = [];
  for (const ref of refs) {
    const c = r.byId.get(/^c\d+$/.test(ref) ? `cat:${siteId}:${ref}` : ref);
    if (!c || c.status === 'afgewezen') return null;
    claims.push(c);
  }
  const edited = claims.some((c) => r.drafts.has(c.id) && r.drafts.get(c.id) !== c.text);
  return { state: edited ? 'aangepast' : claims.every((c) => c.status === 'geverifieerd') ? 'geverifieerd' : 'concept', claims };
}

function questionsOf(siteId: string, resolve: Resolve): StoryQuestion[] {
  const saved = resolve(siteId).story?.questions.map((q) => ({ question: q.question, answer: q.answer, refs: q.claimIds })) ?? [];
  const bundled = PASSAGES[siteId]?.questions?.map((q) => ({ question: q.q, answer: q.a, refs: q.c })) ?? [];
  const seen = new Set<string>();
  const out: StoryQuestion[] = [];
  for (const q of [...saved, ...bundled]) {
    if (seen.has(q.question)) continue;
    seen.add(q.question);
    const s = stateOf(q.refs, siteId, resolve);
    if (s) out.push({ question: q.question, answer: q.answer, state: s.state });
  }
  return out;
}

function stopBlock(siteId: string, resolve: Resolve): StoryBlock {
  const base = { kind: 'stop' as const, siteId, name: siteName(siteId), questions: questionsOf(siteId, resolve) };
  const savedText = resolve(siteId).story?.sentences;
  const raw = savedText?.length ? savedText.map((s) => ({ t: s.text, c: s.claimIds })) : PASSAGES[siteId]?.sentences;
  if (raw) {
    const kept = raw.map((s) => {
      const st = stateOf(s.c, siteId, resolve);
      return st && { text: s.t, ...st };
    });
    // Opening lines without facts only make sense with the facts behind them.
    const sentences = kept.some((s) => s && s.state !== 'verbindend') ? kept.filter((s): s is StorySentence => !!s) : [];
    return { ...base, written: true, saved: !!savedText?.length, sentences };
  }
  const sentences = resolve(siteId).list
    .filter((c) => c.status !== 'afgewezen')
    .map((c): StorySentence => ({ text: c.text, state: c.status === 'geverifieerd' ? 'geverifieerd' : 'concept', claims: [c] }));
  return { ...base, written: false, sentences };
}

/** Threads linking two sites, most specific first, whose claims are all still standing. */
function liveThreads(a: string, b: string, resolve: Resolve): { thread: Thread; a: string; b: string }[] {
  const out: { thread: Thread; a: string; b: string }[] = [];
  for (const thread of THREADS) {
    const ra = thread.refs[a], rb = thread.refs[b];
    if (ra && rb && stateOf(ra.c, a, resolve) && stateOf(rb.c, b, resolve)) out.push({ thread, a: ra.t, b: rb.t });
  }
  return out;
}

function step(a: string, b: string, linked: (a: string, b: string) => boolean, bonus: number): number {
  const pa = positionOf(a), pb = positionOf(b);
  const d = pa && pb ? haversineM(pa, pb) : 5000;
  return d - (bonus && linked(a, b) ? bonus : 0);
}

/** Nearest-neighbour path from every possible start; keeps the cheapest. A shared thread counts as closer. */
function bestPath(ids: string[], linked: (a: string, b: string) => boolean, bonus: number): string[] {
  let best: string[] = ids, bestCost = Infinity;
  for (const start of ids) {
    const path = [start];
    const left = new Set(ids.filter((x) => x !== start));
    let cost = 0;
    while (left.size) {
      let next = '', nextCost = Infinity;
      for (const c of left) {
        const d = step(path[path.length - 1], c, linked, bonus);
        if (d < nextCost) { nextCost = d; next = c; }
      }
      cost += nextCost;
      path.push(next);
      left.delete(next);
    }
    if (cost < bestCost) { bestCost = cost; best = path; }
  }
  return best;
}

function orderSites(ids: string[], mode: StoryOrder, resolve: Resolve): string[] {
  if (mode === 'eigen') return ids;
  if (mode === 'tijd') {
    return [...ids].sort((a, b) => (anchor(a, resolve).year ?? Infinity) - (anchor(b, resolve).year ?? Infinity));
  }
  if (ids.length < 3) return ids;
  const linked = (a: string, b: string) => liveThreads(a, b, resolve).length > 0;
  return bestPath(ids, linked, mode === 'verhaal' ? THREAD_BONUS_M : 0);
}

/** The thread with the most selected sites (at least two); ties go to the more specific, earlier one. */
function mainThread(ids: string[], resolve: Resolve): Thread | null {
  let best: Thread | null = null, bestN = 1;
  for (const t of THREADS) {
    const n = ids.filter((id) => t.refs[id] && stateOf(t.refs[id].c, id, resolve)).length;
    if (n > bestN) { best = t; bestN = n; }
  }
  return best;
}

const linking = (text: string): StorySentence => ({ text, state: 'verbindend', claims: [] });

/** A spoken bridge: a saved one, a shared thread with an unused line, the jump in time, or plainly the next stop. */
function bridge(a: string, b: string, used: Map<string, number>, resolve: Resolve): string {
  const saved = resolve(a).story?.bridges[b];
  if (saved) return saved;
  const options = liveThreads(a, b, resolve);
  const fresh = options.find((o) => (used.get(o.thread.id) ?? 0) < o.thread.bridges.length);
  if (fresh) {
    const n = used.get(fresh.thread.id) ?? 0;
    used.set(fresh.thread.id, n + 1);
    return fresh.thread.bridges[n].replace('{a}', fresh.a).replace('{b}', fresh.b);
  }
  const pa = anchor(a, resolve), pb = anchor(b, resolve), to = shortName(b, resolve);
  if (pa.era && pb.era && pa.year !== undefined && pb.year !== undefined) {
    if (pa.era === pb.era) return `We blijven in ${pa.era}, maar gaan naar een andere plek: ${to}.`;
    return pb.year < pa.year
      ? `Van ${pa.era} gaan we terug in de tijd, naar ${pb.era}: op naar ${to}.`
      : `Van ${pa.era} gaan we vooruit in de tijd, naar ${pb.era}: op naar ${to}.`;
  }
  return `Onze volgende plek is ${to}.`;
}

export function buildStoryline(ids: string[], mode: StoryOrder, landmarks: Landmark[]): Storyline {
  const resolve = claimsResolver(landmarks);
  const known = [...new Set(ids)].filter((id) => siteById.has(id));
  const order = orderSites(known, mode, resolve);
  const thread = mainThread(order, resolve);
  const key = storylineKey(order);
  const savedLine = order.map((id) => resolve(id).story?.storylines[key]).find((x) => !!x);
  const blocks: StoryBlock[] = [];

  if (order.length > 1) {
    const route = `We beginnen bij ${shortName(order[0], resolve)} en eindigen bij ${shortName(order[order.length - 1], resolve)}, ${order.length} plekken in totaal.`;
    const opening = savedLine?.opening ? [linking(savedLine.opening)] : [linking(route), ...(thread ? [linking(thread.intro)] : [])];
    blocks.push({ kind: 'opening', sentences: opening });
  }
  const used = new Map<string, number>();
  order.forEach((id, i) => {
    if (i > 0) blocks.push({ kind: 'overgang', sentences: [linking(bridge(order[i - 1], id, used, resolve))] });
    blocks.push(stopBlock(id, resolve));
  });
  if (order.length > 1) {
    const end = savedLine?.closing || thread?.close || `Daarmee zijn we bij ${shortName(order[order.length - 1], resolve)} aan het einde van het verhaal.`;
    blocks.push({ kind: 'slot', sentences: [linking(end)] });
  }

  const counts: Record<SentenceState, number> = { verbindend: 0, concept: 0, geverifieerd: 0, aangepast: 0 };
  let words = 0;
  for (const b of blocks) for (const s of b.sentences) {
    counts[s.state]++;
    words += s.text.split(/\s+/).length;
  }
  let straightM = 0;
  for (let i = 1; i < order.length; i++) {
    const pa = positionOf(order[i - 1]), pb = positionOf(order[i]);
    if (pa && pb) straightM += haversineM(pa, pb);
  }
  const shown = savedLine?.title ? { id: 'opgeslagen', label: savedLine.title } : thread && { id: thread.id, label: thread.label };
  return { order, thread: shown, blocks, words, minutes: words / WORDS_PER_MINUTE, straightM, counts };
}

/** Sites for the picker: those with a written passage first. */
export function studySites(landmarks: Landmark[] = []): { id: string; name: string; written: boolean; position: LatLng | null }[] {
  const saved = new Set(landmarks.filter((l) => l.story?.sentences.length && l.catalogId).map((l) => l.catalogId));
  return CATALOG
    .map((s) => ({ id: s.id, name: siteName(s.id), written: !!PASSAGES[s.id] || saved.has(s.id), position: positionOf(s.id) }))
    .sort((a, b) => Number(b.written) - Number(a.written) || a.name.localeCompare(b.name, 'nl'));
}

/** Prompts for practising: names, years and quoted words of a sentence, the things a guide must not forget. */
export function keywords(text: string): string[] {
  const found: string[] = [];
  const add = (w: string) => { if (!found.includes(w)) found.push(w); };
  for (const m of text.matchAll(/"([^"]{2,40})"/g)) add(m[1]);
  for (const m of text.matchAll(/\d{3,4}(?:[–-]\d{2,4})?|\d{1,2}e eeuw|\p{Lu}[\p{L}-]+(?:\s\p{Lu}[\p{L}-]+)*/gu)) {
    // A single capitalised word at the start of a sentence is usually just a sentence start.
    const atStart = /(^|[.!?:]\s+)$/.test(text.slice(0, m.index));
    if (atStart && /^\p{Lu}[\p{Ll}]+$/u.test(m[0])) continue;
    add(atStart ? m[0].replace(/^(De|Het|Een|Dit|Deze|Dezelfde|In|Op|Bij|Van)s+/, '') : m[0]);
  }
  return found;
}

const KIND_RISK: Claim['kind'][] = ['onzeker', 'anekdote', 'interpretatie', 'feit'];

/** A tour from a storyline: talking points per stop, the bridges as transitions, questions in the guide notes. */
export function tourFromStoryline(story: Storyline, landmarks: Landmark[]): { tour: Tour; newLandmarks: Landmark[] } {
  const resolve = claimsResolver(landmarks);
  const tour = createTour(story.thread?.label ?? `${siteName(story.order[0])} tot ${siteName(story.order[story.order.length - 1])}`);
  tour.description = story.blocks.filter((b) => b.kind === 'opening').flatMap((b) => b.sentences.map((s) => s.text)).join(' ');
  const stops: TourStop[] = [];
  story.blocks.forEach((b, i) => {
    if (b.kind !== 'stop' || !b.siteId) return;
    const sources = resolve(b.siteId).sources;
    const points: TalkingPoint[] = [];
    let lead = '';
    for (const s of b.sentences) {
      if (!s.claims.length) { lead = `${lead}${s.text} `; continue; }
      const main = [...s.claims].sort((x, y) => KIND_RISK.indexOf(x.kind) - KIND_RISK.indexOf(y.kind))[0];
      points.push({ ...talkingPointFromClaim(main, sources), text: lead + s.text });
      lead = '';
    }
    const next = story.blocks[i + 1];
    const words = b.sentences.reduce((n, s) => n + s.text.split(/\s+/).length, 0);
    stops.push({
      ...createStop(catalogLandmarkId(b.siteId)),
      talkingPoints: points,
      transition: next?.kind === 'overgang' ? next.sentences.map((s) => s.text).join(' ') : '',
      guideNotes: (b.questions ?? []).map((q) => `${q.question} ${q.answer}`).join('\n'),
      speakingMinutes: Math.max(1, Math.ceil(words / WORDS_PER_MINUTE)),
    });
  });
  tour.stops = stops;
  const have = new Set(landmarks.filter((l) => !l.deleted).map((l) => l.id));
  const newLandmarks = story.order.filter((id) => !have.has(catalogLandmarkId(id))).map((id) => landmarkFromCatalog(siteById.get(id)!));
  return { tour, newLandmarks };
}
