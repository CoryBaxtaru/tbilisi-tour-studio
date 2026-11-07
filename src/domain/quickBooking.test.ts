import { describe, expect, it } from 'vitest';
import { createBooking, createDeparture, createProduct, departureFill } from './agenda';
import { createStop, createTour } from './factory';
import { addDays, instagramHandle, instagramLink, pendingMessages } from './messages';
import { departureFor, meetingPointElsewhere, productFromTour, tourMinutes } from './quickBooking';

const product = createProduct('Oude stad');

describe('quick booking', () => {
  it('joins an existing departure at the same product, day and time, never a cancelled one', () => {
    const d = createDeparture(product, '2027-05-10', '10:00');
    expect(departureFor([d], product.id, '2027-05-10', '10:00')).toBe(d);
    expect(departureFor([d], product.id, '2027-05-10', '11:00')).toBeUndefined();
    expect(departureFor([{ ...d, status: 'geannuleerd' }], product.id, '2027-05-10', '10:00')).toBeUndefined();
    expect(departureFor([{ ...d, deleted: true }], product.id, '2027-05-10', '10:00')).toBeUndefined();
  });

  it('treats a private departure as full with any group size', () => {
    const d = { ...createDeparture(product, '2027-05-10'), private: true };
    const f = departureFill(d, [{ ...createBooking(d.id), adults: 6 }], 2);
    expect(f).toMatchObject({ booked: 6, capacity: 6, free: 0, full: true });
  });
});

describe('product from tour', () => {
  const tour = createTour('Geloven naast elkaar');
  const [a, b] = [createStop('l1'), createStop('l2')];
  tour.stops = [{ ...a, speakingMinutes: 20 }, { ...b, speakingMinutes: 20 }];
  tour.legs = [{ fromStopId: a.id, toStopId: b.id, distanceM: 800, durationS: 660, geometry: [], steps: [], provider: 'x', computedAt: '' }];

  it('rounds the tour length up to a quarter of an hour, and knows nothing while a leg is missing', () => {
    expect(tourMinutes(tour)).toBe(60);
    expect(tourMinutes({ ...tour, legs: [] })).toBeNull();
    expect(tourMinutes(undefined)).toBeNull();
  });

  it('takes the name only while it is still the default', () => {
    expect(productFromTour(createProduct(), tour, 'Nieuw touraanbod')).toEqual({ tourId: tour.id, name: 'Geloven naast elkaar', durationMin: 60 });
    expect(productFromTour(product, tour, 'Nieuw touraanbod')).toEqual({ tourId: tour.id, durationMin: 60 });
    expect(productFromTour(product, undefined, 'Nieuw touraanbod')).toEqual({ tourId: null });
  });

  it('notices a meeting point away from the first stop', () => {
    expect(meetingPointElsewhere('Bij de klokkentoren van het Gabriadze-theater', 'Abanotubani (zwavelbaden)')).toBe(true);
    expect(meetingPointElsewhere('Voor de ingang van de zwavelbaden', 'Abanotubani (zwavelbaden)')).toBe(false);
    expect(meetingPointElsewhere('Bij de klokkentoren', 'Klokkentoren van het Gabriadze-theater')).toBe(false);
    expect(meetingPointElsewhere('', 'Abanotubani')).toBe(false);
  });
});

describe('instagram', () => {
  it('reads @name and profile links, nothing else', () => {
    expect(instagramHandle('@test_sophie')).toBe('test_sophie');
    expect(instagramHandle('https://www.instagram.com/test.sophie/')).toBe('test.sophie');
    expect(instagramHandle('+31 6 12345678')).toBeNull();
    expect(instagramLink('@test_sophie')).toBe('https://ig.me/m/test_sophie');
  });

  it('asks for a confirmation of an Instagram booking, and a review on the day a tour was closed', () => {
    const today = '2027-05-10';
    const later = createDeparture(product, addDays(today, 3));
    const done = { ...createDeparture(product, today), status: 'afgerond' as const };
    const open = createDeparture(product, today);
    const book = (d: { id: string }) => ({ ...createBooking(d.id), channel: 'instagram' as const, contact: '@test' });
    const kinds = pendingMessages([product], [later, done, open], [book(later), book(done), book(open)], today).map((m) => [m.departure.id, m.kind]);
    expect(kinds).toEqual([[done.id, 'review'], [later.id, 'bevestiging']]);
  });
});
