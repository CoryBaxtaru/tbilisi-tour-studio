// The research round trip of the Studie section. The app builds a prompt to copy into any Claude chat; the answer
// is pasted back, checked here, and saved on each site: new sources and claims (always as concept) plus the story.
// A pasted answer is outside data, so nothing is trusted: facts need a real source link, Wikipedia is refused
// (founder's rule), sizes are capped, and the text is only ever rendered as text.
import { CATALOG, catalogLandmarkId, landmarkFromCatalog } from './catalog';
import { newId, nowIso } from './factory';
import { isWebUrl, LANGUAGES, mergedResearch, SOURCE_TYPES, withClaim, withSource } from './research';
import { PASSAGES, siteName, storylineKey } from './story';
import type { Claim, ClaimKind, Landmark, SavedQuestion, SavedSentence, SourceRef } from './types';

export const REPLY_FORMAT = 'tourstudio-verhaal-1';
/** Founder's rule: folklore may be told as long as the sentence opens with one of these. */
export const MYTH_OPENERS = ['Legendes zeggen dat', 'Een bekende volksmythe is'];
const MAX_TEXT = 1500;
const MAX_ITEMS = 60;
const MAX_REPLY = 400_000;
const KINDS: ClaimKind[] = ['feit', 'interpretatie', 'anekdote', 'onzeker'];

/** Words a Dutch guest would stumble over, each with a simpler way to say it. Used to warn, not to block. */
export const HARD_WORDS: Record<string, string> = {
  eclectisch: 'een mix van stijlen', classicistisch: 'klassieke stijl', driebeukig: 'met drie lange delen', gestileerd: 'vereenvoudigd',
  cultuurlaag: 'laag met resten', bekokstoofd: 'geregeld', majolica: 'gekleurd aardewerk', inscriptie: 'tekst op de muur',
  gelijkgesteld: 'door elkaar gehaald', overkapping: 'dak', irrigatie: 'water', dateert: 'komt uit', neogoti: 'gotische stijl',
  ritus: 'manier', gewapend: 'beton', derhalve: 'daarom', desalniettemin: 'toch', voorts: 'ook', tevens: 'ook', alsmede: 'en',
  wellicht: 'misschien', aldus: 'zo', dientengevolge: 'daardoor', monumentaal: 'groot', iconisch: 'beroemd', authentiek: 'echt',
  fungeerde: 'was', fungeert: 'is', gesitueerd: 'gelegen', evident: 'duidelijk', prominent: 'belangrijk', hegemonie: 'macht',
  geopolitiek: 'machtsstrijd tussen landen', paradigma: 'manier van denken', symbiose: 'samenleven', vernacular: 'plaatselijke stijl',
};

/** Parts of a text that mention a legend or myth without opening with one of MYTH_OPENERS. */
export function mythsWithoutOpener(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((part) => /\b(legendes?|volksmythes?|mythes?|overlevering)\b/i.test(part) && !MYTH_OPENERS.some((o) => part.includes(o)));
}

/** The hard words in a text. */
export function hardWords(text: string): string[] {
  const low = text.toLowerCase();
  return Object.keys(HARD_WORDS).filter((w) => new RegExp(`(^|[^\\p{L}])${w}`, 'u').test(low));
}

function knownClaims(siteId: string, landmarks: Landmark[]): { ref: string; claim: Claim }[] {
  const lm = landmarks.find((l) => l.id === catalogLandmarkId(siteId));
  return mergedResearch(lm, siteId).claims.map((claim) => ({
    claim,
    ref: claim.id.startsWith(`cat:${siteId}:`) ? claim.id.slice(`cat:${siteId}:`.length) : claim.id,
  }));
}

/** The text to copy into Claude: the job, the rules, what is already known, and the answer format. */
export function buildResearchPrompt(order: string[], landmarks: Landmark[]): string {
  const sites = order.map((id) => {
    const known = knownClaims(id, landmarks);
    const site = CATALOG.find((s) => s.id === id);
    return {
      id,
      naam: siteName(id),
      georgisch: site?.nameKa || undefined,
      bekendeFeiten: known.filter((k) => k.claim.status !== 'afgewezen').map((k) => ({ id: k.ref, soort: k.claim.kind, tekst: k.claim.text })),
      foutGebleken: known.filter((k) => k.claim.status === 'afgewezen').map((k) => k.claim.text),
    };
  });
  return `Je helpt me met een wandeltour in het Nederlands door Tbilisi, Georgië. Ik ben de gids en vertel dit hardop aan Nederlandse gasten. Doe eerst onderzoek op internet en schrijf daarna de verhaallijn.

## Stap 1: onderzoek
Zoek per plek naar feiten en kleine verhalen die nog niet bij "bekendeFeiten" staan: mensen, gebeurtenissen, jaartallen, dingen die gasten verrassen en dingen die je ter plekke kunt zien. Zoek ook in het Georgisch, Russisch en Engels. Zoek vooral naar verbanden tussen de plekken: dezelfde persoon, dezelfde gebeurtenis, dezelfde tijd. Probeer minstens 3 nieuwe feiten per plek te vinden.

Regels voor feiten:
- Verzin niets. Gebruik alleen wat staat in een bron die je echt hebt geopend, met de echte link.
- Wikipedia en Wikidata tellen niet als bron. Je mag wel de bronnen gebruiken die onderaan Wikipedia staan, als je die zelf opent en controleert.
- Geef elk feit een "soort": "feit" (staat vast), "anekdote" (overlevering of verhaal), "interpretatie" (uitleg of mening), "onzeker" (bronnen zijn het oneens).
- Zijn bronnen het oneens? Zeg dat, en verzin geen middenweg.
- Vind je iets niet? Laat het weg en zet het kort in "nietGevonden". Dat is beter dan gokken.
- Noem geen looproutes, openingstijden of prijzen.
- Legendes, folklore en bekende volksmythes zijn welkom, ook als alleen een reisgids ze noemt. Ze moeten wel echt rondgaan: verzin er geen. Zet ze bij "nieuweFeiten" met soort "anekdote" en met een link.
- Gebruik niets uit "foutGebleken".

## Stap 2: de verhaallijn
Kies de beste volgorde voor een wandeling (de plekken liggen allemaal in de stad; kies wat het beste verhaal geeft). Schrijf per plek een stuk tekst om hardop te vertellen, ongeveer 1 tot 2 minuten. Het moet lopen als één verhaal, niet als een rijtje feiten. Geef ook per plek 2 of 3 vragen die gasten waarschijnlijk stellen, met een kort antwoord.

## Taal: dit is belangrijk
- Eenvoudig Nederlands, zoals je tegen vrienden praat. Korte zinnen. Eén gedachte per zin.
- Geen dure woorden. Dus niet "eclectisch", "monumentaal", "fungeerde" of "derhalve", maar "een mix van stijlen", "groot", "was" of "daarom".
- Kun je een moeilijk woord niet vermijden, zoals "katholikos"? Leg het dan in dezelfde zin uit.
- Niet te veel jaartallen: alleen de jaartallen die het verhaal nodig heeft.
- Schrijf "we" en "jullie". Begin met iets dat de gasten nieuwsgierig maakt. Overdrijf niet.
- Overgang en slot voegen geen nieuwe feiten toe; ze verbinden alleen wat al verteld is.
- Elke zin met een legende of mythe begint met "Legendes zeggen dat" of "Een bekende volksmythe is", zodat gasten horen dat het geen vaststaand feit is.

## Zo moet je antwoorden
Eindig met één JSON-blok in precies deze vorm. Ik plak dit in mijn website, dus zet er geen uitleg in.
- Elke zin in "verhaal" noemt in "feiten" de feiten waarop hij steunt: de id uit "bekendeFeiten" of een nieuwe id uit "nieuweFeiten". Alleen een zin zonder feit of jaartal mag een lege lijst hebben.
- "overgang" is wat ik onderweg naar de volgende plek zeg; laat die bij de laatste plek weg.

\`\`\`json
{
  "format": "${REPLY_FORMAT}",
  "titel": "korte naam van de verhaallijn",
  "opening": "wat ik aan het begin zeg",
  "slot": "wat ik aan het eind zeg",
  "volgorde": ["id van de eerste plek", "id van de tweede plek"],
  "plekken": [
    {
      "id": "id van de plek",
      "naamInZin": "bijvoorbeeld: de Metekhi-kerk",
      "jaar": 1278,
      "tijd": "bijvoorbeeld: de 13e eeuw",
      "bronnen": [{ "id": "b1", "titel": "titel van de bron", "url": "https://...", "soort": "${Object.keys(SOURCE_TYPES).join('|')}", "taal": "nl" }],
      "nieuweFeiten": [{ "id": "f1", "soort": "feit", "tekst": "het feit in eenvoudig Nederlands", "bronnen": ["b1"], "bewijs": "wat de bron precies zegt" }],
      "verhaal": [{ "tekst": "een zin om te vertellen", "feiten": ["c1", "f1"] }],
      "overgang": "wat ik onderweg zeg",
      "vragen": [{ "vraag": "een vraag van een gast", "antwoord": "kort antwoord", "feiten": ["f1"] }],
      "nietGevonden": "wat ik niet kon vinden"
    }
  ]
}
\`\`\`

## De plekken
${JSON.stringify(sites, null, 1)}`;
}

export interface ReplySite {
  siteId: string;
  short?: string;
  year?: number;
  era?: string;
  sources: (SourceRef & { localId: string })[];
  facts: (Claim & { localId: string })[];
  sentences: { text: string; refs: string[] }[];
  bridge?: string;
  questions: { question: string; answer: string; refs: string[] }[];
  notFound?: string;
}

export interface ParsedReply {
  title: string;
  opening: string;
  closing: string;
  order: string[];
  sites: ReplySite[];
  /** Things that were refused or look wrong, in plain Dutch. */
  problems: string[];
  hardWords: string[];
  /** Sentences that tell a myth without the required opening. */
  mythWarnings: string[];
}

const str = (v: unknown, max = MAX_TEXT): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v.slice(0, MAX_ITEMS) : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const refusedHost = (url: string) => /(^|\.)wiki(pedia|data|media)\.org$/i.test(hostOf(url));
function hostOf(url: string): string {
  try { return new URL(url).hostname; } catch { return ''; }
}

/** Takes the JSON out of Claude's answer: a fenced block when there is one, otherwise the outermost braces. */
function extractJson(text: string): unknown {
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  const start = text.indexOf('{');
  const candidates = [...fenced.reverse(), start >= 0 ? text.slice(start, text.lastIndexOf('}') + 1) : ''];
  for (const c of candidates) {
    try { return JSON.parse(c); } catch { /* try the next one */ }
  }
  throw new Error('Ik vind geen geldig JSON-blok in deze tekst. Heb je het hele antwoord van Claude geplakt?');
}

/** Checks a pasted answer. Throws a Dutch message when it cannot be used; smaller problems end up in `problems`. */
export function parseReply(text: string, landmarks: Landmark[]): ParsedReply {
  if (text.length > MAX_REPLY) throw new Error('Deze tekst is te lang.');
  const raw = obj(extractJson(text));
  if (raw.format !== REPLY_FORMAT) throw new Error('Dit antwoord heeft niet het juiste formaat. Vraag Claude om alleen het JSON-blok uit de opdracht.');
  const problems: string[] = [];
  const sites: ReplySite[] = [];

  for (const rawSite of list(raw.plekken)) {
    const s = obj(rawSite);
    const siteId = str(s.id, 80);
    if (!CATALOG.some((c) => c.id === siteId)) {
      problems.push(`Onbekende plek overgeslagen: "${siteId}".`);
      continue;
    }
    const name = siteName(siteId);

    const sources: ReplySite['sources'] = [];
    for (const rawSource of list(s.bronnen)) {
      const b = obj(rawSource);
      const url = str(b.url, 600);
      const title = str(b.titel, 300);
      if (!isWebUrl(url) || !title) { problems.push(`${name}: bron zonder titel of geldige link overgeslagen.`); continue; }
      if (refusedHost(url)) { problems.push(`${name}: Wikipedia-bron geweigerd (${title}).`); continue; }
      const type = str(b.soort, 30);
      const language = str(b.taal, 5).toLowerCase();
      sources.push({
        localId: str(b.id, 40), id: newId(), title, url,
        type: SOURCE_TYPES[type] ? type : 'website',
        language: LANGUAGES[language] ? language : 'en',
      });
    }

    const facts: ReplySite['facts'] = [];
    for (const rawFact of list(s.nieuweFeiten)) {
      const f = obj(rawFact);
      const factText = str(f.tekst);
      const sourceIds = list(f.bronnen).flatMap((r) => sources.find((x) => x.localId === r)?.id ?? []);
      if (!factText) continue;
      if (!sourceIds.length) { problems.push(`${name}: feit zonder bruikbare bron geweigerd: "${factText.slice(0, 70)}".`); continue; }
      const kind = KINDS.includes(f.soort as ClaimKind) ? (f.soort as ClaimKind) : 'onzeker';
      const evidence = str(f.bewijs);
      facts.push({ localId: str(f.id, 40), id: newId(), kind, text: factText, sourceIds, status: 'concept', origin: 'claude', ...(evidence ? { evidence } : {}) });
    }

    // A reference must point at a claim that is known and not rejected, or at a fact that passed above.
    const known = new Map(knownClaims(siteId, landmarks).map((k) => [k.ref, k.claim]));
    const validRef = (r: unknown) => facts.some((f) => f.localId === r) || (typeof r === 'string' && !!known.get(r) && known.get(r)!.status !== 'afgewezen');
    const refsOf = (v: unknown) => list(v).filter((r): r is string => typeof r === 'string');

    const sentences: ReplySite['sentences'] = [];
    for (const rawSentence of list(s.verhaal)) {
      const z = obj(rawSentence);
      const sentenceText = str(z.tekst);
      const refs = refsOf(z.feiten);
      if (!sentenceText) continue;
      if (!refs.every(validRef)) { problems.push(`${name}: zin weggelaten, het feit erachter ontbreekt: "${sentenceText.slice(0, 70)}".`); continue; }
      if (!refs.length && /\d/.test(sentenceText)) { problems.push(`${name}: zin met een getal maar zonder feit weggelaten: "${sentenceText.slice(0, 70)}".`); continue; }
      sentences.push({ text: sentenceText, refs });
    }

    const questions: ReplySite['questions'] = [];
    for (const rawQuestion of list(s.vragen)) {
      const v = obj(rawQuestion);
      const question = str(v.vraag, 300), answer = str(v.antwoord);
      const refs = refsOf(v.feiten);
      if (!question || !answer) continue;
      if (!refs.length || !refs.every(validRef)) { problems.push(`${name}: vraag zonder feit weggelaten: "${question.slice(0, 70)}".`); continue; }
      questions.push({ question, answer, refs });
    }

    const year = typeof s.jaar === 'number' && Number.isFinite(s.jaar) ? Math.round(s.jaar) : undefined;
    sites.push({
      siteId, sources, facts, sentences, questions, year,
      short: str(s.naamInZin, 80) || undefined,
      era: str(s.tijd, 60) || undefined,
      bridge: str(s.overgang) || undefined,
      notFound: str(s.nietGevonden) || undefined,
    });
  }
  if (!sites.length) throw new Error('Er staat geen enkele bekende plek in dit antwoord.');

  const ids = new Set(sites.map((s) => s.siteId));
  const order = list(raw.volgorde).filter((id): id is string => typeof id === 'string' && ids.has(id));
  for (const s of sites) if (!order.includes(s.siteId)) order.push(s.siteId);
  const title = str(raw.titel, 120), opening = str(raw.opening), closing = str(raw.slot);
  const allText = [opening, closing, ...sites.flatMap((s) => [s.bridge ?? '', ...s.sentences.map((x) => x.text), ...s.questions.map((q) => q.answer)])].join(' ');
  const mythWarnings = sites.flatMap((s) => s.sentences.flatMap((x) => mythsWithoutOpener(x.text)));
  return { title, opening, closing, order, sites, problems, hardWords: hardWords(allText), mythWarnings };
}

/** The landmarks to save: new claims and sources added, the story replaced. Sources and facts seen before are reused. */
export function applyReply(reply: ParsedReply, landmarks: Landmark[]): Landmark[] {
  const key = storylineKey(reply.order);
  return reply.sites.map((site, _i) => {
    const landmarkId = catalogLandmarkId(site.siteId);
    let lm = landmarks.find((l) => l.id === landmarkId) ?? landmarkFromCatalog(CATALOG.find((c) => c.id === site.siteId)!);
    const merged = mergedResearch(lm, site.siteId);
    const sourceId = new Map<string, string>();
    for (const s of site.sources) {
      const same = merged.sources.find((x) => x.url.trim() === s.url.trim());
      if (same) { sourceId.set(s.id, same.id); continue; }
      const { localId: _l, ...source } = s;
      lm = withSource(lm, source);
    }
    const normal = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();
    const refToId = new Map(knownClaims(site.siteId, landmarks).map((k) => [k.ref, k.claim.id]));
    for (const f of site.facts) {
      const same = merged.claims.find((c) => normal(c.text) === normal(f.text));
      if (same) { refToId.set(f.localId, same.id); continue; }
      const { localId, ...claim } = f;
      lm = withClaim(lm, { ...claim, sourceIds: claim.sourceIds.map((id) => sourceId.get(id) ?? id) });
      refToId.set(localId, claim.id);
    }
    const ids = (refs: string[]) => refs.flatMap((r) => refToId.get(r) ?? []);
    const sentences: SavedSentence[] = site.sentences.map((s) => ({ text: s.text, claimIds: ids(s.refs) }));
    const questions: SavedQuestion[] = site.questions.map((q) => ({ question: q.question, answer: q.answer, claimIds: ids(q.refs) }));
    const old = lm.story;
    const next = reply.order[reply.order.indexOf(site.siteId) + 1];
    const first = reply.order[0] === site.siteId && reply.order.length > 1;
    const hasStoryline = reply.title || reply.opening || reply.closing;
    return {
      ...lm,
      story: {
        sentences: sentences.length ? sentences : old?.sentences ?? [],
        short: site.short ?? old?.short ?? PASSAGES[site.siteId]?.short,
        year: site.year ?? old?.year ?? PASSAGES[site.siteId]?.year,
        era: site.era ?? old?.era ?? PASSAGES[site.siteId]?.era,
        bridges: { ...old?.bridges, ...(next && site.bridge ? { [next]: site.bridge } : {}) },
        questions: questions.length ? questions : old?.questions ?? [],
        storylines: { ...old?.storylines, ...(first && hasStoryline ? { [key]: { title: reply.title, opening: reply.opening, closing: reply.closing } } : {}) },
        savedAt: nowIso(),
      },
    };
  });
}
