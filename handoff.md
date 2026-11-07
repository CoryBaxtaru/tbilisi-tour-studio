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
- 2026-11-08, all of today's work is live in `6cf128c` and was checked on GitHub Pages. That covers the tour import in Studie, guide mode "Je bent hier", and all findings of the A-to-Z test:
  - quick booking with Instagram and private groups;
  - one duration taken from the tour, and a meeting-point check;
  - a product is a draft until saved, with a sticky save bar;
  - closing a tour reaches the departure and Vandaag;
  - clearer buttons, the guide-mode clock, and reordering in Studie.
  - `npm test`: 160 passed. See the breakdown.
- 2026-11-08, guide mode rebuilt around "Je bent hier": arrival keeps the stop's story on screen, with "Verder naar …" and the transition at the end, plus an end card to payment and feedback. **Checked locally, not committed or deployed** (together with the Studie tour import). See the breakdown.
- 2026-11-08, A-to-Z walkthrough as the founder (Instagram booking, party of 6, history tour): 11 findings, no code changed, test data removed. The most important: guide mode jumps to the next stop on arrival, durations disagree, and a booking takes three screens. See the breakdown.
- 2026-11-08, Studie can load one of the guide's tours ("Laad een van je tours"), in tour order; own places without a catalogue entry are named and left out. **Checked locally, not committed or deployed.** `npm test`: 153 passed. See the breakdown.
- 2026-11-07, Studie rebuilt after a design review, live in `c320f2f`, checked on GitHub Pages: the story comes first, the storyline's name is the title, the map stays beside the story and marks the stop being read, sites are chosen by search and district in a folding list, and the `.chip` CSS leak into other pages is fixed. `npm test`: 152 passed. See the breakdown.
- 2026-11-07, step 7, live in `7180842`, checked on GitHub Pages: blocked days and overlap warnings, product text, practical notes per site (start empty), feedback log, Cijfers page, and 8 new sites with stories (66 sites, 299 claims, 235 sources, 25 threads). **Schema 4: both devices must tap "Vernieuwen".** See the breakdown.
- 2026-11-07, step 6, live in `f915da8`, checked on GitHub Pages: guest check-in (guide mode, Vandaag, departure page) and Dutch message templates per booking. See the breakdown.
- Date: 2026-11-07 (session 01), live in `408bada`, checked on GitHub Pages:
  - Studie: copy a research prompt for Claude and paste the answer back, saved per site (clipboard chosen over a Haiku subagent, because a subagent cannot run from the website); make a tour from a storyline; practice mode; guest questions; simpler Dutch in all bundled story text.
  - Business: Vandaag screen, Start gidsen, overbooking block, GetYourGuide reminder, refunds and cancellation fees, lari, general costs and profit (**schema 3: both devices must tap "Vernieuwen"**), open payments, bad-weather plan.
  - Research: all 58 sites now have a written story with facts, anecdotes and myths (266 claims, 214 sources, 23 threads). See `docs/RESEARCH.md`.
  - Folklore rule: myths may go into a story if they open with "Legendes zeggen dat" or "Een bekende volksmythe is". Applied, with new myths added. Live in `cf68bdf`.
  - Breakdown: `docs/session-breakdowns/session-2026-11-07-01.md`.
- Date: 2026-11-06 (session 01): new **Studie** section (`#/studie`), built, **not committed or deployed**. Click sites, get a storyline on the map and a story to tell. 20 passages and 15 threads are written by Claude from the claims; the other 38 sites show their claims in a row. No AI in the app (zero-cost rule). Breakdown: `docs/session-breakdowns/session-2026-11-06-01.md`.
- Previous: 2026-10-23 (session 01):
  - Business hub plan: the vision widened to a founder-only business hub; the plan, prices and build order are in the private data repo (`business/HUB_PLAN.md`; see CLAUDE.md); the licence check is in `docs/HOSTING.md`. CLAUDE.md and the spec are updated (commercial-use rule).
  - Step 3: agenda with tour products, departures and bookings (see the breakdown). Deleting uses an in-page confirmation, because the in-app browser blocks `confirm()`. After a design review, the Agenda and the departure page were rebuilt around upcoming departures, occupancy and guests. A whole-app review followed:
    - Tours: a single accent and the themes as a list;
    - guide mode: a minimal header, no app menu;
    - Onderzoek: verification progress;
    - editor: settings folded.
  - Dark mode: follows the system setting, with a "Weergave" toggle (Systeem / Licht / Donker) under Instellingen. Deployed in `b7ea80f`.
  - Old commits with the business plan (`f138839`, `732f486`, `7f7be3e`, `0b389a7`) are still reachable by SHA on GitHub. A purge request for GitHub Support has been drafted; the founder sends it. Support may refuse non-credential data.
  - Step 5 (live in `b7c8c2b`, checked on GitHub Pages): a price profile per tour product (amounts default to 0, real prices only in synced data); bookings prefill price and commission; departure costs, net and break-even; Financiën page (`#/geld/<year>`) with a CSV for the accountant without personal data.
  - Step 4 (live in `08f1907`, checked on GitHub Pages): weather per departure.
    - MET Norway forecast within about 9 days: one cached request for central Tbilisi, refetched after `Expires`.
    - Beyond the forecast: monthly climate averages from NOAA GHCN-Daily, bundled at build time; temperatures 2005–2024, rain 1961–1990, because the station's recent rain record is missing.
    - Sunrise/sunset calculated locally.
    - Shown on cards, calendar cells, the day panel and the departure page. Limits are in `docs/HOSTING.md`.
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
- `npm test`: 152 passed (2026-11-07). Step 7 checked on a local production build, with screenshots at 375 px, and live on GitHub Pages; not on a phone, and sync of blocked days between devices is untested.
- Earlier: 138 passed (2026-11-07). Step 6 checked on a local production build at 375 px.
- Earlier: 118 passed. The new work was checked on a local production build with test data (desktop and 375 px) and live on GitHub Pages; not on a phone, not with a real answer from Claude, and sync of the new data between real devices is untested.
- Earlier: 95 passed (2026-11-06, incl. 9 story tests). Studie checked on a local production build (desktop and 375 px), not on a phone.
- Earlier: 86 passed (2026-10-23, incl. 10 pricing tests). Step 5 checked on a local production build (prefill, gross-up, costs, Financiën, 375 px). Earlier: 77 passed with the 12 weather tests. Step 4 checked on a local production build with the CSP active (live MET fetch, IndexedDB cache, climate view, 375 px); not on a phone, not offline.
- Earlier: `npm test`: 50 passed. `npm run build` succeeds, with Vite's chunk-size warning (578 kB / 172 kB gzip).
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
0. **Both devices must tap "Vernieuwen"** (schema 4; an app that is not updated shows Instagram bookings without a channel name). Then the founder:
   - tries "Nieuwe boeking" and guide mode on the real phone;
   - checks that a private departure syncs laptop → phone.

   Breakdown: `docs/session-breakdowns/session-2026-11-08-01.md`. Look at the Studie map on the real phone: at 180 px high, nearby pins overlap. Then check that a blocked day syncs laptop → phone. The founder fills in the product text, adds practical notes while walking the route, reads a few stories aloud, verifies claims under Onderzoek and tries one paste round trip with Claude. Step 6 is live: the founder fills in the map link, what to bring and the review link per tour product, and tests a check-in on the phone. Only item 9 of the plan (optional public page) is left, and it is for later.
1. Step 3, the design fixes and dark mode are live (`b7ea80f`, checked on GitHub Pages). **Both devices must tap "Vernieuwen"**: an old app refuses the new sync file (schema 2) until updated. Then check that a test booking syncs laptop → phone.
2. Step 5 (prices and finances) is live and marked in the private plan. The founder taps "Vernieuwen" on both devices and enters real prices per tour product. The founder also sends the GitHub Support purge request. Next build: step 6 (guest check-in, message templates).
3. Still open on the founder's side: verify claims under Onderzoek; phone test of the offline map.
