// The store end to end: IndexedDB (fake-indexeddb), the sync round and a GitHub contents API faked through fetch.
// Each "device" is a fresh copy of the store module with its own database; they share one online file.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBooking, createDeparture, createProduct } from '../domain/agenda';
import { createLandmark, createTour } from '../domain/factory';
import type { Dataset } from '../domain/types';
import { decodeBase64Utf8, encodeBase64Utf8 } from '../sync/github';

type Store = typeof import('./store');

/** The private repository: one file with a version (sha). */
class FakeGitHub {
  content: string | null = null;
  sha = 0;
  writes = 0;
  get data(): Dataset { return JSON.parse(this.content!) as Dataset; }
  fetch = async (url: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
    if (!String(url).includes('/contents/')) return json({});
    if ((init.method ?? 'GET') === 'PUT') {
      const body = JSON.parse(String(init.body)) as { content: string; sha?: string };
      if ((this.content ? String(this.sha) : undefined) !== body.sha) return json({}, 409);
      this.content = decodeBase64Utf8(body.content);
      this.sha++;
      this.writes++;
      return json({ content: { sha: String(this.sha) } });
    }
    if (!this.content) return json({}, 404);
    const b64 = encodeBase64Utf8(this.content);
    return json({ sha: String(this.sha), content: b64, encoding: 'base64', size: b64.length });
  };
}

const CONFIG = { owner: 'test', repo: 'data', path: 'data/tours.json', token: 'test-token' };
let github: FakeGitHub;

/** Starts the app on a device (its database). Starting again on the same database is a reload. */
async function boot(db: IDBFactory): Promise<Store> {
  vi.stubGlobal('indexedDB', db);
  vi.resetModules();
  const store = await import('./store');
  await store.init();
  await store.syncNow();
  return store;
}
const live = <T extends { deleted?: boolean }>(xs: T[]) => xs.filter((x) => !x.deleted);

beforeEach(() => {
  github = new FakeGitHub();
  const memory = new Map<string, string>();
  vi.stubGlobal('fetch', github.fetch);
  vi.stubGlobal('navigator', { onLine: true, userAgent: 'test' });
  vi.stubGlobal('window', { addEventListener: () => undefined });
  vi.stubGlobal('document', { addEventListener: () => undefined, visibilityState: 'visible' });
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
    key: (i: number) => [...memory.keys()][i] ?? null,
    get length() { return memory.size; },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('store', () => {
  it('keeps edits across a reload', async () => {
    const db = new IDBFactory();
    let store = await boot(db);
    await store.saveTour(createTour('Oude stad'));
    store = await boot(db);
    expect(store.getState().tours.map((t) => t.title)).toEqual(['Oude stad']);
    expect(store.getState().loadError).toBeNull();
  });

  it('shows a start-up error instead of loading forever', async () => {
    const broken = { open: () => { throw new Error('opslag geblokkeerd'); } } as unknown as IDBFactory;
    const store = await boot(broken);
    expect(store.getState().loaded).toBe(false);
    expect(store.getState().loadError).toContain('opslag geblokkeerd');
  });

  it('carries a tour from the laptop to the phone', async () => {
    const laptop = await boot(new IDBFactory());
    await laptop.setSyncConfig(CONFIG);
    await laptop.saveTour(createTour('Oude stad'));
    await laptop.syncNow();
    expect(github.data.tours.map((t) => t.title)).toEqual(['Oude stad']);

    const phone = await boot(new IDBFactory());
    await phone.setSyncConfig(CONFIG);
    expect(phone.getState().tours.map((t) => t.title)).toEqual(['Oude stad']);
    expect(phone.getState().syncMessage).toBe('Gesynchroniseerd.');
  });

  it('leaves no personal data in a deleted booking, locally or online', async () => {
    const store = await boot(new IDBFactory());
    await store.setSyncConfig(CONFIG);
    const product = createProduct('Oude stad');
    const departure = createDeparture(product, '2026-11-21');
    const booking = { ...createBooking(departure.id), leadName: 'Anna de Vries', contact: '@anna', notes: 'vegetarisch', reference: 'GYG-1', adults: 2 };
    await store.saveRecord('products', product);
    await store.saveRecord('departures', departure);
    await store.saveRecord('bookings', booking);
    await store.syncNow();
    expect(github.content).toContain('Anna de Vries');

    await store.deleteRecord('bookings', booking);
    await store.syncNow();
    expect(store.getState().bookings[0]).toMatchObject({ deleted: true, leadName: '', contact: '', notes: '', reference: '', adults: 2 });
    expect(github.content).not.toContain('Anna de Vries');
    expect(github.content).not.toContain('@anna');
  });

  it('blanks bookings that were deleted before the app did that', async () => {
    const db = new IDBFactory();
    let store = await boot(db);
    const product = createProduct('Oude stad');
    const departure = createDeparture(product, '2026-11-21');
    // Saved as an old tombstone: deleted, but still holding the name.
    await store.saveRecord('bookings', { ...createBooking(departure.id), leadName: 'Oude Gast', contact: '+31 6 1', deleted: true });
    store = await boot(db);
    expect(store.getState().bookings[0]).toMatchObject({ deleted: true, leadName: '', contact: '' });
  });

  it('"Alles wissen" deletes own data on both devices and keeps catalogue places', async () => {
    const laptop = await boot(new IDBFactory());
    await laptop.setSyncConfig(CONFIG);
    const product = createProduct('Oude stad');
    const departure = createDeparture(product, '2026-11-21');
    await laptop.saveTour(createTour('Oude stad'));
    await laptop.saveLandmark(createLandmark('Eigen plek', { lat: 41.69, lng: 44.8 }, 'kaart'));
    await laptop.saveLandmark({ ...createLandmark('Narikala', { lat: 41.688, lng: 44.809 }, 'osm'), catalogId: 'narikala' });
    await laptop.saveRecord('products', product);
    await laptop.saveRecord('departures', departure);
    await laptop.saveRecord('bookings', { ...createBooking(departure.id), leadName: 'Anna' });
    await laptop.syncNow();

    expect(await laptop.resetOwnData()).toBe(5);
    await laptop.syncNow();
    const s = laptop.getState();
    expect([live(s.tours), live(s.products), live(s.departures), live(s.bookings)].map((x) => x.length)).toEqual([0, 0, 0, 0]);
    expect(live(s.landmarks).map((l) => l.name)).toEqual(['Narikala']);
    expect(github.content).not.toContain('Anna');

    const phone = await boot(new IDBFactory());
    await phone.setSyncConfig(CONFIG);
    expect(live(phone.getState().tours)).toEqual([]);
  });

  it('a normal sync keeps what only the phone has; taking over the online version drops it', async () => {
    const laptop = await boot(new IDBFactory());
    await laptop.setSyncConfig(CONFIG);
    await laptop.saveTour(createTour('Van de laptop'));
    await laptop.syncNow();
    const online = github.content;

    const phoneDb = new IDBFactory();
    let phone = await boot(phoneDb);
    await phone.saveTour(createTour('Oud, alleen op de telefoon'));
    await phone.setSyncConfig(CONFIG);
    expect(live(phone.getState().tours).map((t) => t.title).sort()).toEqual(['Oud, alleen op de telefoon', 'Van de laptop']);

    // The phone pushed its old tour online; put the laptop's version back, as after "Alles wissen" plus a sync.
    github.content = online;
    github.sha++;
    const writes = github.writes;
    expect(await phone.previewTakeOver()).toEqual({ online: { tours: 1, products: 0, departures: 0, bookings: 0 }, lost: 1 });
    await phone.takeOverOnline();
    expect(phone.getState().tours.map((t) => t.title)).toEqual(['Van de laptop']);
    expect(github.writes).toBe(writes); // nothing is sent

    phone = await boot(phoneDb);
    expect(phone.getState().tours.map((t) => t.title)).toEqual(['Van de laptop']);
    expect(github.writes).toBe(writes); // and the next sync has nothing to send
  });

  it('says so when a deleted item came back', async () => {
    const { syncSummary } = await boot(new IDBFactory());
    expect(syncSummary(0, 0)).toBe('Gesynchroniseerd.');
    expect(syncSummary(0, 1)).toContain('1 gewist item kwam terug');
    expect(syncSummary(2, 3)).toContain('conflict');
    expect(syncSummary(2, 3)).toContain('3 gewiste items kwamen terug');
  });
});
