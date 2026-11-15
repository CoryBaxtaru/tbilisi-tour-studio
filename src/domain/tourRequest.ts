// A tour on request: the guide puts a guest's wish into a prompt for Claude (outside the app, no API, no cost),
// Claude picks and orders sites from the catalogue only, and the answer is pasted back. The facts come from the app's
// own research and story passages, never from the answer, so nothing invented reaches a guest.
import { CATALOG, catalogLandmarkId } from './catalog';
import { buildStoryline, tourFromStoryline } from './story';
import { tagLabel } from './tags';
import type { Landmark, Tour } from './types';

export interface TourRequest {
  /** The guest's wish in the guide's own words, e.g. "zes mensen, alles over de oude stad en de geschiedenis". */
  wish: string;
  /** Planned length in minutes, walking and telling together. */
  minutes: number;
}

export interface RequestedStop {
  siteId: string;
  /** Minutes of telling Claude suggests; walking comes from the computed route. */
  minutes: number | null;
  why: string;
  /** Claude's idea for where to stand, in words; the guide picks the spot on the map. */
  standpoint: string;
}

export interface TourReply {
  title: string;
  explanation: string;
  stops: RequestedStop[];
  /** Lines that named a site that is not in the catalogue. */
  unknown: string[];
}

const START = '=== TOUR ===';
const END = '=== EINDE ===';

export function buildTourPrompt(req: TourRequest): string {
  const sites = CATALOG.map((s) => [
    s.id, s.name, tagLabel(s.district), [...s.eras, ...s.themes].map(tagLabel).join(', '),
    `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`, s.note,
  ].join(' | '));
  return [
    'Je helpt een gids in Tbilisi die Nederlandstalige wandeltours geeft. Stel een tour samen voor deze klant.',
    '',
    `Wens van de klant: ${req.wish.trim() || '(geen bijzondere wens)'}`,
    `Totale duur: ongeveer ${req.minutes} minuten, lopen en vertellen samen.`,
    '',
    'Regels:',
    '- Kies alleen plekken uit de lijst hieronder en gebruik precies de id uit de eerste kolom. Verzin geen plekken.',
    '- Maak een logische wandelroute: geen heen-en-weer, en houd rekening met hoogteverschil. Reken met ongeveer 4 km per uur lopen en 5 tot 10 minuten vertellen per stop.',
    '- Sommige plekken zijn lastig te bereiken, zoals Kartlis Deda (Moeder van Georgië) of de vesting Narikala. Stel dan een standpunt voor: een plek waar je de groep het kunt laten zien en uitleggen. Beschrijf dat in woorden; de gids kiest de precieze plek zelf op de kaart.',
    '- Je hoeft geen verhaal of feiten te schrijven: die heeft de gids al per plek. Geef alleen de keuze, de volgorde en kort waarom.',
    '- Schrijf in eenvoudig Nederlands.',
    '',
    'Antwoord precies in deze vorm, zodat de gids het kan terugplakken:',
    START,
    'TITEL: <korte naam voor de tour>',
    'UITLEG: <een of twee zinnen voor de gids: waarom deze route bij deze klant past>',
    'STOP: <id> | <minuten vertellen> | <waarom deze stop, kort> | <standpunt, of leeg als je bij de plek zelf staat>',
    'STOP: ...',
    END,
    '',
    'Plekken (id | naam | wijk | tijdperk en soort | positie | korte omschrijving):',
    ...sites,
  ].join('\n');
}

export class TourReplyError extends Error {}

/** Reads the block between the markers. Unknown sites are reported, not guessed. */
export function parseTourReply(text: string): TourReply {
  const start = text.indexOf(START);
  const end = text.indexOf(END, start + 1);
  const body = start >= 0 ? text.slice(start + START.length, end > start ? end : undefined) : text;
  const ids = new Set(CATALOG.map((s) => s.id));
  const byName = new Map(CATALOG.map((s) => [s.name.toLowerCase(), s.id]));
  let title = '';
  let explanation = '';
  const stops: RequestedStop[] = [];
  const unknown: string[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim().replace(/^[-*]\s*/, '');
    const field = line.match(/^(TITEL|UITLEG|STOP)\s*:\s*(.*)$/i);
    if (!field) continue;
    const [, key, value] = field;
    if (key.toUpperCase() === 'TITEL') title = value.trim();
    else if (key.toUpperCase() === 'UITLEG') explanation = value.trim();
    else {
      const [idPart = '', minPart = '', why = '', standpoint = ''] = value.split('|').map((x) => x.trim());
      const id = ids.has(idPart) ? idPart : byName.get(idPart.toLowerCase());
      if (!id) { unknown.push(line); continue; }
      if (stops.some((s) => s.siteId === id)) continue;
      const minutes = Number(minPart.replace(/[^\d]/g, ''));
      stops.push({ siteId: id, minutes: minutes > 0 && minutes <= 60 ? minutes : null, why, standpoint });
    }
  }
  if (!stops.length) {
    throw new TourReplyError(start < 0
      ? `Dit antwoord heeft geen blok tussen "${START}" en "${END}". Plak het hele antwoord van Claude.`
      : 'In het antwoord staan geen stops die ik ken.');
  }
  return { title, explanation, stops, unknown };
}

/**
 * Turns the answer into a tour. Talking points, transitions and guest questions come from the app's own story
 * passages (as in Studie); the answer only adds the order, the title, why each stop is there and a standpoint idea.
 */
export function tourFromReply(reply: TourReply, req: TourRequest, landmarks: Landmark[]): { tour: Tour; newLandmarks: Landmark[] } {
  const story = buildStoryline(reply.stops.map((s) => s.siteId), 'eigen', landmarks);
  const { tour, newLandmarks } = tourFromStoryline(story, landmarks);
  const byLandmark = new Map(reply.stops.map((s) => [catalogLandmarkId(s.siteId), s]));
  tour.title = reply.title || tour.title;
  tour.description = [reply.explanation, req.wish.trim() && `Wens van de klant: ${req.wish.trim()}`, tour.description].filter(Boolean).join('\n\n');
  tour.stops = tour.stops.map((stop) => {
    const r = byLandmark.get(stop.landmarkId);
    if (!r) return stop;
    const extra = [r.why && `Waarom in deze tour: ${r.why}`, r.standpoint && `Standpunt (kies de plek op de kaart): ${r.standpoint}`].filter(Boolean).join('\n');
    return { ...stop, speakingMinutes: Math.max(stop.speakingMinutes, r.minutes ?? 0), guideNotes: [extra, stop.guideNotes].filter(Boolean).join('\n\n') };
  });
  return { tour, newLandmarks };
}

/**
 * The recommended first tour, about two hours: the classic loop through the old town, with the cable car up to
 * Narikala instead of the steep climb, and Kartlis Deda told from the fortress instead of walking there.
 * The reasons below are about the route, not facts; the facts come from the story passages.
 */
export const CLASSIC_TOUR: TourReply = {
  title: 'Klassiek Tbilisi in 2 uur',
  explanation: 'Een eerste kennismaking: van het Vrijheidsplein door de oude stad, met de kabelbaan omhoog naar Narikala en te voet terug naar de zwavelbaden en Meidan. De kabelbaan scheelt de steile klim. Reken op ongeveer 2 uur.',
  unknown: [],
  stops: [
    { siteId: 'vrijheidsplein', minutes: 6, why: 'Makkelijk te vinden verzamelpunt; hier begint het verhaal van de stad.', standpoint: '' },
    { siteId: 'anchiskhati', minutes: 8, why: 'De oudste kerk van de stad, op de route naar de oude stad.', standpoint: '' },
    { siteId: 'gabriadze', minutes: 4, why: 'Een vrolijke stop die gasten graag fotograferen.', standpoint: '' },
    { siteId: 'vredesbrug', minutes: 5, why: 'Uitzicht over de rivier naar Narikala, waar je straks heen gaat.', standpoint: '' },
    { siteId: 'kabelbaan-narikala', minutes: 3, why: 'Met de kabelbaan omhoog in plaats van de steile klim.', standpoint: '' },
    { siteId: 'narikala', minutes: 10, why: 'Het uitzicht over de hele stad, en het oudste verhaal van Tbilisi.', standpoint: '' },
    { siteId: 'moeder-georgie', minutes: 5, why: 'Vertel haar verhaal vanaf de vesting, waar je haar ziet staan; erheen lopen kost te veel tijd.', standpoint: 'Op de muren van Narikala, met zicht op het beeld.' },
    { siteId: 'abanotubani', minutes: 10, why: 'Te voet naar beneden naar de zwavelbaden, waar de stad begon.', standpoint: '' },
    { siteId: 'meidan', minutes: 6, why: 'Het oude marktplein, vlak bij de baden.', standpoint: '' },
    { siteId: 'sioni', minutes: 8, why: 'Afsluiten bij de kathedraal, vlak bij de restaurants van de Shardeni-straat.', standpoint: '' },
  ],
};
