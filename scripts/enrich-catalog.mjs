// Adds sourced background info ("Toon meer") to src/data/tbilisi-sites.json:
//  1. Wikidata id from each site's OpenStreetMap object (wikidata tag) via Nominatim lookup (1 req/s).
//  2. Wikidata facts (CC0): inception, architect, style, heritage status, named after.
//  3. Wikipedia lead section (CC BY-SA 4.0): Dutch if an article exists, otherwise English.
// Text is stored with title, URL, language, licence and retrieval date. Run: node scripts/enrich-catalog.mjs
// Optional: --wikidata id=Q123,id2=Q456 to set Wikidata ids by hand where OSM has none (check them!).
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'src/data/tbilisi-sites.json';
const UA = 'TbilisiTourStudio/0.1 (personal project; https://github.com/CoryBaxtaru/tbilisi-tour-studio)';
const MAX_EXTRACT = 1400; // keep it an excerpt: cut at a sentence boundary
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
};

const data = JSON.parse(readFileSync(FILE, 'utf8'));
const manual = Object.fromEntries(
  (process.argv.includes('--wikidata') ? process.argv[process.argv.indexOf('--wikidata') + 1].split(',') : []).map((p) => p.split('=')),
);
const today = new Date().toISOString().slice(0, 10);

// 1. Wikidata ids from OSM tags.
const ids = {};
for (const s of data.sites) {
  if (manual[s.id]) { ids[s.id] = { qid: manual[s.id], via: 'handmatig' }; continue; }
  if (s.info?.wikidata) { ids[s.id] = { qid: s.info.wikidata, via: s.info.wikidataVia ?? 'osm' }; continue; }
  const [type, num] = s.osm.split('/');
  const hit = (await get(`https://nominatim.openstreetmap.org/lookup?osm_ids=${type[0].toUpperCase()}${num}&format=jsonv2&extratags=1`))[0];
  await sleep(1100);
  const qid = hit?.extratags?.wikidata ?? hit?.extratags?.['brand:wikidata'];
  if (qid) ids[s.id] = { qid, via: 'osm' };
  console.log(`${s.id.padEnd(24)} ${qid ?? '— geen wikidata-tag in OSM'}`);
}

// 2. Wikidata entities (batches of 50).
const qids = [...new Set(Object.values(ids).map((x) => x.qid))];
const entities = {};
for (let i = 0; i < qids.length; i += 50) {
  const r = await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels|claims|sitelinks&languages=nl|en&ids=${qids.slice(i, i + 50).join('|')}`);
  Object.assign(entities, r.entities);
}
const PROPS = { P571: 'Gebouwd / opgericht', P84: 'Architect', P149: 'Bouwstijl', P1435: 'Erfgoedstatus', P138: 'Vernoemd naar' };
const refIds = new Set();
for (const e of Object.values(entities)) for (const p of Object.keys(PROPS)) for (const c of e.claims?.[p] ?? []) {
  const v = c.mainsnak?.datavalue?.value;
  if (v?.id) refIds.add(v.id);
}
const refLabels = {};
const refList = [...refIds];
for (let i = 0; i < refList.length; i += 50) {
  const r = await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=nl|en&ids=${refList.slice(i, i + 50).join('|')}`);
  for (const [id, e] of Object.entries(r.entities)) refLabels[id] = e.labels?.nl?.value ?? e.labels?.en?.value ?? id;
}

function formatTime(v) {
  // Wikidata time: "+1851-00-00T00:00:00Z", precision 9 = year, 8 = decade, 7 = century, 11 = day.
  const m = /^([+-])(\d+)-(\d\d)-(\d\d)/.exec(v.time);
  if (!m) return null;
  const year = Number(m[2]) * (m[1] === '-' ? -1 : 1);
  if (v.precision >= 11) return `${Number(m[4])}-${Number(m[3])}-${year}`;
  if (v.precision === 10) return `${Number(m[3])}-${year}`;
  if (v.precision === 9) return String(year);
  if (v.precision === 8) return `jaren ${Math.floor(year / 10) * 10}`;
  if (v.precision === 7) return `${Math.ceil(year / 100)}e eeuw`;
  return null;
}

function facts(e) {
  const out = [];
  for (const [p, label] of Object.entries(PROPS)) {
    const vals = (e.claims?.[p] ?? [])
      .filter((c) => c.rank !== 'deprecated')
      .map((c) => c.mainsnak?.datavalue?.value)
      .filter(Boolean)
      .map((v) => (v.time ? formatTime(v) : v.id ? refLabels[v.id] : null))
      .filter(Boolean);
    if (vals.length) out.push({ label, value: [...new Set(vals)].join(', ') });
  }
  return out;
}

// 3. Wikipedia intros, Dutch first.
async function extract(lang, title) {
  const r = await get(`https://${lang}.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(title)}`);
  const page = Object.values(r.query.pages)[0];
  let text = (page.extract ?? '').replace(/\n{2,}/g, '\n').trim();
  let truncated = false;
  if (text.length > MAX_EXTRACT) {
    const cut = text.slice(0, MAX_EXTRACT);
    text = cut.slice(0, Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n')) + 1);
    truncated = true;
  }
  return text ? { lang, title: page.title, url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`, extract: text, truncated } : null;
}

for (const s of data.sites) {
  const ref = ids[s.id];
  const e = ref && entities[ref.qid];
  if (!e || e.missing !== undefined) { delete s.info; continue; }
  let wiki = null;
  for (const lang of ['nl', 'en']) {
    const title = e.sitelinks?.[`${lang}wiki`]?.title;
    if (!title) continue;
    wiki = await extract(lang, title);
    await sleep(200);
    if (wiki) break;
  }
  s.info = {
    wikidata: ref.qid,
    wikidataVia: ref.via,
    wikidataLabel: e.labels?.nl?.value ?? e.labels?.en?.value ?? '',
    facts: facts(e),
    wiki,
    retrievedAt: today,
  };
}

data.infoSource = 'Achtergrond: Wikipedia (tekst CC BY-SA 4.0, per kaart titel en link) en Wikidata (CC0). Koppeling via de wikidata-tag in OpenStreetMap.';
writeFileSync(FILE, JSON.stringify(data, null, 1) + '\n');
const withInfo = data.sites.filter((s) => s.info);
console.log(`\ninfo: ${withInfo.length}/${data.sites.length}; nl: ${withInfo.filter((s) => s.info.wiki?.lang === 'nl').length}, en: ${withInfo.filter((s) => s.info.wiki?.lang === 'en').length}, zonder tekst: ${withInfo.filter((s) => !s.info.wiki).length}`);
console.log('zonder wikidata:', data.sites.filter((s) => !s.info).map((s) => s.id).join(', ') || 'geen');
