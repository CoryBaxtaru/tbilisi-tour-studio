// Application state: in-memory mirror of IndexedDB, plus sync orchestration.
// Every edit is saved locally first; sync to GitHub runs in the background when configured.
import { useEffect, useState } from 'preact/hooks';
import { dueForErasure, isoDate } from '../domain/agenda';
import { staleCatalogLandmarks } from '../domain/catalog';
import { touch } from '../domain/factory';
import { KINDS, type Collections, type Kind, type Landmark, type SyncedEntity, type Tour } from '../domain/types';
import { DatasetError, parseDataset, serializeDataset } from '../storage/backup';
import { deleteMeta, getMeta, loadAll, putRecords, requestPersistence, setMeta } from '../storage/db';
import { GitHubRemote, SyncError, type SyncConfig } from '../sync/github';
import { importRecords, type SyncBase } from '../sync/merge';
import { syncOnce } from '../sync/sync';

export type SyncStatus = 'uit' | 'bezig' | 'ok' | 'fout' | 'offline';

export interface AppState extends Collections {
  loaded: boolean;
  online: boolean;
  persisted: boolean | null;
  syncConfig: SyncConfig | null;
  syncStatus: SyncStatus;
  syncMessage: string;
  lastSyncAt: string | null;
  pendingChanges: boolean;
}

let state: AppState = {
  loaded: false,
  tours: [],
  landmarks: [],
  products: [],
  departures: [],
  bookings: [],
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  persisted: null,
  syncConfig: null,
  syncStatus: 'uit',
  syncMessage: '',
  lastSyncAt: null,
  pendingChanges: false,
};

const listeners = new Set<() => void>();

function set(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function getState(): AppState {
  return state;
}

export function useAppState(): AppState {
  const [, force] = useState(0);
  const rendered = state;
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    if (state !== rendered) l(); // changed between render and subscribe
    return () => void listeners.delete(l);
  }, []);
  return state;
}

const SYNC_CONFIG_KEY = 'syncConfig';
const SYNC_BASE_KEY = 'syncBase';
const LAST_SYNC_KEY = 'lastSyncAt';
const SYNC_DEBOUNCE_MS = 15_000;

export async function init(): Promise<void> {
  const all = await loadAll();
  const syncConfig = (await getMeta<SyncConfig>(SYNC_CONFIG_KEY)) ?? null;
  const lastSyncAt = (await getMeta<string>(LAST_SYNC_KEY)) ?? null;
  set({ loaded: true, ...all, syncConfig, lastSyncAt, syncStatus: syncConfig ? 'ok' : 'uit' });
  await refreshCatalog();
  await erasePersonalData();
  set({ persisted: await requestPersistence().catch(() => null) });

  window.addEventListener('online', () => { set({ online: true }); void syncNow(); });
  window.addEventListener('offline', () => set({ online: false, syncStatus: state.syncConfig ? 'offline' : 'uit' }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  void syncNow();
}

/** Brings unedited catalogue landmarks up to the bundled catalogue; drops routes to moved sites. */
async function refreshCatalog(): Promise<void> {
  const stale = staleCatalogLandmarks(state.landmarks);
  if (!stale.length) return;
  let landmarks = state.landmarks;
  for (const { fresh } of stale) landmarks = upsert(landmarks, fresh);
  set({ landmarks });
  await putRecords('landmarks', stale.map((s) => s.fresh));
  const moved = new Set(stale.filter((s) => s.moved).map((s) => s.fresh.id));
  for (const t of state.tours.filter((x) => !x.deleted)) {
    const stopIds = new Set(t.stops.filter((s) => moved.has(s.landmarkId)).map((s) => s.id));
    const legs = t.legs.filter((l) => !stopIds.has(l.fromStopId) && !stopIds.has(l.toStopId));
    if (legs.length !== t.legs.length) await saveTour({ ...t, legs });
  }
  changed();
}

/** Erases guests' personal data RETENTION_MONTHS after their tour (deterministic, so devices agree). */
async function erasePersonalData(): Promise<void> {
  const erased = dueForErasure(state.bookings, state.departures, isoDate(new Date()));
  if (!erased.length) return;
  let bookings = state.bookings;
  for (const b of erased) bookings = upsert(bookings, b);
  set({ bookings });
  await putRecords('bookings', erased);
  changed();
}

// ---- Edits (local first) ----

/** Saves any record with a fresh updatedAt. */
export async function saveRecord<K extends Kind>(kind: K, record: Collections[K][number]): Promise<void> {
  const r = touch(record as SyncedEntity) as Collections[K][number];
  set({ [kind]: upsert(state[kind] as SyncedEntity[], r as SyncedEntity) } as Partial<AppState>);
  await putRecords(kind, [r] as Collections[K]);
  changed();
}

export const saveTour = (tour: Tour) => saveRecord('tours', tour);
export const saveLandmark = (landmark: Landmark) => saveRecord('landmarks', landmark);

/** Soft delete (tombstone) so the deletion reaches other devices. */
export function deleteRecord<K extends Kind>(kind: K, record: Collections[K][number]): Promise<void> {
  return saveRecord(kind, { ...record, deleted: true });
}

/** Latest saved version of a record (avoids applying edits to a stale render copy). */
export function currentRecord<K extends Kind>(kind: K, id: string): Collections[K][number] | undefined {
  return (state[kind] as SyncedEntity[]).find((r) => r.id === id && !r.deleted) as Collections[K][number] | undefined;
}

/**
 * Stores a landmark as-is (no new updatedAt) unless it already exists. Used for catalogue sites,
 * whose fixed ids and timestamps make the same record on every device, so sync sees no conflict.
 */
export async function ensureLandmark(landmark: Landmark): Promise<void> {
  if (state.landmarks.some((l) => l.id === landmark.id && !l.deleted)) return;
  set({ landmarks: upsert(state.landmarks, landmark) });
  await putRecords('landmarks', [landmark]);
  changed();
}

/** Latest saved version of a tour (avoids applying edits to a stale render copy). */
export function currentTour(id: string): Tour | undefined {
  return state.tours.find((t) => t.id === id && !t.deleted);
}

/** Soft delete (tombstone) so the deletion reaches other devices. */
export async function deleteTour(tour: Tour): Promise<void> {
  await saveTour({ ...tour, deleted: true });
}

function upsert<T extends { id: string }>(xs: T[], x: T): T[] {
  const i = xs.findIndex((y) => y.id === x.id);
  if (i === -1) return [...xs, x];
  const copy = xs.slice();
  copy[i] = x;
  return copy;
}

// ---- Backup ----

/** Backup file. Bookings (guests' personal data) only when asked. */
export function exportJson(includeBookings = false): string {
  return serializeDataset(state, { includeDeleted: false, includeBookings });
}

export async function importJson(text: string): Promise<string> {
  try {
    const data = parseDataset(text);
    const counts: Partial<Record<Kind, number>> = {};
    const patch: Partial<Collections> = {};
    for (const k of KINDS) {
      const r = importRecords(state[k] as SyncedEntity[], data[k] as SyncedEntity[]);
      (patch as Record<Kind, SyncedEntity[]>)[k] = r.merged;
      counts[k] = r.changed;
      await putRecords(k, r.merged as Collections[typeof k]);
    }
    set(patch);
    changed();
    const business = (counts.products ?? 0) + (counts.departures ?? 0) + (counts.bookings ?? 0);
    return `Geïmporteerd: ${counts.tours} tour(s) en ${counts.landmarks} bezienswaardigheid/-heden bijgewerkt of toegevoegd` +
      (business ? `, plus ${business} touraanbod/vertrek(ken)/boeking(en).` : '.');
  } catch (e) {
    if (e instanceof DatasetError) throw e;
    throw new DatasetError('Importeren mislukt.');
  }
}

// ---- Sync ----

let debounce: ReturnType<typeof setTimeout> | null = null;
let running: Promise<void> | null = null;

function changed() {
  set({ pendingChanges: true });
  if (!state.syncConfig) return;
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => void syncNow(), SYNC_DEBOUNCE_MS);
}

export async function setSyncConfig(cfg: SyncConfig | null): Promise<void> {
  if (cfg) await setMeta(SYNC_CONFIG_KEY, cfg);
  else {
    await deleteMeta(SYNC_CONFIG_KEY);
    await deleteMeta(SYNC_BASE_KEY);
  }
  set({ syncConfig: cfg, syncStatus: cfg ? 'ok' : 'uit', syncMessage: '' });
  if (cfg) await syncNow();
}

export function syncNow(): Promise<void> {
  if (!state.syncConfig) return Promise.resolve();
  if (!navigator.onLine) {
    set({ syncStatus: 'offline', syncMessage: 'Offline: wijzigingen worden later gesynchroniseerd.' });
    return Promise.resolve();
  }
  running ??= runSync().finally(() => { running = null; });
  return running;
}

async function runSync(): Promise<void> {
  const cfg = state.syncConfig!;
  if (debounce) { clearTimeout(debounce); debounce = null; }
  set({ syncStatus: 'bezig', syncMessage: 'Synchroniseren…' });
  const all = () => KINDS.flatMap((k) => state[k] as SyncedEntity[]);
  const snapshot = new Map(all().map((r) => [r.id, r.updatedAt]));
  try {
    const base = (await getMeta<SyncBase>(SYNC_BASE_KEY)) ?? {};
    const input = Object.fromEntries(KINDS.map((k) => [k, state[k]])) as unknown as Collections;
    const out = await syncOnce(new GitHubRemote(cfg), { ...input, base }, deviceLabel());

    // Apply results, but never overwrite a record edited while the sync was running.
    const cur = new Map(all().map((r) => [r.id, r.updatedAt]));
    const untouched = (r: SyncedEntity) => cur.get(r.id) === snapshot.get(r.id);
    const patch: Partial<Collections> = {};
    let editedDuring = false;
    for (const k of KINDS) {
      const results = (out[k] as SyncedEntity[]).filter(untouched);
      editedDuring ||= results.length !== out[k].length;
      let next = state[k] as SyncedEntity[];
      for (const r of results) next = upsert(next, r);
      (patch as Record<Kind, SyncedEntity[]>)[k] = next;
      await putRecords(k, results as Collections[typeof k]);
    }
    await setMeta(SYNC_BASE_KEY, out.base);
    const now = new Date().toISOString();
    await setMeta(LAST_SYNC_KEY, now);
    set({
      ...patch,
      lastSyncAt: now,
      pendingChanges: editedDuring,
      syncStatus: 'ok',
      syncMessage: out.conflicts
        ? `${out.conflicts} conflict(en): beide versies bewaard, zoek "(conflictkopie)".`
        : 'Gesynchroniseerd.',
    });
    if (editedDuring) changed();
  } catch (e) {
    set({ syncStatus: 'fout', syncMessage: e instanceof SyncError || e instanceof DatasetError ? e.message : 'Synchronisatie mislukt.' });
  }
}

function deviceLabel(): string {
  return /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'telefoon' : 'laptop';
}
