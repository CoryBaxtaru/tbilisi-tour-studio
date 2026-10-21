# Interface system — Tbilisi Walking Tour Studio

Approved by founder 2026-10-21 (session 02). Stack-independent; translate tokens into the chosen stack's convention once it exists. No UI code yet.

## Direction and feel
- **Studio (desktop authoring):** calm and well-kept, like a guide's notebook on limestone. Reading-heavy and precise.
- **Gidsmodus (mobile guiding):** read in a two-second glance while talking to a group outdoors. High contrast, large type, thumb-sized controls.
- Same palette in both modes; the mode changes density and type size, not identity.
- UI copy in Dutch, sentence case, verb-first buttons ("Aangekomen", "Overslaan").

## Palette (colors from the city)
| Token | Hex | Role |
|---|---|---|
| `--baksteen` | `#9A4A2E` | Single accent: primary action, talking time. Text on limestone 5.08:1 |
| `--baksteen-licht` | `#D9876A` | Brick as text/icon on dark (6.10:1) |
| `--balkon` | `#2F6F6A` | Route, walking time, "feit" stamp. Text on limestone 4.78:1 |
| `--balkon-licht` | `#4FA39A` / `#7FC2B8` | Route on dark (5.63:1) / GPS-status text on dark (8.25:1) |
| `--kalksteen` | `#EFE8DA` | Light canvas |
| `--mtkvari` | `#4A5652` | Secondary text on limestone (6.28:1) |
| `--zwavel` | `#C4962C` | Uncertainty/warning **fills and borders only** on light (text 2.22:1 fails) |
| `--zwavel-inkt` | `#7A5A12` | Uncertainty/warning text on light (5.22:1) |
| `--smeedijzer` | `#1F1D1B` | Ink on light (13.78:1); canvas in guiding mode |
| `--kalk` / `--zand` | `#F4EFE6` / `#E8DCC8` | Primary / secondary text on dark (14.67 / 12.40:1) |

Rules: one accent (brick). Color carries meaning: brick = talking/action, turquoise = walking/route/verified, sulfur = uncertain/warning. Brick as text on the dark canvas fails (2.71:1); use `--baksteen-licht`, or a brick fill with `#FBF4EA` text (5.67:1).

## Typography
- **Literata** (opsz 7–72): story content, i.e. stop names, talking points, arrival notes. Headings get slightly negative tracking (−0.015em).
- **Public Sans**: UI, i.e. labels, metadata, controls, numbers.
- **Noto Sans Georgian**: fallback for Mkhedruli place names (Literata has no Georgian glyphs). Not yet tested.
- Scale ~1.25 from 14px desktop body: 11 · 14 · 16 · 18 · 22 · 28. Guiding mode: stop name 26–28, body 15–16, controls 15/500.
- Hierarchy through weight and color first (500 value / 400 meta), size second. `tabular-nums` on all times, distances and GPS accuracy.

## Depth, spacing, shape
- Depth: borders only (low-opacity hairlines), no shadows. Dense tool, quiet structure.
- Spacing base 4px. Desktop panels 12–16px padding; guiding mode 16px.
- Radius: 4px stamps and small controls, 8px buttons and inputs, 12px cards, 16px frames (concentric).
- Hit areas: ≥48px tall in guiding mode.

## Signature patterns
- **Loop-en-vertel-lint (walk-and-talk ribbon):** one horizontal strip per tour. Talking blocks are brick fills 20px tall; walking stretches are a turquoise 2px line; breaks are sulfur. Segment length is proportional to minutes. Summary line below: "vertellen N · lopen N · pauze N" and the total. Used in tour overview, editor header and guiding progress.
- **Provenance stamps:** 11px, 4px radius, 0.5px border in the role color, no fill. `feit · N bronnen` (balkon) · `interpretatie` (baksteen) · `anekdote` (neutral) · `onzeker` (zwavel border + zwavel-inkt text). Shown on every talking point.
- **Next-stop card (guiding):** "Volgende stop" label + GPS accuracy (only when tracking is really active) → stop name (Literata 26/500) → "N min lopen · N m" → route progress line → arrival note → primary "Aangekomen" (2fr, brick fill) + secondary "Overslaan" (1fr, outlined). The map comes second, not first.

## Open decisions
- Guiding mode dark vs. light: test both on the founder's phone in direct sunlight before committing.
- Verify Noto Sans Georgian pairing once Georgian names appear.
- Contrast ratios computed for the pairs listed above only; check new pairs before use.
