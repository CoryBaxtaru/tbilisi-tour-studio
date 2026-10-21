# Product Specification — Tbilisi Walking Tour Studio

## 1. Product vision
A personal tour-building studio for a guide living in Georgia who plans to lead Dutch-speaking visitors on walking tours through Tbilisi, mainly focused on Georgian and Tbilisi history. It is a guide's work tool, not primarily a tourist-facing discovery app.

Two main environments:
- **Desktop authoring:** research, plan, edit, map and review tours.
- **Mobile guiding:** follow the route, track position and read short notes while leading visitors.

All UI and presentation content default to Dutch. Research may use Georgian, Dutch, English, Russian or any other useful language.

## 2. Desktop tour design
Support:
- Create, edit, duplicate, archive and organize tours.
- Tour title, theme, description, intended audience, learning goals, start/end points and status (draft, reviewed, ready to guide).
- Add existing landmarks or create new ones.
- Display stops on an interactive map and in a reorderable list.
- Manually reorder, remove, skip or insert stops.
- Show each stop as an editable card with concise talking-point bullets, historical context, dates, people, anecdotes, questions, transitions, sources and estimated speaking time.
- Search/reuse existing landmark knowledge.
- Preview the full story arc and route.
- See walking distance/time, speaking time, breaks, other planned activities and total estimated duration.
- Export or back up tour data in a documented, portable format where practical.

## 3. Mobile live-guiding
Support:
- Open a saved tour and view its route, current stop and next stop.
- Request GPS permission only when needed; show whether tracking is active and useful location accuracy/last-fix information.
- Show current stop's short Dutch arrival briefing and expandable talking points.
- Show walking distance/time and turn instructions when the routing provider supports them.
- Detect proximity to stops using a configurable threshold, with hysteresis/cooldown to avoid repeated arrival triggers.
- Let the guide manually open a stop, confirm arrival, mark it complete, skip it or adjust upcoming stops.
- Handle GPS drift, denied permissions, poor signal, loss of connectivity, app background restrictions and missing route data honestly.
- Keep key controls readable and usable outdoors on a small screen in bright daylight.
- Do not claim that tracking or arrival detection is active unless it is.

## 4. Tour and stop data
Use stable IDs and structured data. Reuse landmark records across tours without duplicating all research.

### Tour
Include, as appropriate:
- ID, title, description, theme, audience, learning objectives, language and status.
- Ordered stop references and walking segments.
- Start/end point, route geometry where available, total distance and duration estimate.
- Pace, accessibility/difficulty notes, terrain/elevation notes where known.
- Breaks, optional activities and planned timing.
- Created/updated timestamps and schema version where useful.

### Landmark / reusable knowledge record
Include, as appropriate:
- Stable ID, names and original-language names (Dutch, Georgian and other relevant languages).
- Coordinates, address and verified place/provider identifiers.
- Historical periods, dates, people, events and related places.
- Concise Dutch explanation and reusable Dutch talking points.
- Claim-level source references where practical.
- Research notes, source language, verification status, confidence/uncertainty and last-reviewed timestamp.
- Pronunciation guidance, original-language terminology, practical notes and optional image references.

### Tour stop / presentation
Keep tour-specific content separate from shared landmark knowledge:
- Tour-specific speaking points and narrative purpose.
- Short arrival briefing suitable for a glance.
- Transition from the previous stop and setup for the next.
- Speaking-time estimate, optional anecdote/question and guide-only notes.
- Local overrides where needed.

Editing a tour must not silently overwrite presentation notes used by other tours. Shared knowledge updates must not silently overwrite manually edited tour content.

## 5. Route quality and stop ordering
Treat these as separate concerns:
1. **Pedestrian routing:** actual walking-accessible network, route geometry, distance, duration and turn instructions where supported.
2. **Stop-order suggestions:** choose a good sequence balancing route efficiency with historical narrative flow.
3. **Live GPS:** determine approximate position and proximity to a planned stop.
4. **Offline capability:** use cached tour content and route geometry; offline turn-by-turn routing requires an actually available offline engine/data.

Route suggestions should consider:
- Total walking time and distance.
- Backtracking and route continuity.
- Terrain, stairs, elevation, crossings, restrictions and accessibility when data exists.
- Historical chronology, causal relationships, theme, transitions and a satisfying opening/middle/conclusion.
- User-selected duration, pace and must-visit stops.

Do not optimize only by straight-line distance. The nearest stop is not always the best story beat. Recommendations must explain their reason briefly and never silently change the saved sequence. The guide retains final control.

Use pedestrian routing results, not invented paths. Clearly label estimates and missing information. If route data is unavailable, offer an explicit fallback and distinguish it from a verified pedestrian route.

Hide routing behind a small provider interface so it can be replaced without rewriting tour logic. Evaluate OpenStreetMap-based data and suitable routing engines/providers. Verify licensing, attribution, commercial-use rules, API limits, caching restrictions, uptime, data coverage and hosting costs. Do not assume public demo endpoints are production-ready.

## 6. Duration estimates
Calculate transparently:

**Total estimate = walking time + speaking time + breaks + other planned activities.**

- Use actual pedestrian route distances and provider estimates where available.
- Use a configurable walking pace and adjust for elevation/terrain only when supported by data.
- Allow per-stop speaking-time estimates and tour-wide pace settings.
- Prevent double-counting walking and speaking time.
- Show component totals and total duration.
- Label uncertain values as estimates and explain assumptions.

## 7. Research and Dutch content
Research may be gathered in any useful language. Preserve source titles and original-language names where helpful, then translate/adapt presentation text into natural spoken Dutch.

Prioritize:
1. Primary sources and official records where appropriate.
2. Academic scholarship and reputable museums/heritage institutions.
3. Reputable secondary sources for context.

For disputed or politically sensitive history:
- Separate established facts from interpretation and anecdotes.
- Represent significant scholarly or historical perspectives fairly.
- Flag disputed dates, attributions and uncertainty.
- Do not convert speculation into confident narration.

Do not treat AI-generated summaries as sources. Attach source references to the claims they support wherever practical. Keep private research notes separate from visitor-facing spoken notes. Respect copyright: store metadata, links and concise notes/excerpts as appropriate, not wholesale copyrighted source text.

Talking points should be engaging, concise, easy to scan and natural to speak. Avoid encyclopedic paragraphs.

## 8. Reusable historical knowledge base
Research must persist independently of any individual tour.

When adding a landmark:
1. Search the existing knowledge base first.
2. Reuse a record only when the site's identity is sufficiently certain.
3. Research only missing, contradictory or outdated information.
4. Save original source metadata and useful notes.
5. Produce natural Dutch explanations and tour-ready talking points.
6. Attach references and mark claims that still need verification.
7. Save shared knowledge separately from tour-specific narrative content.

Avoid repeating retrieval, translation or summarization when source material has not changed. Revisit research when it is incomplete, contradictory, outdated or explicitly requested. Use stable IDs and hashes/timestamps where useful to detect changes. Never discard provenance to save tokens.

A single landmark may be used in several tours with different narrative purposes. Shared facts remain reusable; each tour's framing, speaking notes and transitions remain independent.

## 9. Offline, privacy and reliability
- Cache saved tour content and essential route geometry for offline use where technically possible.
- Clearly state which features work offline and which require connectivity.
- Synchronize local edits safely; prevent silent data loss or overwrites.
- Provide appropriate export/backup and recovery options.
- Request location permission only when needed and explain its purpose in the UI.
- Avoid collecting or retaining location history beyond what the product requires.
- Do not expose API keys or credentials in client code or repository history.

## 10. Product and technical constraints
- Inspect the existing repository before selecting or changing the stack.
- If starting from scratch, prefer the simplest maintainable responsive web application with installability, mobile GPS support and practical offline caching.
- Prefer open data, open-source components and free options where practical, but verify all terms and real operating costs.
- Keep maps, routing, geocoding, storage and research retrieval behind replaceable interfaces when reasonable.
- Avoid unnecessary paid APIs, frameworks, abstractions and speculative features.
- Design for one guide and a growing collection of reusable tours first. Do not add public accounts, booking, payments or tourist-facing features unless explicitly requested.

## 11. Suggested delivery phases
Adapt these to the actual repository; do not implement everything in one session.
1. Foundation: inspect repo, choose/document architecture, create core models and session continuity.
2. Tour builder: tour CRUD, stop cards, talking points and manual ordering.
3. Map and routing: map display, pedestrian directions and transparent duration calculation.
4. Tour intelligence: sequence suggestions balancing walking quality and historical narrative.
5. Knowledge base: reusable landmarks, source provenance, Dutch content and verification status.
6. Mobile guiding: responsive guide view, GPS and arrival detection.
7. Offline reliability: cached tour/route data, sync and explicit capability boundaries.
8. Polish: end-to-end workflows, accessibility, backups and documentation.

Deliver small, testable increments and keep the application runnable.
