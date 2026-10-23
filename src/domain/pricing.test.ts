import { describe, expect, it } from 'vitest';
import { createBooking, createDeparture, createProduct } from './agenda';
import { bookingsCsv, defaultPricing, departureFinance, directPrice, moneyOverview, pricingOf, suggestedPrice } from './pricing';
import type { Booking, PriceProfile } from './types';

// Test amounts only; real prices are private and never in the code.
const group: PriceProfile = { ...defaultPricing(), adult: 10, child: 4, infant: 0, costPerGuest: 1, fixedCost: 18, commission: { getyourguide: 20 } };
const priv: PriceProfile = { ...defaultPricing(), kind: 'prive', privateBase: 50, privateIncluded: 2, privateExtra: 15 };

describe('pricingOf', () => {
  it('gives zero defaults for products without a profile', () => {
    const p = createProduct();
    expect(pricingOf(p)).toEqual(defaultPricing());
    expect(pricingOf({ ...p, pricing: { ...group, commission: { direct: 0 } } }).commission).toEqual({ direct: 0 });
  });
});

describe('directPrice', () => {
  it('adds per-person prices', () => {
    expect(directPrice(group, { adults: 2, children: 1, infants: 1 })).toEqual({ total: 24, how: '2 × €10 + 1 × €4' });
  });
  it('charges private tours a base plus extra guests', () => {
    expect(directPrice(priv, { adults: 2, children: 0, infants: 0 }).total).toBe(50);
    expect(directPrice(priv, { adults: 3, children: 1, infants: 1 }).total).toBe(80);
  });
});

describe('suggestedPrice', () => {
  it('has no commission on direct bookings', () => {
    expect(suggestedPrice(group, 'direct', { adults: 2, children: 0, infants: 0 })).toMatchObject({ total: 20, commission: 0 });
  });
  it('grosses up commission channels so the net stays equal', () => {
    const s = suggestedPrice(group, 'getyourguide', { adults: 2, children: 0, infants: 0 });
    expect(s.total).toBe(25); // 20 / 0.8
    expect(s.commission).toBe(5);
    expect(s.how).toContain('20% commissie');
  });
  it('keeps the direct price without gross-up', () => {
    expect(suggestedPrice({ ...group, grossUp: false }, 'getyourguide', { adults: 2, children: 0, infants: 0 })).toMatchObject({ total: 20, commission: 4 });
  });
});

describe('departureFinance', () => {
  const product = { ...createProduct(), pricing: group };
  const dep = createDeparture(product, '2027-05-01');
  const book = (p: Partial<Booking>): Booking => ({ ...createBooking(dep.id), ...p });

  it('subtracts commission and costs, and computes break-even', () => {
    const bookings = [
      book({ adults: 2, priceTotal: 20 }),
      book({ adults: 1, children: 1, channel: 'getyourguide', priceTotal: 18, commission: 3.6 }),
      book({ adults: 4, priceTotal: 40, status: 'geannuleerd' }),
      book({ adults: 1, priceTotal: 10, status: 'no-show' }),
    ];
    const f = departureFinance(dep, product, bookings);
    expect(f).toMatchObject({ gross: 48, commission: 3.6, guests: 5 });
    expect(f.costs).toBe(4 * 1 + 18); // no-show and cancelled bring no costs
    expect(f.net).toBe(48 - 3.6 - 22);
    expect(f.breakEven).toBe(2); // 18 / (10 - 1)
  });
  it('has no costs for a cancelled departure', () => {
    const f = departureFinance({ ...dep, status: 'geannuleerd' }, product, [book({ adults: 2, priceTotal: 20 })]);
    expect(f.costs).toBe(0);
  });
});

describe('moneyOverview and CSV', () => {
  const product = { ...createProduct('Oude stad'), pricing: group };
  const may = createDeparture(product, '2027-05-01');
  const june = createDeparture(product, '2027-06-02');
  const other = createDeparture(product, '2028-01-01');
  const bookings: Booking[] = [
    { ...createBooking(may.id), adults: 2, priceTotal: 20, leadName: 'Geheim', contact: 'x@y.z', reference: 'A;1' },
    { ...createBooking(june.id), adults: 1, channel: 'getyourguide', priceTotal: 13, commission: 2.6, paid: true },
    { ...createBooking(other.id), adults: 3, priceTotal: 30 },
  ];

  it('sums per month, channel and product within the year', () => {
    const o = moneyOverview(2027, [product], [may, june, other], bookings);
    expect(o.months[4]).toMatchObject({ month: '2027-05', departures: 1, guests: 2, capacity: 10, gross: 20, costs: 20 });
    expect(o.total).toMatchObject({ departures: 2, guests: 3, gross: 33, commission: 2.6 });
    expect(o.byChannel.map((c) => c.channel)).toEqual(['direct', 'getyourguide']);
    expect(o.byProduct[0]).toMatchObject({ name: 'Oude stad', departures: 2, guests: 3 });
  });

  it('exports CSV without personal data', () => {
    const csv = bookingsCsv(2027, [product], [may, june, other], bookings);
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('2027-05-01;10:00;Oude stad;gepland;Direct;"A;1";2;0;0;geboekt;nee;20,00;0,00;20,00');
    expect(csv).not.toContain('Geheim');
    expect(csv).not.toContain('x@y.z');
  });
});
