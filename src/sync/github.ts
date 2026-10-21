// Remote copy in a private GitHub repository via the REST contents API.
// Free on GitHub Free, versioned (every sync is a commit = backup history), CORS-enabled.
// The token is entered by the user per device and stored only in that device's IndexedDB.
import { parseDataset } from '../storage/backup';
import type { Dataset } from '../domain/types';

export interface SyncConfig {
  owner: string;
  repo: string;
  path: string;
  token: string;
}

export interface RemoteFile {
  sha: string | null;
  dataset: Dataset | null;
}

export interface Remote {
  read(): Promise<RemoteFile>;
  /** Writes the file; `sha` must match the current remote version. Returns the new sha. */
  write(content: string, sha: string | null, message: string): Promise<string>;
}

export class SyncError extends Error {}
/** The remote changed between read and write; caller should re-read and merge again. */
export class StaleRemoteError extends SyncError {}

const API = 'https://api.github.com';

export class GitHubRemote implements Remote {
  constructor(private cfg: SyncConfig, private fetchImpl: typeof fetch = (...a) => fetch(...a)) {}

  private url(suffix = ''): string {
    const { owner, repo } = this.cfg;
    return `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${suffix}`;
  }

  private fileUrl(): string {
    const path = this.cfg.path.split('/').map(encodeURIComponent).join('/');
    return this.url(`/contents/${path}`);
  }

  private async call(url: string, init: RequestInit = {}): Promise<Response> {
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        ...init,
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.cfg.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
      });
    } catch {
      throw new SyncError('Geen verbinding met GitHub.');
    }
    if (res.status === 401) throw new SyncError('Token ongeldig of verlopen. Maak een nieuw token aan.');
    if (res.status === 403) throw new SyncError('Token heeft geen schrijf-/leesrecht op deze repository (of limiet bereikt).');
    return res;
  }

  async read(): Promise<RemoteFile> {
    const res = await this.call(this.fileUrl());
    if (res.status === 404) {
      const repo = await this.call(this.url());
      if (repo.status === 404) throw new SyncError('Repository niet gevonden of token heeft er geen toegang toe.');
      return { sha: null, dataset: null }; // repo exists, file not yet created
    }
    if (!res.ok) throw new SyncError(`GitHub gaf fout ${res.status}.`);
    const meta = (await res.json()) as { sha: string; content?: string; encoding?: string; size: number };
    let b64 = meta.encoding === 'base64' ? meta.content ?? '' : '';
    if (!b64 && meta.size > 0) {
      // Files over 1 MB come without inline content; fetch the blob instead.
      const blob = await this.call(this.url(`/git/blobs/${meta.sha}`));
      if (!blob.ok) throw new SyncError(`Kon groot bestand niet lezen (${blob.status}).`);
      b64 = ((await blob.json()) as { content: string }).content;
    }
    return { sha: meta.sha, dataset: parseDataset(decodeBase64Utf8(b64)) };
  }

  async write(content: string, sha: string | null, message: string): Promise<string> {
    const res = await this.call(this.fileUrl(), {
      method: 'PUT',
      body: JSON.stringify({ message, content: encodeBase64Utf8(content), ...(sha ? { sha } : {}) }),
    });
    if (res.status === 409 || res.status === 422) throw new StaleRemoteError('Remote is tussentijds gewijzigd.');
    if (!res.ok) throw new SyncError(`Opslaan op GitHub mislukt (${res.status}).`);
    return ((await res.json()) as { content: { sha: string } }).content.sha;
  }
}

export function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function decodeBase64Utf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
