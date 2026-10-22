# Research: sources and claims ("Onderzoek")

Reusable research per site: claims with sources and the guide's verdict. Talking points in a tour are copied from these claims.

## In the app
- **Onderzoek** (`#/onderzoek`): every site with its counts (te verifiëren · geverifieerd · bronnen). Filters: Alles, Te verifiëren, Zonder onderzoek. Search by name.
- **Per site** (`#/onderzoek/<landmarkId>`), each claim shows:
  - its provenance stamp (feit, interpretatie, anekdote, onzeker) and its status (Concept, Geverifieerd, Afgewezen);
  - the linked sources and "wat de bron zegt" (a short summary of what the source says);
  - any warning note.
  - Actions:
    - **Bevestigen**: you checked the source yourself.
    - **Afwijzen**: the claim moves to a collapsed "Afgewezen" list.
    - **Terug naar concept**, **Bewerken**.
    - Add your own claims and sources. Only `http(s)` links are rendered.
  - The Wikipedia/Wikidata background stays available for reading only.
- **Stop card → "Uit onderzoek"**: "Als vertelpunt gebruiken" copies a claim into the stop as a talking point (text, kind, source titles) and keeps the link (`TalkingPoint.claimId`).
  - The stop card flags such a point "Concept: nog niet geverifieerd" or "Afgewezen in onderzoek".
  - Guide mode shows "niet geverifieerd" or "afgewezen" next to it until you confirm the claim.
- The copy is a snapshot. Later edits to a claim's text do not change points already copied; its status does show.
- "Toon meer" in the card deck links to the site's research page ("Bronnen en beweringen").
- **Name previews:** names and places in claims, the stop card's research list and guide-mode talking points are dotted-underlined. Hovering (desktop) or tapping (phone, opens as a sheet at the bottom) shows the Wikipedia lead, Dutch when an article exists.
  - Background only, never a source, and labelled as such with the CC BY-SA licence.
  - The leads are bundled at build time (`scripts/wiki-terms.mjs` lists phrase → article; `node scripts/build-wiki-terms.mjs` fetches them and prints each article's description so a wrong match is easy to spot). So they work offline and the app makes no calls to Wikipedia.
  - A phrase links wherever it appears (first occurrence per text), also in your own talking points, so only unambiguous phrases are listed.

## Spelling convention
- Georgian names follow the spelling on Tbilisi street signs and in the app's site names (Georgian national romanization: Rustaveli, Kote Afkhazi, Vakhtang Gorgasali, Akhaltsikhe, Kutaisi).
- Russian names and established Dutch exonyms use Dutch spelling (Paskevitsj, Poesjkin, Gribojedov, Jerevan).
- Applied to all drafts on 2026-10-22 (72 replacements), after the founder pointed out "Erivanplein" (now Jerevanplein) and mixed spellings.

## Storage and sync
- Concept claims ship with the app in `src/data/research-drafts.json` and stay **virtual**. Only when you confirm, reject or edit one is that single claim saved on the landmark (`Landmark.claims`; own sources in `Landmark.sources`).
  - A catalogue site is first stored exactly as the catalogue makes it, so every device has the same base record.
  - Untouched drafts never cause sync conflicts.
- Draft ids are `cat:<site>:c<n>` (claims) and `cat:<site>:s<n>` (sources), and the saved version replaces the draft with the same id.
  - Never renumber existing ids in the drafts file; continue the numbering for new ones.
- Removing your own claim is possible. A draft cannot be removed (it would reappear); reject it instead.
- Like any landmark edit, acting on a claim marks the landmark as edited, so later catalogue refreshes (e.g. a corrected position) no longer replace it (`docs/CATALOG.md`).

## How the concept claims were made (2026-10-22)
The founder's rule: **Wikipedia is not a source.** Claude traced the sources that Wikipedia and Wikidata cite and checked each claim in the original text.
- **Official Georgian heritage register:** National Agency for Cultural Heritage Preservation of Georgia (`memkvidreoba.gov.ge`), cited by Wikidata. Record pages are linked per claim.
- **T. Kvirkvelia, *Dzveltbilisuri dasakhelebani* (Old Tbilisi place names), Tbilisi 1985:** read online at the National Parliamentary Library of Georgia. Wikipedia cites it for Freedom Square; it was then used for other sites.
- **Web sources cited by the articles:** news, institutions, academic papers, the Georgian Encyclopedia; archive.org copies where the original is gone.
- **Travel blogs and guides:** used only where nothing better exists. They are labelled as such and carry a note to check on site.

Result:
- 151 claims for 53 of the 58 sites, with 122 sources.
- Kinds: 132 feit, 12 anekdote, 3 interpretatie, 4 onzeker.
- Source languages: Georgian 85, English 33, Russian 3, German 1.

Rules applied:
- A claim was kept only if a source confirmed it, and trimmed to what that source confirms. Conflicting sources give an "onzeker" claim that names both sides.
- Book-only claims (books not accessible online) and unsourced claims were dropped.
- Texts are Claude's own Dutch phrasing. `evidence` is a short summary, not a quotation, and no source text is stored in the repo.
- Every draft starts as **concept**. "Checked by Claude" is not the same as verified by the guide: confirm before telling.
- `npm test` enforces that every claim has at least one source that resolves, that no source is a Wikipedia or Wikidata URL, and that kinds are valid.

### Where sources disagree with Wikipedia/Wikidata or with each other
- **Norashen:** the register dates the church to 1790–1796 and Kvirkvelia to 1793. The Armenian diocese says 15th century; Wikipedia says early 16th century and Wikidata 1467. → "onzeker"
- **Metekhi:** rebuilt 1278–1289 (register) or 1278–1284 (Kvirkvelia).
- **Sioni:** construction began in the 570s–580s under Guaram and was finished in the 620s under Adarnase. The founding by Vakhtang Gorgasali is kept only as a legend ("anekdote").
- **9 April 1989:** carried out by the Soviet Army. 16 people died on the spot, 4 more later, and 1 during the curfew.
- **Marjanishvili Theatre:** the building is Zubalashvili's People's House (1907, architect Krzyczyński).
- **Circus:** 1940.
- **Jumah mosque:** the neo-Gothic and Islamic description is correct; the first mosque dates from 1723–35.
- **Anchiskhati belfry:** 1675. Register record 3914's "1775" is probably a typo.
- **Synagogue:** the dates conflict (1904 / 1904–1913 / 1895–1903). → "onzeker"
- **Botanical garden:** 97 ha (register), not 161; 1845 confirmed.
- **Chronicle of Georgia:** 1980–2012 (Georgian Encyclopedia); work began in 1980 (Russian Academy of Arts).
- **Kashveti:** the altar was painted 1946–48 by Lado Gudiashvili.
- **Printing house:** the register makes no link to Stalin. → "onzeker"
- **Gabriadze clock tower:** built 2010.
- **Viceroy's palace:** its own site calls architect Otto Jacob Simonson Swedish; other sources say German (noted with the claim).
- **Opera:** began in 1851 in Tamamshev's theatre; the present building dates from 1880–1896.
- **Aghmashenebeli Avenue:** Kvirkvelia calls viceroy Mikhail a nephew of Nicholas I, which conflicts with other data (son). It is left out of the text and noted.

### Dropped (not confirmed in an accessible source)
- **Rustaveli Avenue:** the 1991 coup and the Rose Revolution (book only).
- **Sameba:** "largest" and "9th tallest"; the Basiani claim.
- **Art Museum:** 140,000 items.
- **Synagogue:** "largest".
- **Kashveti:** the stone-birth legend.
- **Abanotubani:** the falcon founding legend; "65 baths".
- **Ateshgah:** "northernmost fire temple". The cited site's domain is now spam.
- **Presidential palace:** Foreign Ministry from 2026.
- **Vake Park:** WWII memorial and red sand.
- **University:** founded 1918.
- **Shardeni:** named after Chardin.
- **Rike Park, Public Service Hall and the cable car:** Wikidata dates only. Rike now has claims about the old Rike district from Kvirkvelia.

### Sites without concept claims
Waterval van Leghvtakhevi, Kabelbaan Rike–Narikala, Europaplein, Public Service Hall and Fabrika have no confirmed source yet. Add your own under Onderzoek.

## Adding or fixing drafts
- Edit `src/data/research-drafts.json`. Per site:
  - `sources`: `{ id, title, url, type, language }`. Types are listed in `SOURCE_TYPES` in `src/domain/research.ts`.
  - `claims`: `{ id, kind, text, sourceIds, evidence, note? }`.
  - Keep existing ids, then run `npm test`.
- Useful official endpoints (free, no key; used only during research, never by the app):
  - Register record: `https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=<id>`. Data via ArcGIS REST: `https://memkvidreoba.gov.ge/arcgisch/rest/services/Culture/CulturePortalService/MapServer/4/query?where=ImmovableObjectID=<id>&outFields=*&f=json`. A `where=Description LIKE N'%…%'` query searches the descriptions; a point plus distance query finds records near a site.
  - Kvirkvelia entry: `http://www.nplg.gov.ge/gwdict/index.php?a=term&d=36&t=<n>`; search: `…?a=srch&d=36&q=<Georgian term>`.
- Claude's working files (downloaded source texts, extraction scripts) stayed in the session scratchpad and are deliberately not in the repo, because the downloaded texts are copyrighted.
