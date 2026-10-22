import { describe, expect, it } from 'vitest';
import data from '../data/wiki-terms.json';
import { linkTerms, type WikiTerm } from './wikiTerms';

const t = (title: string): WikiTerm => ({ lang: 'nl', title, url: `https://nl.wikipedia.org/wiki/${title}`, description: '', extract: 'x', truncated: false });
const TERMS = { 'Agha Mohammad': t('A'), 'Agha Mohammad Khan': t('AK'), Lenin: t('Lenin'), Sioni: t('Sioni') };

describe('linkTerms', () => {
  it('links the longest phrase and never inside a word', () => {
    const parts = linkTerms('Agha Mohammad Khan verwoestte het; het Leninplein bij Sionistraat.', TERMS);
    expect(parts).toEqual(['', { text: 'Agha Mohammad Khan', term: TERMS['Agha Mohammad Khan'] }, ' verwoestte het; het Leninplein bij Sionistraat.'].filter(Boolean));
  });

  it('links each subject once', () => {
    const linked = linkTerms('Lenin, en later weer Lenin.', TERMS).filter((p) => typeof p !== 'string');
    expect(linked).toHaveLength(1);
  });

  it('returns plain text unchanged when nothing matches', () => {
    expect(linkTerms('Geen namen hier.', TERMS)).toEqual(['Geen namen hier.']);
  });
});

describe('wiki-terms data', () => {
  it('has a Wikipedia URL and a lead for every term', () => {
    for (const [phrase, term] of Object.entries(data.terms)) {
      expect(term.url, phrase).toMatch(/^https:\/\/(nl|en)\.wikipedia\.org\/wiki\//);
      expect(term.extract.length, phrase).toBeGreaterThan(20);
    }
  });
});
