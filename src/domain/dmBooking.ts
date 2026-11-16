// Reads a guest's message (an Instagram DM, WhatsApp, e-mail) and pulls out what a booking needs: day, time,
// party, name, contact and wishes. Dutch and English. Nothing is sent anywhere; it is plain pattern matching,
// so the guide always checks the form before saving.

export interface DmFacts {
  /** YYYY-MM-DD */
  date?: string;
  /** HH:MM */
  time?: string;
  adults?: number;
  children?: number;
  leadName?: string;
  /** @instagram, phone number or e-mail address. */
  contact?: string;
  privateGroup?: boolean;
  productId?: string;
  /** Sentences about wishes (diet, mobility, interests), for the notes. */
  notes?: string;
}

/** The questions to send a guest; an answer in this shape is read completely. */
export const DM_QUESTIONS = [
  'Leuk dat je mee wilt! Om je boeking vast te leggen heb ik nog nodig:',
  'Datum:',
  'Starttijd:',
  'Aantal volwassenen:',
  'Aantal kinderen:',
  'Naam:',
  'Wensen (bijv. dieet of slecht ter been):',
].join('\n');

const WORDS: Record<string, number> = {
  een: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10, elf: 11, twaalf: 12,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
/** "met z'n zessen"; accents are already removed from the text. */
const GROUP_WORDS: Record<string, number> = {
  tweeen: 2, drieen: 3, vieren: 4, vijven: 5, zessen: 6, zevenen: 7, achten: 8, negenen: 9, tienen: 10,
};
const N = `(\\d{1,2}|${Object.keys(WORDS).join('|')})`;
const num = (s: string): number => WORDS[s] ?? Number(s);

const MONTHS: [RegExp, number][] = [
  [/^jan/, 1], [/^feb/, 2], [/^(mrt|maa|mar)/, 3], [/^apr/, 4], [/^(mei|may)/, 5], [/^jun/, 6],
  [/^jul/, 7], [/^aug/, 8], [/^sep/, 9], [/^o[kc]t/, 10], [/^nov/, 11], [/^dec/, 12],
];
const MONTH = '(jan(?:uari|uary)?|feb(?:ruari|ruary)?|mrt|maart|mar(?:ch)?|apr(?:il)?|mei|may|juni?|june?|juli?|july?|aug(?:ustus|ust)?|sep(?:t(?:ember)?)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const monthOf = (s: string): number => MONTHS.find(([re]) => re.test(s))![1];

const WEEKDAYS = ['zondag|sunday', 'maandag|monday', 'dinsdag|tuesday', 'woensdag|wednesday', 'donderdag|thursday', 'vrijdag|friday', 'zaterdag|saturday'];
/** Words after a number that make it a count or a length, not a day or an hour. */
const COUNTED = 'personen|persoon|pers|mensen|people|persons|gasten|guests|volwassenen|adults|kinderen|children|kids|man';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** A real calendar day, or null (e.g. 31 February). Without a year: the next time that day comes. */
function dayMonth(day: number, month: number, year: number | null, today: Date): string | null {
  const make = (y: number) => {
    const d = new Date(y, month - 1, day);
    return d.getMonth() === month - 1 && d.getDate() === day ? d : null;
  };
  if (year !== null) {
    const d = make(year < 100 ? 2000 + year : year);
    return d ? iso(d) : null;
  }
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d = make(today.getFullYear());
  if (d && d >= start) return iso(d);
  const next = make(today.getFullYear() + 1);
  return next ? iso(next) : null;
}

function findDate(t: string, today: Date): string | undefined {
  let m = t.match(new RegExp(`\\b(\\d{1,2})(?:e|de|ste|st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}\\b\\.?(?:\\s+(\\d{4}))?`));
  if (m) { const d = dayMonth(+m[1], monthOf(m[2]), m[3] ? +m[3] : null, today); if (d) return d; }
  m = t.match(new RegExp(`\\b${MONTH}\\b\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`));
  if (m) { const d = dayMonth(+m[2], monthOf(m[1]), m[3] ? +m[3] : null, today); if (d) return d; }
  // Day first, as in Dutch: 21-11, 21/11/2026, 21.11.2026. Not a range such as "4-6 personen" or "10-12 uur".
  m = t.match(new RegExp(`\\b(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{4}|\\d{2}))?\\b(?!\\s*(?:${COUNTED}|uur|u|hours?|km|euro|eur|gel|lari)\\b)`))
    ?? t.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
  if (m && +m[2] >= 1 && +m[2] <= 12) { const d = dayMonth(+m[1], +m[2], m[3] ? +m[3] : null, today); if (d) return d; }

  if (/\b(overmorgen|day after tomorrow)\b/.test(t)) return iso(addDays(today, 2));
  if (/\b(morgen(ochtend|middag|avond)?|tomorrow)\b/.test(t)) return iso(addDays(today, 1));
  if (/\b(vandaag|vanochtend|vanmiddag|vanavond|today|tonight|this (morning|afternoon|evening))\b/.test(t)) return iso(today);

  for (let wd = 0; wd < 7; wd++) {
    const hit = t.match(new RegExp(`\\b(volgende week |next week )?(?:${WEEKDAYS[wd]})\\b`));
    if (!hit) continue;
    if (hit[1]) {
      // The day in next week, weeks starting on Monday.
      const monday = addDays(today, 7 - ((today.getDay() + 6) % 7));
      return iso(addDays(monday, (wd + 6) % 7));
    }
    return iso(addDays(today, ((wd - today.getDay() + 7) % 7) || 7));
  }
  return undefined;
}

const AT = '(?:om|at|rond|around|vanaf|tegen|tijd:|starttijd:|time:)';

function findTime(t: string): string | undefined {
  const evening = /('s avonds|\bvanavond|\bavond|\bevening|\btonight)\b/.test(t);
  const morning = /('s morgens|'s ochtends|\bochtend|\bmorning|\bvanochtend)\b/.test(t);
  /** A bare hour from 1 to 7 means the afternoon: nobody walks at three at night. */
  const clock = (h: number, min: number, ampm?: string): string | undefined => {
    if (ampm === 'pm' && h < 12) h += 12;
    else if (ampm === 'am' && h === 12) h = 0;
    else if (!ampm && h < 12 && (evening || (h >= 1 && h <= 7 && !morning))) h += 12;
    return h <= 23 && min <= 59 ? `${pad(h)}:${pad(min)}` : undefined;
  };
  let m = t.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?/);
  if (m) return clock(+m[1], +m[2], m[3]);
  m = t.match(/\b(\d{1,2})\s?[uh]\s?(\d{2})\b/);
  if (m) return clock(+m[1], +m[2]);
  m = t.match(/\b(\d{1,2})\.(\d{2})\s*(uur|u\b|am|pm)/) ?? t.match(new RegExp(`\\b${AT}\\s*(\\d{1,2})\\.(\\d{2})\\b(?!\\.\\d)`));
  if (m) return clock(+m[1], +m[2], m[3] === 'am' || m[3] === 'pm' ? m[3] : undefined);
  m = t.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (m) return clock(+m[1], 0, m[2]);
  m = t.match(new RegExp(`\\bhalf ${N}\\b`));
  if (m) return clock(num(m[1]) - 1 || 12, 30);
  m = t.match(new RegExp(`\\bkwart (over|voor) ${N}\\b`));
  if (m) return m[1] === 'over' ? clock(num(m[2]), 15) : clock(num(m[2]) - 1 || 12, 45);
  // "om 10", "at 10 o'clock", "Starttijd: 10", but not "rond 20 november", "om 6 personen" or "om een tour".
  m = t.match(new RegExp(`\\b${AT}\\s*(\\d{1,2})(?:\\s*(?:uur|u|h|o'?clock))?\\b(?!\\s*(?:${MONTH}|${COUNTED})\\b)(?![/.:-]\\d)`))
    ?? t.match(new RegExp(`\\b${AT}\\s+${N}\\s*(?:uur|o'?clock)\\b`));
  if (m) return clock(num(m[1]), 0);
  // A bare "10 uur" is a time; "2 uur" is how long a tour takes.
  m = t.match(new RegExp(`\\b${N}\\s*(?:uur|o'?clock)\\b`));
  if (m && (num(m[1]) >= 8 || /o'?clock/.test(m[0]))) return clock(num(m[1]), 0);
  return undefined;
}

function findParty(t: string): { adults?: number; children?: number } {
  const first = (re: string) => { const m = t.match(new RegExp(re)); return m ? num(m[1]) : undefined; };
  const children = first(`\\b${N}\\s*(?:kind(?:eren|je|jes)?|kids?|child(?:ren)?|tieners?|teenagers?)\\b`)
    ?? first(`\\b(?:aantal )?(?:kinderen|children|kids)\\s*:[ \\t]*${N}\\b`)
    ?? (/\b(?:en|and|with|met) (?:een|a|ons|our|mijn|my) (?:kind|child|zoon|dochter|son|daughter)\b/.test(t) ? 1 : undefined);
  const adults = first(`\\b${N}\\s*(?:volwassenen?|adults?)\\b`) ?? first(`\\b(?:aantal )?(?:volwassenen|adults)\\s*:[ \\t]*${N}\\b`);
  if (adults !== undefined) return { adults, children };

  const group = t.match(/\bmet (?:z'n|zijn|ons) ([a-z]+|\d{1,2}(?:en)?)\b/);
  const groupSize = group ? GROUP_WORDS[group[1]] ?? (/^\d/.test(group[1]) ? parseInt(group[1], 10) : undefined) : undefined;
  const total = first(`\\been man of ${N}\\b`)
    ?? first(`\\b${N}\\s*(?:personen|persoon|pers\\b|mensen|man\\b|people|persons?|gasten|guests?|pax|of us)`)
    ?? first(`\\b(?:we|wij) zijn met (?:z'n |zijn |ons )?${N}\\b`)
    ?? first(`\\b(?:we are|we're|we will be|there are|there will be) ${N}\\b`)
    ?? first(`\\b(?:groep|group|party|gezelschap|gezin|family) (?:van|of) ${N}\\b`)
    ?? first(`\\b(?:aantal|personen|people|number of people|hoeveel)\\s*:[ \\t]*${N}\\b`)
    ?? groupSize
    ?? (/\b(?:ik en|me and|with|samen met|met) (?:mijn|my) (?:vrouw|man|vriend|vriendin|partner|wife|husband|girlfriend|boyfriend)\b|\b(?:the two of us|us two|a couple|als stel)\b/.test(t) ? 2 : undefined);
  if (total === undefined) return children === undefined ? {} : { children };
  // "6 personen, waarvan 2 kinderen" counts the children in; "4 personen en 2 kinderen" adds them.
  const within = children !== undefined && children < total && /\b(waarvan|of which|of whom|including|inclusief|incl|onder wie)\b/.test(t);
  return { adults: within ? total - children! : total, children };
}

const NOT_A_NAME = new Set(['Nederlands', 'Nederlandse', 'Nederlander', 'Dutch', 'Belg', 'Belgisch', 'Benieuwd', 'Op', 'In', 'Van', 'Here', 'Hier', 'Interested', 'Looking', 'Tbilisi', 'Georgië', 'Georgia']);
const NAME = "(\\p{Lu}[\\p{L}'-]+(?:\\s+(?:van der|van den|van de|van|de|den|der|ter|te)(?=\\s+\\p{Lu}))?(?:\\s+\\p{Lu}[\\p{L}'-]+)?)";

function findName(text: string): string | undefined {
  const label = text.match(/^[ \t]*(?:naam|name)[ \t]*:[ \t]*(\S[^\n]{0,58})$/imu);
  if (label) return label[1].trim();
  const intro = text.match(new RegExp(`(?:[Mm]ijn naam is|[Ii]k heet|[Ii]k ben|[Mm]y name is|[Ii] am|[Ii]'m|[Tt]his is)\\s+${NAME}`, 'u'))
    ?? text.match(new RegExp(`\\b[Mm]et\\s+${NAME}\\s+hier\\b`, 'u'));
  if (intro && !NOT_A_NAME.has(intro[1].split(/\s+/)[0])) return intro[1];
  // A sign-off on the last lines: "Groetjes, Anna".
  const tail = text.trim().split('\n').map((l) => l.trim()).filter(Boolean).slice(-2).join('\n');
  const sign = tail.match(new RegExp(`(?:[Gg]roetjes|[Gg]roeten|[Gg]roet|[Mm]vg|[Gg]r\\.?|[Ll]iefs|[Rr]egards|[Cc]heers)[,!.]?\\s*${NAME}\\s*[.!]?$`, 'u'));
  if (sign && !NOT_A_NAME.has(sign[1].split(/\s+/)[0])) return sign[1];
  return undefined;
}

function findContact(text: string): string | undefined {
  const handle = text.match(/(?:^|[\s(])@([A-Za-z0-9._]{2,30})/);
  if (handle) return `@${handle[1].replace(/\.+$/, '')}`;
  const insta = text.match(/instagram\.com\/([A-Za-z0-9._]{2,30})/i);
  if (insta) return `@${insta[1]}`;
  const mail = text.match(/[^\s@<>()]+@[^\s@<>()]+\.[A-Za-z]{2,}/);
  if (mail) return mail[0];
  // International, Dutch (06 12345678, 020 123 45 67) or a Georgian mobile number (555 12 34 56).
  const phone = text.match(/(?:\+|\b00)\d[\d\s().-]{7,16}\d|\b0\d{9}\b|\b06[\s-]?\d{8}\b|\b0\d{1,2}[\s-]\d{3}[\s-]?\d{2}[\s-]?\d{2,3}\b|\b5\d{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}\b/);
  return phone ? phone[0].replace(/\s+/g, ' ').trim() : undefined;
}

const WISH = /allerg|vegetari|vegan|gluten|lactose|halal|kosher|dieet|\bdiet|rolstoel|wheelchair|rollator|kinderwagen|stroller|buggy|ter been|moeilijk lopen|trappen|stairs|mobility|verjaardag|birthday|jubileum|anniversary|huwelijksreis|honeymoon|geschieden|histor|sovjet|soviet|architect|wijn|wine|eten\b|food|foto|photo|kerk|church|interesse|interested|graag zien|willen zien|want to see|would like to see|love to see|focus|ophalen|pick ?up|hotel/i;
const NO_WISH = /^(geen|nee|niets|nvt|n\.v\.t\.?|none|no|nothing|-+)[.!]?$/i;

function findNotes(text: string): string | undefined {
  const wishes: string[] = [];
  for (const line of text.split(/\n+/).map((l) => l.trim()).filter(Boolean)) {
    // A labelled line ("Wensen: …") is taken whole; other lines sentence by sentence.
    const label = line.match(/^(?:wensen|wishes|opmerking(?:en)?|notes?)\b[^:]*:\s*(.*)$/i);
    if (label) { if (label[1] && !NO_WISH.test(label[1])) wishes.push(label[1]); continue; }
    for (const sentence of line.match(/[^.!?]+[.!?]*/g) ?? []) if (WISH.test(sentence)) wishes.push(sentence.trim());
  }
  const notes = [...new Set(wishes)].join(' ').slice(0, 300).trim();
  return notes || undefined;
}

const GENERIC = new Set(['tour', 'tours', 'tbilisi', 'wandeling', 'stadswandeling', 'rondleiding', 'door', 'voor', 'with', 'walk', 'walking']);

function findProduct(t: string, products: { id: string; name: string; durationMin: number }[]): string | undefined {
  if (products.length < 2) return undefined;
  const score = (name: string) => name.toLowerCase().split(/[^\p{L}]+/u).filter((w) => w.length >= 4 && !GENERIC.has(w) && t.includes(w)).length;
  const scored = products.map((p) => ({ id: p.id, n: score(p.name) })).sort((a, b) => b.n - a.n);
  if (scored[0].n > 0 && scored[0].n > scored[1].n) return scored[0].id;
  // "een tour van 2 uur", "a 3 hour tour": the one product of that length.
  const m = t.match(new RegExp(`\\b${N}([.,]5)?\\s*(?:uur|hours?|hrs?)\\b`));
  if (m && num(m[1]) <= 7) {
    const minutes = num(m[1]) * 60 + (m[2] ? 30 : 0);
    const fit = products.filter((p) => Math.abs(p.durationMin - minutes) <= 15);
    if (fit.length === 1) return fit[0].id;
  }
  return undefined;
}

/** Greetings hold day parts ("goedemorgen", "good evening") that are not about the tour. */
const GREETING = /\bgoede?n?\s?(morgen|middag|avond|dag)\b|\bgood (morning|afternoon|evening)\b/g;

export function parseDm(text: string, today: Date, products: { id: string; name: string; durationMin: number }[] = []): DmFacts {
  const plain = text.replace(/[’‘`]/g, "'");
  // Lower case and without accents ("privé", "tweeën"), so word boundaries work.
  const t = plain.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(GREETING, ' ');
  if (!t.trim()) return {};
  const facts: DmFacts = {
    date: findDate(t, today),
    time: findTime(t),
    ...findParty(t),
    leadName: findName(plain),
    contact: findContact(plain),
    privateGroup: /\b(prive|private|alleen wij|alleen ons|just us|only us|exclusief|exclusive)\b/.test(t) || undefined,
    productId: findProduct(t, products),
    notes: findNotes(plain),
  };
  for (const k of Object.keys(facts) as (keyof DmFacts)[]) if (facts[k] === undefined) delete facts[k];
  return facts;
}
