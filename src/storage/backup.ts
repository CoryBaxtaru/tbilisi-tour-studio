// Portable JSON format used for export/import and for the synced remote file.
import { SCHEMA_VERSION, type Dataset, type Landmark, type Tour } from '../domain/types';

export class DatasetError extends Error {}

export function serializeDataset(tours: Tour[], landmarks: Landmark[], opts: { includeDeleted: boolean }): string {
  const keep = <T extends { deleted?: boolean }>(xs: T[]) => (opts.includeDeleted ? xs : xs.filter((x) => !x.deleted));
  const data: Dataset = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tours: keep(tours),
    landmarks: keep(landmarks),
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
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    throw new DatasetError(`Niet-ondersteunde schemaversie: ${String(raw.schemaVersion)}.`);
  }
  if (!Array.isArray(raw.tours) || !Array.isArray(raw.landmarks)) throw new DatasetError('Tours of bezienswaardigheden ontbreken.');
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
