# Project State

> Claude: keep this document factual and concise. Update it as implementation changes. Do not invent progress. If the repository has not yet been inspected, leave implementation status marked unknown.

## Product
Tbilisi Walking Tour Studio: a personal desktop tour editor and mobile live-guiding tool for Dutch-language historical walking tours in Tbilisi.

## Current status (verified 2026-10-21)
- Phase: first working app. Tour builder, map and routing, mobile guiding, sync and offline (spec phases 2, 3, 6 and 7 in basic form).
- Repository: https://github.com/CoryBaxtaru/tbilisi-tour-studio (public). Live: https://corybaxtaru.github.io/tbilisi-tour-studio/. Data repo CoryBaxtaru/tbilisi-tour-data (private, empty until the first sync).
- Working (verified locally on a production build):
  - Tour CRUD and stop cards (shared landmark knowledge vs. tour-specific notes)
  - Card deck builder: 58 catalogue sites (OSM positions, unverified tags) + own landmarks; filter by era, tour type, district and text; drag cards into the route, drag the handle to reorder, + button, map-dot popup; automatic route recalculation; proximity sort to the last stop; card click flies the map to the site; "Toon meer" with sourced Wikipedia/Wikidata background (also in guide mode); pre-generated tours (11 themes + Tbilisi compleet + custom tags); catalogue refresh for unedited landmarks (docs/CATALOG.md)
  - Talking points with provenance stamps
  - Map placement of stops (Leaflet + OSM)
  - Offline Tbilisi map: self-hosted Protomaps extract (9.7 MB), stored per device via "Kaart offline opslaan"; verified rendering from the stored copy with the server stopped (local preview, 2026-10-22). Light style in the editor, dark in guide mode.
  - Pedestrian routes via FOSSGIS OSRM, stored per leg
  - Walk-and-talk ribbon and duration breakdown
  - Guide mode: next stop, arrival notes, manual controls, GPS with arrival suggestion (simulated positions only), stored turn steps
  - JSON export/import
  - PWA install manifest and offline app shell (tested with the server stopped)
  - Update prompt
  - GitHub sync: verified on real devices 2026-10-22. The founder tested laptop ↔ phone; the private data repo shows "Sync vanaf laptop" and "Sync vanaf telefoon" commits.
- Handoff hooks: Stop and SessionStart hooks both confirmed live. See `docs/HANDOFF_HOOKS.md`.
- Tests/build: `npm test` passes 43 unit tests; `npm run build` (tsc + vite) is clean.
- Real-device test (2026-10-22, founder-reported "it all works"): sync both ways, phone install, offline reopen, GPS in guide mode, card deck on the phone. Details (phone model, GPS accuracy) were not reported.
- Known blockers: none.

## Environment (verified)
- Windows 11, Claude Code 2.1.302, Node v24.20.0, npm 11.19, Git, gh 2.102 (logged in as `CoryBaxtaru`).

## Architecture (see docs/HOSTING.md)
- Frontend: Vite 8 + Preact 11 + TypeScript 7, hash routing, CSS tokens from `.interface-design/system.md`.
- Hosting: GitHub Pages via `.github/workflows/deploy.yml` (public code repo).
- Storage: IndexedDB (`idb`), local-first; `navigator.storage.persist()` requested.
- Sync: private GitHub repo via REST contents API, three-way per-record merge with conflict copies (`src/sync/`).
- Map: Leaflet; base = self-hosted Protomaps vector extract (`src/map/offlineMap.ts`, protomaps-leaflet, pmtiles 3.2.1), plus OSM raster tiles underneath online (never cached, by OSM policy).
- Routing: `RoutingProvider` interface; FOSSGIS OSRM foot (`src/routing/osrm.ts`).
- Geocoding: none yet (stops are placed by clicking the map; coordinates are never invented).
- Offline: vite-plugin-pwa/Workbox precache of the app shell and fonts; data in IndexedDB.
- Testing: Vitest (domain, merge, sync, GitHub client with mocked fetch, OSRM parsing, backup format).

## Important decisions
- 2026-10-21: Handoff hooks as a dependency-free Node script; freshness check only.
- 2026-10-21: Zero-cost rule made permanent (CLAUDE.md, spec §10a). GitHub Pages + private GitHub repo sync chosen over Cloudflare, Supabase and Firebase (reasons in HOSTING.md).
- 2026-10-21: Map tiles are never cached for offline use (OSM tile policy).
- 2026-10-21: Card deck uses SortableJS in pointer-fallback mode (same for mouse and touch); catalogue landmarks have fixed ids and timestamps so devices never conflict.
- 2026-10-21: Updates use a prompt, not auto-reload, so a tour in progress is never interrupted.

## Known issues and constraints
- The offline map covers only the extract area; refreshing it is manual (docs/HOSTING.md). The dark map style in guide mode is untested in sunlight.
- Catalogue names, notes and era/theme tags are unverified suggestions; the founder should review docs/CATALOG.md.
- Landmark sources, claim-level references and a separate knowledge-base page are not built yet. Talking points carry free-text sources.
- No stop-order suggestions yet (spec phase 4).
- Real-phone test reported as passing by the founder. Measured GPS accuracy and the device/OS are unrecorded; standby behaviour is untested.
- Stop hook reminds once per turn in which work files changed without a handoff update.

## Next step
Deploy the offline map (founder go-ahead), verify Range requests on GitHub Pages, and have the founder store the map on the phone and test with airplane mode. Then the research → verified talking points workflow.
