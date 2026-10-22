// Offline basemap: a self-hosted Protomaps extract of Tbilisi (public/maps/*.pmtiles, OSM data, ODbL).
// Online it is read with HTTP range requests; after "Opslaan voor offline" the whole file lives in
// Cache Storage on this device and every read is served from there, with or without a connection.
// OSM's own tile servers forbid offline use, so this file is the only map that works without signal.
import { FetchSource, PMTiles, type RangeResponse, type Source } from 'pmtiles';
import { useEffect, useState } from 'preact/hooks';

/** Versioned file name: a new extract gets a new name, so old copies are never mixed up. */
export const MAP_FILE = 'maps/tbilisi-20261020.pmtiles';
export const MAP_SIZE_BYTES = 9_714_602;
export const MAP_DATA_DATE = '2026-10-20';
/** Area of the extract (west, south, east, north); the vector layer is limited to it. */
export const MAP_BOUNDS: [[number, number], [number, number]] = [[41.673, 44.732], [41.783, 44.842]];
export const MAP_ATTRIBUTION = 'Kaart: <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

const CACHE_NAME = 'offline-kaart';
const mapUrl = () => new URL(MAP_FILE, document.baseURI).href;

let storedBlob: Promise<Blob | null> | null = null;
const listeners = new Set<() => void>();

function loadStored(): Promise<Blob | null> {
  storedBlob ??= (async () => {
    if (!('caches' in window)) return null;
    try {
      const res = await (await caches.open(CACHE_NAME)).match(mapUrl());
      return res ? await res.blob() : null;
    } catch {
      return null;
    }
  })();
  return storedBlob;
}

/** Reads from the stored copy when present, otherwise from the network (range requests). */
class HybridSource implements Source {
  private net: FetchSource;
  constructor(private url: string) {
    this.net = new FetchSource(url);
  }
  getKey() {
    return this.url;
  }
  async getBytes(offset: number, length: number, signal?: AbortSignal, etag?: string): Promise<RangeResponse> {
    const blob = await loadStored();
    if (blob) return { data: await blob.slice(offset, offset + length).arrayBuffer() };
    return this.net.getBytes(offset, length, signal, etag);
  }
}

let pmtiles: PMTiles | null = null;
export function mapArchive(): PMTiles {
  pmtiles ??= new PMTiles(new HybridSource(mapUrl()));
  return pmtiles;
}

export async function isMapStored(): Promise<boolean> {
  return (await loadStored()) !== null;
}

/** Downloads the whole file into Cache Storage. Reports progress 0..1 when the size is known. */
export async function storeMap(onProgress?: (fraction: number) => void): Promise<void> {
  const res = await fetch(mapUrl(), { cache: 'no-store' });
  if (!res.ok || !res.body) throw new Error(`Download mislukt (${res.status}).`);
  const total = Number(res.headers.get('content-length')) || MAP_SIZE_BYTES;
  const reader = res.body.getReader();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    received += value.length;
    onProgress?.(Math.min(1, received / total));
  }
  const blob = new Blob(parts, { type: 'application/octet-stream' });
  if (blob.size < 1024) throw new Error('Download onvolledig.');
  const cache = await caches.open(CACHE_NAME);
  // Remove copies of older extracts before storing the current one.
  for (const req of await cache.keys()) if (req.url !== mapUrl()) await cache.delete(req);
  await cache.put(mapUrl(), new Response(blob, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(blob.size) } }));
  storedBlob = Promise.resolve(blob);
  listeners.forEach((l) => l());
}

export async function removeStoredMap(): Promise<void> {
  if ('caches' in window) await caches.delete(CACHE_NAME);
  storedBlob = Promise.resolve(null);
  listeners.forEach((l) => l());
}

/** Whether the offline map is stored on this device (null while checking). */
export function useMapStored(): boolean | null {
  const [stored, setStored] = useState<boolean | null>(null);
  useEffect(() => {
    const check = () => void isMapStored().then(setStored);
    check();
    listeners.add(check);
    return () => void listeners.delete(check);
  }, []);
  return stored;
}
