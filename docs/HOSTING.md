# Hosting, sync and cross-device access (zero cost)

Decision date: 2026-10-21. Rule: no paid services, no billing accounts, no credit cards (see `CLAUDE.md`).

## Architecture
```
Laptop browser ─┐                          ┌─ GitHub Pages (public repo): static PWA, HTTPS
                ├─ same app URL ───────────┤
Phone (PWA)   ──┘                          └─ api.github.com → private repo tbilisi-tour-data
   │                                                  data/tours.json (every sync = a commit)
   └─ IndexedDB: full local copy on each device (works offline)
```
- **App:** static Vite + Preact + TypeScript PWA. No backend, no secrets in the code.
- **Data:** local-first in IndexedDB on each device. Sync copies a single JSON file to a **private** GitHub repository via the REST contents API, with a fine-grained token entered per device.
- **Merge:** per record, three-way against the last sync. If both devices changed the same tour or landmark, the newer one wins and the other is kept as a visible "(conflictkopie)". Deletions are tombstones, and an edit beats a concurrent delete. The sha check prevents blind overwrites (retried up to 3 times).
- **Backups:** (1) the Git history of the data repo, where every sync is a restorable version; (2) the "Back-up downloaden" JSON export and import in Instellingen; (3) the local copy on each device.
- **Routing:** FOSSGIS OSRM foot profile, calculated on the laptop when planning. Geometry, distance, duration and turn steps are stored in the tour, so the phone needs no routing service while walking.
- **Maps:** a self-hosted Protomaps vector extract of Tbilisi (`public/maps/tbilisi-YYYYMMDD.pmtiles`, about 10 MB), drawn with protomaps-leaflet. The user stores it on a device with "Kaart offline opslaan" (Cache Storage); it then works without signal. OpenStreetMap raster tiles sit underneath for online context outside the extract.

## Why this option
| Option | Verdict |
|---|---|
| **GitHub Pages + private GitHub repo as sync store** | **Chosen.** One free account, no card, HTTPS, versioned data history, no server to maintain, CORS-enabled API (tested). |
| Cloudflare Pages + Workers/D1 | Free without a card and allows private code, but needs a custom API, auth and deployment secrets. More to maintain. Best fallback if GitHub stops fitting. |
| Supabase free | Free projects pause after a period of inactivity (not re-verified this session). Risky for a tool used occasionally. |
| Firebase Spark | Free, but a proprietary SDK and Google lock-in. Heavier than needed. |
| Netlify / Vercel free | Fine static hosting, but no storage. Vercel Hobby is non-commercial only. Adds nothing over Pages here. |
| Self-hosting on the laptop | The phone needs HTTPS for GPS and installation, and the laptop isn't with you on a walk. Rejected. |

## Verified limits (checked 2026-10-21)
- **GitHub Pages:** site ≤ 1 GB, soft limit 100 GB/month bandwidth. Not meant for commercial transaction sites; personal use is fine. Deploys through Actions, so the 10 builds/hour limit doesn't apply. On GitHub Free, Pages needs a **public** repository (from GitHub's plan docs; not re-verified on the page this session). That's why the code repo is public and the data repo is private. The code contains no secrets or personal data.
- **GitHub REST API:** CORS allows browser calls from any origin (tested with a preflight). Authenticated rate limit is 5,000 requests/hour per user. Sync uses about 2 requests per round. Files over 1 MB are read through the blob API (handled).
- **Fine-grained token:** can be limited to one repository with **Contents: Read and write**; expiry up to 366 days or none.
- **FOSSGIS routing** (`routing.openstreetmap.de`, foot profile): free, max 1 request/second (enforced in code), no heavy use, attribution required (shown on the map). No uptime guarantee: when it's down, routes can't be recalculated, but stored routes keep working.
- **OSM tiles** (`tile.openstreetmap.org`): attribution required. **Offline use and prefetching are not permitted**, so the service worker deliberately does not cache tiles. Only the browser's normal HTTP cache applies.
- **Fonts:** Literata and Public Sans (SIL OFL), self-hosted and precached.
- **Nominatim** (`nominatim.openstreetmap.org`): used **only at build time** by `scripts/build-catalog.mjs` to geocode the site catalogue. Max 1 request/s with an identifying User-Agent; never called by the app. The resulting catalogue is ODbL (see `docs/CATALOG.md`).
- **Wikidata and Wikipedia APIs**: used **only at build time** by `scripts/enrich-catalog.mjs` and `scripts/build-wiki-terms.mjs` (name previews, about 150 requests per run) (identifying User-Agent, a few dozen requests). **Overpass** was used once, by hand, to find the cable car station.
- **Research sources** (2026-10-22): the Georgian heritage register (`memkvidreoba.gov.ge`, public ArcGIS REST service, no key), the National Parliamentary Library's online dictionary (`nplg.gov.ge`) and the web sources Wikipedia cites were read **only during the research session**, with an identifying User-Agent. The app never calls them; it only links to them (`docs/RESEARCH.md`).
- **Protomaps basemap** (checked 2026-10-22): daily world builds at `build.protomaps.com/YYYYMMDD.pmtiles` (about 139 GB). The data is an ODbL Produced Work and needs OpenStreetMap attribution. Protomaps discourages hotlinking and recommends copying or extracting to your own hosting, which this project does. `pmtiles extract` downloads only the needed byte ranges (about 10 MB for Tbilisi). The served file is static on GitHub Pages; GitHub Pages serves it with `Accept-Ranges: bytes`, correct 206 partial responses, no compression and `Cache-Control: max-age=600` (verified 2026-10-22; the served file's SHA-256 matches the repo copy). Each refresh adds about 10 MB to the code repo's history, so refresh rarely (a few times a year is plenty).
- **Licences:** Leaflet BSD-2, Preact MIT, idb ISC, SortableJS MIT, protomaps-leaflet BSD-3, pmtiles BSD-3, Workbox/vite-plugin-pwa MIT. Catalogue data: positions ODbL (OpenStreetMap); background text CC BY-SA 4.0 (Wikipedia, attributed per card); facts CC0 (Wikidata). Research drafts (`src/data/research-drafts.json`): Claude's own Dutch phrasing with short summaries of, and links to, the sources; no source text is copied. No non-commercial licences are currently in use.

## Online vs. offline
| Works offline (after the app has been opened once) | Needs internet |
|---|---|
| App itself (precached by the service worker) | Map outside the Tbilisi extract (OSM tiles) |
| All tours, landmarks, talking points, arrival notes, "Toon meer", Onderzoek (claims and source titles) | Calculating a new walking route; opening source links |
| Stop positions, stored route lines, turn steps, walking times | Sync between devices |
| GPS position, distance to the next stop, arrival suggestions | First visit or install; storing the offline map |
| **Map of Tbilisi**, once stored via "Kaart offline opslaan" | |
| Export and import | |

GPS itself needs no data connection. It does need HTTPS, which GitHub Pages provides, and location permission.

## Security
- No API keys exist in the app. The only credential is the user's fine-grained token, entered per device and stored in that device's IndexedDB. It is never committed, never included in exports, and is removed by "Synchronisatie uitzetten".
- Scope the token to the single private data repo with Contents read/write only. If a device is lost, revoke the token on GitHub.
- A strict Content-Security-Policy allows scripts only from the app itself and network calls only to `api.github.com` and `routing.openstreetmap.de`. That limits what an injected script could do with the token.
- Location is used only while GPS is switched on in guide mode, and no location history is stored.

## Live
- App: https://corybaxtaru.github.io/tbilisi-tour-studio/
- Code: https://github.com/CoryBaxtaru/tbilisi-tour-studio (public)
- Data: https://github.com/CoryBaxtaru/tbilisi-tour-data (private)

Steps 1 and 2 below are done.

## Setup (one time)
1. **Publish the app.** Push this repo to a public GitHub repo with Pages source set to "GitHub Actions". `.github/workflows/deploy.yml` tests, builds and deploys on every push to `main`. The URL is `https://<user>.github.io/<repo>/`.
2. **Create the private data repo**, e.g. `tbilisi-tour-data` (private, with a README).
3. **Create a fine-grained token** (only you can do this) at github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token:
   - Repository access: *Only select repositories* → `tbilisi-tour-data`
   - Permissions → Repository → **Contents: Read and write**
   - Expiration: 366 days (put a reminder in your calendar), or your choice
4. **Laptop:** open the app URL → Instellingen → GitHub username, repo `tbilisi-tour-data`, path `data/tours.json`, paste the token → "Opslaan en synchroniseren". Optionally install it from the address-bar install icon.
5. **Phone:** open the same URL in Chrome (Android) or Safari (iPhone).
   - Android: menu → *App installeren* / *Toevoegen aan startscherm*.
   - iPhone: Share → *Zet op beginscherm*.
   - Open the installed app → Instellingen → same details and token. To avoid typing the token, use a password manager or temporarily paste it into a private note you delete afterwards.
6. Before a walk, open the tour on the phone once while online. That syncs the latest version and loads map tiles for the area while you look at it.

## Daily use and recovery
- Edits save locally at once. Sync runs about 15 seconds after an edit, when the app regains focus, when connectivity returns, and via "Nu synchroniseren". The status pill at the top shows the state.
- **Cleared browser data, or a new device:** set up sync again and all data comes back from the data repo. Without sync, import the latest backup file.
- **Bad edit synced:** restore an older `data/tours.json` from the data repo's history on GitHub, then download that version and import it.
- **Deployment:** never touches data. Data lives in IndexedDB and the data repo, not in the app repo. A new version shows a "Nieuwe versie beschikbaar" prompt instead of reloading in the middle of a tour.

## Known limitations
- The offline map covers only the extract area (west 44.732, south 41.673, east 44.842, north 41.783: all catalogue sites plus about 1 km). It has street detail up to zoom 15, and closer zooms are scaled up. Labels use English names where OSM has them, otherwise the Georgian name.

## Refreshing the offline map (manual, rare)
1. Get the `pmtiles` CLI (go-pmtiles, GitHub releases; BSD-3). Keep it outside the repo.
2. `pmtiles extract https://build.protomaps.com/<YYYYMMDD>.pmtiles public/maps/tbilisi-<YYYYMMDD>.pmtiles --bbox=44.732,41.673,44.842,41.783` (widen the bbox if new catalogue sites fall outside it).
3. Delete the old file in `public/maps/`. Update `MAP_FILE`, `MAP_SIZE_BYTES` and `MAP_DATA_DATE` in `src/map/offlineMap.ts`.
4. After deploying, devices show the map as "not stored" (new file name) and prompt to store it again. The old copy is deleted when the new one is stored.
- Conflict resolution is per whole tour or landmark, not per field. Device clocks decide "newer".
- Real-device GPS accuracy and iOS background behaviour are not yet tested: the screen must stay on and the app open. Arrival detection was only tested with simulated positions.
