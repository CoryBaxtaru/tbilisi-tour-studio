// Three-way, per-record merge used by sync. Pure and deterministic.
// Rule: never lose an edit silently. When both sides changed the same record since the
// last sync, the newer one wins and the other is kept as a visible conflict copy.
import type { SyncedEntity } from '../domain/types';

/** updatedAt of each record as it was after the last successful sync. */
export type SyncBase = Record<string, string>;

export interface MergeResult<T> {
  merged: T[];
  conflicts: T[];
}

export function mergeRecords<T extends SyncedEntity>(
  local: T[],
  remote: T[],
  base: SyncBase,
  makeConflictCopy: (loser: T) => T,
): MergeResult<T> {
  const localById = new Map(local.map((r) => [r.id, r]));
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  const ids = new Set([...localById.keys(), ...remoteById.keys()]);
  const merged: T[] = [];
  const conflicts: T[] = [];

  for (const id of [...ids].sort()) {
    const l = localById.get(id);
    const r = remoteById.get(id);
    if (!l) { merged.push(r!); continue; }
    if (!r) { merged.push(l); continue; } // remote lost it (e.g. file reset): keep ours
    if (l.updatedAt === r.updatedAt) { merged.push(r); continue; }

    const localChanged = l.updatedAt !== base[id];
    const remoteChanged = r.updatedAt !== base[id];
    if (!localChanged) { merged.push(r); continue; }
    if (!remoteChanged) { merged.push(l); continue; }

    // Both changed since last sync.
    if (l.deleted && r.deleted) { merged.push(newer(l, r)); continue; }
    if (l.deleted !== r.deleted) { merged.push(l.deleted ? r : l); continue; } // an edit beats a delete
    const winner = newer(l, r);
    const loser = winner === l ? r : l;
    merged.push(winner);
    const copy = makeConflictCopy(loser);
    merged.push(copy);
    conflicts.push(copy);
  }
  return { merged, conflicts };
}

/** Newer by updatedAt; ties go to remote (second argument) for determinism. */
function newer<T extends SyncedEntity>(local: T, remote: T): T {
  return local.updatedAt > remote.updatedAt ? local : remote;
}

/** Import rule (backup files): newer record wins, nothing is deleted, no conflict copies. */
export function importRecords<T extends SyncedEntity>(local: T[], incoming: T[]): { merged: T[]; changed: number } {
  const byId = new Map(local.map((r) => [r.id, r]));
  let changed = 0;
  for (const rec of incoming) {
    const cur = byId.get(rec.id);
    if (!cur || rec.updatedAt > cur.updatedAt) {
      byId.set(rec.id, rec);
      changed++;
    }
  }
  return { merged: [...byId.values()], changed };
}
