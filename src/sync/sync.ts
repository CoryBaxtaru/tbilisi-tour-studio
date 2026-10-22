// One sync round: read remote → three-way merge per record type → write back if needed. Retries on races.
import { newId, nowIso } from '../domain/factory';
import { KINDS, type Collections, type Kind, type SyncedEntity } from '../domain/types';
import { serializeDataset } from '../storage/backup';
import { StaleRemoteError, SyncError, type Remote } from './github';
import { mergeRecords, type SyncBase } from './merge';

export interface SyncInput extends Partial<Collections> {
  base: SyncBase;
}

export interface SyncOutput extends Collections {
  base: SyncBase;
  conflicts: number;
  wrote: boolean;
}

const MAX_ATTEMPTS = 3;
const MARK = ' (conflictkopie)';

/** How a conflict copy is labelled, so the guide can find it. */
const LABEL: { [K in Kind]: (r: Collections[K][number]) => Partial<Collections[K][number]> } = {
  tours: (t) => ({ title: t.title + MARK }),
  landmarks: (l) => ({ name: l.name + MARK }),
  products: (p) => ({ name: p.name + MARK }),
  departures: (d) => ({ notes: (d.notes + MARK).trim() }),
  bookings: (b) => ({ leadName: b.leadName + MARK }),
};

export async function syncOnce(remote: Remote, input: SyncInput, deviceLabel: string): Promise<SyncOutput> {
  for (let attempt = 1; ; attempt++) {
    const file = await remote.read();
    const merged = {} as Collections;
    let conflicts = 0;
    let needsWrite = !file.sha;
    for (const k of KINDS) {
      const remoteRecs = (file.dataset?.[k] ?? []) as SyncedEntity[];
      const label = LABEL[k] as (r: SyncedEntity) => Partial<SyncedEntity>;
      const m = mergeRecords((input[k] ?? []) as SyncedEntity[], remoteRecs, input.base, (r) => conflictCopy(r, label(r)));
      (merged as unknown as Record<Kind, SyncedEntity[]>)[k] = m.merged;
      conflicts += m.conflicts.length;
      needsWrite ||= differs(m.merged, remoteRecs);
    }
    if (needsWrite) {
      try {
        await remote.write(serializeDataset(merged, { includeDeleted: true }), file.sha, `Sync vanaf ${deviceLabel}`);
      } catch (e) {
        if (e instanceof StaleRemoteError && attempt < MAX_ATTEMPTS) continue;
        if (e instanceof StaleRemoteError) throw new SyncError('Remote bleef veranderen; probeer het opnieuw.');
        throw e;
      }
    }
    const base: SyncBase = {};
    for (const k of KINDS) for (const r of merged[k]) base[r.id] = r.updatedAt;
    return { ...merged, base, conflicts, wrote: needsWrite };
  }
}

function differs(a: { id: string; updatedAt: string }[], b: { id: string; updatedAt: string }[]): boolean {
  if (a.length !== b.length) return true;
  const m = new Map(b.map((r) => [r.id, r.updatedAt]));
  return a.some((r) => m.get(r.id) !== r.updatedAt);
}

function conflictCopy<T extends SyncedEntity>(rec: T, patch: Partial<T>): T {
  const now = nowIso();
  return { ...rec, ...patch, id: newId(), createdAt: now, updatedAt: now };
}
