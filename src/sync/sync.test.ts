import { describe, expect, it } from 'vitest';
import { createLandmark, createTour } from '../domain/factory';
import type { Dataset, Tour } from '../domain/types';
import { parseDataset } from '../storage/backup';
import { StaleRemoteError, decodeBase64Utf8, encodeBase64Utf8, GitHubRemote, type Remote, type RemoteFile } from './github';
import { syncOnce } from './sync';

class MemoryRemote implements Remote {
  content: string | null = null;
  sha = 0;
  writes = 0;
  failNextWrites = 0;
  async read(): Promise<RemoteFile> {
    return { sha: this.content ? String(this.sha) : null, dataset: this.content ? parseDataset(this.content) : null };
  }
  async write(content: string, sha: string | null): Promise<string> {
    if (this.failNextWrites > 0) { this.failNextWrites--; this.sha++; throw new StaleRemoteError('race'); }
    if ((this.content ? String(this.sha) : null) !== sha) throw new StaleRemoteError('sha mismatch');
    this.content = content;
    this.sha++;
    this.writes++;
    return String(this.sha);
  }
}

const withTitle = (t: Tour, title: string, updatedAt: string): Tour => ({ ...t, title, updatedAt });

describe('syncOnce', () => {
  it('two devices converge on the same data', async () => {
    const remote = new MemoryRemote();
    const laptopTour = createTour('Oude stad');
    const lm = createLandmark('Testpunt', null, null);
    const a = await syncOnce(remote, { tours: [laptopTour], landmarks: [lm], base: {} }, 'laptop');
    expect(a.wrote).toBe(true);

    const phone = await syncOnce(remote, { tours: [], landmarks: [], base: {} }, 'telefoon');
    expect(phone.wrote).toBe(false);
    expect(phone.tours.map((t) => t.title)).toEqual(['Oude stad']);
    expect(phone.landmarks.map((l) => l.name)).toEqual(['Testpunt']);
  });

  it('creates a conflict copy instead of overwriting', async () => {
    const remote = new MemoryRemote();
    const t = createTour('Basis');
    const first = await syncOnce(remote, { tours: [t], landmarks: [], base: {} }, 'laptop');
    // Phone edits and syncs; laptop edits offline with an older base.
    await syncOnce(remote, { tours: [withTitle(t, 'Telefoon', '2030-01-01T00:00:00.000Z')], landmarks: [], base: first.base }, 'telefoon');
    const laptop = await syncOnce(remote, { tours: [withTitle(t, 'Laptop', '2030-01-02T00:00:00.000Z')], landmarks: [], base: first.base }, 'laptop');
    expect(laptop.conflicts).toBe(1);
    expect(laptop.tours.map((x) => x.title).sort()).toEqual(['Laptop', 'Telefoon (conflictkopie)']);
  });

  it('retries when the remote changes during a write', async () => {
    const remote = new MemoryRemote();
    remote.failNextWrites = 1;
    const out = await syncOnce(remote, { tours: [createTour()], landmarks: [], base: {} }, 'laptop');
    expect(out.wrote).toBe(true);
    expect(remote.writes).toBe(1);
  });
});

describe('GitHubRemote', () => {
  const cfg = { owner: 'me', repo: 'data', path: 'data/tours.json', token: 'test-token' };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

  it('round-trips UTF-8 (Georgian and Dutch) through base64', () => {
    const s = 'ნარიყალა — één café';
    expect(decodeBase64Utf8(encodeBase64Utf8(s))).toBe(s);
  });

  it('treats a missing file in an existing repo as empty', async () => {
    const calls: string[] = [];
    const fake: typeof fetch = async (url) => {
      calls.push(String(url));
      return String(url).endsWith('/contents/data/tours.json') ? json(404, {}) : json(200, {});
    };
    expect(await new GitHubRemote(cfg, fake).read()).toEqual({ sha: null, dataset: null });
    expect(calls).toHaveLength(2);
  });

  it('reports a missing repo and a bad token clearly', async () => {
    await expect(new GitHubRemote(cfg, async () => json(404, {})).read()).rejects.toThrow(/Repository niet gevonden/);
    await expect(new GitHubRemote(cfg, async () => json(401, {})).read()).rejects.toThrow(/Token ongeldig/);
  });

  it('reads the file and sends the sha and auth header on write', async () => {
    const data: Dataset = { schemaVersion: 1, tours: [], landmarks: [] };
    let sent: { headers: Record<string, string>; body: any } | null = null;
    const fake: typeof fetch = async (_url, init) => {
      if (init?.method === 'PUT') {
        sent = { headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) };
        return json(200, { content: { sha: 'new' } });
      }
      return json(200, { sha: 'old', encoding: 'base64', size: 10, content: encodeBase64Utf8(JSON.stringify(data)) });
    };
    const r = new GitHubRemote(cfg, fake);
    expect((await r.read()).sha).toBe('old');
    expect(await r.write('{}', 'old', 'msg')).toBe('new');
    expect(sent!.body.sha).toBe('old');
    expect(sent!.headers.Authorization).toBe('Bearer test-token');
  });

  it('maps a sha mismatch to StaleRemoteError', async () => {
    const r = new GitHubRemote(cfg, async () => json(409, {}));
    await expect(r.write('{}', 'x', 'm')).rejects.toBeInstanceOf(StaleRemoteError);
  });
});
