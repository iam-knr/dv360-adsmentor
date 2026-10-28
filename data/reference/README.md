# data/reference

Owner session: P3-05b.
Spec: data-model.md 3.1, modules 02 and 10 (section 3.4). Do not edit from another session (build-plan 3.2).

Global reference data for the seed. Every file is plain JSON, read by `lib/seed/reference.ts`.
All data is synthetic (PROJECT.md R5). Real exchange, verifier and vendor names are reference data with
invented prices (ADR-042, RC-055) and must be listed in `vendors.json`; a unit test fails otherwise.

| File                    | Content                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `exchanges.json`        | 71 exchanges (54 enabled by default, 8 app mediation partners of which 6 enabled), `simClass` (engine key, RC-029), format support, seat and network ID flags, supply `weight` |
| `vendors.json`          | Allow-list of real vendor names (RC-055)                                                                                                                                       |
| `fx-rates.json`         | Invented FX rates (engine.md 2.7). Not loaded yet: `FxRate` has no model before P3-05c                                                                                         |
| `geography.json`        | 30 countries, 30 Indian states and UTs, 60 cities, Singapore and US samples                                                                                                    |
| `languages.json`        | 30 languages                                                                                                                                                                   |
| `categories.json`       | 26 top-level categories with children and grandchildren                                                                                                                        |
| `technology.json`       | Device types, OS, browsers, device makes and models, connection speeds, synthetic carriers and ISPs                                                                            |
| `labels.json`           | Demographics, viewability, content labels, sensitive categories, genres, DOOH venues, positions                                                                                |
| `google-audiences.json` | 60 Google audiences (affinity, in-market, life events, demographics). Not loaded yet: `GoogleAudience` has no model before P3-05c                                              |
| `apps.json`             | 20 synthetic mobile apps for the app install line items                                                                                                                        |
| `brands.json`           | Fictional brand name parts and the real-brand blocklist                                                                                                                        |

Reduced sizes: the module 10 3.4 catalogues list larger minimums (150 cities, 300 postal codes, 200 apps).
P3-05b builds the reduced versions the task asks for; Phase 4 targeting sessions can extend these files.
