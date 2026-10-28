# 14 — Advertiser settings
Path: Advertiser → Advertiser settings ▸ Basic details · Targeting rules · Data manager (Linked accounts) · Alert preferences · Policy center   Level: Advertiser
Explored: 2026-10-28. Read-only: dropdowns and side panels opened, then cancelled; nothing saved, linked or requested. All pages show the "Limited Access" chip. Names/IDs are placeholders (R5).

## Routes
| Page | Route |
|---|---|
| Basic details | `/a/{aid}/details` |
| Targeting rules | `/a/{aid}/targeting` |
| Data manager — Connected products | `/a/{aid}/data-manager` |
| Data manager — Linked accounts | `/a/{aid}/linked-accounts` |
| Alert preferences | `/a/{aid}/alert-config` |
| Policy center | `/a/{aid}/policy-center` |

Left nav label for Data manager is two lines: "Data manager" / "(Linked accounts)".

## Views

### Basic details
Single long form; label column on the left, controls on the right, cards grouped by section. Sticky footer: **Save** (disabled until changed) · **Schedule for deletion**.

**Card 1 — identity**
| Field | Type | Default / example | Rules |
|---|---|---|---|
| Name (Required) | text | advertiser name | required |
| Status | dropdown next to Name | Active | Active · Paused |
| Website (help ?) (Required) | URL text | `https://example.com/` | required |
| Currency | 🔒 read-only | e.g. Singapore Dollar (SGD) | locked after creation |
| Timezone | 🔒 read-only | e.g. Asia/Calcutta | locked after creation |
| Advertiser ID (help ?) | read-only | "Display & Video 360 advertiser ID" + 10-digit ID | system |

**Card 2 — Structured Data Files**
| Field | Type | Default | Options |
|---|---|---|---|
| SDF version | dropdown | 9 | 9 · 9.1 · 9.2 · 10 · 10.1 · 11 |
| Administrator email | email text | empty, "Enter email" | |

**Card 3 — Ad server and attribution** (pencil ✎ opens right side panel)
- Summary: "Ad server — Third-party ad servers only"; "Attribution settings — {floodlightConfigId}: {advertiser name} - {id}".
- Side panel "Ad server and attribution": rows Ad server (help ?) · Attribution settings (read-only in demo); footer **Apply** · **Cancel**.

**Section — Authorizations** (checkbox list; paraphrased)
| Group | Checkbox | Demo default |
|---|---|---|
| General | Product Improvement — allow use of the partner's service data to improve the platform (can only be unchecked if data-processing terms are accepted) (help ?) | ✓ |
| General | Enable Order ID Reporting for Pixels | ☐ |
| Ad badging, transparency, and reporting (help ?) | Use "About this ad" badging / transparency / illegal content reporting; expander "Requirements to opt out…" | ✓ |
| Commerce partners | Share spend & performance data with commerce partners that provided audience/measurement (Learn more ↗) | ☐ |
| Creatives | Creatives from this advertiser contain tracking activities (creative can override) | ☐ |
| Creatives | Authorise use of video creatives for TV campaign reporting/features | ☐ |
| Third-party integrations | Authorise a media-planning system (Prisma) to send budget segment plans and receive reporting/invoices | ☐ |

**Section — EU political ads**
- Question "Does this advertiser plan to serve European Union political ads?" + regulation note + "Learn how EU political advertising is defined" link.
- Radios: "Yes, this advertiser plans to serve EU political ads" · "No, this advertiser doesn't plan to serve EU political ads" (demo: No).
- Note: same answer applied to all new and existing line items; editable per LI later (see 04/05 validation).

**Section — YouTube and Demand Gen settings**
- Conversion → "Conversion optimization": ☑ "Use Floodlight data for conversion optimization on Demand Gen line items." Blue info box "By enabling this feature:" with 4 bullets (Demand Gen LIs optimise to LI-level Floodlight activities; YouTube + Demand Gen conversion reporting uses cross-media Floodlight methodology; Floodlight group enabled for Engaged View conversions; no need to enable Floodlight activities for YouTube) + Learn more.
- **This is the setting that unlocks the Demand Gen LI card** (see 05: "Enable Floodlight optimization in this advertiser").
- Business name & logo: "Set the default business name and logo for your ads." Business name (help ?) text, counter "0 / 25"; Logo (help ?) "Add logo" link. Info: can override at ad level, but once set at advertiser level cannot be cleared during ad create/edit.

**Expander — Additional settings** (collapsed by default, chevron)
| Field | Type |
|---|---|
| Entity Read Files Read Google Group (help ?) | 🔒 read-only text |
| Integration code (help ?) | text, "Enter code" |
| Third-party services | summary "No third-party rate cards added" / "No third-party vendors for YouTube added" + ✎; info box about vendor charges + on-by-default vendors + Learn more |

**Third-party services side panel** (✎) — footer Apply · Cancel
| Section | Controls |
|---|---|
| Third-party verifier configuration | Integral Ad Science Client ID (number, default 0) |
| Bidding rate cards | Per bidding vendor card: ☐ "I affirm with the rate below and have read the {vendor} Terms and Conditions" (link) + "{vendor} rate (Media Fee)" read-only % (e.g. 5%, 14%). Two vendors seen |
| Measurement vendors for YouTube & partners line items (help ?) | Info box (extra charges; on-by-default vendors pre-selected) |
| Third-party viewability vendors | 3 checkboxes |
| Third-party brand safety vendors | 3 checkboxes |
| Third-party reach vendors | 10 checkboxes |
| Third-party brand lift vendors | 4 checkboxes |
| Third-party conversion attribution vendors | 1 checkbox |
Simulator: use fictional vendor names, same counts/sections.

**Schedule for deletion** (footer, not clicked): schedules advertiser deletion. Simulator: confirm dialog → advertiser status "Scheduled for deletion".

### Targeting rules
- Title + Limited Access. Info banner: "Targeting rules are applied to all new and existing targeting templates and line items."
- Read-only summary card (rows not clickable in demo):
  | Row | Content |
  |---|---|
  | Brand suitability | 🔒 "Locked for campaigns, insertion orders, and line items." ✓ Inventory mode: Maximum inventory · ⛔ Content type: Embedded YouTube videos, Live streaming videos · 2 info banners: from Oct 2026 sensitive-category and digital-content-label exclusions become unavailable; use Brand suitability controls here instead |
  | Channels & YouTube URLs | "No restrictions" |
  | Keywords | "No contextual keywords selected" |
  | Viewability | 🔒 locked for campaigns/IOs/LIs · ✓ Open Measurement — target only OM-enabled mobile display inventory |
- Rule: advertiser-level rule is inherited and locked at campaign / IO / LI (shown with lock in their targeting panels — see 07).

### Data manager (formerly Linked accounts)
Title "Data manager (formerly Linked accounts)" + Limited Access. Tabs **Connected products** | **Linked accounts**. Content renders in an embedded frame (no page text).

**Connected products tab**
- "+ Connect product" (disabled). Section "Google tag": card with tag icon + tag name + **Manage** link.

**Linked accounts tab**
- **Link new account** (primary) menu: Ads Data Hub · External Data Partner · YouTube channels · YouTube creator videos · Google Ads · BigQuery Exporter.
- Promo card "Request access to YouTube creator videos": 2 paragraphs (request access to a creator's video for ads; creator can let you promote it; you are responsible for rights), illustration, **Learn more ↗** + **Request access**.
- "Connected products — Self-service product linking available in the new integration center for:" rows Analytics (Web + App) · Display & Video 360, each with "Integration center" link.
- Line "To link a Merchant Center account, use {partner-account-id} as the ID you send to your Merchant Center account owner." + Learn more.
- Rows with link counts: "Google My Business for YouTube assets — ✓ 1 linked" · "YouTube channels — ✓ 1 linked".

### Alert preferences
- Intro: "Select which alerts appear in the **Alerts** tab and **Intelligence** panel. Settings apply to this advertiser and its campaigns, insertion orders, and line items. Changes may take a few hours to apply."
- Toggle list (grey title + black description), grouped:
  | Group | Alert | Description (paraphrase) | Default | Extra control |
  |---|---|---|---|---|
  | Budget and pacing | No spend | IO or LI hasn't spent today or yesterday | On | |
  | Budget and pacing | Underpacing | IO is underpacing | On | "Alert if it's estimated that less than [90] % of the current budget segment will be spent by its end date." |
  | Performance | Underperforming | IO is underperforming | On | |
  | Targeting changes | Limited audience size | LI audience reach very limited (needs Underpacing on) | On | |
  | Targeting changes | Deals offline | Targeted deal sent no inventory in 48 h (needs Underpacing on) | On | |
  | Targeting changes | Restricted audience list | LI targets audience lists without permission | On | |
  | Creative or YouTube & partners ad | Rejected creative | LI uses creative rejected by ≥1 exchange | On | |
  | Creative or YouTube & partners ad | Restricted creative | LI has creatives restricted from serving | On | |
  | Advertiser spend threshold exceeded | Exceeded spend threshold | Advertiser total spend over daily threshold | Off | "Alert if the advertiser spends more than [{currency} 0.00] in a day. … applies to yesterday's spend and will not pause line item spend." |
  | Mismatched settings | Insertion order / line item settings | IO or LI has conflicting settings | On | |
- Footer: **Save** (disabled until change) · link **Manage Global Email Configuration** (→ user email preferences, see 01/02).

### Policy center
- Intro: certificates may be required for restricted products/services; apply and view status here; Learn more ↗.
- One card per certificate type: left = title + description ("To run ads for X on open exchanges, TrueView, and deals… certify the domain of the advertiser for each country you target"); right = status ("No certificates."); footer link **Request Certificate ↗** (external).
- Card types seen (in order): addiction service providers · cryptocurrency exchanges & software wallets · pharmaceutical manufacturer drug sales · speculative financial products · gambling (all countries & domains) · online pharmacy · pharmaceutical manufacturer · pharmaceutical non-prescription drug sales · political advertising in EU / India / US (three links: Request Certificate – European Union / – India / – United States) · New York state registration documents ("Provide Registration Documents ↗") · California elections advertisement information (Provided name / California ID / Advertisements regarding = "None provided"; "Self-Declare Advertiser Information ↗") · social casino games.

## Actions & state changes
| Action | Result |
|---|---|
| Edit Name / Website / Status / SDF version / email → Save | Advertiser updated; Paused status shows banner on advertiser pages ("This advertiser is currently paused…", see 01) |
| Ad server & attribution ✎ → Apply | Updates ad server / Floodlight config link |
| Toggle Demand Gen conversion optimisation → Save | Enables/disables Demand Gen LI type |
| EU political ads radio → Save | Propagates to all LIs |
| Business name/logo → Save | Default for YouTube/Demand Gen ads; cannot be cleared at ad level |
| Third-party services ✎ → Apply | Adds rate cards (fees in partner costs) and default measurement vendors for YouTube LIs |
| Schedule for deletion | Advertiser scheduled for deletion (not executed) |
| Link new account → type | Starts linking flow (not executed) |
| Alert toggles / thresholds → Save | Changes which alerts the engine raises in Alerts tab and Intelligence panel |
| Request Certificate | Opens external form (simulator: internal "request" → instructor approves) |

## Simulator notes
- Currency & time zone are set at advertiser creation (partner level, not seen — P1-17) and locked after.
- Alert preferences directly gate the engine's alert generator (§7.3 step 7); underpacing threshold default 90%.
- Targeting rules = advertiser-level locked targeting merged into every LI before the auction check.
- Policy certificates: LIs in restricted categories should not serve until the advertiser has an approved certificate for the targeted country (scenario idea).
- Data manager is mostly external links; simulate as static cards with fake "linked" counts.

## Dependencies on other modules
- 01 Global shell (paused banner, email preferences), 02 Partner (advertiser create, SDF defaults), 05 Line items (Demand Gen gate, EU political ads), 07 Targeting (locked rules, 3P verification), 08 Creatives (tracking flag), 11 Resources (Floodlight group, Google tag), 15 Alerts.

## Open questions / gaps
- Ad server options other than "Third-party ad servers only" (e.g. CM360) not visible.
- Google tag "Manage" page, Link new account flows, Schedule for deletion confirm dialog — not opened.
- Targeting rules edit panels (locked in demo).
