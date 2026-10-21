// Looks up catalogue sites in OpenStreetMap via Nominatim and writes src/data/tbilisi-sites.json.
// Nominatim policy: max 1 request/second, identifying User-Agent, no heavy use. One-off, ~60 requests.
// Data © OpenStreetMap contributors, ODbL. Run: node scripts/build-catalog.mjs [--only id1,id2]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { SITES } from './catalog-source.mjs';

const OUT = 'src/data/tbilisi-sites.json';
const UA = 'TbilisiTourStudio/0.1 (personal project; https://github.com/CoryBaxtaru/tbilisi-tour-studio)';
// Viewport around Tbilisi (search restriction only, not a coordinate claim).
const VIEWBOX = '44.65,41.85,45.05,41.60';

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { sites: [] };
const prevById = new Map(previous.sites.map((s) => [s.id, s]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function lookup(site) {
  const params = new URLSearchParams({ format: 'jsonv2', namedetails: '1', limit: '1', viewbox: VIEWBOX, bounded: '1', 'accept-language': 'en' });
  const url = site.osm
    ? `https://nominatim.openstreetmap.org/lookup?osm_ids=${site.osm}&format=jsonv2&namedetails=1&accept-language=en`
    : `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(site.q)}&${params}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const [hit] = await res.json();
  return hit ?? null;
}

const out = [];
const missing = [];
for (const site of SITES) {
  const base = { id: site.id, name: site.name, district: site.district, eras: site.eras, themes: site.themes, note: site.note };
  if (only && !only.includes(site.id) && prevById.has(site.id)) {
    out.push({ ...prevById.get(site.id), ...base });
    continue;
  }
  const hit = await lookup(site);
  await sleep(1100);
  if (!hit) {
    missing.push(site.id);
    continue;
  }
  const nd = hit.namedetails ?? {};
  out.push({
    ...base,
    nameKa: nd['name:ka'] ?? (/[Ⴀ-ჿ]/.test(nd.name ?? '') ? nd.name : ''),
    lat: Number(Number(hit.lat).toFixed(6)),
    lng: Number(Number(hit.lon).toFixed(6)),
    osm: `${hit.osm_type}/${hit.osm_id}`,
    osmName: hit.display_name,
    osmCategory: `${hit.category}/${hit.type}`,
  });
  console.log(`${site.id.padEnd(24)} ${hit.osm_type}/${hit.osm_id}  ${hit.display_name.slice(0, 90)}`);
}

mkdirSync('src/data', { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify(
    {
      source: 'Positions and Georgian names: © OpenStreetMap contributors (ODbL), via Nominatim. Names, tags and notes: suggestions, not verified.',
      // Full timestamp: catalogue landmarks use it as createdAt/updatedAt, so a newer build refreshes unedited copies.
      generatedAt: new Date().toISOString().replace(/\.\d+Z$/, '.000Z'),
      sites: out,
    },
    null,
    1,
  ) + '\n',
);
console.log(`\n${out.length} sites written to ${OUT}; not found: ${missing.join(', ') || 'none'}`);
