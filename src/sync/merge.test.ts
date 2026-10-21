import { describe, expect, it } from 'vitest';
import { importRecords, mergeRecords } from './merge';

type R = { id: string; createdAt: string; updatedAt: string; deleted?: boolean; v: string };
const rec = (id: string, updatedAt: string, v = updatedAt, deleted?: boolean): R => ({ id, createdAt: 't0', updatedAt, v, deleted });
const copy = (r: R): R => ({ ...r, id: `${r.id}-copy`, v: `${r.v} (copy)` });

describe('mergeRecords', () => {
  it('takes records that exist on one side only', () => {
    const { merged, conflicts } = mergeRecords([rec('a', 't1')], [rec('b', 't1')], {}, copy);
    expect(merged.map((r) => r.id)).toEqual(['a', 'b']);
    expect(conflicts).toEqual([]);
  });

  it('takes the changed side when only one side changed since base', () => {
    const base = { a: 't1', b: 't1' };
    const local = [rec('a', 't2'), rec('b', 't1')];
    const remote = [rec('a', 't1'), rec('b', 't3')];
    const { merged } = mergeRecords(local, remote, base, copy);
    expect(merged.map((r) => r.updatedAt)).toEqual(['t2', 't3']);
  });

  it('keeps a conflict copy when both sides changed', () => {
    const { merged, conflicts } = mergeRecords([rec('a', 't3', 'local')], [rec('a', 't2', 'remote')], { a: 't1' }, copy);
    expect(merged.find((r) => r.id === 'a')!.v).toBe('local');
    expect(conflicts.map((r) => r.v)).toEqual(['remote (copy)']);
    expect(merged).toHaveLength(2);
  });

  it('an edit beats a concurrent delete', () => {
    const { merged, conflicts } = mergeRecords([rec('a', 't2', 'del', true)], [rec('a', 't3', 'edit')], { a: 't1' }, copy);
    expect(merged).toEqual([rec('a', 't3', 'edit')]);
    expect(conflicts).toEqual([]);
  });

  it('propagates a delete when the other side did not change', () => {
    const { merged } = mergeRecords([rec('a', 't1')], [rec('a', 't2', 'x', true)], { a: 't1' }, copy);
    expect(merged[0].deleted).toBe(true);
  });

  it('keeps local records missing from the remote', () => {
    const { merged } = mergeRecords([rec('a', 't1')], [], { a: 't1' }, copy);
    expect(merged.map((r) => r.id)).toEqual(['a']);
  });
});

describe('importRecords', () => {
  it('adds new and replaces only older records', () => {
    const { merged, changed } = importRecords([rec('a', 't2', 'mine'), rec('b', 't1')], [rec('a', 't1', 'old'), rec('b', 't5', 'new'), rec('c', 't1')]);
    const byId = Object.fromEntries(merged.map((r) => [r.id, r.v]));
    expect(byId).toEqual({ a: 'mine', b: 'new', c: 't1' });
    expect(changed).toBe(2);
  });
});
