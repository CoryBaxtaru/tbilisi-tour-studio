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
- Date: 2026-10-21 (session 02, parts 2–3)
- Summary: Built the zero-cost PWA, rewrote commits to the noreply address, created both repos, deployed to GitHub Pages and verified it live.
- Breakdown: `docs/session-breakdowns/session-2026-10-21-02.md`

## Decisions that matter now
- Never paid services or billing (CLAUDE.md). Check limits in `docs/HOSTING.md` before adding any service.
- OSM tiles are never cached for offline use (policy). Routes are calculated during planning and stored in the tour.
- UI direction: `.interface-design/system.md`.
- Hooks check handoff freshness only.

## Tests and verification
- `npm test`: 25 passed. `npm run build`: clean.
- Live deploy: page, manifest, service worker and precache verified over HTTPS.
- Browser (production build): main workflow, offline reload, update prompt, import, simulated GPS, live GitHub 401 path.
- Not verified: full sync with a real token, real-phone GPS, iOS install, export download.

## Blockers / unfinished work
- Founder must create the fine-grained token (steps in `docs/HOSTING.md`).

## Next recommended task
Founder sets up the token on laptop and phone → round-trip sync test → walk-test on the phone. Then: an offline Tbilisi basemap (PMTiles) and the landmark knowledge base with sources.
