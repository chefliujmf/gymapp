# Knowledge Base — Book Manifest

Complete inventory of `knowledge_base/` (gitignored, copyright — local only). This is the
**source-of-truth list**; `knowledge_map.md` is the thematic map and `*_source_notes.md` hold
deep-mined coach-owned summaries. Process books into coach-owned summaries with attribution;
never commit or bulk-copy source text.

## How to read each format
- **`.epub`** — zip of XHTML; open with stdlib `zipfile`, strip tags.
- **`.pdf`** — Read tool `pages` param (no poppler/`pdftotext` installed); scanned PDFs may need OCR.
- **`.mobi` / `.azw3`** — `mobi` pip package (installed in `.venv`): `mobi.extract(path)` → temp `.epub`/`.html`, then read like epub. No Calibre on this machine.

## Relevance legend
**JMF** = applies to Jean-Manuel · **F** = female-athlete physiology (future female athletes, not JMF) · **Gen** = general/any athlete · **Insp** = inspiration only, do not copy.

## Status legend
**mined** = coach-owned `*_source_notes.md` and/or integrated into instructions · **cataloged** = listed, not yet deep-mined · **TODO** = newly added, deep extraction pending.

| Title | Author | Format | Domain | Rel. | Status |
| --- | --- | --- | --- | --- | --- |
| The Cyclist's Training Bible | Joe Friel | epub | Cycling theory | JMF | cataloged |
| Training and Racing with a Power Meter | Allen & Coggan | epub | Power/training | JMF | cataloged |
| The Power Meter Handbook | Joe Friel | epub | Power/training | JMF | cataloged |
| Méthode de musculation (110 exercices) | Olivier Lafay | pdf (FR) | Bodyweight strength | Insp | cataloged |
| New Functional Training for Sports 2nd Ed | Michael Boyle | mobi | Functional strength | JMF | mined (`functional_training_boyle_source_notes.md`) |
| Fuel Your Ride | — | epub | Cycling nutrition | JMF | cataloged |
| The Complete Guide to Sports Nutrition (8th) | Anita Bean | epub | Nutrition | JMF | cataloged |
| Plant-based Sports Nutrition | Larson-Meyer & Ruscigno | pdf | Plant nutrition | JMF | cataloged |
| The Athlete's Guide to Sports Supplements | — | pdf | Supplements | JMF | cataloged |
| Smarter Recovery | Pete McCall | pdf | Recovery | JMF | cataloged |
| The Feed Zone Cookbook | Lim & Thomas | epub | Recipes | JMF | cataloged |
| AIS Collagen Support Fact Sheet v3 | AIS | pdf | Supplements | JMF | mined (`collagen_source_notes.md`) |
| How to Take Creatine: A Doctor's Practical Guide | — | pdf | Supplements | JMF | mined (`creatine_source_notes.md`) |
| Vegetarian Cyclist Performance Optimization Plan | — | pdf | Veg nutrition | JMF | mined (`vegetarian_cyclist_performance_source_notes.md`) |
| Plant Based Diet for Athlete | Howard Patton MD | azw3 | Plant nutrition | JMF | mined (`plant_based_diet_athlete_source_notes.md`) — low-quality source; defer to Larson-Meyer/Bean |
| ROAR | Stacy Sims & Selene Yeager | epub | Female physiology/fueling | F | mined (`roar_female_physiology_source_notes.md`) |
| Next Level | Stacy Sims & Selene Yeager | azw3 | Peri/menopause athlete | F | mined (`next_level_female_masters_source_notes.md`) |
| Good for a Girl | Lauren Fleshman | epub | Female dev, RED-S (memoir) | F | mined (`good_for_a_girl_source_notes.md`) |
| Endurance Performance in Sport | Meijen (ed.) | epub | Sports psychology | JMF/Gen | cataloged |
| The Inner Game of Tennis | W. Timothy Gallwey | epub | Sports psychology | Gen | cataloged |
| Mind Games | Vernon & Wellington | epub | Sports psychology | Gen | cataloged |
| Endure | Alex Hutchinson | epub | Sports psychology | Gen | cataloged |
| Beyond Bigger Leaner Stronger | Michael Matthews | epub | Hypertrophy/strength | Insp | cataloged |
| Made to Stick | Chip & Dan Heath | epub | Communication of ideas | Gen (coach comms) | cataloged |

> Derived coach-owned note (not a book): `epsom_salt_bath_source_notes.md`.

## Maintenance
When a book is added to `knowledge_base/`: confirm it's readable (format above), add a row here and a line in `knowledge_map.md`, then deep-mine into the relevant instruction/library + a `*_source_notes.md` when it's used. Female-physiology titles are mined when a female athlete is onboarded (build a dedicated module). See memory `knowledge-base-readers` and `coaching-engine-multitenant`.
