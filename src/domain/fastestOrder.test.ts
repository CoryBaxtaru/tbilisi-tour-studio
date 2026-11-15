import { describe, expect, it } from 'vitest';
import { fastestOrder, orderCost, type Durations } from './fastestOrder';

/** Points on a line: walking time is the gap between them. */
const line = (xs: number[]): Durations => xs.map((a) => xs.map((b) => Math.abs(a - b)));

function bruteForce(d: Durations): number {
  const rest = [...Array(d.length).keys()].slice(1);
  let best = Infinity;
  const go = (order: number[], left: number[]) => {
    if (!left.length) { best = Math.min(best, orderCost(d, order)); return; }
    left.forEach((k, i) => go([...order, k], left.filter((_, j) => j !== i)));
  };
  go([0], rest);
  return best;
}

describe('fastest order', () => {
  it('keeps the first stop and sorts points on a line', () => {
    expect(fastestOrder(line([0, 5, 1, 3, 2, 4]))).toEqual([0, 2, 4, 3, 5, 1]);
  });

  it('matches brute force on uneven walking times', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 600;
    const d: Durations = Array.from({ length: 8 }, () => Array.from({ length: 8 }, rnd));
    for (let i = 0; i < 8; i++) d[i][i] = 0;
    const order = fastestOrder(d);
    expect(order[0]).toBe(0);
    expect(new Set(order).size).toBe(8);
    expect(orderCost(d, order)).toBeCloseTo(bruteForce(d));
  });

  it('avoids a pair without a route', () => {
    const d = line([0, 1, 2]);
    d[0][1] = null;
    expect(fastestOrder(d)).toEqual([0, 2, 1]);
  });

  it('handles long tours with the quick method', () => {
    const xs = [0, 20, 3, 17, 8, 1, 14, 6, 19, 11, 2, 16, 9, 4, 13, 7];
    const order = fastestOrder(line(xs));
    expect(order[0]).toBe(0);
    expect(orderCost(line(xs), order)).toBe(20);
  });

  it('keeps a ride joined to the stop after it', () => {
    // Stop 1 is a ride to stop 2; on foot, 2 would rather come last.
    const d = line([0, 1, 9, 2, 3]);
    expect(fastestOrder(d)).toEqual([0, 1, 3, 4, 2]);
    const joined = fastestOrder(d, new Set([1]));
    expect(joined[0]).toBe(0);
    expect(joined[joined.indexOf(1) + 1]).toBe(2);
    expect(new Set(joined).size).toBe(5);
  });

  it('leaves one or two stops alone', () => {
    expect(fastestOrder(line([0]))).toEqual([0]);
    expect(fastestOrder(line([0, 4]))).toEqual([0, 1]);
  });
});
