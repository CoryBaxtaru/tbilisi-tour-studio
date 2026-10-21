# Handoff hooks

Project-scoped Claude Code hooks that support (not guarantee) the mandatory handoff in `CLAUDE.md`.

## Files
- `.claude/settings.json` — registers `SessionStart` and `Stop` hooks.
- `.claude/hooks/handoff.mjs` — single Node script (Node ≥18, no dependencies).
- `.claude/state/current-session.json` — per-session start time (gitignored).

## Behavior
- **SessionStart** (startup/resume/clear/compact): records the session start time (kept on resume/compact of the same session) and injects a short reminder naming today's breakdown file to use.
- **Stop**: scans project file mtimes (skips `.git`, `node_modules`, `dist`, `build`, `coverage`, `.claude/state`; max 5000 files). If any work file changed this session and either `handoff.md` is older than that change or no session breakdown in `docs/session-breakdowns/` was updated after it (any date, so a session crossing midnight keeps its own file), it returns `decision: block` once with the reason. `handoff.md` counts as fresh if updated within 60 s before the latest work change (docs edited in one batch). `stop_hook_active` prevents loops.
- Fails open: any error exits 0 silently. No tests, network or heavy work.

## Limitations
- Checks freshness only, not content quality. Claude must still verify the handoff.
- Stop fires at the end of every turn, so mid-session turns that edit files also get one reminder; keep those updates small.
- Hooks load at session start; edits to `settings.json` may need a new session (or review via `/hooks` in an interactive terminal).
- Dates use the local machine clock. Since 2026-10-22 the breakdown check is date-independent (it previously required a file named after today, which broke after midnight).

## Fallback
If hooks are disabled or fail, follow the manual end-of-session workflow in `CLAUDE.md`. To disable, remove the entries from `.claude/settings.json`.

## Manual test
```bash
echo '{"session_id":"x"}' | node .claude/hooks/handoff.mjs stop
```
