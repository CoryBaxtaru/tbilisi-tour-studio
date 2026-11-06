# Research: sources and claims ("Onderzoek")

Reusable research per site: claims with sources and the guide's verdict. Talking points in a tour are copied from these claims.

## In the app
- **Onderzoek** (`#/onderzoek`): every site with its counts (te verifiëren · geverifieerd · bronnen). Filters: Alles, Te verifiëren, Zonder onderzoek. Search by name.
- **Per site** (`#/onderzoek/<landmarkId>`), each claim shows:
  - its provenance stamp (feit, interpretatie, anekdote, onzeker) and its status (Concept, Geverifieerd, Afgewezen);
  - "wat de bron zegt" (a short summary of what the source says), with the linked sources behind a collapsed "Bronnen (n)" toggle;
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
- 2026-10-22: 151 claims for 53 of the 58 sites, with 122 sources.
- 2026-10-23: 52 more claims, so **every site has at least 3**. Total: 203 claims for all 58 sites, with 155 sources.
- Kinds: 179 feit, 13 anekdote, 4 interpretatie, 7 onzeker. Source languages: Georgian 97, English 53, Russian 4, German 1.
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

### Additions of 2026-10-23
- **Sources:**
  - mostly the heritage register's descriptions and Kvirkvelia entries not yet used before;
  - for modern sites, sources found on the web and checked against the page itself: the national tourism administration (georgia.travel), the architects' own pages (MUA, e-architect for Fuksas), Scan Tbilisi, the university's own site, and news (Civil.ge, 1TV, EurasiaNet, New East).
- **Weaker sources** carry a note saying so: travel blogs for the Chronicle of Georgia and the Dezerter Bazaar name, a travel portal for Europe Square.
- **Conflicts recorded as "onzeker" or in a note:**
  - Cable car: Civil.ge reported its opening in November 2010; a travel guide says 2012 and 600 m instead of 500 m.
  - Peace Bridge: 150 m (Archibase) versus 160 m bridge / 115 m roof (the builder Cimolai).
  - University: built 1900–1906 (register) versus completed 1916 (Scan Tbilisi).
  - Berlin Wall fragment: given in 2016 (New East) versus handed over on 16 June 2017 (1TV).
- **Corrected:** the Droge Brug was not "built in 1848". Kvirkvelia says construction of the bridge complex began in 1848, and this bridge was built in 1851. Its name comes from the river arm drying up in 1938, not from the road underneath.
- **Sensitive:** Sameba stands on Khojivank hill, a former Armenian cemetery. That claim is "onzeker", from the Armenian organisation AGBU, and noted as one side's perspective.

### Starter points (auto-add)
When a site joins a tour (drag, +, or a suggested tour), the new stop gets its 3 best research claims as talking points: verified claims first, then by kind (feit, anekdote, interpretatie, onzeker), rejected ones never. They are copies with a link to the claim, so the editor and guide mode show "niet geverifieerd" until you confirm the claim. Existing stops are not changed; use "Uit onderzoek" in the stop card for those.

## Story passages (Studie, 2026-11-06)
`src/data/story-passages.json` holds spoken text for the Studie section, written by Claude. Rules:
- Only what the claims of that site say. Every sentence lists its claims in `c`; an empty list means connecting text with no facts of its own.
- Overlevering, interpretation and disagreement between sources stay marked as such in the sentence.
- `threads` link sites through something the claims really share. Each `ref` lists its claims too, so a rejected claim also removes the link.
- `year` and `era` are one anchor per site, taken from its claims, for the timeline order and the jump-in-time bridges. They do not sum up the site's whole history.
- Keep claim ids stable. `story.test.ts` fails when a reference no longer exists; it does not check the wording, so check that by hand.

## Research round trip (Studie, 2026-11-07)
The Studie section copies a prompt (`buildResearchPrompt`) for any Claude chat and takes the answer back (`parseReply`, `applyReply` in `src/domain/storyExchange.ts`).
- New facts need a real link. Wikipedia and Wikidata links are refused, as are the facts and sentences resting only on them.
- Everything new is saved as a concept claim with origin Claude, so it goes through the same check under Onderzoek as the drafts. The app does not open the links; verifying stays with the guide.
- Language: simple Dutch. The prompt asks for it; `HARD_WORDS` warns about words that slip through, and a test keeps the bundled text free of them.

## Research round for the stories (2026-11-07)
The founder asked for a real story per site, with facts, anecdotes and myths, from respectable sources in any language, translated into simple Dutch. Wikipedia may be used if its citations are checked. So it served as a map to the sources it cites; a Wikipedia URL is still never stored as a source (a test enforces that).

Result: all 58 sites have a written story with guest questions; 11 of the first 20 were rewritten and extended, 9 were left as they were because nothing better turned up. 52 new claims and 50 new sources: 255 claims and 205 sources in total. Myths and legends are claims of kind "anekdote" and are told as such. 23 threads link the sites (new: Gribojedov, the monk David, Poesjkin, Scudieri, Gudiashvili, Stalin, Saakashvili, 1918).

Best new sources: Poesjkin's own text (1829), Lerner in *Folklore* 16, Kekelia in *Identity Studies*, Daryaee in *e-Sasanika*, the Georgian Encyclopedia of the Georgian Academy of Sciences, *The New York Review of Books*, *The Guardian*, RFE/RL, BBC.

**Weaker or not read in full:** every claim says so in its note where it matters.
- Read through a search result only, because the page refused the fetch: Encyclopaedia Iranica, Eurasianet. The same holds for short passages from OrthodoxWiki, OrthoChristian (Shushanik), Advantour, Eurasia Travel and georgia.travel (Dry Bridge). Check these before relying on the exact wording.
- Villari (1906) and Lang (1957) on the oath at Sioni were not opened: Villari's site failed its security certificate and the check was not bypassed. The claim rests on OrthodoxWiki, which cites Villari.
- Heiligenlevens (Orthodox Church in America, Mystagogy, OrthoChristian) are tradition, not history. They are used only for claims of kind "anekdote".

**Where sources disagree:**
- **Bank robbery 1907:** 6 dead and 40 wounded (Aspects of History) or 40 dead (English Wikipedia, attributed to archive documents, not seen). Stalin's own role that day is unclear. → "onzeker"
- **Narikala explosion:** 1827 (claim c3, Kvirkvelia) or 1848 (botanical garden, claim c2). The Georgian Encyclopedia only says "first half of the 19th century". Left as they are; the garden story names no year.
- **Chakhava:** the older claim calls him minister; several sources say deputy minister. The story says "de baas bij de wegenbouw" and it stays an anecdote.
- **Dry Bridge market:** after the Soviet collapse (a seller in VICE) or since the 1950s (georgia.travel). → stated in the claim.
- **Takaishvili's treasure:** TV claims that Stalin saved it were checked by Myth Detector and rejected; left out.
- **Kashveti:** two versions of the legend (a stone; the unborn child speaks), both told.
- **Stalin and Gorki in the Metekhi prison:** only in travel guides. → "onzeker", told as "men zegt".

**Dropped:** Poesjkin's bath number (no source for which bath); the origin of "Sachino"; Shushanik's burial as fact; the Vera Cross (source not reachable); "built by German prisoners of war" (no source).

The wording of the sentences was checked by hand against the claims. All of it is still concept until the founder verifies it under Onderzoek.

## Folklore and myths (founder's rule, 2026-11-07)
Folklore and common myths may go into a story, even when only a travel guide or a blog tells them, as long as the sentence opens with **"Legendes zeggen dat"** or **"Een bekende volksmythe is"**. Guests must hear that it is not an established fact.
- They must be tales that really circulate. Claude does not make them up, and each has a claim of kind "anekdote" with a link, so it can be checked or rejected like any other claim.
- A test fails when a story sentence mentions a legend or myth without the opening. The Claude prompt asks for it, and a pasted answer that skips it gets a warning.
- Accounts with a named witness keep that name instead (Grishashvili, a seller at the Dry Bridge, the newspaper Iveria), and so does what the church itself tells about the martyrs of 1226 ("volgens de kerk"). Those are not folklore.
- Added: Metekhi's name ("ik brak mijn woord"), the lightning at Narikala, the 300 men from Aragvi, Nino's hair on the cross, Sayat-Nova and princess Ana, the bride inspection in the baths, the boiled pheasant, and three at Chreli Abano (Agha Mohammad Khan, Poesjkin's bath, the holes in the domes). The Morse message of the Bridge of Peace is added too, attributed to its designer.
- Not used, no source found: wish pebbles at Mamadaviti, why Turtle Lake has its name.

## Scouting new sites (step 7, 2026-11-07)
Thirteen candidates were checked. A site went in only with a real OSM position and at least three claims from sources that Claude opened. All wording is still concept until the founder verifies it.

**Added (8):** Armeense kathedraal Surb Gevorg, Jvaris Mama-kerk, Mushtaidi-tuin, Baratashvili-brug, Pantheon van Didube, Tbilisi-zee, Huismuseum Ilia Chavchavadze, Huismuseum Galaktion Tabidze. Two threads are new: "De stad van de dichters" and "Waar de doden liggen". The catalogue now has 66 sites, with 299 claims, 235 sources and 25 threads.

**Not added:**
- Archaeology Museum: only architect credits found, no story.
- Tbilisi Concert Hall and St George Kldisubani: no usable source.
- Pushkin garden: too thin.
- Queen Tamar bridge: already covered in the botanical garden story.

**Where sources disagree (the story says so):**
- **Surb Gevorg, founding:** the Armenian diocese mentions 631 and, as a hypothesis, 1251 by prince Umek. Lonely Planet gives 1251, with the building mainly from the 18th century.
- **Sayat-Nova's death and grave:** Lonely Planet says killed here in 1795, with his tomb outside the main door. The diocese also places his grave here. Armenian History says beheaded and buried at Haghpat. The killing is told with "Legendes zeggen dat".
- **Mushtaidi, founding:** the Georgian Encyclopedia says Mir-Fatah-Aga laid it out in memory of Nino after her death. Scan Tbilisi says he founded it together with his wife.
- **Baratashvili bridge:** built in 1965 (Tbilisi Architecture Archive), opened in 1966 (Georgia About).

**Weak sources, marked in a note on the claim:**
- Madloba (Tbilisi Sea: Iori, salt lakes, depth, altitude). Only the length is also in TASS.
- AllGeo (Galaktion's last years). It also gives a birth year of 1892 where the museum says 1891; the story uses neither. His death by suicide is told plainly in the story, so the note asks the guide to judge whether it suits the group.
- "World's first children's railway" comes only from the Georgian tourism board, and the story says so.

**Corrected while rereading every sentence against its source:**
- The exhibition hall under the bridge closed in the mid-1980s, so it is no longer told as if it were still there.
- "Paid for with gifts" at Didube had no source and was removed. Kekelia does say Didube was the top pantheon until 1934, so the story now opens with that.
- Galaktion's "best-known poems" and Titsian Tabidze being his cousin had no source in hand and were removed.
- A sentence about the Chronicle of Georgia had the wrong source and was removed.

## Adding or fixing drafts
- Edit `src/data/research-drafts.json`. Per site:
  - `sources`: `{ id, title, url, type, language }`. Types are listed in `SOURCE_TYPES` in `src/domain/research.ts`.
  - `claims`: `{ id, kind, text, sourceIds, evidence, note? }`.
  - Keep existing ids, then run `npm test`.
- Useful official endpoints (free, no key; used only during research, never by the app):
  - Register record: `https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=<id>`. Data via ArcGIS REST: `https://memkvidreoba.gov.ge/arcgisch/rest/services/Culture/CulturePortalService/MapServer/4/query?where=ImmovableObjectID=<id>&outFields=*&f=json`. A `where=Description LIKE N'%…%'` query searches the descriptions; a point plus distance query finds records near a site.
  - Kvirkvelia entry: `http://www.nplg.gov.ge/gwdict/index.php?a=term&d=36&t=<n>`; search: `…?a=srch&d=36&q=<Georgian term>`.
- Claude's working files (downloaded source texts, extraction scripts) stayed in the session scratchpad and are deliberately not in the repo, because the downloaded texts are copyrighted.
