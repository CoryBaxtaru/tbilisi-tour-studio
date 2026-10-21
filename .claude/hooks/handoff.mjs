#!/usr/bin/env node
// Lightweight handoff support for Claude Code lifecycle hooks.
//   node handoff.mjs session-start  -> records session start, prints handoff reminder as context
//   node handoff.mjs stop           -> blocks once if work changed but handoff/breakdown did not
// Never runs tests or heavy scans. Fails open: any error exits 0 silently.
import fs from 'node:fs';
import path from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const stateFile = path.join(root, '.claude', 'state', 'current-session.json');
const handoffFile = path.join(root, 'handoff.md');
const breakdownDir = path.join(root, 'docs', 'session-breakdowns');
// Directories and files that never count as "work" for the stop check.
const IGNORE = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.claude/state']);
const MAX_FILES = 5000;

function readStdin() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { return {}; }
}

function mtime(file) {
  try { return fs.statSync(file).mtimeMs; } catch { return 0; }
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function breakdownsFor(date) {
  try {
    return fs.readdirSync(breakdownDir).filter((f) => f.startsWith(`session-${date}-`) && f.endsWith('.md')).sort();
  } catch { return []; }
}

function nextBreakdownName(date) {
  const nums = breakdownsFor(date).map((f) => parseInt(f.slice(`session-${date}-`.length), 10)).filter(Number.isFinite);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `session-${date}-${String(next).padStart(2, '0')}.md`;
}

function readState() {
  try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return null; }
}

// Newest mtime among work files (everything except handoff docs and ignored dirs).
function latestWorkChange() {
  let latest = 0, latestFile = null, count = 0;
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (count > MAX_FILES) return;
      const full = path.join(dir, e.name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (IGNORE.has(e.name) || IGNORE.has(rel)) continue;
      if (e.isDirectory()) { walk(full); continue; }
      count++;
      if (rel === 'handoff.md' || rel.startsWith('docs/session-breakdowns/')) continue;
      const m = mtime(full);
      if (m > latest) { latest = m; latestFile = rel; }
    }
  };
  walk(root);
  return { latest, latestFile };
}

function sessionStart(input) {
  const prev = readState();
  const sameSession = prev && input.session_id && prev.session_id === input.session_id;
  const state = sameSession ? prev : { session_id: input.session_id || null, startedAt: Date.now() };
  try {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch { /* fail open */ }

  const date = today();
  const existing = breakdownsFor(date);
  const lines = [
    '[handoff hook] Project session workflow reminder:',
    `- Read handoff.md first${fs.existsSync(handoffFile) ? '' : ' (MISSING — create it)'}.`,
    `- Today's breakdowns: ${existing.length ? existing.join(', ') : 'none'}. If this session does work, record it in ${sameSession && existing.length ? existing[existing.length - 1] : nextBreakdownName(date)} (template: docs/session-breakdowns/TEMPLATE.md).`,
    '- Before ending, update handoff.md and the breakdown; the Stop hook checks they changed after work files.',
  ];
  process.stdout.write(lines.join('\n') + '\n');
}

function stop(input) {
  // Avoid loops: if Claude is already continuing because of this hook, let it stop.
  if (input.stop_hook_active) return;
  const state = readState();
  const startedAt = state && (!input.session_id || state.session_id === input.session_id) ? state.startedAt : 0;
  const { latest, latestFile } = latestWorkChange();
  if (!latest || latest <= startedAt) return; // no work changed this session

  const date = today();
  const handoffOk = mtime(handoffFile) >= latest;
  const breakdownOk = breakdownsFor(date).some((f) => mtime(path.join(breakdownDir, f)) >= Math.max(startedAt, 1));
  if (handoffOk && breakdownOk) return;

  const missing = [];
  if (!handoffOk) missing.push('handoff.md is older than the latest work change');
  if (!breakdownOk) missing.push(`no docs/session-breakdowns/session-${date}-NN.md updated this session (next free: ${nextBreakdownName(date)})`);
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: `[handoff hook] Work files changed (latest: ${latestFile}) but ${missing.join('; ')}. ` +
      'If this ends the work session, update them concisely per CLAUDE.md. If the session is continuing, make the smallest useful handoff update and stop.',
  }));
}

try {
  const input = readStdin();
  const mode = process.argv[2];
  if (mode === 'session-start') sessionStart(input);
  else if (mode === 'stop') stop(input);
} catch { /* fail open */ }
process.exit(0);
