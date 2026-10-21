# Session Handoff

> Keep this file short, current and actionable. Update it at the end of every Claude Code work session. Do not guess: use `Unknown` when the repository has not been inspected.

## Project
Tbilisi Walking Tour Studio — desktop tour design and mobile live guiding for Dutch-language historical walking tours in Tbilisi.

## Current state
- Phase: Foundation — docs + handoff hooks; no application code or stack yet.
- Working implementation: Handoff hooks (script tested manually; live firing unconfirmed). See `docs/HANDOFF_HOOKS.md`.
- Branch / Git state: `main`, initial commit 74d1535 (repo-local author: nilas — change with `git config user.name`).

## Latest session
- Date: 2026-10-21 (session 02)
- Summary: Verified repo state, added SessionStart/Stop handoff hooks, initialized Git, reconciled docs.
- Breakdown: `docs/session-breakdowns/session-2026-10-21-02.md`

## Decisions that matter now
- Hooks support but don't guarantee handoff; they check file freshness only and fail open.
- Stack not chosen — founder decision required (spec §10–11).
- Historical research must be reusable and source-linked; routing, ordering, GPS and offline are distinct capabilities.

## Tests and verification
- Hook script: 8 manual scenarios passed in scratch dir.
- Application: none exists.

## Blockers / unfinished work
- Confirm the start-of-session hook reminder appears next session.

## Next recommended task
Founder picks the stack (suggested: Vite + TypeScript PWA, no backend initially). Then add typed Tour / Landmark / TourStop models from spec §4 with unit tests.
