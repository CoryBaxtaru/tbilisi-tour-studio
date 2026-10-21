// Application state: in-memory mirror of IndexedDB, plus sync orchestration.
// Every edit is saved locally first; sync to GitHub runs in the background when configured.
import { useEffect, useState } from 'preact/hooks';
import { staleCatalogLandmarks } from '../domain/catalog';
import { touch } from '../domain/factory';
import type { Landmark, Tour } from '../domain/types';
import { DatasetError, parseDataset, serializeDataset } from '../storage/backup';
import { deleteMeta, getMeta, loadAll, putRecords, requestPersistence, setMeta } from '../storage/db';
import { GitHubRemote, SyncError, type SyncConfig } from '../sync/github';
import { importRecords, type SyncBase } from '../sync/merge';
import { syncOnce } from '../sync/sync';

export type SyncStatus = 'uit' | 'bezig' | 'ok' | 'fout' | 'offline';

export interface AppState {
  loaded: boolean;
  tours: Tour[];
  landmarks: Landmark[];
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
  const { tours, landmarks } = await loadAll();
  const syncConfig = (await getMeta<SyncConfig>(SYNC_CONFIG_KEY)) ?? null;
  const lastSyncAt = (await getMeta<string>(LAST_SYNC_KEY)) ?? null;
  set({ loaded: true, tours, landmarks, syncConfig, lastSyncAt, syncStatus: syncConfig ? 'ok' : 'uit' });
  await refreshCatalog();
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

// ---- Edits (local first) ----

export async function saveTour(tour: Tour): Promise<void> {
  const t = touch(tour);
  set({ tours: upsert(state.tours, t) });
  await putRecords('tours', [t]);
  changed();
}

export async function saveLandmark(landmark: Landmark): Promise<void> {
  const l = touch(landmark);
  set({ landmarks: upsert(state.landmarks, l) });
  await putRecords('landmarks', [l]);
  changed();
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

export function exportJson(): string {
  return serializeDataset(state.tours, state.landmarks, { includeDeleted: false });
}

export async function importJson(text: string): Promise<string> {
  try {
    const data = parseDataset(text);
    const tours = importRecords(state.tours, data.tours);
    const landmarks = importRecords(state.landmarks, data.landmarks);
    set({ tours: tours.merged, landmarks: landmarks.merged });
    await putRecords('tours', tours.merged);
    await putRecords('landmarks', landmarks.merged);
    changed();
    return `Geïmporteerd: ${tours.changed} tour(s) en ${landmarks.changed} bezienswaardigheid/-heden bijgewerkt of toegevoegd.`;
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
  const snapshot = new Map([...state.tours, ...state.landmarks].map((r) => [r.id, r.updatedAt]));
  try {
    const base = (await getMeta<SyncBase>(SYNC_BASE_KEY)) ?? {};
    const out = await syncOnce(new GitHubRemote(cfg), { tours: state.tours, landmarks: state.landmarks, base }, deviceLabel());

    // Apply results, but never overwrite a record edited while the sync was running.
    const untouched = <T extends { id: string; updatedAt: string }>(current: T[]) => {
      const cur = new Map(current.map((r) => [r.id, r.updatedAt]));
      return (r: T) => cur.get(r.id) === snapshot.get(r.id);
    };
    const tours = out.tours.filter(untouched(state.tours));
    const landmarks = out.landmarks.filter(untouched(state.landmarks));
    let nextTours = state.tours;
    for (const t of tours) nextTours = upsert(nextTours, t);
    let nextLandmarks = state.landmarks;
    for (const l of landmarks) nextLandmarks = upsert(nextLandmarks, l);
    await putRecords('tours', tours);
    await putRecords('landmarks', landmarks);
    await setMeta(SYNC_BASE_KEY, out.base);
    const now = new Date().toISOString();
    await setMeta(LAST_SYNC_KEY, now);
    const editedDuring = tours.length !== out.tours.length || landmarks.length !== out.landmarks.length;
    set({
      tours: nextTours,
      landmarks: nextLandmarks,
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
