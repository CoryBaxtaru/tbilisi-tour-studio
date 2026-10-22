# Session Handoff

> Keep this file short, current and actionable. Update it at the end of every Claude Code work session. Do not guess: use `Unknown` when the repository has not been inspected.

## Project
Tbilisi Walking Tour Studio — desktop tour design and mobile live guiding for Dutch-language historical walking tours in Tbilisi.

## Current state
- Phase: first working app (editor, map and routes, guide mode, sync, offline PWA). Details in `docs/PROJECT_STATE.md`.
- Hosting and sync design: `docs/HOSTING.md` (GitHub Pages + private GitHub data repo + IndexedDB, zero cost).
- Branch / Git state: `main`, pushed to https://github.com/CoryBaxtaru/tbilisi-tour-studio (public). Data repo: CoryBaxtaru/tbilisi-tour-data (private). Commits use the GitHub noreply address.
- Live app: https://corybaxtaru.github.io/tbilisi-tour-studio/ (deploys automatically on every push to `main`).
- Run locally: `npm install`, `npm test`, `npm run build`, then `npx vite preview` (or the `preview` entry in `.claude/launch.json`).

## Latest session
- Date: 2026-10-23 (session 01):
  - Business hub plan: the vision widened to a founder-only business hub; the plan, prices and build order are in the private data repo (`business/HUB_PLAN.md`; see CLAUDE.md); the licence check is in `docs/HOSTING.md`. CLAUDE.md and the spec are updated (commercial-use rule).
  - Then step 2: 52 new source-checked claims, so all 58 sites have ≥ 3 (203 total). New stops auto-get 3 starter talking points. Deployed as `f138839`, verified live.
  - The business plan moved from the public code repo to the private data repo, and the public history was rewritten and force-pushed without it (main = `fc2a343`; old commits may stay reachable by ID on GitHub until purged). Local backup branch: `backup-before-plan-rewrite`. Breakdown: `docs/session-breakdowns/session-2026-10-23-01.md`.
- Previous: 2026-10-22 (session 01)
- Summary:
  - Deployed the card deck improvements (`9898329`) and the offline map (`7ea9b2e`).
  - Built and deployed the research panel ("Onderzoek", commit `236470b`, verified live) with 151 concept claims for 53 sites, checked in the original sources, never Wikipedia.
  - After founder feedback: one spelling convention for the drafts (Jerevan, Rustaveli, …) and Wikipedia previews on 76 names and places (bundled, offline). Deployed as `4cfd8dd`, verified live.
  - Source links per claim collapsed behind "Bronnen (n)" (founder feedback). Deployed as `ea1d202`, verified live. "Vernieuwen" now reloads itself after 1.5 s if the update didn't reload the page (`83524ea`, live).
- Breakdown: `docs/session-breakdowns/session-2026-10-22-01.md`. Research method, corrections and dropped claims: `docs/RESEARCH.md`.

## Decisions that matter now
- Never paid services or billing (CLAUDE.md). Check limits in `docs/HOSTING.md` before adding any service.
- OSM tiles are never cached for offline use (policy). The offline map is the self-hosted Protomaps extract `public/maps/tbilisi-20261020.pmtiles`; refreshing it is a manual step (`docs/HOSTING.md`). Routes are calculated during planning and stored in the tour.
- UI direction: `.interface-design/system.md`.
- Hooks check handoff and breakdown freshness only (date-independent since 2026-10-22).
- Wikipedia/Wikidata are never a source for talking points (founder's rule). Concept claims live in `src/data/research-drafts.json` and stay virtual until the guide acts on one. Keep their ids stable.

## Tests and verification
- `npm test`: 50 passed. `npm run build` succeeds, with Vite's chunk-size warning (578 kB / 172 kB gzip).
- Research panel: tested on a local production build (desktop and 375 px). Live since `236470b`: the update prompt works, the counts are 58/53/5, a site page renders with its sources, and there are no console errors. Not yet tested on a real phone or for claim sync between devices.
- Live deploy: page, manifest, service worker and precache verified over HTTPS; card deck (commit 119faa9) deployed, the update prompt switched the live site to the new version, and the deck showed 58 cards; commit 9898329 deployed, and the live site shows 12 suggested tours.
- Browser (production build): main workflow, offline reload, update prompt, import, simulated GPS, live GitHub 401 path.
- Real devices (2026-10-22): founder reports sync both ways, phone install, offline, GPS and the card deck all work; the data repo history confirms laptop and phone syncs.
- Not verified: export download in the UI; GPS accuracy figures and phone model unrecorded.

## Blockers / unfinished work
- Catalogue names, notes and tags are unverified suggestions: founder review via `docs/CATALOG.md`.
- Concept claims need the founder's verification under Onderzoek. Five sites have no claims yet.
- nplg.gov.ge (Kvirkvelia links) sometimes answers 502; reload.
- Sync token is set up on both devices. The founder chose to keep using a token that was pasted into the chat once; revoke and replace it if the transcript is ever shared. Renew it before it expires.

## Next recommended task
1. Step 3 of the business plan: tour products, departures and calendar with slots, and bookings entered by hand. The founder still needs to pick the customer-data retention period and the languages.
4. Still open on the founder's side: verify claims under Onderzoek; phone test of the offline map.
