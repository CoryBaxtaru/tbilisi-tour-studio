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
- Date: 2026-10-21 (session 02, parts 2–4)
- Summary: Zero-cost PWA live on GitHub Pages; added the card deck tour builder (58 OSM-located Tbilisi sites with era, tour-type and district tags; drag into the route, drag to reorder, automatic walking routes).
- Breakdown: `docs/session-breakdowns/session-2026-10-21-02.md`

## Decisions that matter now
- Never paid services or billing (CLAUDE.md). Check limits in `docs/HOSTING.md` before adding any service.
- OSM tiles are never cached for offline use (policy). Routes are calculated during planning and stored in the tour.
- UI direction: `.interface-design/system.md`.
- Hooks check handoff freshness only.

## Tests and verification
- `npm test`: 32 passed. `npm run build`: clean.
- Live deploy: page, manifest, service worker and precache verified over HTTPS.
- Browser (production build): main workflow, offline reload, update prompt, import, simulated GPS, live GitHub 401 path.
- Not verified: full sync with a real token, real-phone GPS, iOS install, export download.

## Blockers / unfinished work
- Card deck work is not committed or deployed yet (commit and push to deploy).
- Catalogue names, notes and tags are unverified suggestions: founder review via `docs/CATALOG.md`.
- Founder must create the fine-grained token (steps in `docs/HOSTING.md`).

## Next recommended task
Commit and push the card deck → founder reviews catalogue tags → founder sets up the sync token on laptop and phone (`docs/HOSTING.md`) → walk-test. Later: an offline Tbilisi basemap (PMTiles) and landmark sources/knowledge base.
