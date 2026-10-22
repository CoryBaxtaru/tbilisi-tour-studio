// Local-first storage: every device keeps a full copy in IndexedDB.
import { openDB, type IDBPDatabase } from 'idb';
import { KINDS, type Collections, type Kind } from '../domain/types';

const DB_NAME = 'tbilisi-tourstudio';
// 2 adds the business stores (products, departures, bookings).
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(d) {
      for (const kind of KINDS) if (!d.objectStoreNames.contains(kind)) d.createObjectStore(kind, { keyPath: 'id' });
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
    },
  });
  return dbPromise;
}

export async function loadAll(): Promise<Collections> {
  const d = await db();
  const lists = await Promise.all(KINDS.map((k) => d.getAll(k)));
  return Object.fromEntries(KINDS.map((k, i) => [k, lists[i]])) as unknown as Collections;
}

export async function putRecords<K extends Kind>(store: K, records: Collections[K]): Promise<void> {
  if (!records.length) return;
  const tx = (await db()).transaction(store, 'readwrite');
  await Promise.all([...records.map((r) => tx.store.put(r)), tx.done]);
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db()).get('meta', key);
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await db()).put('meta', value, key);
}

export async function deleteMeta(key: string): Promise<void> {
  await (await db()).delete('meta', key);
}

/** Asks the browser not to evict our data under storage pressure. Returns the resulting state. */
export async function requestPersistence(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
