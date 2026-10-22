// Portable JSON format used for export/import and for the synced remote file.
import { KINDS, SCHEMA_VERSION, type Collections, type Dataset } from '../domain/types';

export class DatasetError extends Error {}

/**
 * Sync writes everything (incl. tombstones). A backup file leaves bookings out unless asked: they hold guests'
 * personal data, and a downloaded file is easily shared or forgotten.
 */
export function serializeDataset(c: Collections, opts: { includeDeleted: boolean; includeBookings?: boolean }): string {
  const keep = <T extends { deleted?: boolean }>(xs: T[]) => (opts.includeDeleted ? xs : xs.filter((x) => !x.deleted));
  const data: Dataset = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tours: keep(c.tours),
    landmarks: keep(c.landmarks),
    products: keep(c.products),
    departures: keep(c.departures),
    bookings: opts.includeBookings === false ? [] : keep(c.bookings),
  };
  return JSON.stringify(data, null, 2);
}

/** Parses and structurally validates a dataset. Throws DatasetError with a Dutch message. */
export function parseDataset(text: string): Dataset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new DatasetError('Dit is geen geldig JSON-bestand.');
  }
  if (!isObject(raw)) throw new DatasetError('Onbekend bestandsformaat.');
  if (raw.schemaVersion !== 1 && raw.schemaVersion !== SCHEMA_VERSION) {
    throw new DatasetError(`Niet-ondersteunde schemaversie: ${String(raw.schemaVersion)}. Werk de app bij (Vernieuwen).`);
  }
  if (!Array.isArray(raw.tours) || !Array.isArray(raw.landmarks)) throw new DatasetError('Tours of bezienswaardigheden ontbreken.');
  // Version 1 files have no business records.
  for (const k of KINDS) {
    raw[k] ??= [];
    if (!Array.isArray(raw[k])) throw new DatasetError(`Onderdeel "${k}" is ongeldig.`);
  }
  raw.products.forEach((p: unknown, i: number) => {
    if (!isEntity(p) || typeof p.name !== 'string' || !isFiniteNum(p.maxGuests)) throw new DatasetError(`Touraanbod ${i + 1} is ongeldig.`);
  });
  raw.departures.forEach((d: unknown, i: number) => {
    if (!isEntity(d) || typeof d.productId !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || !isFiniteNum(d.capacity)) {
      throw new DatasetError(`Vertrek ${i + 1} is ongeldig.`);
    }
  });
  raw.bookings.forEach((b: unknown, i: number) => {
    if (!isEntity(b) || typeof b.departureId !== 'string' || !isFiniteNum(b.adults) || !isFiniteNum(b.priceTotal)) {
      throw new DatasetError(`Boeking ${i + 1} is ongeldig.`);
    }
  });
  raw.tours.forEach((t, i) => {
    if (!isEntity(t) || typeof t.title !== 'string' || !Array.isArray(t.stops) || !Array.isArray(t.legs)) {
      throw new DatasetError(`Tour ${i + 1} is ongeldig.`);
    }
  });
  raw.landmarks.forEach((l, i) => {
    if (!isEntity(l) || typeof l.name !== 'string') throw new DatasetError(`Bezienswaardigheid ${i + 1} is ongeldig.`);
    if (l.position !== null && !(isObject(l.position) && isFiniteNum(l.position.lat) && isFiniteNum(l.position.lng))) {
      throw new DatasetError(`Bezienswaardigheid "${l.name}" heeft ongeldige coördinaten.`);
    }
  });
  return raw as unknown as Dataset;
}

function isObject(v: unknown): v is Record<string, any> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNum(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v);
}

function isEntity(v: unknown): v is Record<string, any> {
  return isObject(v) && typeof v.id === 'string' && typeof v.createdAt === 'string' && typeof v.updatedAt === 'string';
}
