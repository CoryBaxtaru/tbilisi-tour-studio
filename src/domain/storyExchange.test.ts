import { describe, expect, it } from 'vitest';
import { catalogLandmarkId } from './catalog';
import { mergedResearch } from './research';
import { buildStoryline, keywords, PASSAGES, THREADS, tourFromStoryline } from './story';
import { applyReply, buildResearchPrompt, hardWords, mythsWithoutOpener, parseReply, REPLY_FORMAT } from './storyExchange';
import type { Landmark } from './types';

const reply = (over: Record<string, unknown> = {}) => ({
  format: REPLY_FORMAT,
  titel: 'Buskruit',
  opening: 'We gaan beginnen.',
  slot: 'Dat was het.',
  volgorde: ['metekhi', 'narikala'],
  plekken: [
    {
      id: 'metekhi', naamInZin: 'de Metekhi-kerk', jaar: 1278, tijd: 'de 13e eeuw',
      bronnen: [
        { id: 'b1', titel: 'Een boek', url: 'https://example.org/boek', soort: 'naslagwerk', taal: 'en' },
        { id: 'b2', titel: 'Wikipedia', url: 'https://nl.wikipedia.org/wiki/Metechi', soort: 'website', taal: 'nl' },
      ],
      nieuweFeiten: [
        { id: 'f1', soort: 'feit', tekst: 'Een nieuw feit.', bronnen: ['b1'], bewijs: 'Staat op pagina 3.' },
        { id: 'f2', soort: 'feit', tekst: 'Alleen uit Wikipedia.', bronnen: ['b2'] },
      ],
      verhaal: [
        { tekst: 'Kijk eens omhoog.', feiten: [] },
        { tekst: 'Dit steunt op iets nieuws.', feiten: ['f1'] },
        { tekst: 'Dit steunt op iets ouds.', feiten: ['c1'] },
        { tekst: 'Dit steunt op Wikipedia.', feiten: ['f2'] },
        { tekst: 'In 1500 gebeurde iets zonder bron.', feiten: [] },
      ],
      overgang: 'We lopen door.',
      vragen: [{ vraag: 'Hoe oud?', antwoord: 'Heel oud.', feiten: ['c2'] }, { vraag: 'Zomaar?', antwoord: 'Ja.', feiten: [] }],
    },
    { id: 'bestaat-niet', verhaal: [] },
    { id: 'narikala', verhaal: [{ tekst: 'De vesting.', feiten: ['c1'] }] },
  ],
  ...over,
});
const asText = (o: unknown) => `Hier is je verhaal.\n\n\`\`\`json\n${JSON.stringify(o)}\n\`\`\`\nVeel succes!`;

describe('buildResearchPrompt', () => {
  it('holds the rules, the format and what is known', () => {
    const p = buildResearchPrompt(['sioni'], []);
    expect(p).toContain('Geen dure woorden');
    expect(p).toContain('Wikipedia en Wikidata tellen niet als bron');
    expect(p).toContain(REPLY_FORMAT);
    expect(p).toContain('"id": "sioni"');
    expect(p).toContain('berg Sion');
  });
  it('moves rejected claims to the list of what proved wrong', () => {
    const c = mergedResearch(undefined, 'sioni').claims[0];
    const lm = { id: catalogLandmarkId('sioni'), catalogId: 'sioni', claims: [{ ...c, status: 'afgewezen' }] } as unknown as Landmark;
    const p = buildResearchPrompt(['sioni'], [lm]);
    expect(p.indexOf(c.text)).toBeGreaterThan(p.indexOf('foutGebleken'));
  });
});

describe('parseReply', () => {
  it('finds the JSON inside the answer and refuses what has no source', () => {
    const r = parseReply(asText(reply()), []);
    expect(r.order).toEqual(['metekhi', 'narikala']);
    const m = r.sites[0];
    expect(m.sources.map((s) => s.title)).toEqual(['Een boek']);
    expect(m.facts.map((f) => f.text)).toEqual(['Een nieuw feit.']);
    expect(m.facts[0]).toMatchObject({ status: 'concept', origin: 'claude' });
    expect(m.sentences.map((s) => s.text)).toEqual(['Kijk eens omhoog.', 'Dit steunt op iets nieuws.', 'Dit steunt op iets ouds.']);
    expect(m.questions.map((q) => q.question)).toEqual(['Hoe oud?']);
    const all = r.problems.join(' ');
    expect(all).toContain('Wikipedia-bron geweigerd');
    expect(all).toContain('bestaat-niet');
    expect(all).toContain('zonder feit');
  });
  it('gives a clear message for text it cannot use', () => {
    expect(() => parseReply('geen json hier', [])).toThrow(/JSON-blok/);
    expect(() => parseReply('{"format":"iets anders"}', [])).toThrow(/juiste formaat/);
    expect(() => parseReply(JSON.stringify(reply({ plekken: [] })), [])).toThrow(/bekende plek/);
  });
  it('refuses links that are not web links', () => {
    const base = reply();
    (base.plekken as { bronnen?: unknown[] }[])[0].bronnen = [{ id: 'b1', titel: 'Slecht', url: 'javascript:alert(1)' }];
    const r = parseReply(JSON.stringify(base), []);
    expect(r.sites[0].sources).toEqual([]);
    expect(r.sites[0].facts).toEqual([]);
  });
});

describe('applyReply', () => {
  const saved = applyReply(parseReply(asText(reply()), []), []);
  const metekhi = saved.find((l) => l.catalogId === 'metekhi')!;

  it('saves sources, concept claims and the story on the site', () => {
    expect(metekhi.sources?.map((s) => s.title)).toContain('Een boek');
    const claim = metekhi.claims?.find((c) => c.text === 'Een nieuw feit.');
    expect(claim?.status).toBe('concept');
    expect(claim?.sourceIds).toEqual([metekhi.sources?.find((s) => s.title === 'Een boek')?.id]);
    expect(metekhi.story?.sentences.find((s) => s.text.includes('iets nieuws'))?.claimIds).toEqual([claim?.id]);
    expect(metekhi.story?.bridges.narikala).toBe('We lopen door.');
    expect(metekhi.story?.year).toBe(1278);
  });

  it('is used by the storyline and keeps working across a second paste', () => {
    const line = buildStoryline(['metekhi', 'narikala'], 'eigen', saved);
    expect(line.thread?.label).toBe('Buskruit');
    const text = line.blocks.flatMap((b) => b.sentences.map((s) => s.text));
    expect(text).toContain('We gaan beginnen.');
    expect(text).toContain('We lopen door.');
    expect(text).toContain('Dat was het.');
    expect(line.blocks.find((b) => b.siteId === 'metekhi')).toMatchObject({ saved: true });

    const again = applyReply(parseReply(asText(reply()), saved), saved).find((l) => l.catalogId === 'metekhi')!;
    expect(again.claims?.filter((c) => c.text === 'Een nieuw feit.')).toHaveLength(1);
    expect(again.sources?.filter((s) => s.title === 'Een boek')).toHaveLength(1);
    const claimId = again.claims?.find((c) => c.text === 'Een nieuw feit.')?.id;
    expect(again.story?.sentences.find((s) => s.text.includes('iets nieuws'))?.claimIds).toEqual([claimId]);
    expect(new Set(again.claims?.find((c) => c.id === claimId)?.sourceIds).size).toBe(1);
  });

  it('drops a saved sentence when its claim is rejected later', () => {
    const rejected = saved.map((l) => (l.catalogId === 'metekhi'
      ? { ...l, claims: l.claims?.map((c) => (c.text === 'Een nieuw feit.' ? { ...c, status: 'afgewezen' as const } : c)) }
      : l));
    const text = buildStoryline(['metekhi'], 'eigen', rejected).blocks.flatMap((b) => b.sentences.map((s) => s.text));
    expect(text).not.toContain('Dit steunt op iets nieuws.');
    expect(text).toContain('Dit steunt op iets ouds.');
  });
});

describe('plain Dutch', () => {
  it('finds hard words', () => {
    expect(hardWords('Een eclectische gevel, die fungeerde als poort.')).toEqual(['eclectisch', 'fungeerde']);
    expect(hardWords('Een mooie gevel.')).toEqual([]);
  });
  it('the bundled text uses none', () => {
    const text = [
      ...Object.values(PASSAGES).flatMap((p) => [...p.sentences.map((s) => s.t), ...(p.questions ?? []).flatMap((q) => [q.q, q.a])]),
      ...THREADS.flatMap((t) => [t.label, t.intro, t.close, ...t.bridges, ...Object.values(t.refs).map((r) => r.t)]),
    ].join(' ');
    expect(hardWords(text)).toEqual([]);
  });
});

describe('myths', () => {
  it('finds a myth without the required opening', () => {
    expect(mythsWithoutOpener('Volgens de legende bouwde hij dit. Dat is mooi.')).toEqual(['Volgens de legende bouwde hij dit.']);
    expect(mythsWithoutOpener('Legendes zeggen dat hij dit bouwde.')).toEqual([]);
    expect(mythsWithoutOpener('Een bekende volksmythe is dat hij hier zat.')).toEqual([]);
  });
  it('every story uses the opening', () => {
    for (const [site, p] of Object.entries(PASSAGES)) {
      for (const s of p.sentences) expect(mythsWithoutOpener(s.t), site).toEqual([]);
    }
  });
  it('the prompt asks for it and a pasted answer is checked', () => {
    expect(buildResearchPrompt(['sioni'], [])).toContain('Legendes zeggen dat');
    const r = parseReply(JSON.stringify(reply({ plekken: [{ id: 'sioni', verhaal: [{ tekst: 'Volgens de overlevering was dit zo.', feiten: ['c1'] }] }] })), []);
    expect(r.mythWarnings).toEqual(['Volgens de overlevering was dit zo.']);
  });
});

describe('questions', () => {
  it('every bundled question rests on existing claims', () => {
    for (const [site, p] of Object.entries(PASSAGES)) {
      expect(p.questions?.length, site).toBeGreaterThan(0);
      const ids = new Set(mergedResearch(undefined, site).claims.map((c) => c.id));
      for (const q of p.questions ?? []) for (const c of q.c) expect(ids.has(`cat:${site}:${c}`), `${site} ${c}`).toBe(true);
    }
  });
  it('are shown per stop and drop with a rejected claim', () => {
    expect(buildStoryline(['gabriadze'], 'eigen', []).blocks[0].questions?.length).toBe(2);
    const c = mergedResearch(undefined, 'gabriadze').claims.find((x) => x.id.endsWith(':c1'))!;
    const lm = { id: catalogLandmarkId('gabriadze'), catalogId: 'gabriadze', claims: [{ ...c, status: 'afgewezen' }] } as unknown as Landmark;
    expect(buildStoryline(['gabriadze'], 'eigen', [lm]).blocks[0].questions?.length).toBe(1);
  });
});

describe('keywords', () => {
  it('keeps names, years and quoted words, not sentence starts', () => {
    const k = keywords('Daarna kwam Jean Chardin in 1672 naar "het plein", en Sioni.');
    expect(k).toEqual(expect.arrayContaining(['het plein', 'Jean Chardin', '1672', 'Sioni']));
    expect(k).not.toContain('Daarna');
  });
});

describe('tourFromStoryline', () => {
  it('turns a storyline into stops with points, transitions and notes', () => {
    const line = buildStoryline(['narikala', 'metekhi'], 'eigen', []);
    const { tour, newLandmarks } = tourFromStoryline(line, []);
    expect(tour.title).toBe('Buskruit in de kerk');
    expect(tour.stops.map((s) => s.landmarkId)).toEqual(['cat:narikala', 'cat:metekhi']);
    expect(tour.stops[0].transition).toContain('buskruitopslag');
    expect(tour.stops[1].transition).toBe('');
    expect(tour.stops[0].talkingPoints.length).toBeGreaterThan(2);
    expect(tour.stops[0].talkingPoints.every((p) => p.claimId)).toBe(true);
    expect(tour.stops[0].guideNotes).toContain('Hoe oud is de vesting?');
    expect(tour.stops[0].speakingMinutes).toBeGreaterThan(0);
    expect(newLandmarks.map((l) => l.id)).toEqual(['cat:narikala', 'cat:metekhi']);
  });
});
