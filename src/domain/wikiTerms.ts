// Names and places that get a Wikipedia preview (src/data/wiki-terms.json, built by scripts/build-wiki-terms.mjs).
// Background for reading only: Wikipedia is never a source for claims (docs/RESEARCH.md).
import data from '../data/wiki-terms.json';

export interface WikiTerm {
  lang: string;
  title: string;
  url: string;
  description: string;
  extract: string;
  truncated: boolean;
}

export type Segment = string | { text: string; term: WikiTerm };

const TERMS = data.terms as Record<string, WikiTerm>;
export const WIKI_RETRIEVED: string = data.retrievedAt;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Longest phrase first, so "Agha Mohammad Khan" wins over "Agha Mohammad"; never inside a word ("Leninplein").
const PATTERN = Object.keys(TERMS).sort((a, b) => b.length - a.length).map(escape).join('|');

/** Splits text into plain parts and linked names. Each name is linked only at its first occurrence. */
export function linkTerms(text: string, terms: Record<string, WikiTerm> = TERMS): Segment[] {
  const pattern = terms === TERMS ? PATTERN : Object.keys(terms).sort((a, b) => b.length - a.length).map(escape).join('|');
  if (!pattern || !text) return [text];
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, 'gu');
  const out: Segment[] = [];
  const seen = new Set<string>();
  let last = 0;
  for (const m of text.matchAll(re)) {
    const term = terms[m[0]];
    if (!term || seen.has(term.url)) continue;
    seen.add(term.url);
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push({ text: m[0], term });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
