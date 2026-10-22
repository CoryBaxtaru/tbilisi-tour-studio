// Builds src/data/wiki-terms.json: per phrase in scripts/wiki-terms.mjs the Wikipedia lead (Dutch if it exists,
// else English) for hover/tap previews. Build time only; the app never calls Wikipedia.
// Usage: node scripts/build-wiki-terms.mjs   (prints each match's description: check it is the intended subject)
import { readFileSync, writeFileSync } from 'node:fs';
import { TERMS } from './wiki-terms.mjs';
const UA = 'TbilisiTourStudio/0.1 (personal, non-commercial; https://github.com/CoryBaxtaru/tbilisi-tour-studio)';
const MAX = 700;
const get = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cut = (s) => {
  if (s.length <= MAX) return { text: s, truncated: false };
  const i = s.lastIndexOf('. ', MAX);
  return { text: s.slice(0, i > 200 ? i + 1 : MAX), truncated: true };
};

const drafts = JSON.parse(readFileSync(new URL('../src/data/research-drafts.json', import.meta.url), 'utf8'));
const allText = Object.values(drafts.sites).flatMap((s) => s.claims.map((c) => c.text)).join('\n');
const out = {};
const cache = new Map();
for (const [phrase, enTitle] of Object.entries(TERMS)) {
  if (!new RegExp(`(^|[^\\p{L}])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'u').test(allText)) {
    console.log(`!! "${phrase}" komt in geen enkele tekst voor`);
  }
  try {
    let page = cache.get(enTitle);
    if (!page) {
      const q = await get(`https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=langlinks|pageprops&lllang=nl&titles=${encodeURIComponent(enTitle)}`);
      const p = Object.values(q.query.pages)[0];
      if (p.missing !== undefined) throw new Error(`bestaat niet: ${enTitle}`);
      if (p.pageprops && 'disambiguation' in p.pageprops) throw new Error(`doorverwijspagina: ${enTitle}`);
      const nl = p.langlinks?.[0]?.['*'];
      const lang = nl ? 'nl' : 'en';
      const title = nl ?? p.title;
      const s = await get(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
      const { text, truncated } = cut(s.extract ?? '');
      page = { lang, title: s.title, url: s.content_urls.desktop.page, description: s.description ?? '', extract: text, truncated, en: p.title };
      cache.set(enTitle, page);
      await sleep(150);
    }
    out[phrase] = page;
    console.log(`${phrase} → ${page.lang}:${page.title} — ${page.description || page.extract.slice(0, 80)}`);
  } catch (e) {
    console.log(`!! ${phrase}: ${e.message}`);
  }
}
writeFileSync(new URL('../src/data/wiki-terms.json', import.meta.url), JSON.stringify({
  retrievedAt: new Date().toISOString().slice(0, 10),
  licence: 'Tekst: Wikipedia, CC BY-SA 4.0 (titel en link per term).',
  terms: out,
}, null, 1) + '\n');
console.log(`${Object.keys(out).length}/${Object.keys(TERMS).length} termen`);
