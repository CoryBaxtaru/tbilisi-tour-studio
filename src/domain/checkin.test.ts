import { describe, expect, it } from 'vitest';
import { createBooking, createDeparture, createProduct } from './agenda';
import { arrivedCount, checkInSummary, departureForGuide, guestList, partySize, withArrived, withNoShow } from './checkin';
import { addDays, buildMessage, mailLink, pendingMessages, whatsappLink, withMessageSent } from './messages';
import { parseMetForecast } from './weather';

const product = { ...createProduct('Oude stad'), tourId: 'tour-1', durationMin: 180, meetingPoint: 'Bij de klokkentoren', included: 'Een glas wijn' };
const dep = createDeparture(product, '2027-05-10', '10:00');
const book = (p: Partial<ReturnType<typeof createBooking>> = {}) => ({ ...createBooking(dep.id), adults: 2, children: 1, leadName: 'Anna de Vries', contact: '+31 6 12345678', ...p });

describe('check-in', () => {
  it('counts who came and never more than the party', () => {
    const b = book();
    expect(partySize(b)).toBe(3);
    expect(arrivedCount(b)).toBe(0);
    expect(arrivedCount(withArrived(b, 2))).toBe(2);
    expect(arrivedCount(withArrived(b, 9))).toBe(3);
    expect(arrivedCount(withArrived(b, -1))).toBe(0);
  });
  it('marks a no-show, and arriving after all undoes it', () => {
    const gone = withNoShow(withArrived(book(), 2));
    expect(gone).toMatchObject({ status: 'no-show', arrived: 0 });
    expect(withArrived(gone, 1)).toMatchObject({ status: 'geboekt', arrived: 1 });
  });
  it('lists active bookings and sums the headcount', () => {
    const a = withArrived(book({ createdAt: '2027-01-01' }), 2);
    const noShow = withNoShow(book({ adults: 1, children: 0, createdAt: '2027-01-02' }));
    const waiting = book({ adults: 2, children: 0, createdAt: '2027-01-03' });
    const list = guestList(dep.id, [waiting, noShow, a, book({ status: 'geannuleerd' }), { ...book(), deleted: true }, { ...book(), departureId: 'x' }]);
    expect(list.map((b) => b.id)).toEqual([a.id, noShow.id, waiting.id]);
    expect(checkInSummary(list)).toEqual({ expected: 6, arrived: 2, noShow: 1, waiting: 3 });
  });
  it('finds the departure being guided', () => {
    const later = { ...createDeparture(product, '2027-05-10', '15:00') };
    const other = createDeparture({ ...createProduct(), tourId: 'tour-2' }, '2027-05-10');
    const deps = [later, dep, other];
    expect(departureForGuide('tour-1', [product], deps, '2027-05-10')?.id).toBe(dep.id);
    expect(departureForGuide('tour-1', [product], deps, '2027-05-10', later.id)?.id).toBe(later.id);
    expect(departureForGuide('tour-1', [product], deps, '2027-05-11')).toBeUndefined();
    expect(departureForGuide('tour-1', [product], [{ ...dep, status: 'geannuleerd' }], '2027-05-10')).toBeUndefined();
  });
});

describe('messages', () => {
  const input = { departure: dep, product, signature: 'Nilas', today: '2027-05-09' };

  it('confirms with the details the guide entered', () => {
    const m = buildMessage('bevestiging', { ...input, booking: book({ priceTotal: 40 }) });
    expect(m.text).toContain('Hallo Anna,');
    expect(m.text).toContain('10:00');
    expect(m.text).toContain('Met: 2 volwassenen, 1 kind');
    expect(m.text).toContain('Verzamelpunt: Bij de klokkentoren');
    expect(m.text).toContain('Inbegrepen: Een glas wijn');
    expect(m.text).toMatch(/Nog te betalen: €\s40,00/);
    expect(m.text.trim().endsWith('Nilas')).toBe(true);
    expect(m.missing).toEqual([]);
  });
  it('leaves the payment line out for GetYourGuide and thanks a guest who paid', () => {
    expect(buildMessage('bevestiging', { ...input, booking: book({ channel: 'getyourguide', priceTotal: 40 }) }).text).not.toMatch(/betal/i);
    expect(buildMessage('bevestiging', { ...input, booking: book({ priceTotal: 40, paid: true }) }).text).toContain('al betaald');
  });
  it('asks for a missing meeting point instead of guessing', () => {
    const m = buildMessage('bevestiging', { ...input, product: { ...product, meetingPoint: '' }, booking: book() });
    expect(m.text).toContain('[verzamelpunt invullen]');
    expect(m.missing).toContain('verzamelpunt');
  });
  it('reminds with map link, what to bring and the real forecast only', () => {
    const p = { ...product, meetingMapUrl: 'https://example.org/kaart', bring: 'goede schoenen' };
    const noForecast = buildMessage('herinnering', { ...input, product: p, booking: book() });
    expect(noForecast.text).toContain('Morgen is het zover');
    expect(noForecast.text).toContain('Op de kaart: https://example.org/kaart');
    expect(noForecast.text).toContain('Neem mee: goede schoenen');
    expect(noForecast.text).not.toContain('weerbericht');

    const step = (time: string) => ({ time, data: { instant: { details: { air_temperature: 14, wind_speed: 2 } }, next_1_hours: { summary: { symbol_code: 'rain' }, details: { precipitation_amount: 2 } } } });
    const times = Array.from({ length: 8 }, (_, i) => `2027-05-10T0${i + 2}:00:00Z`);
    const forecast = parseMetForecast({ properties: { timeseries: times.map(step) } }, '2027-05-09T08:00:00Z', '2027-05-09T09:00:00Z');
    const withForecast = buildMessage('herinnering', { ...input, forecast, booking: book() });
    expect(withForecast.text).toContain('Het weerbericht: regen, 14 graden.');
    expect(withForecast.text).toContain('regenjas');
  });
  it('rejects a link that is not a web link', () => {
    const m = buildMessage('review', { ...input, product: { ...product, reviewUrl: 'javascript:alert(1)' }, booking: book() });
    expect(m.text).not.toContain('javascript');
    expect(m.missing).toContain('reviewlink');
    expect(buildMessage('review', { ...input, product: { ...product, reviewUrl: 'https://example.org/r' }, booking: book() }).text).toContain('https://example.org/r');
  });
  it('greets without a name after erasure', () => {
    expect(buildMessage('review', { ...input, booking: book({ leadName: '', anonymizedAt: '2027-11-10' }) }).text.startsWith('Hallo,')).toBe(true);
  });
  it('makes a WhatsApp link only for international numbers', () => {
    expect(whatsappLink('+31 6 12345678', 'Hoi daar')).toBe('https://wa.me/31612345678?text=Hoi%20daar');
    expect(whatsappLink('0031612345678', 'x')).toBe('https://wa.me/31612345678?text=x');
    expect(whatsappLink('0612345678', 'x')).toBeNull();
    expect(whatsappLink('anna@example.org', 'x')).toBeNull();
  });
  it('makes a mail link only for an address', () => {
    expect(mailLink('anna@example.org', 'Onderwerp', 'Tekst')).toBe('mailto:anna@example.org?subject=Onderwerp&body=Tekst');
    expect(mailLink('+31612345678', 'a', 'b')).toBeNull();
  });
});

describe('pendingMessages', () => {
  const today = '2027-05-09';
  const tomorrow = createDeparture(product, addDays(today, 1));
  const lastWeek = createDeparture(product, addDays(today, -3));
  const longAgo = createDeparture(product, addDays(today, -30));
  const list = (bookings: ReturnType<typeof book>[]) => pendingMessages([product], [tomorrow, lastWeek, longAgo], bookings, today);

  it('asks for a confirmation and a reminder for tomorrow', () => {
    const kinds = list([book({ departureId: tomorrow.id })]).map((m) => m.kind);
    expect(kinds).toEqual(['bevestiging', 'herinnering']);
  });
  it('does not ask for a confirmation on the day itself', () => {
    const today2 = createDeparture(product, today);
    expect(pendingMessages([product], [today2], [book({ departureId: today2.id })], today)).toEqual([]);
  });
  it('stops asking once sent', () => {
    const b = withMessageSent(withMessageSent(book({ departureId: tomorrow.id }), 'bevestiging', 'nu'), 'herinnering', 'nu');
    expect(list([b])).toEqual([]);
  });
  it('asks for a review after a tour, not after a no-show or long ago', () => {
    expect(list([book({ departureId: lastWeek.id })]).map((m) => m.kind)).toEqual(['review']);
    expect(list([withNoShow(book({ departureId: lastWeek.id }))])).toEqual([]);
    expect(list([book({ departureId: longAgo.id })])).toEqual([]);
  });
  it('skips bookings without a contact, and confirmations for GetYourGuide', () => {
    expect(list([book({ departureId: tomorrow.id, contact: '' })])).toEqual([]);
    expect(list([book({ departureId: tomorrow.id, channel: 'getyourguide' })]).map((m) => m.kind)).toEqual(['herinnering']);
  });
});
