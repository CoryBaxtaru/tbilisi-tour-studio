import { describe, expect, it } from 'vitest';
import { createBooking, createDeparture, createProduct } from './agenda';
import { blockedOn, clashes, createBlockedDay, planningProblems } from './planning';
import { createPracticalNote, isStale, practicalProblems, withoutPractical, withPractical } from './practical';
import { buildProductSheet } from './productSheet';
import { defaultPricing } from './pricing';
import { statistics } from './statistics';
import type { Landmark } from './types';

const product = { ...createProduct('Oude stad'), durationMin: 180 };
const dep = (date: string, time: string) => createDeparture(product, date, time);

describe('planning', () => {
  it('finds overlapping departures, not touching ones', () => {
    const a = dep('2027-05-10', '10:00');
    expect(clashes(a, [a, dep('2027-05-10', '12:59')], [product])).toHaveLength(1);
    expect(clashes(a, [a, dep('2027-05-10', '13:00')], [product])).toEqual([]);
    expect(clashes(a, [a, dep('2027-05-10', '08:00')], [product])).toHaveLength(1);
    expect(clashes(a, [a, dep('2027-05-11', '10:00')], [product])).toEqual([]);
    expect(clashes(a, [a, { ...dep('2027-05-10', '10:00'), status: 'geannuleerd' }], [product])).toEqual([]);
    expect(clashes(a, [a, { ...dep('2027-05-10', '10:00'), deleted: true }], [product])).toEqual([]);
  });
  it('knows blocked days, not deleted ones', () => {
    const b = createBlockedDay('2027-05-10', 'Vakantie');
    expect(blockedOn('2027-05-10', [b])?.reason).toBe('Vakantie');
    expect(blockedOn('2027-05-11', [b])).toBeUndefined();
    expect(blockedOn('2027-05-10', [{ ...b, deleted: true }])).toBeUndefined();
  });
  it('lists problems in the coming three months', () => {
    const a = dep('2027-05-10', '10:00');
    const b = dep('2027-05-10', '11:00');
    const blocked = dep('2027-05-12', '10:00');
    const farAway = dep('2027-12-12', '10:00');
    const past = dep('2027-01-01', '10:00');
    const list = planningProblems([a, b, blocked, farAway, past], [product], [createBlockedDay('2027-05-12', 'Vakantie'), createBlockedDay('2027-12-12')], '2027-05-01');
    expect(list.map((p) => [p.departure.id, p.kind])).toEqual([[a.id, 'dubbel'], [b.id, 'dubbel'], [blocked.id, 'geblokkeerd']]);
    expect(list[2].detail).toBe('Vakantie');
  });
});

describe('product sheet', () => {
  it('reports what is missing instead of inventing it', () => {
    const s = buildProductSheet({ ...product, meetingPoint: '' });
    expect(s.missing).toEqual(['hoogtepunten', 'omschrijving', 'verzamelpunt', 'annuleringsvoorwaarden']);
    expect(s.text).toContain('[annuleringsvoorwaarden invullen]');
  });
  it('uses what the guide wrote, and the tour stops as a fallback', () => {
    const full = { ...product, description: 'Een mooie wandeling.', highlights: '- De baden\n• Narikala\n\n', meetingPoint: 'Bij de toren', cancellationTerms: 'Gratis tot 24 uur vooraf.', bring: 'schoenen', pricing: { ...defaultPricing(), adult: 10, child: 4 } };
    const s = buildProductSheet(full, ['Sioni']);
    expect(s.missing).toEqual([]);
    expect(s.text).toContain('- De baden\n- Narikala');
    expect(s.text).not.toContain('Sioni');
    expect(s.text).toContain('Duur: ongeveer 3 uur');
    expect(s.text).toContain('Taal: Nederlands');
    expect(s.text).toMatch(/Prijs: €\s10,00 per volwassene, €\s4,00 per kind/);
    expect(s.text).toContain('Gratis tot 24 uur vooraf.');
    expect(buildProductSheet({ ...full, highlights: '' }, ['Sioni']).text).toContain('- Sioni');
  });
  it('leaves the price out without a profile', () => {
    expect(buildProductSheet(product).text).not.toContain('Prijs');
  });
});

describe('practical notes', () => {
  const today = '2027-05-10';
  it('cannot be saved without text, source and a real date', () => {
    expect(practicalProblems(createPracticalNote(today), today)).toEqual(['tekst', 'bron']);
    const ok = { ...createPracticalNote(today), text: 'Hoofd bedekken', source: 'Zelf gezien' };
    expect(practicalProblems(ok, today)).toEqual([]);
    expect(practicalProblems({ ...ok, checkedOn: '2027-06-01' }, today)).toEqual(['een datum die niet in de toekomst ligt']);
    expect(practicalProblems({ ...ok, checkedOn: '' }, today)).toEqual(['datum']);
  });
  it('flags a note older than a year', () => {
    const n = createPracticalNote('2026-05-09');
    expect(isStale(n, today)).toBe(true);
    expect(isStale({ ...n, checkedOn: '2026-06-01' }, today)).toBe(false);
  });
  it('adds, replaces and removes', () => {
    const n = { ...createPracticalNote(today), text: 'a' };
    const lm = withPractical({} as Landmark, n);
    expect(lm.practical).toHaveLength(1);
    expect(withPractical(lm, { ...n, text: 'b' }).practical?.[0].text).toBe('b');
    expect(withoutPractical(lm, n.id).practical).toEqual([]);
  });
});

describe('statistics', () => {
  const today = '2027-06-30';
  const may = { ...dep('2027-05-10', '10:00'), capacity: 10 };
  const june = { ...dep('2027-06-10', '15:00'), capacity: 10 };
  const future = { ...dep('2027-09-10', '10:00'), capacity: 10 };
  const cancelled = { ...dep('2027-05-20', '10:00'), status: 'geannuleerd' as const };
  const book = (d: { id: string }, adults: number, created: string, p = {}) => ({ ...createBooking(d.id), adults, createdAt: `${created}T08:00:00.000Z`, ...p });
  const bookings = [
    book(may, 4, '2027-05-09'),
    book(may, 2, '2027-04-10', { status: 'no-show' }),
    book(june, 5, '2027-06-05'),
    book(june, 1, '2027-06-10', { channel: 'walk-in' }),
    book(future, 3, '2027-06-20'),
    book(may, 9, '2027-05-01', { status: 'geannuleerd' }),
  ];
  const s = statistics(2027, [product], [may, june, future, cancelled], bookings, today);

  it('counts occupancy only for tours that have happened', () => {
    expect(s.byProduct[0]).toMatchObject({ label: 'Oude stad', departures: 2, guests: 12, capacity: 20, occupancy: 0.6 });
    expect(s.byStartTime.map((r) => [r.key, r.guests])).toEqual([['10:00', 6], ['15:00', 6]]);
    expect(s.byMonth.map((r) => r.label)).toEqual(['mei', 'juni']);
  });
  it('measures how early guests book, without walk-ins', () => {
    expect(s.leadTime.counted).toBe(4);
    expect(s.leadTime.buckets.map((b) => b.bookings)).toEqual([1, 1, 1, 1]);
    expect(s.leadTime.median).toBe(18);
  });
  it('counts no-shows', () => {
    expect(s.noShows).toEqual({ guests: 2, expected: 12 });
  });
  it('sums feedback', () => {
    const withFeedback = { ...may, feedback: [{ id: '1', at: 'x', kind: 'gast' as const, stars: 5, text: 'Mooi' }, { id: '2', at: 'x', kind: 'gast' as const, stars: 4, text: 'Goed' }, { id: '3', at: 'x', kind: 'verbeterpunt' as const, text: 'Korter bij Sioni' }] };
    const f = statistics(2027, [product], [withFeedback], [], today).feedback;
    expect(f).toMatchObject({ count: 3, averageStars: 4.5 });
    expect(f.improvements.map((i) => i.text)).toEqual(['Korter bij Sioni']);
  });
  it('is empty without data', () => {
    const e = statistics(2030, [product], [], [], today);
    expect(e.leadTime.median).toBeNull();
    expect(e.feedback.averageStars).toBeNull();
  });
});
