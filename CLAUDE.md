# Tbilisi Walking Tour Studio — Claude Code Instructions

## Mission
Build a reliable personal tool for designing Dutch-language historical walking tours in Tbilisi on a laptop and guiding them on a phone. The founder is the product owner. Be a pragmatic engineering partner: challenge unnecessary complexity, protect working functionality, and prioritize useful software over elaborate plans.

## Start of every session
1. Read this file.
2. Read `handoff.md` if present.
3. Inspect `git status` and the current branch.
4. Inspect only files relevant to the task.
5. Consult `docs/PROJECT_STATE.md` and `docs/PRODUCT_SPEC.md` when relevant; do not load them automatically if they are not needed.
6. Continue from existing work. Do not repeat completed research or diagnostics without a reason.

## Product requirements
The complete product requirements live in `docs/PRODUCT_SPEC.md`. Key outcomes:
- Desktop tour editor with tour management, map, editable stop cards, talking points, research and timing.
- Mobile live-guiding mode with GPS, current/next stop, arrival notes, manual controls and graceful offline behavior.
- Dutch interface and Dutch presentation content; research can use any useful language.
- Recommendations balance actual pedestrian route quality and historical storytelling.
- Historical research is reusable across tours, with provenance and verification status.

## Zero-cost rule — non-negotiable
- Never use paid services, APIs, subscriptions, hosting or infrastructure. Never enable billing or add a credit card, not even for a "free" tier that requires one.
- Prefer services that stay free indefinitely. Non-commercial licences are acceptable (testing project, no revenue); note them in `docs/HOSTING.md`.
- Laptop and phone must share the same tours, landmarks, notes and routes. Current architecture: static PWA on GitHub Pages + local-first IndexedDB + sync to a private GitHub repo + JSON export/import. See `docs/HOSTING.md` before changing hosting, sync, maps or routing.
- Before adding any external service, check its real limits (quotas, sleep, storage, rate limits, caching/offline rules) and record them in `docs/HOSTING.md`.
- No secrets in client code or Git. User credentials (e.g. the sync token) are entered per device at runtime.

## Engineering rules
- Inspect the repository before choosing or changing the stack. If empty, choose the simplest maintainable architecture for a responsive, installable web app that supports mobile GPS and practical offline use.
- Implement incrementally. Do not scaffold the entire imagined product in one session.
- Prefer shared typed domain models, small testable functions, clear boundaries and existing conventions.
- Keep routing, geocoding, storage and research sources behind replaceable interfaces where practical.
- Prefer open data and free/open-source solutions, but verify licensing, attribution, commercial terms, rate limits, caching rules and real hosting costs. Public demo servers are not assumed production-ready.
- Never invent historical facts, source references, place coordinates, pedestrian routes, opening hours or navigation instructions. Distinguish facts, interpretations, anecdotes and uncertainty.
- Protect secrets. Avoid unnecessary dependencies, paid services, speculative features and unrelated refactors.
- Ask before destructive/irreversible actions, major architecture changes or significant recurring costs. Make routine reversible decisions without unnecessary questions.
- Never claim code, tests, builds, integrations or GPS behavior work unless appropriately verified.

## Token economy — critical
Optimize for total task efficiency, not merely the shortest answer.
- Use targeted file reads, searches, diffs and focused test commands.
- Do not reread the whole codebase, print huge files/tree listings/logs, repeat unchanged research or run expensive checks without cause.
- Reuse repository documentation, saved research and existing dependencies.
- Keep plans, progress updates and final reports concise.
- Load only the product/spec/state material needed for the current task.
- Never save tokens by sacrificing correctness, security, historical accuracy or essential tests.
- If blocked, state the exact blocker and smallest useful next action.

## Task workflow
1. Identify the requested outcome and relevant existing implementation.
2. Choose the smallest complete change.
3. Implement using existing conventions.
4. Run focused tests and relevant checks.
5. Review the diff for regressions, accidental files and unnecessary complexity.
6. Update relevant documentation and project status.
7. Complete the mandatory handoff below.

## Mandatory session handoff
At the end of EVERY work session:
1. Update root `handoff.md`.
2. Create/update `docs/session-breakdowns/session-YYYY-MM-DD-NN.md` (increment `NN` for multiple sessions on the same date).
3. Record actual work, decisions, files changed, checks and results, blockers, and the next concrete task.
4. Verify the handoff files are actually updated. Never claim completion if this did not happen.
5. Preserve older breakdowns. Keep `handoff.md` a concise current snapshot; link to the latest breakdown rather than duplicating its history.

If work is interrupted, make the smallest useful handoff update before stopping. Do not report unfinished implementation or verification as complete.

### Lifecycle hooks
When practical, use Claude Code lifecycle hooks to support handoff reliability:
- First inspect the installed Claude Code version, project configuration and existing hooks.
- Prefer project-scoped, lightweight hooks and preserve existing configuration.
- Use supported lifecycle events to remind Claude to prepare the handoff and, where feasible, check that expected files exist or changed.
- Do not assume hooks can guarantee successful documentation or task completion.
- Do not run full tests, expensive scans or context-heavy tasks from a hook.
- Avoid duplicate reports from repeated hook invocations; update the current session record.
- Document setup and fallback behavior. Do not overwrite existing settings without understanding them.
- If reliable automation is not possible, keep the explicit end-of-session workflow above.

## Definition of done
A task is done only when the requested behavior is implemented (or limitations are explicit), relevant checks have been run and recorded, introduced regressions are addressed or explained, docs/handoff reflect reality, and the next useful step is clear.

## Communication
Be direct and concise. Challenge needless scope and explain meaningful trade-offs. At session start, state the task/approach briefly. At completion, report outcome, checks, limitations and next step. Minimize routine narration.
