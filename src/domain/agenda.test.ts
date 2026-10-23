import { describe, expect, it } from 'vitest';
import { parseDataset, serializeDataset } from '../storage/backup';
import { mergeRecords } from '../sync/merge';
import {
  addMonths, createBooking, createDeparture, createProduct, departureFill, dueForErasure, monthGrid,
} from './agenda';

const product = { ...createProduct('Oude stad'), maxGuests: 10, minGuests: 2 };
const dep = createDeparture(product, '2026-11-14', '10:00');
const booking = (patch: Partial<ReturnType<typeof createBooking>>) => ({ ...createBooking(dep.id), ...patch });

describe('departureFill', () => {
  it('counts every guest of active bookings against capacity and the minimum', () => {
    const bs = [booking({ adults: 2, children: 1 }), booking({ adults: 3, status: 'geannuleerd' }), { ...booking({ adults: 4 }), deleted: true }];
    expect(departureFill(dep, bs, product.minGuests)).toEqual({ booked: 3, capacity: 10, free: 7, belowMinimum: false, full: false });
    expect(departureFill(dep, [booking({ adults: 1 })], 2).belowMinimum).toBe(true);
    expect(departureFill(dep, [booking({ adults: 10 })], 2).full).toBe(true);
  });
});

describe('monthGrid', () => {
  it('starts on Monday and covers the whole month', () => {
    const weeks = monthGrid(2026, 11); // 1 Nov 2026 is a Sunday
    expect(weeks[0][0]).toBe('2026-10-26');
    expect(weeks[0][6]).toBe('2026-11-01');
    expect(weeks.at(-1)!.includes('2026-11-30')).toBe(true);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });
});

describe('retention', () => {
  it('adds months and clamps to the month end', () => {
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28');
    expect(addMonths('2026-11-14', 6)).toBe('2027-05-14');
  });

  it('erases name, contact and notes six months after the tour, keeping counts and money', () => {
    const b = booking({ leadName: 'Jan', contact: '+31 6 1234', notes: 'allergie', adults: 2, priceTotal: 50 });
    expect(dueForErasure([b], [dep], '2027-05-13')).toEqual([]);
    const [e] = dueForErasure([b], [dep], '2027-05-14');
    expect(e).toMatchObject({ leadName: '', contact: '', notes: '', adults: 2, priceTotal: 50, anonymizedAt: '2027-05-14T00:00:00.000Z' });
    expect(dueForErasure([e], [dep], '2028-01-01')).toEqual([]); // only once
  });

  it('is deterministic, so two devices erasing the same booking do not conflict in sync', () => {
    const b = booking({ leadName: 'Jan' });
    const [a] = dueForErasure([b], [dep], '2027-06-01');
    const [c] = dueForErasure([b], [dep], '2027-07-01');
    expect(a).toEqual(c);
    const m = mergeRecords([a], [c], { [b.id]: b.updatedAt }, () => { throw new Error('conflict'); });
    expect(m.conflicts).toEqual([]);
  });
});

describe('backup with business records', () => {
  it('leaves bookings out of a backup unless asked', () => {
    const c = { tours: [], landmarks: [], products: [product], departures: [dep], bookings: [booking({ leadName: 'Jan' })] };
    expect(parseDataset(serializeDataset(c, { includeDeleted: false })).bookings).toHaveLength(1);
    const without = parseDataset(serializeDataset(c, { includeDeleted: false, includeBookings: false }));
    expect(without.bookings).toEqual([]);
    expect(without.departures).toHaveLength(1);
  });
});
