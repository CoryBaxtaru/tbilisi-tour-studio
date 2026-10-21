// Rewrites the "Review list" table at the end of docs/CATALOG.md from src/data/tbilisi-sites.json.
// Run: node scripts/catalog-table.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const { sites } = JSON.parse(readFileSync('src/data/tbilisi-sites.json', 'utf8'));
const tagsSrc = readFileSync('src/domain/tags.ts', 'utf8');
const label = Object.fromEntries([...tagsSrc.matchAll(/id: '([^']+)', label: '([^']+)'/g)].map((m) => [m[1], m[2]]));

const rows = sites.map((s) => `| ${[
  s.name,
  label[s.district] ?? s.district,
  s.eras.map((e) => label[e]).join(', ') || '—',
  s.themes.map((t) => label[t]).join(', '),
  `[${s.osm}](https://www.openstreetmap.org/${s.osm})`,
].join(' | ')} |`);

const doc = readFileSync('docs/CATALOG.md', 'utf8');
const head = doc.slice(0, doc.indexOf('## Review list'));
const table = ['## Review list', '', '| Kaart | Wijk | Tijdperk (voorstel) | Soort tour (voorstel) | OSM |', '|---|---|---|---|---|', ...rows, ''].join('\n');
writeFileSync('docs/CATALOG.md', head + table);
console.log(`${rows.length} rows written`);
