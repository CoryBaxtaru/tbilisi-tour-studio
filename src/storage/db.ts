// Local-first storage: every device keeps a full copy in IndexedDB.
import { openDB, type IDBPDatabase } from 'idb';
import type { Landmark, Tour } from '../domain/types';

const DB_NAME = 'tbilisi-tourstudio';
const DB_VERSION = 1;

type Store = 'tours' | 'landmarks' | 'meta';

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(d) {
      d.createObjectStore('tours', { keyPath: 'id' });
      d.createObjectStore('landmarks', { keyPath: 'id' });
      d.createObjectStore('meta');
    },
  });
  return dbPromise;
}

export async function loadAll(): Promise<{ tours: Tour[]; landmarks: Landmark[] }> {
  const d = await db();
  const [tours, landmarks] = await Promise.all([d.getAll('tours'), d.getAll('landmarks')]);
  return { tours, landmarks };
}

export async function putRecords(store: 'tours' | 'landmarks', records: (Tour | Landmark)[]): Promise<void> {
  if (!records.length) return;
  const tx = (await db()).transaction(store, 'readwrite');
  await Promise.all([...records.map((r) => tx.store.put(r)), tx.done]);
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db()).get('meta' satisfies Store, key);
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await db()).put('meta' satisfies Store, value, key);
}

export async function deleteMeta(key: string): Promise<void> {
  await (await db()).delete('meta' satisfies Store, key);
}

/** Asks the browser not to evict our data under storage pressure. Returns the resulting state. */
export async function requestPersistence(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
