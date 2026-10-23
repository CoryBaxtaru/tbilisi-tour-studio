// Business hub step 5: price profiles, suggested booking prices, per-departure finances and the money overview.
// Pure functions. Amounts in EUR. Costs are derived from the product's current profile, so changing a profile
// also changes the costs shown for past departures; revenue and commission are stored per booking and do not.
import { CHANNELS } from './agenda';
import type { Booking, BookingChannel, Departure, PriceProfile, TourProduct } from './types';

export function defaultPricing(): PriceProfile {
  return {
    kind: 'per-persoon', adult: 0, child: 0, infant: 0, privateBase: 0, privateIncluded: 1, privateExtra: 0,
    costPerGuest: 0, fixedCost: 0, commission: {}, grossUp: true,
  };
}

/** The product's profile, with defaults for fields an older record lacks. */
export function pricingOf(p: TourProduct | undefined): PriceProfile {
  const d = defaultPricing();
  return p?.pricing ? { ...d, ...p.pricing, commission: { ...p.pricing.commission } } : d;
}

export function hasPrices(pr: PriceProfile): boolean {
  return pr.kind === 'prive' ? pr.privateBase > 0 : pr.adult > 0 || pr.child > 0;
}

const round2 = (x: number) => Math.round(x * 100) / 100;
export const commissionRate = (pr: PriceProfile, channel: BookingChannel) => Math.min(95, Math.max(0, pr.commission[channel] ?? 0)) / 100;

export interface Party { adults: number; children: number; infants: number }

/** Paying guests: adults and children (infants are free unless priced). */
const paying = (x: Party) => x.adults + x.children;

/** Direct price for a party, with a short Dutch explanation. */
export function directPrice(pr: PriceProfile, x: Party): { total: number; how: string } {
  if (pr.kind === 'prive') {
    const extra = Math.max(0, paying(x) - pr.privateIncluded);
    const total = pr.privateBase + extra * pr.privateExtra;
    return { total, how: `privé €${pr.privateBase} t/m ${pr.privateIncluded}${extra ? ` + ${extra} × €${pr.privateExtra}` : ''}` };
  }
  const parts = [
    x.adults && `${x.adults} × €${pr.adult}`,
    x.children && `${x.children} × €${pr.child}`,
    x.infants && pr.infant && `${x.infants} × €${pr.infant}`,
  ].filter(Boolean);
  return { total: x.adults * pr.adult + x.children * pr.child + x.infants * pr.infant, how: parts.join(' + ') || 'geen gasten' };
}

/**
 * Suggested total and commission for a booking. On a commission channel with grossUp the price is raised to
 * direct ÷ (1 − rate), rounded to whole euros, so the guide keeps the same net.
 */
export function suggestedPrice(pr: PriceProfile, channel: BookingChannel, x: Party): { total: number; commission: number; how: string } {
  const direct = directPrice(pr, x);
  const rate = commissionRate(pr, channel);
  const total = rate > 0 && pr.grossUp ? Math.round(direct.total / (1 - rate)) : direct.total;
  const how = rate > 0
    ? `${direct.how}${pr.grossUp ? `, opgehoogd voor ${CHANNELS[channel]}` : ''} · ${Math.round(rate * 100)}% commissie`
    : direct.how;
  return { total, commission: round2(total * rate), how };
}

const counts = (b: Booking) => b.status === 'geannuleerd' ? 0 : 1;

export interface Money {
  gross: number;
  commission: number;
  costs: number;
  net: number;
}

export interface DepartureFinance extends Money {
  guests: number;
  /** Paying guests at the direct adult price needed to cover the fixed cost; null when it does not apply. */
  breakEven: number | null;
}

/** Revenue, commission, costs and net of one departure. Costs count only guests who came or are expected. */
export function departureFinance(dep: Departure, product: TourProduct | undefined, bookings: Booking[]): DepartureFinance {
  const pr = pricingOf(product);
  let gross = 0, commission = 0, payingGuests = 0, guests = 0;
  for (const b of bookings) {
    if (b.departureId !== dep.id || b.deleted || !counts(b)) continue;
    gross += b.priceTotal;
    commission += b.commission;
    guests += b.adults + b.children + b.infants;
    if (b.status === 'geboekt') payingGuests += paying(b);
  }
  const runs = dep.status !== 'geannuleerd' && payingGuests > 0;
  const costs = runs ? payingGuests * pr.costPerGuest + pr.fixedCost : 0;
  const margin = pr.adult - pr.costPerGuest;
  const breakEven = pr.kind === 'per-persoon' && pr.fixedCost > 0 && margin > 0 ? Math.ceil(pr.fixedCost / margin) : null;
  return { gross: round2(gross), commission: round2(commission), costs: round2(costs), net: round2(gross - commission - costs), guests, breakEven };
}

export interface MonthRow extends Money {
  month: string; // YYYY-MM
  departures: number;
  guests: number;
  capacity: number;
}

export interface Overview {
  months: MonthRow[];
  total: MonthRow;
  byChannel: { channel: BookingChannel; bookings: number; guests: number; gross: number; commission: number }[];
  byProduct: { productId: string; name: string; departures: number; guests: number; net: number }[];
}

/** Money and occupancy per month of a year, plus totals per channel and per product. Cancelled departures are left out. */
export function moneyOverview(year: number, products: TourProduct[], departures: Departure[], bookings: Booking[]): Overview {
  const productById = new Map(products.map((p) => [p.id, p]));
  const deps = departures.filter((d) => !d.deleted && d.status !== 'geannuleerd' && d.date.startsWith(`${year}-`));
  const empty = (month: string): MonthRow => ({ month, departures: 0, guests: 0, capacity: 0, gross: 0, commission: 0, costs: 0, net: 0 });
  const months = Array.from({ length: 12 }, (_, i) => empty(`${year}-${String(i + 1).padStart(2, '0')}`));
  const total = empty(String(year));
  const byChannel = new Map<BookingChannel, Overview['byChannel'][number]>();
  const byProduct = new Map<string, Overview['byProduct'][number]>();
  const depIds = new Set(deps.map((d) => d.id));

  for (const d of deps) {
    const f = departureFinance(d, productById.get(d.productId), bookings);
    const row = months[Number(d.date.slice(5, 7)) - 1];
    for (const r of [row, total]) {
      r.departures++;
      r.guests += f.guests;
      r.capacity += d.capacity;
      r.gross += f.gross; r.commission += f.commission; r.costs += f.costs; r.net += f.net;
    }
    const p = productById.get(d.productId);
    const pp = byProduct.get(d.productId) ?? { productId: d.productId, name: p ? (p.deleted ? `${p.name} (verwijderd)` : p.name) : 'Onbekend', departures: 0, guests: 0, net: 0 };
    pp.departures++; pp.guests += f.guests; pp.net += f.net;
    byProduct.set(d.productId, pp);
  }
  for (const b of bookings) {
    if (b.deleted || !counts(b) || !depIds.has(b.departureId)) continue;
    const c = byChannel.get(b.channel) ?? { channel: b.channel, bookings: 0, guests: 0, gross: 0, commission: 0 };
    c.bookings++; c.guests += b.adults + b.children + b.infants; c.gross += b.priceTotal; c.commission += b.commission;
    byChannel.set(b.channel, c);
  }
  const fix = <T extends object>(o: T): T => {
    for (const k of ['gross', 'commission', 'costs', 'net'] as const) if (k in o) (o as Record<string, number>)[k] = round2((o as Record<string, number>)[k]);
    return o;
  };
  return {
    months: months.map(fix),
    total: fix(total),
    byChannel: [...byChannel.values()].map(fix).sort((a, b) => b.gross - a.gross),
    byProduct: [...byProduct.values()].map(fix).sort((a, b) => b.net - a.net),
  };
}

/**
 * Bookings of a year as CSV for the accountant: Dutch Excel style (semicolons, decimal comma, BOM).
 * Deliberately without names, contact details or notes.
 */
export function bookingsCsv(year: number, products: TourProduct[], departures: Departure[], bookings: Booking[]): string {
  const productById = new Map(products.map((p) => [p.id, p]));
  const depById = new Map(departures.filter((d) => !d.deleted && d.date.startsWith(`${year}-`)).map((d) => [d.id, d]));
  const money = (n: number) => n.toFixed(2).replace('.', ',');
  const cell = (s: string | number) => {
    const v = String(s);
    return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const rows: (string | number)[][] = [['Datum', 'Starttijd', 'Touraanbod', 'Vertrekstatus', 'Kanaal', 'Boekingsnummer', 'Volwassenen', 'Kinderen', "Baby's", 'Boekingsstatus', 'Betaald', 'Bedrag', 'Commissie', 'Netto']];
  const list = bookings
    .filter((b) => !b.deleted && depById.has(b.departureId))
    .map((b) => ({ b, d: depById.get(b.departureId)! }))
    .sort((x, y) => x.d.date.localeCompare(y.d.date) || x.d.startTime.localeCompare(y.d.startTime) || x.b.createdAt.localeCompare(y.b.createdAt));
  for (const { b, d } of list) {
    rows.push([d.date, d.startTime, productById.get(d.productId)?.name ?? 'Onbekend', d.status, CHANNELS[b.channel], b.reference, b.adults, b.children, b.infants,
      b.status, b.paid ? 'ja' : 'nee', money(b.priceTotal), money(b.commission), money(b.priceTotal - b.commission)]);
  }
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}
