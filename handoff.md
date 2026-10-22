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
- Date: 2026-10-22 (session 01)
- Summary: Deployed the card deck improvements (proximity sort, map focus, sourced "Toon meer", pre-generated tours) as commit `9898329`; verified live.
- Breakdown: `docs/session-breakdowns/session-2026-10-22-01.md` (feature details: `session-2026-10-21-02.md` part 5)

## Decisions that matter now
- Never paid services or billing (CLAUDE.md). Check limits in `docs/HOSTING.md` before adding any service.
- OSM tiles are never cached for offline use (policy). The offline map is the self-hosted Protomaps extract `public/maps/tbilisi-20261020.pmtiles`; refreshing it is a manual step (`docs/HOSTING.md`). Routes are calculated during planning and stored in the tour.
- UI direction: `.interface-design/system.md`.
- Hooks check handoff and breakdown freshness only (date-independent since 2026-10-22).

## Tests and verification
- `npm test`: 43 passed. `npm run build`: clean.
- Live deploy: page, manifest, service worker and precache verified over HTTPS; card deck (commit 119faa9) deployed, the update prompt switched the live site to the new version, and the deck showed 58 cards; commit 9898329 deployed, and the live site shows 12 suggested tours.
- Browser (production build): main workflow, offline reload, update prompt, import, simulated GPS, live GitHub 401 path.
- Real devices (2026-10-22): founder reports sync both ways, phone install, offline, GPS and the card deck all work; the data repo history confirms laptop and phone syncs.
- Not verified: export download in the UI; GPS accuracy figures and phone model unrecorded.

## Blockers / unfinished work
- Catalogue names, notes and tags are unverified suggestions: founder review via `docs/CATALOG.md`.
- Sync token is set up on both devices. The founder chose to keep using a token that was pasted into the chat once; revoke and replace it if the transcript is ever shared. Renew it before it expires.

## Next recommended task
The offline Tbilisi map is built and verified locally but not committed or deployed. Next: deploy it, check Range requests on GitHub Pages, then the founder taps "Kaart offline opslaan" on the phone and tests in airplane mode. After that, the research → verified talking points workflow. The founder can review catalogue tags (`docs/CATALOG.md`) at any time.
