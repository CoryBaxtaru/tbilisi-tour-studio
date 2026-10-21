# Session Handoff

> Keep this file short, current and actionable. Update it at the end of every Claude Code work session. Do not guess: use `Unknown` when the repository has not been inspected.

## Project
Tbilisi Walking Tour Studio — desktop tour design and mobile live guiding for Dutch-language historical walking tours in Tbilisi.

## Current state
- Phase: first working app (editor, map and routes, guide mode, sync, offline PWA). Details in `docs/PROJECT_STATE.md`.
- Hosting and sync design: `docs/HOSTING.md` (GitHub Pages + private GitHub data repo + IndexedDB, zero cost).
- Branch / Git state: `main`, local only (no remote yet). The app work since commit `14f8f23` is not yet committed.
- Run locally: `npm install`, `npm test`, `npm run build`, then `npx vite preview` (or the `preview` entry in `.claude/launch.json`).

## Latest session
- Date: 2026-10-21 (session 02, part 2)
- Summary: Zero-cost rule made permanent; built and browser-tested the PWA with local-first data, GitHub sync, export/import, routes and guide mode.
- Breakdown: `docs/session-breakdowns/session-2026-10-21-02.md`

## Decisions that matter now
- Never paid services or billing (CLAUDE.md). Check limits in `docs/HOSTING.md` before adding any service.
- OSM tiles are never cached for offline use (policy). Routes are calculated during planning and stored in the tour.
- UI direction: `.interface-design/system.md`.
- Hooks check handoff freshness only.

## Tests and verification
- `npm test`: 25 passed. `npm run build`: clean.
- Browser (production build): main workflow, offline reload, update prompt, import, simulated GPS, live GitHub 401 path.
- Not verified: full sync with a real token, real-phone GPS, iOS install, export download.

## Blockers / unfinished work
- Founder approval needed to create the public app repo and private data repo, push, and enable Pages.
- Founder must create the fine-grained token (steps in `docs/HOSTING.md`).
- Existing commits carry the personal email; decide whether to switch to the GitHub noreply address before publishing.

## Next recommended task
Publish (repos, push, Pages) → founder sets up the token on laptop and phone → round-trip sync test → walk-test on the phone. Then: an offline Tbilisi basemap (PMTiles) and the landmark knowledge base with sources.
