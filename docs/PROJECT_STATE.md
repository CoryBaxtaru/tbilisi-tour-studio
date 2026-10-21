# Project State

> Claude: keep this document factual and concise. Update it as implementation changes. Do not invent progress. If the repository has not yet been inspected, leave implementation status marked unknown.

## Product
Tbilisi Walking Tour Studio: a personal desktop tour editor and mobile live-guiding tool for Dutch-language historical walking tours in Tbilisi.

## Current status (verified 2026-10-21)
- Phase: Foundation — documentation and session-handoff tooling only.
- Repository/stack: Git on `main`, initial commit 74d1535 (2026-10-21). No application code, package manifest or stack chosen.
- Working features: Handoff hooks (`SessionStart`, `Stop`) — script tested manually; Stop hook confirmed firing live 2026-10-21 (SessionStart not yet observed). See `docs/HANDOFF_HOOKS.md`.
- Tests/build status: No application tests or build exist.
- Known blockers: None. Stack decision pending (spec §10–11).

## Environment (verified)
- Windows 11, Claude Code 2.1.302, Node v24.20.0, Git (Git Bash).
- No user-level hooks in `~/.claude/settings.json`.

## Architecture
Record only verified decisions:
- Frontend: Not chosen.
- Backend/storage: Not chosen.
- Map/routing provider: Not chosen.
- Geocoding/place data: Not chosen.
- Offline strategy: Not chosen.
- Research/source storage: Not chosen.
- Testing: Not chosen.

## Important decisions
- 2026-10-21: Handoff hooks implemented as one dependency-free Node script (Node already installed; Python is only a Windows Store stub). Hooks check file freshness only.

## Known issues and constraints
- Stop hook reminds once per turn in which work files changed without a handoff update.

## Next step
Choose the minimal stack for an installable responsive web app (PWA) and add a typed domain model for Tour / Landmark / TourStop from spec §4, with unit tests. Ask the founder before committing to a stack.
