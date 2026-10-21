// One sync round: read remote → three-way merge → write back if needed. Retries on races.
import { newId, nowIso } from '../domain/factory';
import type { Landmark, Tour } from '../domain/types';
import { serializeDataset } from '../storage/backup';
import { StaleRemoteError, SyncError, type Remote } from './github';
import { mergeRecords, type SyncBase } from './merge';

export interface SyncInput {
  tours: Tour[];
  landmarks: Landmark[];
  base: SyncBase;
}

export interface SyncOutput {
  tours: Tour[];
  landmarks: Landmark[];
  base: SyncBase;
  conflicts: number;
  wrote: boolean;
}

const MAX_ATTEMPTS = 3;

export async function syncOnce(remote: Remote, input: SyncInput, deviceLabel: string): Promise<SyncOutput> {
  for (let attempt = 1; ; attempt++) {
    const file = await remote.read();
    const rTours = file.dataset?.tours ?? [];
    const rLandmarks = file.dataset?.landmarks ?? [];
    const tours = mergeRecords(input.tours, rTours, input.base, (t) => conflictCopy(t, { title: `${t.title} (conflictkopie)` }));
    const landmarks = mergeRecords(input.landmarks, rLandmarks, input.base, (l) => conflictCopy(l, { name: `${l.name} (conflictkopie)` }));

    const needsWrite = !file.sha || differs(tours.merged, rTours) || differs(landmarks.merged, rLandmarks);
    if (needsWrite) {
      try {
        await remote.write(
          serializeDataset(tours.merged, landmarks.merged, { includeDeleted: true }),
          file.sha,
          `Sync vanaf ${deviceLabel}`,
        );
      } catch (e) {
        if (e instanceof StaleRemoteError && attempt < MAX_ATTEMPTS) continue;
        if (e instanceof StaleRemoteError) throw new SyncError('Remote bleef veranderen; probeer het opnieuw.');
        throw e;
      }
    }
    const base: SyncBase = {};
    for (const r of [...tours.merged, ...landmarks.merged]) base[r.id] = r.updatedAt;
    return {
      tours: tours.merged,
      landmarks: landmarks.merged,
      base,
      conflicts: tours.conflicts.length + landmarks.conflicts.length,
      wrote: needsWrite,
    };
  }
}

function differs(a: { id: string; updatedAt: string }[], b: { id: string; updatedAt: string }[]): boolean {
  if (a.length !== b.length) return true;
  const m = new Map(b.map((r) => [r.id, r.updatedAt]));
  return a.some((r) => m.get(r.id) !== r.updatedAt);
}

function conflictCopy<T extends { id: string; createdAt: string; updatedAt: string }>(rec: T, patch: Partial<T>): T {
  const now = nowIso();
  return { ...rec, ...patch, id: newId(), createdAt: now, updatedAt: now };
}
