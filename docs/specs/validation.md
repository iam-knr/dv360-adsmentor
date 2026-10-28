# Validation rules catalogue (P2-04)

> Spec for `lib/validation/`. Source of truth for every business rule, error/warning text, default, dependency and compatibility matrix the simulator must enforce.
> Derived from `docs/explore/01..18`. Where the demo account could not show a behaviour (see `17-gap-sweep.md` "Still blocked") the rule is filled from public DV360 knowledge and marked `(from public docs)`.
> Last updated: 2026-10-28 · Owner: P2-04 · Siblings: data-model (P2-01), routes (P2-02), design-system (P2-03), engine (P2-05).

## Contents
0. How to read this document
1. Rule ID scheme and message catalogue
2. Rules per module (tables)
3. Cross-entity matrices (constants)
4. State machines and bulk-action constraints
5. "Unsaved Changes" and confirm dialogs
6. TypeScript design (`lib/validation/`) and Vitest case table
7. Open questions

---

## 0. How to read this document

### 0.1 Column legend (rule tables)
| Column | Meaning |
|---|---|
| Rule ID | Stable ID, never reused or renumbered (see 1.1). Tests, SDF result files and change history refer to it. |
| Entity.field | Dotted path of the field the issue is attached to. `*` = whole entity. Paths use the camelCase names proposed for the data model (`name`, `budget.segments[].amount`). |
| Condition | When the issue is raised. "UI:" prefix = the DV360 UI prevents it (disabled control, locked field); the server still rejects the same input with the listed severity. |
| Sev | `E` error (blocks save), `W` warning (shown, never blocks), `I` info (hint or banner). |
| Message | Exact text. `{x}` = parameter. No marker = verbatim from the explore file named in Src. `‡` = verbatim text observed on a sibling field and reused here (DV360 shows the same wording for the same kind of failure). `[SIM]` = wording written for the simulator because the demo never showed it; needs sign-off (see Open questions). |
| Trigger | `B` on blur of the field (or on change for selects, radios, checkboxes) · `S` on save/create/Apply · `X` cross-field: re-evaluated whenever any field it reads changes, shown inline, and always re-run on save · `A` on status change to Active (Draft to Active, Paused to Active) in addition to `S`. |
| Src | Explore file number(s) where the behaviour was seen, or `(from public docs)`. |
| `~X` after an ID | Alias row. It documents how shared rule `X` bites for this type or module. It is not registered or emitted separately. |
| Trigger `n/a` | UI-only statement or documentation row. Info rows without a message are never emitted. |

### 0.2 Behavioural defaults (apply to every rule unless a row says otherwise)
1. **Error blocks, warning does not.** Create/Save with any `E` issue: no navigation, red field borders, inline red text under the field, focus moves to the first invalid field. Warnings and infos render in amber/neutral and never disable Save. (03, 04, 05)
2. **Required text fields** show `Enter a value` on blur after the field was touched, and on save for untouched fields. Counters read `n / max` (for example `0 / 240`). The input stops accepting characters at `max`; the server still rejects longer values with `GEN-004`. (03, 04, 05, 08, 10)
3. **Locked fields** (padlock or greyed) are not sent to the server as changes. A forged change is rejected with the field's `...-LOCK` rule (severity E, message `[SIM] This setting can't be changed after it is created.` unless the row gives a specific text).
4. **Draft saves still run all `E` rules.** `A` rules add extra checks when the entity is set to Active. A Draft IO/LI can be saved only if it is structurally valid, but it never delivers.
5. **Validation never reads from the network.** The caller builds a `ValidationContext` first (section 6). Rules are pure and synchronous, so the same function runs in the browser form, in a server action, in SDF import and in the engine's alert generator.
6. **Money**: stored as integer minor units plus ISO currency of the advertiser. "Greater than 0" means `> 0` in minor units. Percentages are decimals with 2 places. The wire (RT `Money`) uses major units; services convert to minor units at the boundary before calling a rule (RC-019).

### 0.3 Demo vs. public-docs policy
Anything marked `(from public docs)` is a best-effort reproduction of real DV360 behaviour. The instructor team should confirm each against a full-access account during the SOP-3 fidelity review. Open items are numbered `Q1..Qn` in section 7.

---

## 1. Rule ID scheme and message catalogue

### 1.1 ID format
`<DOMAIN>[-<TYPE>]-<NNN>`

* `DOMAIN` = module (table below). `TYPE` = optional line-item type suffix, only for the `LI` domain (`LI-DSP-020`).
* `NNN` = 3 digits, allocated in **blocks of 10 by topic** inside a domain (001-009 identity, 010-019 next topic, ...). A new rule takes the next free number in its block; if the block is full it takes the next block. IDs are never reused after a rule is deleted (mark it `RETIRED` in the registry).
* Cross-entity matrices have their own IDs `MX-nn` (section 3). A rule that needs a matrix cites it in Condition.
* Severity is not part of the ID. A rule keeps its ID if its severity changes.

| Domain | Module | Primary explore file |
|---|---|---|
| `GEN` | Shared primitives (required, length, number, URL, date range) | all |
| `PRT` | Partner settings | 02 |
| `ADV` | Advertiser settings | 14 |
| `CMP` | Campaign | 03 |
| `IO` | Insertion order (incl. budget segments, pacing, partner costs) | 04 |
| `LI` | Line item, all types | 05 |
| `LI-DSP` `LI-VID` `LI-CTV` `LI-AUD` `LI-APP` `LI-YT` `LI-DG` `LI-DOOH` | Type-specific line item rules: Display, Video, Connected TV, Audio, Mobile app install and Ads in mobile apps, YouTube & partners (video and audio), Demand Gen, Digital out of home | 05, 06 |
| `AG` `AD` | YouTube ad group, YouTube ad | 06 |
| `TGT` | Targeting editors and cross-dimension rules | 07 |
| `TPL` | Targeting templates | 15 |
| `CRE` | Creatives | 08, 17 |
| `AUD` | Audiences | 10 |
| `INV` | Inventory: deals, instant deals, packages, groups, negotiations | 09 |
| `CH` `KW` `LOC` `FL` `CB` | Channels, keyword lists, location lists, Floodlight, custom bidding | 11, 17 |
| `AB` `LS` | A/B tests, lift studies | 18 |
| `BLK` | Bulk actions, SDF | 15, 01 |
| `PLN` `RPT` `USR` | Plans and cross-media reach, reports, users | 13, 12, 02 |
| `SHL` | Global shell: search, workspaces, pins, notes entry points (domain registered by RC-053; IDs `SHL-010..015` live in module 01) | 01 |
| `HIS` | History pages, notes, notifications (IDs `HIS-001..020` live in module 05) | 16 |
| `SIM` | Simulator rules: auth, access windows, clock, scenarios (IDs `SIM-001..015` live in module 18; `SIM-003` is superseded by `ACC-010`) | none |
| `ACC` | Account management: accounts, passwords, roles, cohorts, CSV import, bulk actions, sign in states (section 2.26; defined in module 19) | none |

> Resolved RC-053: rule IDs proposed in module files (`ADV-021..028`, `PRT-011..015`, `USR-010..011`, `PLN-020..031`, `CRE-100..104`, `INV-030..042`, `AUD-023..025` and `AUD-110..114`, `CB-012`, `FL-030..033`, `BLK-020..035`, `RPT-010..020`, `AB-026..029`, `LS-018..019`, `SHL`, `HIS`, `SIM`) are adopted; the module file is their definition until the P3 validation scaffold copies them here. `LS-017` duplicates `LS-002` and is dropped.

### 1.2 Message catalogue (verbatim strings used by more than one rule)
These are the exact strings. Code keeps them in `lib/validation/messages.ts` as `MSG.<KEY>`; no rule may inline a string that exists here.

| Key | Text | Used by | Src |
|---|---|---|---|
| `ENTER_VALUE` | `Enter a value` | every required text, number and URL field | 03, 04, 05 |
| `ENTER_POSITIVE` | `Enter a number greater than 0` | KPI values, budgets, bids | 04 |
| `ENTER_LARGER` | `Enter a larger number` | A/B arm split of 0% | 18 |
| `SELECT_CREATIVE_TYPE` | `Please select at least one creative type.` | CMP-020 | 03 |
| `KPI_NOT_RECOMMENDED` | `This KPI is not recommended for the selected campaign goal.` | CMP-013 | 03 |
| `SELECTION_REQUIRED` | `A selection is required` | INV-001 | 09 |
| `LI_TYPE_INCOMPAT` | `{Type} line items aren't compatible with your insertion order's objective setting.` | LI-006 | 05 |
| `DG_PREREQ` | `To create Demand Gen line items:` + bullet `Enable Floodlight optimization in this advertiser` (yellow toast, Dismiss) | LI-DG-001 | 05 |
| `AG_NO_ADS` | `This active ad group doesn't have any ads. It won't run until you create ads.` | AG-005 | 06 |
| `LS_SELECT_IO` | `Select at least one eligible insertion order to add a lift study` | LS-003 | 15 |
| `CB_MIN_RULE` | `At least 1 rule is required` | CB-004 | 11 |
| `INV_MIN_TARGETING` | `At least 1 targeting setting is required` | INV-004 | 09 |
| `LOOKALIKE_MIN` | `The first-party list must have a minimum of 1,000 active users.` | AUD-041 | 10 |
| `LI_BUDGET_GT_IO` | `The total budget of all line items is greater than the insertion order budget.` | IO-093, AB-023 | 18 |
| `IO_AUTOMATION_CONTENT` | `Your insertion order may only contain cross-exchange display, video and Connected TV line items` | IO-051 | 04 |
| `FREQ_HIGHER_LI` | `The higher level frequency cap is set to {n} exposures per {period}` | LI-052 | 05 |
| `FREQ_CAMPAIGN_IO` | `The campaign's frequency cap is set to {n} exposures per {period}` | IO-061 | 04 |
| `NEG_KW_LIMIT` | `Your list can contain up to 5,000 keywords.` (help text, shown under the field) | KW-002 | 17 |
| `CHANNEL_UNSAVED` | `You have made changes to this channel that have not yet been saved and will be lost.` | CH-006 | 17 |
| `DEAL_VIEW_ONLY` | `Inventory is view only. It is editable by users with write access to all advertisers assigned to this deal.` | INV-010 | 09 |
| `ADV_PAUSED_BANNER` | `This advertiser is currently paused. None of its campaigns or deals are serving.` | ADV-009 | 01 |
| `AUD_DELAY` | `Recently added audiences will be available within 4 hours, except for Combined Audiences which are immediately available.` | AUD-060 | 10 |
| `AUD_FORECAST_NA` | `Audience forecasting is not available for this configuration.` | AUD-051 | 10 |
| `LS_LANG_OBJ` | `The selected metrics only support certain languages and object types.` | LS-009 | 18 |
| `LIFT_NA_FOR_LI` | `Lift studies are not applicable for line items, or cross-exchange insertion orders…` (source text is truncated after the ellipsis, complete wording is an open question Q9) | AB-018 | 18 |
| `INV_AVAIL_UNKNOWN` | `Inventory availability could not be determined. You may need to add creatives.` | LI-062 | 05 |
| `UNSAVED_TITLE` / `UNSAVED_BODY` | `Unsaved Changes` / `You have made changes that have not been saved and will be lost.` | section 5 | 03, 04, 05 |
| `UNSAVED_DISCARD` / `UNSAVED_CONTINUE` | `Discard changes` / `Continue editing` | section 5 | 03 |
| `SDF9_DEPRECATION` | `SDF version 9 will no longer be supported starting January 28, 2027. Upgrade to the latest version… upgrade to SDF version 11.` | BLK-006 | 15 |
| `SDF_EU_DEFAULT` | `Line items without an answer for EU political ads will get "No"` (paraphrase of the dialog; changeable per line item) | BLK-004 | 15 |
| `COPY_SUBLOC_DATA` | `Reach and impressions data is available from January 2024 if you select sub-location(s)` | PLN-013 | 13 |

### 1.3 Key registry (enum keys used by the matrices and the code)

**Line item types** `LiType`
| Key | UI name | Notes |
|---|---|---|
| `DISPLAY` | Display | |
| `VIDEO` | Video | |
| `CTV` | Connected TV | |
| `AUDIO` | Audio | |
| `MOBILE_APP_INSTALL` | Mobile app install | |
| `ADS_IN_MOBILE_APPS` | Ads in mobile apps | |
| `YT_VIDEO` | YouTube & partners video | subtype in `YtSubtype` |
| `YT_AUDIO` | YouTube & partners audio | |
| `DEMAND_GEN` | Demand Gen | |
| `DOOH_DISPLAY` | Display digital out of home | DOOH IO only |
| `DOOH_VIDEO` | Video digital out of home | DOOH IO only |
| `YT_ON_CTV` | YouTube & partners on CTV | CTV IO only |

**IO types** `IoType`: `STANDARD`, `CTV_OTT`, `DOOH`.
**IO objectives** `IoObjective`: `BRAND_AWARENESS`, `CLICKS`, `CONVERSIONS`, `CUSTOM`, `NONE` (Insertion order without objective).
**Campaign goals** `CampaignGoal`: `AWARENESS`, `ONLINE_ACTION`, `OFFLINE_SALES`, `APP_INSTALLS`.
**Statuses** `EntityStatus`: `DRAFT`, `ACTIVE`, `PAUSED`, `ARCHIVED`, `COMPLETED` (derived, never written by users), `SCHEDULED_FOR_DELETION`. Per-entity subsets in section 4.

**KPIs** `Kpi` (unit in brackets: `$` money in advertiser currency, `%` percentage)
`CPM` $ · `CPC` $ · `CPA` $ · `CTR` % · `CPV` $ (cost per YouTube view) · `CPIAVC` $ (cost per impression audible and visible at completion) · `VIEWABLE_PCT` % (Viewability %) · `VCPM` $ (cost per thousand viewable impressions) · `CPCL` $ (cost per complete audio listen) · `CPCV` $ (cost per complete video view) · `TOS10` % (time on screen 10+ s) · `VTR` % (YouTube view rate) · `COMPL_AUDIO` % · `COMPL_VIDEO` % · `VALUE_COST` $ (Custom impression value / cost) · `CLICK_CVR` % · `IMPR_CVR` % · `OTHER` (campaign only, free text).

**Bid strategies** `BidStrategy`
`FIXED_BID` · `MAX_CLICKS` · `TARGET_CPC` · `MAX_CONVERSIONS` · `MAX_CONVERSION_VALUE` · `TARGET_CPA` · `TARGET_ROAS` · `MAX_REACH` · `MAX_VIEWABLE_IMPRESSIONS` · `MAX_VIEWABLE_10S` · `MAX_COMPLETED_IN_VIEW_AUDIBLE` · `MAX_CPV` · `TARGET_CPM` · `TARGET_CPV` · `TARGET_VIEWABLE_IMPRESSIONS` · `MAX_CUSTOM_VALUE_COST` · `TARGET_CUSTOM_VALUE_COST`.

**Pacing** `PacingPeriod`: `FLIGHT`, `DAILY`. `PacingType`: `EVEN`, `AHEAD`, `ASAP`.
**Frequency period** `FreqPeriod`: `MINUTE`, `HOUR`, `DAY`, `WEEK`, `MONTH`.
**Trigger** `Trigger`: `blur`, `save`, `cross`, `activate`.

---

## 2. Rules per module

All tables use the column order from 0.1: Rule ID · Entity.field · Condition · Sev · Message · Trigger · Src.

### 2.1 GEN: shared primitives
Module rules reuse these through helpers in `lib/validation/primitives.ts`. A module row repeats the text so the catalogue stays readable on its own.

| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| GEN-001 | any required text/number/URL | value empty or whitespace only | E | `Enter a value` | B, S | 03, 04, 05 |
| GEN-002 | any amount, KPI value, bid | number missing, not numeric, or `<= 0` | E | `Enter a number greater than 0` | B, S | 04 |
| GEN-003 | A/B arm split, other "must exceed" fields | number `<= min` where `min` is given by the caller (0 for splits) | E | `Enter a larger number` | B, S | 18 |
| GEN-004 | any text with a counter | `length > max` (characters; server counts Unicode code points). UI stops typing at `max` | E | `[SIM] Use {max} characters or fewer.` | S | 04, 08 (counters) |
| GEN-005 | any required radio/card/select | nothing chosen | E | `A selection is required` | S | 09 |
| GEN-006 | any URL field | not `http(s)://host...`, or longer than the field limit (landing page 1,024) | E | `[SIM] Enter a valid URL.` | B, S | 08 |
| GEN-007 | integer fields | non-integer | E | `[SIM] Enter a whole number.` | B, S | (from public docs) |
| GEN-008 | any start/end pair | `end < start` | E | `[SIM] End date must be on or after the start date.` | X | (from public docs) |
| GEN-009 | any percentage | outside 0-100 | E | `[SIM] Enter a number between 0 and 100.` | B, S | 03 |
| GEN-010 | any fee/markup/threshold | number `< 0` | E | `[SIM] Enter a number that is 0 or greater.` | B, S | (from public docs) |

### 2.2 PRT: partner settings (`/p/{pid}/details`, `targeting`, `third-party-configuration`)
| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| PRT-001 | partner.name | empty (label "Required") | E | `Enter a value` ‡ | B, S | 02 |
| PRT-002 | partner.status | not `Active` or `Paused` | E | `[SIM] Choose a status.` | S | 02 |
| PRT-003 | partner.currency, partner.timeZone | UI: locked after creation; any change rejected | E | `[SIM] This setting can't be changed after it is created.` | S | 02 |
| PRT-004 | partner.sdfVersion | not in `9, 9.1, 9.2, 10, 10.1, 11` | E | `[SIM] Choose a supported SDF version.` | S | 02 |
| PRT-005 | partner.sdfAdminEmail | non-empty and not an email | E | `[SIM] Enter a valid email address.` | B, S | 02 |
| PRT-006 | partner.dataProtection.accepted | UI: locked once accepted; cannot be unchecked | E | `[SIM] This setting can't be changed after it is created.` | S | 02 |
| PRT-007 | partner.exchanges | user lacks partner "Read and write" permission | E | `[SIM] You need read and write access to the partner to change exchanges.` | S | 02 |
| PRT-008 | partner.exchanges[GAM].networkId | exchange has extra fields and is enabled but field empty | E | `Enter a value` ‡ | S | 02 |
| PRT-009 | partner.productImprovement | UI: read-only while Enhanced automation is on | E | `[SIM] This setting can't be changed while Enhanced automation is on.` | X | 02 |
| PRT-010 | partner.exchanges | disabling an exchange that existing line items still target | W | `[SIM] {n} line items target this exchange. They will stop buying on it.` | X | (from public docs) |

### 2.3 ADV: advertiser settings (`/a/{aid}/details`, `targeting`, `alert-config`)
| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| ADV-001 | advertiser.name | empty | E | `Enter a value` ‡ | B, S | 14 |
| ADV-002 | advertiser.website | empty | E | `Enter a value` ‡ | B, S | 14 |
| ADV-003 | advertiser.website | not a valid URL | E | `[SIM] Enter a valid URL.` | B, S | 14 |
| ADV-004 | advertiser.currency, advertiser.timeZone | UI: locked after creation; change rejected | E | `[SIM] This setting can't be changed after it is created.` | S | 14 |
| ADV-005 | advertiser.status | not `Active` or `Paused` (Scheduled for deletion has its own action, ADV-010) | E | `[SIM] Choose a status.` | S | 14 |
| ADV-006 | advertiser.sdfVersion | not in `9, 9.1, 9.2, 10, 10.1, 11`; default `9` on seeded demo advertisers, a new advertiser copies the partner value (RC-045) | E | `[SIM] Choose a supported SDF version.` | S | 14 |
| ADV-007 | advertiser.sdfAdminEmail | non-empty and not an email | E | `[SIM] Enter a valid email address.` | B, S | 14 |
| ADV-008 | advertiser.integrationCode | longer than 500 bytes | E | `[SIM] Use {max} characters or fewer.` | S | (from public docs) |
| ADV-009 | advertiser.status = Paused | advertiser is paused: banner on every advertiser page, nothing serves | I | `This advertiser is currently paused. None of its campaigns or deals are serving.` | X | 01 |
| ADV-010 | advertiser.status | "Schedule for deletion" clicked: confirm dialog (DLG-05), status becomes Scheduled for deletion | E | `[SIM] Only users with write access to the advertiser can schedule it for deletion.` (role failure) | S | 14 |
| ADV-011 | advertiser.euPoliticalAds | no answer (default `No`) | E | `[SIM] Select whether this advertiser plans to serve EU political ads.` | S | 14 |
| ADV-012 | advertiser.demandGenFloodlightOptimization | toggled off while Demand Gen line items exist | W | `[SIM] {n} Demand Gen line items will stop delivering until this is turned back on.` | X | 14, 05 |
| ADV-013 | advertiser.businessName | longer than 25 | E | `[SIM] Use 25 characters or fewer.` | B, S | 14 |
| ADV-014 | advertiser.authorizations.productImprovement | unchecked while data-processing terms are not accepted | E | `[SIM] Product improvement can only be turned off after the data processing terms are accepted.` | S | 14 |
| ADV-015 | advertiser.alerts.underpacing.thresholdPct | outside 1-100 (default 90) | E | `[SIM] Enter a number between 1 and 100.` (RC-046) | B, S | 14 |
| ADV-016 | advertiser.alerts.spendThreshold.amount | negative; only editable when the toggle is on | E | `[SIM] Enter a number that is 0 or greater.` | B, S | 14 |
| ADV-017 | advertiser.thirdParty.iasClientId | not a non-negative integer (default 0) | E | `[SIM] Enter a whole number.` | B, S | 14 |
| ADV-018 | advertiser.thirdParty.rateCards[].affirmed | rate card row ticked without affirming terms checkbox | E | `[SIM] Confirm the terms to use this rate card.` | S | 14 |
| ADV-019 | advertiser.alerts.* | "Limited audience size" or "Deals offline" on while "Underpacing" is off | E | `[SIM] Turn on Underpacing to use this alert.` | X | 14 |
| ADV-020 | advertiser.* | Save pressed with nothing changed (button disabled) | I | (no message, button disabled until dirty) | X | 14 |

### 2.4 CMP: campaign (`/cs/new`, `/c/{cid}/details`)
| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| CMP-001 | campaign.name | empty | E | `Enter a value` | B, S | 03 |
| CMP-002 | campaign.name | longer than 240 | E | `[SIM] Use 240 characters or fewer.` | S | (from public docs) |
| CMP-003 | campaign.status | create: not `Active` / `Paused` (default Active) | E | `[SIM] Choose a status.` | S | 03 |
| CMP-010 | campaign.goal | not chosen (placeholder "Choose goal") | E | `[SIM] Choose a goal.` | S | 03 |
| CMP-011 | campaign.kpi.type | goal chosen but KPI not chosen. KPI dropdown disabled until a goal is chosen | E | `[SIM] Choose a KPI.` | S | 03, (from public docs) |
| CMP-012 | campaign.kpi.value | KPI chosen (not `OTHER`) and value empty | E | `Enter a value` | B, S | 03 |
| CMP-013 | campaign.kpi.type | KPI is in the "Not recommended" group for the goal (matrix MX-01) | W | `This KPI is not recommended for the selected campaign goal.` | X | 03 |
| CMP-014 | campaign.kpi.value | value present but `<= 0` | E | `Enter a number greater than 0` ‡ | B, S | 03, 04 |
| CMP-015 | campaign.kpi.value | % KPI (`CTR`, `VIEWABLE_PCT`) over 100 | E | `[SIM] Enter a number between 0 and 100.` | B, S | 03 |
| CMP-016 | campaign.kpi.otherText | KPI = `OTHER`: text is optional ("Enter your KPIs (optional)"), no value box | I | (none) | X | 03 |
| CMP-020 | campaign.creativeTypes | none of Display / Video / Audio ticked | E | `Please select at least one creative type.` | S | 03 |
| CMP-030 | campaign.plannedSpend | non-empty and not a number `>= 0` | E | `[SIM] Enter a number that is 0 or greater.` | B, S | 03 |
| CMP-031 | campaign.startDate | empty (default today) | E | `Enter a value` ‡ | S | 03 |
| CMP-032 | campaign.endDate | optional; when set must be `>= startDate` | E | `[SIM] End date must be on or after the start date.` | X | 03 (open question there), (from public docs) |
| CMP-033 | campaign.startDate | edit mode and campaign already started: field locked | E | `[SIM] The start date can't be changed after the campaign has started.` | S | 03 |
| CMP-034 | campaign.startDate | create: date before today | E | `[SIM] The start date can't be in the past.` | B, S | (from public docs) |
| CMP-040 | campaign.frequencyCap.maxImpressions | "Limit frequency" selected and `n` empty | E | `Enter a value` | B, S | 03 |
| CMP-041 | campaign.frequencyCap.maxImpressions | `n` not a whole number `>= 1` | E | `Enter a number greater than 0` ‡ | B, S | 03 |
| CMP-042 | campaign.frequencyCap.periodCount, .period | period count not a whole number `>= 1` (default 1), or unit not in `MINUTE, HOUR, DAY, WEEK, MONTH` (default MONTH) | E | `Enter a number greater than 0` ‡ | B, S | 03 |
| CMP-050 | campaign.budgets[].amount | row is partly filled (any cell non-empty) and Budget empty. Fully empty rows are ignored | E | `Enter a value` ‡ | S | 03 |
| CMP-051 | campaign.budgets[].name | row is partly filled and Name empty | E | `Enter a value` ‡ | S | 03 |
| CMP-052 | campaign.budgets[].amount | `<= 0`; for budget type Impressions must also be a whole number | E | `Enter a number greater than 0` ‡ | B, S | 03 |
| CMP-053 | campaign.budgets[].endDate | `< startDate` | E | `[SIM] End date must be on or after the start date.` | X | 03 |
| CMP-060 | campaign.landingPageUrls[] | non-empty and not a valid URL | E | `[SIM] Enter a valid URL.` | B, S | 03 |
| CMP-061 | campaign.keywords | more than 5 keywords (comma separated) | W | `Enter up to 5 keywords to help improve recommendations.` | B | 03 |
| CMP-070 | copySettings dialog | UI: "Copy Settings" disabled until a source campaign and at least one setting (Frequency cap, Campaign goal, Creative type) are ticked | E | (button disabled) | X | 03 |
| CMP-080 | campaign.* (banner) | always shown on create: inventory source and targeting live at line item level | I | `Inventory source and Targeting settings are now managed at the line item level. Use targeting templates for easy reuse.` | n/a | 03 |
| CMP-081 | campaign.goal card | gear note under the card | I | `These settings don't impact serving.` | n/a | 03 |
| CMP-090 | campaign.status | edit: archived campaign edited other than Unarchive | E | `[SIM] Archived campaigns can't be edited. Unarchive it first.` | S | (from public docs) |

Notes
* Changing the goal re-evaluates CMP-013 against the new goal and keeps the chosen KPI (it only changes group). If the goal is cleared, the KPI is cleared and disabled.
* CMP-012 and CMP-014 are separate IDs even though the text differs by case: empty gives `Enter a value`; present but `<= 0` gives `Enter a number greater than 0`.

### 2.5 IO: insertion order (`/ios/new` two steps, `/io/{id}/details`)
Step 1 rules (type and objective) run when "Next" is pressed. Step 2 rules run on the form.

| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| IO-001 | io.type | none chosen. Default `STANDARD` | E | `A selection is required` ‡ | S | 04 |
| IO-002 | io.objective | none chosen (Next disabled) | E | `A selection is required` ‡ | S | 04 |
| IO-003 | io.objective | UI: type `CTV_OTT` and objective `CLICKS` (radio disabled) | E | `[SIM] Clicks isn't available for Connected TV and OTT insertion orders.` | X | 04 |
| IO-004 | io.objective | UI: type `DOOH` and objective is anything but `NONE` (other radios disabled) | E | `[SIM] Digital out of home insertion orders can only be created without an objective.` | X | 04 |
| IO-005 | io.objective | edit: new value is not the current objective or `NONE`. Change to `NONE` is one-way | E | `[SIM] The objective can only be changed to "Insertion order without objective".` | S | 04 |
| IO-006 | io.type | edit: type differs from stored type (UI shows type read-only) | E | `[SIM] This setting can't be changed after it is created.` | S | (from public docs) |
| IO-010 | io.name | empty | E | `Enter a value` | B, S | 04 |
| IO-011 | io.name | longer than 240 (counter `0 / 240`) | E | `[SIM] Use 240 characters or fewer.` | S | 04 |
| IO-012 | io.status | create: not `DRAFT` / `ACTIVE`. Default `DRAFT` | E | `[SIM] Choose a status.` | S | 04 |
| IO-020 | io.budget.type | not `CURRENCY` or `IMPRESSIONS`; edit: differs from stored (locked after creation) | E | `[SIM] This setting can't be changed after it is created.` | S | 04 |
| IO-021 | io.budget.segments[].amount | empty (red border) | E | `Enter a value` ‡ | B, S | 04 |
| IO-022 | io.budget.segments[].amount | `<= 0` | E | `Enter a number greater than 0` ‡ | B, S | 04 |
| IO-023 | io.budget.segments[].amount | type `IMPRESSIONS` and not a whole number | E | `[SIM] Enter a whole number.` | B, S | 04 (open question there) |
| IO-024 | io.budget.segments[].endDate | `< startDate`. Defaults: start today, end last day of the current month | E | `[SIM] End date must be on or after the start date.` | X | 04 (open question there) |
| IO-025 | io.budget.segments[].startDate | edit: segment already started and start date changed (locked) | E | `[SIM] The start date can't be changed after the segment has started.` | S | 04 |
| IO-026 | io.budget.segments[].amount | edit: new amount below the amount already spent in that segment | E | `[SIM] The budget can't be lower than the amount already spent ({spent}).` | B, S | (from public docs) |
| IO-027 | io.budget.segments | two segments overlap in dates | E | `[SIM] Budget segments can't overlap.` | X | (from public docs) |
| IO-028 | io.budget.segments | no segment with an amount (default empty first row) | E | `Enter a value` ‡ (on first row amount) | S | 04 |
| IO-030 | io.pacing.period | not `FLIGHT` / `DAILY`. Default `FLIGHT` ("Recommended") | E | `[SIM] Choose a pacing period.` | S | 04 |
| IO-031 | io.pacing.type | not allowed for the period (matrix MX-05): `FLIGHT` allows `AHEAD`, `EVEN`; `DAILY` allows `EVEN`, `ASAP`. New IO default `FLIGHT` + `AHEAD` | E | `[SIM] This pacing type isn't available for the selected pacing period.` | X | 04 |
| IO-032 | io.pacing.dailyAmount | period `DAILY` and amount empty | E | `Enter a value` ‡ | B, S | 04 |
| IO-033 | io.pacing.dailyAmount | period `DAILY` and `<= 0` | E | `Enter a number greater than 0` ‡ | B, S | 04 |
| IO-034 | io.pacing.dailyAmount | daily amount greater than the budget of any segment | W | `[SIM] The daily amount is higher than the segment budget, so the segment budget will limit spend.` | X | (from public docs) |
| IO-040 | io.kpi.type | not in the objective's KPI list (MX-02). On objective change the KPI resets to the objective default | E | `[SIM] Choose a KPI that is available for this objective.` | X | 04 |
| IO-041 | io.kpi.value | KPI is not "Any/N-A" and value empty or `<= 0` | E | `Enter a number greater than 0` | B, S | 04 |
| IO-042 | io.kpi.value | % KPI (`VTR`, `TOS10`, `VIEWABLE_PCT`, `COMPL_AUDIO`, `COMPL_VIDEO`, `CTR`, `CLICK_CVR`, `IMPR_CVR`) over 100 | E | `[SIM] Enter a number between 0 and 100.` | B, S | 04 |
| IO-043 | io.kpi | type `DOOH`: KPI is N/A and hidden | I | (none) | X | 04 |
| IO-050 | io.optimization.mode | not `IO_AUTOMATED` / `LI_CONTROLLED`. Default `IO_AUTOMATED` | E | `[SIM] Choose how to optimize.` | S | 04 |
| IO-051 | io.optimization.mode | mode `IO_AUTOMATED`: info text under the control | I | `Your insertion order may only contain cross-exchange display, video and Connected TV line items` | X | 04 |
| IO-052 | io.lineItems[].type | mode `IO_AUTOMATED` and a line item of a type other than `DISPLAY`, `VIDEO`, `CTV` is added (or exists when switching to automated); `MOBILE_APP_INSTALL`, `ADS_IN_MOBILE_APPS`, `YT_*`, `DEMAND_GEN` and `DOOH_*` count as other types (RC-041) | E | `[SIM] Line items of this type can't be added to an insertion order that automates bid and budget.` | X | 04, 05 |
| IO-053 | io.optimization.mode | switching to `IO_AUTOMATED` while line items exist: their pacing becomes ASAP and bid strategy is taken from the IO (MX-05) | I | `[SIM] Line item bid strategy and pacing are managed by this insertion order.` | X | 04, 05 |
| IO-054 | io.optimization.optimizedTowards | not in the objective's bid strategy list (MX-04). Default for Brand awareness: `MAX_VIEWABLE_IMPRESSIONS` | E | `[SIM] Choose a bid strategy that is available for this objective.` | X | 04 |
| IO-055 | io.optimization.autoBudgetAllocation | ticked while mode is `IO_AUTOMATED` (option sits under "Additional options" of line-item control) | E | `[SIM] Automatic budget allocation is only available when bid and budget are controlled at the line item level.` | X | 04, (from public docs) |
| IO-056 | io.optimization.youtubeReachFrequency | ticked (ALPHA) but IO has no YouTube line item | W | `[SIM] This option only applies to YouTube & partners line items.` | X | 04 |
| IO-060 | io.frequencyCap.maxImpressions | "Limit frequency" selected and `n` empty | E | `Enter a value` ‡ | B, S | 04 |
| IO-061 | io.frequencyCap | "Unlimited" selected: shows the campaign cap | I | `The campaign's frequency cap is set to {n} exposures per {period}` | X | 04 |
| IO-062 | io.frequencyCap.maxImpressions, .periodCount | not a whole number `>= 1` | E | `Enter a number greater than 0` ‡ | B, S | 04 |
| IO-063 | io.frequencyCap | cap is looser than the campaign cap (formula in MX-06) | I | `[SIM] This limit is less restrictive than the campaign's, so the campaign limit applies.` | X | 03, 04 |
| IO-070 | io.partnerCosts.cpmFees[].amount | non-empty and `< 0` | E | `[SIM] Enter a number that is 0 or greater.` | B, S | 04 |
| IO-071 | io.partnerCosts.mediaFees[].percent | non-empty and outside 0-100 | E | `[SIM] Enter a number between 0 and 100.` | B, S | 04 |
| IO-072 | io.partnerCosts.*[].type | amount entered but Type not chosen. Fee type list in MX-17 | E | `[SIM] Choose a fee type.` | S | 04 |
| IO-073 | io.partnerCosts.mediaFees[0] | media fee 1 is the DV360 fee: locked, invoiced, cannot be edited or removed | E | `[SIM] This fee can't be changed.` | S | 04 |
| IO-074 | io.partnerCosts | more than 5 CPM fees or 5 media fees | E | `[SIM] You can add up to 5 fees of each kind.` | S | (from public docs), Q12 |
| IO-080 | io.integrationCode | longer than 500 bytes | E | `[SIM] Use {max} characters or fewer.` | S | 04, (from public docs) |
| IO-090 | io.status | activation with an `E` issue open | E | (the issue itself) | A | 04 |
| IO-091 | io.status | activate while parent campaign is Archived | E | `[SIM] Unarchive the campaign before activating this insertion order.` | A | (from public docs) |
| IO-092 | io.budget.segments | activate and no segment has `endDate >= today` | E | `[SIM] An active insertion order needs a budget segment that has not ended.` | A | (from public docs) |
| IO-093 | io (cross-entity) | sum of line item budgets (fixed amounts) in the IO is greater than the IO budget (all segments) | W | `The total budget of all line items is greater than the insertion order budget.` | X | 18 |
| IO-094 | io (cross-entity) | any line item has custom flight dates outside the IO's segments, or a LI pacing/bid setting contradicts IO automation | W | `Insertion order or line item has conflicting settings which may prevent your budget from being spent` | X | 04 (Intelligence panel), 14 (alert) |
| IO-095 | io.budget.segments | editing segments so a line item's custom dates fall outside the new IO flight | W | `[SIM] {n} line items have dates outside this insertion order's flight.` | X | (from public docs) |
| IO-100 | io.budget.segments[] (list inline edit) | Budget-cell pencil edit on the grid uses IO-021..IO-027 | E | same as the linked rule | B, S | 15 |

### 2.6 LI: line item, rules shared by all types (`/lis/new`, `/li/{id}/details`)
| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| LI-001 | li.name | empty | E | `Enter a value` | B, S | 05 |
| LI-002 | li.name | longer than 240 (`0 / 240`) | E | `[SIM] Use 240 characters or fewer.` | S | 05 |
| LI-003 | li.status | create: not `DRAFT` / `ACTIVE`. Default `DRAFT` | E | `[SIM] Choose a status.` | S | 05 |
| LI-004 | li.type | edit: differs from stored type | E | `[SIM] This setting can't be changed after it is created.` | S | 05 |
| LI-005 | li.ioId | IO missing or archived. Step 1 lets the user switch IO; every switch re-runs LI-006 and LI-007 | E | `[SIM] Choose an active or paused insertion order.` | X | 05 |
| LI-006 | li.type | type not allowed by the IO objective (MX-03). UI: card greyed with an info icon | E | `{Type} line items aren't compatible with your insertion order's objective setting.` | X | 05 |
| LI-007 | li.type | type not allowed by IO type (MX-02: `DOOH` IO allows only `DOOH_DISPLAY`, `DOOH_VIDEO`; `CTV_OTT` IO allows only `CTV`, `YT_ON_CTV`; `STANDARD` IO allows none of those three) | E | `{Type} line items aren't compatible with your insertion order's objective setting.` ‡ (same wording) | X | 04, 05 |
| LI-008 | li.ioId | IO with `IO_AUTOMATED` mode and type not in `DISPLAY`, `VIDEO`, `CTV` | E | see IO-052 | X | 04 |
| LI-010 | li.inventory.quality | not one of `AUTHORIZED_DIRECT_SELLERS`, `AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS` (default), `AUTHORIZED_AND_NON_PARTICIPATING` | E | `[SIM] Choose an inventory quality option.` | S | 05 |
| LI-011 | li.inventory | no public exchange, no deal/package and no deal group selected | E | `[SIM] Select at least one inventory source.` | S | (from public docs), 05 |
| LI-012 | li.inventory.exchanges[] | exchange is not enabled at partner level (PRT exchanges) | E | `[SIM] This exchange isn't enabled for the partner.` | S | 02, 05 |
| LI-013 | li.inventory.deals[] | deal not accessible to this advertiser, or deal exchange not enabled, or deal Archived/Not servable | E | `[SIM] This deal isn't available to this advertiser.` | S | 09 |
| LI-014 | li.inventory.targetCuratedCtv | checkbox only on `VIDEO` and `CTV` | E | `[SIM] This option isn't available for {Type} line items.` | S | 05 |
| LI-020 | li.flight.mode | not `SAME_AS_IO` (default) or `CUSTOM` | E | `[SIM] Choose flight dates.` | S | 05 |
| LI-021 | li.flight.endDate | `CUSTOM` and `endDate < startDate` | E | `[SIM] End date must be on or after the start date.` | X | (from public docs) |
| LI-022 | li.flight | `CUSTOM` and range outside the IO flight (earliest segment start to latest segment end) | E | `[SIM] Line item dates must be within the insertion order's flight.` | X | (from public docs) |
| LI-023 | li.flight.startDate | edit: line item already started and start changed | E | `[SIM] The start date can't be changed after the line item has started.` | S | (from public docs) |
| LI-024 | li.flight.startDate | `CUSTOM` start date is a past date on create | E | `[SIM] The start date can't be in the past.` | B, S | (from public docs) |
| LI-030 | li.budget.amount | mode "[amount] INR" and empty (default "Unlimited up to the insertion order's budget") | E | `Enter a value` ‡ | B, S | 05 |
| LI-031 | li.budget.amount | mode amount and `<= 0` | E | `Enter a number greater than 0` ‡ | B, S | 05 |
| LI-032 | li.budget.amount | budget type of the IO is `IMPRESSIONS` and value not a whole number | E | `[SIM] Enter a whole number.` | B, S | 04, 05 |
| LI-033 | li.budget.amount | amount greater than the IO budget (all segments) | W | `The total budget of all line items is greater than the insertion order budget.` ‡ | X | 18 |
| LI-034 | li.pacing.period/type | combination not allowed (MX-05) | E | `[SIM] This pacing type isn't available for the selected pacing period.` | X | 05 |
| LI-035 | li.pacing.type | parent IO mode `IO_AUTOMATED`: type forced to `ASAP`, field locked | E | `[SIM] Pacing is managed by the insertion order's automation.` | X | 05 |
| LI-036 | li.pacing.dailyAmount | period `DAILY` and empty or `<= 0` | E | `Enter a number greater than 0` ‡ | B, S | 05, 06 |
| LI-037 | li.pacing.dailyAmount | greater than the LI budget (when set) | W | `[SIM] The daily amount is higher than the line item budget, so the line item budget will limit spend.` | X | (from public docs) |
| LI-040 | li.bid.mode | not `AUTOMATED` / `FIXED` | E | `[SIM] Choose a bid strategy.` | S | 05 |
| LI-041 | li.bid.fixedCpm | mode `FIXED` and empty or `<= 0` | E | `Enter a number greater than 0` ‡ | B, S | 05 |
| LI-042 | li.bid.optimizedTowards | mode `AUTOMATED` and strategy not in the IO objective list for this type (MX-04, MX-07) | E | `[SIM] Choose a bid strategy that is available for this insertion order.` | X | 04, 05 |
| LI-043 | li.bid.targetValue | prioritising "a target CPC" / CPA / ROAS / CPM and target empty or `<= 0` | E | `Enter a number greater than 0` ‡ | B, S | 05 |
| LI-044 | li.bid | parent IO `IO_AUTOMATED`: bid strategy locked to the IO's | E | `[SIM] Bid strategy is managed by the insertion order's automation.` | X | 04 |
| LI-045 | li.bid.mode | type `AUDIO`: default `FIXED` | I | (none) | X | 05 |
| LI-046 | li.bid.optimizedTowards | `MAX_CONVERSIONS`, `MAX_CONVERSION_VALUE`, `TARGET_CPA`, `TARGET_ROAS` with no Floodlight activity selected | E | `[SIM] Select at least one conversion to use this bid strategy.` | X | 05, (from public docs) |
| LI-047 | li.bid.optimizedTowards | `MAX_CUSTOM_VALUE_COST` / `TARGET_CUSTOM_VALUE_COST` with no custom bidding algorithm chosen, or the algorithm is not `Active` | E | `[SIM] Choose an active custom bidding algorithm.` | X | 11 |
| LI-050 | li.frequencyCap.maxImpressions | "Limit frequency" selected and `n` empty | E | `Enter a value` ‡ | B, S | 05 |
| LI-051 | li.frequencyCap.maxImpressions, .periodCount | not a whole number `>= 1` | E | `Enter a number greater than 0` ‡ | B, S | 05 |
| LI-052 | li.frequencyCap | "Unlimited up to the higher level frequency cap" selected | I | `The higher level frequency cap is set to {n} exposures per {period}` | X | 05 |
| LI-053 | li.frequencyCap | cap is looser than the effective higher-level cap (MX-06) | I | `[SIM] This limit is less restrictive than the higher-level limit, so the higher-level limit applies.` | X | 05 |
| LI-060 | li.creatives[] | assigned creative is not eligible for the LI type (MX-09) | E | `[SIM] This creative can't be used in {Type} line items.` | S | 08 |
| LI-061 | li.creatives[] | creative archived or DV360 review "Not servable" | E | `[SIM] This creative can't be assigned because it isn't servable.` | S | 08 |
| LI-062 | li.creatives | no creative assigned (forecast panel and list) | I | `Inventory availability could not be determined. You may need to add creatives.` (panel) and `No creatives assigned` (list) | X | 05 |
| LI-063 | li.creatives | activating with no creative assigned (not for `YT_VIDEO`, `YT_AUDIO`, `DEMAND_GEN`, whose ads live in ad groups) | W | `[SIM] This line item has no creatives and won't deliver.` | A | 05, 06 |
| LI-064 | li.creatives[] | creative restricted for a geography the LI targets, or disapproved on every selected exchange | W | `This creative is restricted from serving in line items that target {country}.` | X | 08 |
| LI-070 | li.conversions.activities[] | activity not Active or from a Floodlight group not linked to the advertiser | E | `[SIM] Choose an active conversion from the advertiser's Floodlight group.` | S | 05, 11 |
| LI-071 | li.conversions.countingMode | not one of `ALL`, `POST_CLICK_ONLY`, `PERCENTAGE` | E | `[SIM] Choose a conversion counting option.` | S | 05 |
| LI-072 | li.conversions.postViewPct | mode `PERCENTAGE` and value empty (default 100) or outside 0-100 | E | `Enter a value` ‡ for empty; `[SIM] Enter a number between 0 and 100.` otherwise | B, S | 05 |
| LI-073 | li.conversions.attributionModelId | model not in the advertiser's Floodlight attribution models (default "Primary model") | E | `[SIM] Choose an attribution model.` | S | 05 |
| LI-080 | li.euPoliticalAds | no answer on create (radio is "Required") | E | `[SIM] Select whether this line item has EU political ads.` | S | 05 |
| LI-081 | li.euPoliticalAds | SDF upload row blank: value becomes `NO` silently | I | `Line items without an answer for EU political ads will get "No"` (dialog text) | S | 15 |
| LI-090 | li.revenueModel.value | markup % outside 0-100, or CPM value `< 0` | E | `[SIM] Enter a number that is 0 or greater.` | B, S | 05 |
| LI-091 | li.partnerCosts | same as IO-070..IO-074 | E | same as the linked rules | B, S | 05 |
| LI-092 | li.integrationCode | longer than 500 bytes | E | `[SIM] Use {max} characters or fewer.` | S | 05 |
| LI-100 | li.targeting (locked rows) | advertiser targeting rules removed or edited at LI level (brand suitability Inventory mode, Open Measurement) | E | `[SIM] This targeting is set in the advertiser's targeting rules.` | S | 05, 14 |
| LI-101 | li.targeting.templateId | template LI type differs from the LI type | E | `[SIM] This template is for {Type} line items.` | S | 15 |
| LI-102 | li.targeting.dimensions | dimension not available for the LI type (MX-10) | E | `[SIM] {Dimension} targeting isn't available for {Type} line items.` | S | 07, 05, 06 |
| LI-110 | li.status | activation with an `E` issue open | E | (the issue itself) | A | 05 |
| LI-111 | li.status | activate while parent IO is Archived or parent campaign is Archived | E | `[SIM] Unarchive the insertion order before activating this line item.` | A | (from public docs) |
| LI-120 | li.copySettings | "Copy settings from an existing line item": source must be the same type (settings that do not apply are skipped) | I | `[SIM] Settings that don't apply to this line item type weren't copied.` | S | 05 |

Notes
* `LI-033`, `IO-093` and `AB-023` are one condition with three display places. The engine's alert generator reuses `IO-094`.
* LI-006 and LI-007 share one wording because DV360 shows the same tooltip for both causes.

### 2.7 LI-DSP: Display (`New display line item`)
| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| LI-DSP-001 ~LI-100 | li.targeting.brandSuitability | row is pre-added and locked (Inventory mode "Maximum inventory", "Not yet labeled"). Not removable | E | `[SIM] This targeting is set in the advertiser's targeting rules.` | S | 05, 07 |
| LI-DSP-002 ~LI-100 | li.targeting.viewability.openMeasurement | pre-added and locked: "Target only Open Measurement enabled mobile display inventory." | E | `[SIM] This targeting is set in the advertiser's targeting rules.` | S | 05, 07, 14 |
| LI-DSP-010 | li.inventory.exchanges | default selection is the partner's enabled exchanges that support display (45 of the 54 in the demo) | I | `[SIM] {n} exchanges and 0 subexchanges are selected` | X | 05 |
| LI-DSP-020 | li.targeting.position | position value not in the Display position lists (MX-10 notes) | E | `[SIM] Choose a valid position.` | S | 07 |
| LI-DSP-021 | li.targeting.viewability.predicted | not one of 90, 80, ..., 10 % or "All impressions" (default) | E | `[SIM] Choose a viewability option.` | S | 07 |
| LI-DSP-030 ~LI-060 | li.creatives[] | creative type must be in MX-09 row `DISPLAY`: image, HTML5, native display, native video, third-party display | E | `[SIM] This creative can't be used in Display line items.` | S | 05, 08 |
| LI-DSP-031 | li.creatives[].dimensions | creative size not in the inventory size list (MX-09b) | W | `[SIM] This creative size can't serve on most exchanges.` | S | (from public docs) |

### 2.8 LI-VID: Video
| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| LI-VID-001 | li.inventory.exchanges | default is the partner's enabled exchanges that support video (46 in the demo) | I | `[SIM] {n} exchanges and 0 subexchanges are selected` | X | 05 |
| LI-VID-002 | li.targeting.viewability.openMeasurement | no default Open Measurement row for video | I | (none) | X | 05 |
| LI-VID-003 ~LI-102 | li.targeting.videoPlayerSize, .position, .contentDuration, .livestream, .rewarded | video-only dimensions; only valid on `VIDEO`, `CTV`, `YT_ON_CTV`, `DOOH_VIDEO` | E | `[SIM] {Dimension} targeting isn't available for {Type} line items.` ‡ | S | 05, 07 |
| LI-VID-010 ~LI-060 | li.creatives[] | creative type must be in MX-09 row `VIDEO` (hosted video, YouTube video, third-party video VAST, native video) | E | `[SIM] This creative can't be used in Video line items.` | S | 05, 08 |

### 2.9 LI-CTV: Connected TV
| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| LI-CTV-001 ~LI-006 | li.ioId | CTV line item in an IO with objective `CLICKS` | E | `{Type} line items aren't compatible with your insertion order's objective setting.` ‡ | X | 05 (greyed in Clicks IO) |
| LI-CTV-002 | li.targeting.position | pre-added "Position in content: In-stream, all positions selected" | I | (none) | X | 05 |
| LI-CTV-003 | li.targeting.videoPlayerSize | pre-added "Large, HD" | I | (none) | X | 05 |
| LI-CTV-004 | li.targeting.device | pre-added "Include: Connected TV. Exclude: Computer, Smartphone, Tablet". Removing Connected TV from the included list | E | `[SIM] Connected TV line items must target Connected TV devices.` | S | 05, (from public docs) |
| LI-CTV-005 ~LI-042 | li.bid.optimizedTowards | in a `BRAND_AWARENESS` IO: automated = `MAX_REACH` only (plus fixed bid) | E | `[SIM] Choose a bid strategy that is available for this insertion order.` ‡ | X | 05 |
| LI-CTV-006 | li.inventory.targetCuratedCtv | checkbox "Target DV360 curated CTV auction inventory" available (46 exchanges) | I | (none) | X | 05 |
| LI-CTV-010 ~LI-060 | li.creatives[] | creative type must be in MX-09 row `CTV` (hosted video, third-party video VAST). YouTube-hosted video not allowed | E | `[SIM] This creative can't be used in Connected TV line items.` | S | (from public docs) |

### 2.10 LI-AUD: Audio
| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| LI-AUD-001 | li.inventory.exchanges | public inventory limited to the 11 exchanges that support audio. Note under the control | I | `Google Ad Manager and Spotify Ad Exchange support public inventory for audio line items.` | X | 05 |
| LI-AUD-002 | li.targeting | targeting note | I | `Most audio ads serve in mobile app environments, which limits the available targeting options.` | X | 05 |
| LI-AUD-003 ~LI-102 | li.targeting.viewability, .position, .browser, .connectionSpeed | not available on audio (MX-10) | E | `[SIM] {Dimension} targeting isn't available for {Type} line items.` ‡ | S | 05, (from public docs) |
| LI-AUD-004 | li.bid.mode | default is `FIXED` (automated not pre-selected) | I | (none) | X | 05 |
| LI-AUD-010 ~LI-060 | li.creatives[] | creative type must be in MX-09 row `AUDIO` (audio file, third-party audio) | E | `[SIM] This creative can't be used in Audio line items.` | S | 05, 08 |

### 2.11 LI-APP: Mobile app install and Ads in mobile apps
| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| LI-APP-001 | li.app.platform | `MOBILE_APP_INSTALL` step 1: platform not chosen. Default `ALL` (All platforms / iOS / Android) | E | `[SIM] Choose a platform.` | S | 05 |
| LI-APP-002 | li.app.storeId | `MOBILE_APP_INSTALL`: no app selected via "Search for Android or iOS apps" (Next disabled) | E | `[SIM] Select an app.` | S | 05 |
| LI-APP-003 | li.adType | both types: not `DISPLAY` / `VIDEO` (radio, default Display) | E | `A selection is required` ‡ | S | 05 |
| LI-APP-004 ~LI-001 | li.name | `ADS_IN_MOBILE_APPS` pre-step: name empty (Next disabled) | E | `Enter a value` | B, S | 05 |
| LI-APP-005 | li.targeting.environment | `ADS_IN_MOBILE_APPS`: locked "Include: App". Cannot be removed or changed | E | `[SIM] This targeting can't be changed for {Type} line items.` | S | 05 |
| LI-APP-006 | li.targeting.device | `ADS_IN_MOBILE_APPS`: locked "Include: Smartphone, Tablet" | E | `[SIM] This targeting can't be changed for {Type} line items.` | S | 05 |
| LI-APP-007 ~LI-060 | li.creatives[] | creative type must match `adType`: DISPLAY uses MX-09 row `DISPLAY` set without native site; VIDEO uses row `VIDEO` | E | `[SIM] This creative can't be used in {Type} line items.` ‡ | S | 05 |
| LI-APP-008 | li.app.* | after creation the app and platform are read-only | E | `[SIM] This setting can't be changed after it is created.` | S | (from public docs) |
| LI-APP-009 | li.bid.optimizedTowards | `MOBILE_APP_INSTALL`: conversions counted through app attribution partner links (FL group "Partner integrations") | W | `[SIM] Link an app attribution partner to measure installs.` | A | 11, (from public docs) |

### 2.12 LI-YT: YouTube & partners (video and audio)
Step 1 fields are final; step 2 holds the details form. YouTube audio mirrors video (Q5).

| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| LI-YT-001 ~LI-001 | li.name | step 1 name empty (Next disabled, hint "Required") | E | `Enter a value` | B, S | 06 |
| LI-YT-002 | li.optimization | not `REACH` (default), `TARGET_FREQUENCY`, `TRUEVIEW_VIEWS`, `AD_SEQUENCE` | E | `A selection is required` ‡ | S | 06 |
| LI-YT-003 | li.adFormatChoice | `REACH`: not `EFFICIENT` (default) / `NON_SKIPPABLE`. `TARGET_FREQUENCY`: not `ALL_FORMATS` (default) / `IN_STREAM_ONLY`. `TRUEVIEW_VIEWS` and `AD_SEQUENCE`: no choice shown (matrix MX-07) | E | `A selection is required` ‡ | S | 06 |
| LI-YT-004 | li.subtype | edit: subtype (optimization + format choice) differs from the stored one (read-only after step 1) | E | `[SIM] This setting can't be changed after it is created.` | S | 06 |
| LI-YT-005 | li.adFormats | subtype `EFFICIENT_REACH` or `TARGET_FREQUENCY`: none of In-stream, In-feed, Shorts ticked (all ticked on new) | E | `[SIM] Select at least one ad format.` | S | 06 |
| LI-YT-006 | li.budget.amount | line item budget "Required" when Daily or Flight chosen (new default Daily) | E | `Enter a value` ‡ | B, S | 06 |
| LI-YT-007 | li.budget.amount | `<= 0` | E | `Enter a number greater than 0` ‡ | B, S | 06 |
| LI-YT-008 | li.pacing | YouTube pacing: new default `DAILY` + `EVEN`. Note shown: "Actual spend on a given day may vary." | I | `Actual spend on a given day may vary.` | X | 06 |
| LI-YT-009 | li.bid.optimizedTowards | locked by subtype (MX-07): `REACH` locks to `MAX_REACH` | E | `[SIM] Bid strategy is set by the line item type.` | X | 06 |
| LI-YT-010 | li.frequencyCap.exposure | "Limit frequency" and `n` empty / `<= 0` | E | `Enter a value` ‡ / `Enter a number greater than 0` ‡ | B, S | 06 |
| LI-YT-011 | li.frequencyCap.view | "Limit to [n] views" and `n` empty / `<= 0` | E | `Enter a value` ‡ / `Enter a number greater than 0` ‡ | B, S | 06 |
| LI-YT-012 | li.frequencyCap.targetFrequency | subtype `TARGET_FREQUENCY_*`: exposure target required | E | `Enter a value` ‡ | S | 06, (from public docs) |
| LI-YT-013 | li.productFeed | "Use a Google Merchant Center product feed" ticked but no Merchant Center account is linked in Data manager | E | `[SIM] Link a Merchant Center account to use a product feed.` | S | 06, 14 |
| LI-YT-014 | li.conversions | conversion activity search (YouTube LIs) uses LI-070..LI-073 | E | same as the linked rules | S | 06 |
| LI-YT-015 ~LI-080 | li.euPoliticalAds | required, as LI-080 | E | `[SIM] Select whether this line item has EU political ads.` ‡ | S | 06 |
| LI-YT-016 ~LI-102 | li.targeting | line item level menu limited to Keyword exclusions, Language, Inventory sources, Geography, Day & time, Device (MX-10). Audience lists, demographics and placements belong to the ad group | E | `[SIM] {Dimension} targeting isn't available for {Type} line items.` ‡ | S | 06 |
| LI-YT-017 | li.targeting.inventorySources | none of YouTube, Google TV, Video partners remain ticked | E | `[SIM] Select at least one inventory source.` ‡ | S | 06 |
| LI-YT-018 | li.adGroups | activating the LI with no active ad group | W | `[SIM] This line item has no active ad groups and won't run.` | A | 06 |
| LI-YT-019 ~LI-006 | li.ioId | IO objective not `BRAND_AWARENESS` or `NONE` (see MX-03) | E | `{Type} line items aren't compatible with your insertion order's objective setting.` ‡ | X | 05, 06 |
| LI-YT-021 | advertiser.googleInventoryEnabled | partner "Google & partner inventory" not enabled for this advertiser | E | `[SIM] YouTube & partners and Demand Gen line items aren't enabled for this advertiser.` ‡ | S | 02 |
| LI-YT-020 | li.adGroups[].audience | `AD_SEQUENCE`: sequence needs at least two steps | E | `[SIM] Add at least two ads to the sequence.` | S | 06 (builder not seen), (from public docs), Q6 |

### 2.13 AG and AD: YouTube ad group and ad
| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| AG-001 | adGroup.name | empty | E | `Enter a value` ‡ | B, S | 06 |
| AG-002 | adGroup.name | longer than 255 (`0/255`) | E | `[SIM] Use 255 characters or fewer.` | S | 06 |
| AG-003 | adGroup.bid | the bid field for the LI strategy (for example Target CPM) is empty ("required") | E | `Enter a value` ‡ | B, S | 06 |
| AG-004 | adGroup.bid | `<= 0` | E | `Enter a number greater than 0` ‡ | B, S | 06 |
| AG-005 | adGroup (status Active) | active ad group with zero ads | W | `This active ad group doesn't have any ads. It won't run until you create ads.` | X | 06 |
| AG-006 | adGroup.targeting | "No targeting" is allowed. Dimensions limited to Placements/keywords/categories, Demographics, Audience lists & expansion | E | `[SIM] {Dimension} targeting isn't available for ad groups.` ‡ | S | 06 |
| AG-007 | adGroup.ads | info text: include 1 horizontal video 10-60 s (skippable in-stream and in-feed), 1 horizontal 6 s (bumper), 1 vertical 5 s (Shorts) | I | `Get more reach by including at least: 1 horizontal video ad, 10-60 sec. (Skippable in-stream and in-feed); 1 horizontal video ad, 6 sec. (Bumper); 1 vertical video ad, 5 sec. (Shorts)` | X | 06 |
| AG-008 | adGroup | delete (trash icon) requires confirm dialog DLG-08 | I | (dialog) | S | 06 |
| AD-001 | ad.name | empty | E | `Enter a value` ‡ | B, S | 06 |
| AD-002 | ad.name | longer than 255 | E | `[SIM] Use 255 characters or fewer.` | S | 06 |
| AD-003 | ad.videoId | empty ("Search for a video or paste the URL from YouTube") | E | `Enter a value` ‡ | S | 06 |
| AD-004 | ad.videoId | URL/ID does not resolve to a public or unlisted YouTube video the advertiser may promote | E | `[SIM] We couldn't find that video. Check the URL or ID.` | B, S | 06, (from public docs) |
| AD-005 | ad.headline | longer than 30 | E | `[SIM] Use 30 characters or fewer.` | B, S | 06 |
| AD-006 | ad.longHeadline | empty (required) | E | `Enter a value` ‡ | B, S | 06 |
| AD-007 | ad.longHeadline | longer than 90 | E | `[SIM] Use 90 characters or fewer.` | S | 06 |
| AD-008 | ad.description | empty (required) | E | `Enter a value` ‡ | B, S | 06 |
| AD-009 | ad.description | longer than 90 | E | `[SIM] Use 90 characters or fewer.` | S | 06 |
| AD-010 | ad.callToAction | longer than 10 | E | `[SIM] Use 10 characters or fewer.` | S | 06 |
| AD-011 | ad.businessName | from 12 Oct 2026 required for YouTube ads (default from advertiser). Empty | E | `Enter a value` ‡ | S | 06, 14 |
| AD-012 | ad.businessName | longer than 25 | E | `[SIM] Use 25 characters or fewer.` | S | 06, 14 |
| AD-013 | ad.businessName | advertiser-level default exists: field cannot be cleared at ad level | E | `[SIM] The business name is set for the whole advertiser and can't be cleared here.` | S | 14 |
| AD-014 | ad.logo | from 12 Oct 2026 required for YouTube ads (default from advertiser). Missing | E | `[SIM] Add a logo.` | S | 06, 14 |
| AD-015 | ad.displayUrl.path1, .path2 | longer than 15 each | E | `[SIM] Use 15 characters or fewer.` | B, S | 06 |
| AD-016 | ad.landingPageUrl | empty (required) | E | `Enter a value` ‡ | B, S | 06 |
| AD-017 | ad.landingPageUrl, ad.clickTrackerUrl | invalid URL for the chosen protocol (`http://` or `https://`) | E | `[SIM] Enter a valid URL.` ‡ | B, S | 06 |
| AD-018 | ad.companionBanner | "Upload my own image" chosen with no image. Only shown for desktop in-stream | E | `[SIM] Upload a companion banner image.` | S | 06 |
| AD-019 | ad.status | not `ACTIVE` / `PAUSED` (chip, default Active) | E | `[SIM] Choose a status.` | S | 06 |
| AD-020 | ad.aiLabel | EU, India and New York laws may need an AI label. Shown as info text | I | `[SIM] Laws in some regions may require labelling AI-made ads.` | X | 06, 17 |

### 2.14 LI-DG: Demand Gen
Demand Gen could not be opened in the demo (05, 17). Everything except LI-DG-001 and LI-DG-002 is `(from public docs)`.

| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| LI-DG-001 | advertiser.demandGenFloodlightOptimization | user clicks the Demand Gen card while "Use Floodlight data for conversion optimization on Demand Gen line items" is off. Yellow toast at the top with Dismiss, the picker stays open | E | `To create Demand Gen line items:` then bullet `Enable Floodlight optimization in this advertiser` | S (card click) | 05, 14 |
| LI-DG-002 ~LI-006 | li.ioId | IO objective is `BRAND_AWARENESS` or `CUSTOM` (MX-03) | E | `{Type} line items aren't compatible with your insertion order's objective setting.` ‡ | X | 05, 04 |
| LI-DG-003 ~LI-007 | li.ioId | IO type is not `STANDARD` | E | `{Type} line items aren't compatible with your insertion order's objective setting.` ‡ | X | 04 |
| LI-DG-004 | advertiser.googleInventoryEnabled | partner "Google & partner inventory" not enabled for this advertiser (02, Advertiser configurations) | E | `[SIM] YouTube & partners and Demand Gen line items aren't enabled for this advertiser.` | S | 02 |
| LI-DG-005 | li.conversions.activities | IO objective `CONVERSIONS` and no Floodlight activity chosen | E | `[SIM] Select at least one conversion.` | S | (from public docs) |
| LI-DG-006 | li.budget.amount, li.pacing | like YouTube: budget and daily amount required | E | `Enter a value` ‡ | B, S | (from public docs) |
| LI-DG-007 | li.ads[].headline | longer than 40 | E | `[SIM] Use 40 characters or fewer.` | S | (from public docs), Q8 |
| LI-DG-008 | li.ads[].description | longer than 90 | E | `[SIM] Use 90 characters or fewer.` | S | (from public docs) |
| LI-DG-009 | li.ads[].businessName | empty or longer than 25 | E | `Enter a value` ‡ / `[SIM] Use 25 characters or fewer.` | S | 14 |
| LI-DG-010 | li.ads | activating with no ad | W | `[SIM] This line item has no ads and won't run.` | A | (from public docs) |
| LI-DG-011 ~LI-102 | li.targeting | line item targeting limited to Audience lists and expansion (incl. lookalike), Demographics, Geography, Language, Device, Day & time (MX-10) | E | `[SIM] {Dimension} targeting isn't available for {Type} line items.` ‡ | S | (from public docs) |

### 2.15 LI-DOOH: Display and Video digital out of home
Not explored (05 "not explored"). All `(from public docs)` except where the IO file said so.

| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| LI-DOOH-001 ~LI-007 | li.ioId | IO type is not `DOOH` | E | `{Type} line items aren't compatible with your insertion order's objective setting.` ‡ | X | 04 |
| LI-DOOH-002 | li.bid.mode | not `FIXED` (only Fixed bid exists) | E | `[SIM] Digital out of home line items use a fixed bid.` | S | 04 |
| LI-DOOH-003 | li.bid.fixedCpm | empty or `<= 0` | E | `Enter a number greater than 0` ‡ | B, S | 04 |
| LI-DOOH-004 | li.inventory.exchanges | any exchange outside the DOOH set (`Hivestack`, `Place Exchange`, `VIOOH Digital Out of Home`, `Vistar`) | E | `[SIM] Only digital out of home exchanges are available for this line item.` | S | 02 (exchange list), (from public docs) |
| LI-DOOH-005 ~LI-102 | li.targeting | dimensions limited to Geography, Day & time, Inventory sources and DOOH venue and screen targeting (MX-10) | E | `[SIM] {Dimension} targeting isn't available for {Type} line items.` ‡ | S | (from public docs), Q7 |
| LI-DOOH-006 | li.kpi | KPI N/A | I | (none) | X | 04 |
| LI-DOOH-007 ~LI-060 | li.creatives[] | `DOOH_DISPLAY`: image or HTML5; `DOOH_VIDEO`: hosted video; dimensions must match the screen sizes of the targeted venues | E | `[SIM] This creative can't be used in {Type} line items.` ‡ | S | (from public docs) |
| LI-DOOH-008 ~LI-101 | li.targeting.templateId | targeting templates not available for DOOH | E | `[SIM] Targeting templates aren't available for {Type} line items.` ‡ | S | 15 |

### 2.16 TGT: targeting (shared panel and cross-dimension rules)
Editors open as a right slide-over with Apply · Cancel · trash (07). "Dimension row added" = the row exists in the LI Targeting card.

| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| TGT-001 | any list editor | same item both included and excluded (UI toggles are mutually exclusive) | E | `[SIM] An item can't be both included and excluded.` | S | 07 |
| TGT-002 | any list editor | Apply pressed with nothing selected while the row is being added | E | `[SIM] Select at least one item.` | S | 07 |
| TGT-003 ~LI-102 | li.targeting.dimensions | dimension not available for the LI type (MX-10) | E | `[SIM] {Dimension} targeting isn't available for {Type} line items.` | S | 07 |
| TGT-004 | li.targeting (default rows) | rows pre-added by type (Brand suitability, Viewability OM, Position, Device, Environment, Geography "All locations"): present on create | I | (none) | X | 05, 06, 07 |
| TGT-010 | geography.region | Region mode, row added, zero regions chosen | E | `[SIM] Select at least one location.` | S | 07 |
| TGT-011 | geography.radius.points[] | line is not a street address or `lat,long` pair (bulk "Bulk add points of interest" paste) | E | `[SIM] Enter a street address or a latitude and longitude pair on each line.` | B, S | 07 |
| TGT-012 | geography.radius.distance | distance outside the allowed range (1-500 km, same in miles) | E | `[SIM] Enter a distance between 1 and 500 km.` | B, S | (from public docs), Q10 |
| TGT-013 | geography | an included region sits inside an excluded region of the same row | W | `[SIM] {Region} is inside an excluded location, so it won't be targeted.` | X | 07 |
| TGT-020 | appsUrls.items[] | URL does not parse, or app ID not `package`/store ID | E | `[SIM] Enter a valid URL or app ID.` | B, S | 07 |
| TGT-021 | appsUrls | same channel/URL/app in both include and exclude | E | `[SIM] An item can't be both included and excluded.` ‡ | S | 07 |
| TGT-022 | appsUrls.channels[] | channel does not belong to the advertiser or partner | E | `[SIM] Choose a channel from this advertiser or partner.` | S | 11 |
| TGT-023 | appsUrls bulk add | pasted lines that failed parsing | W | `[SIM] {n} entries couldn't be added.` | S | 07 |
| TGT-030 | keywords.include / .exclude | row added with zero keywords | E | `Enter a value` ‡ | S | 07 |
| TGT-031 | keywords | separators: new line or comma; entries trimmed, case-folded, de-duplicated before counting | I | (none) | B | 07 |
| TGT-032 | keywords | one keyword longer than 80 characters | E | `[SIM] Use 80 characters or fewer.` | B, S | (from public docs) |
| TGT-033 | keywords | more than 5,000 positive keywords on a line item | E | `[SIM] Use 5,000 keywords or fewer.` | S | 07 (counter), (from public docs) |
| TGT-034 | keywords | same keyword in include and exclude | E | `[SIM] An item can't be both included and excluded.` ‡ | S | 07 |
| TGT-040 | categories | row added with zero categories chosen | E | `[SIM] Select at least one item.` ‡ | S | 07 |
| TGT-050 | environment | row added with neither Web nor App ticked | E | `[SIM] Select at least one environment.` | S | 07 |
| TGT-060 | position | row added with no value; value not in the lists of the creative type (Display: above/below fold, unknown; content: in-article, in-feed, interstitial, in-banner, unknown; Native: in-article, in-feed, peripheral, recommendation, unknown). On-screen AND in-content must both pass | E | `[SIM] Select at least one position.` | S | 07 |
| TGT-070 | viewability.predicted | value not in the 10-step list or "All impressions". `OpenMeasurement` row is locked | E | `[SIM] Choose a viewability option.` | S | 07 |
| TGT-080 | language | row added with no language | E | `[SIM] Select at least one item.` ‡ | S | 07 |
| TGT-090 | brandSuitability.provider | not one of `NONE` (default), `DOUBLEVERIFY`, `IAS`, `SCOPE3` | E | `[SIM] Choose a verification provider.` | S | 07 |
| TGT-091 | brandSuitability.doubleVerify | "Authentic Brand Safety" ticked together with "Brand safety" or "Fraud & invalid traffic" (the last two are disabled when ABS applies) | E | `[SIM] Authentic Brand Safety replaces standard brand safety and fraud and invalid traffic.` | X | 07 |
| TGT-092 | brandSuitability.provider | provider not enabled in Advertiser settings, Third-party services (for IAS also client ID `0`) | E | `[SIM] Turn on this verification service in Advertiser settings first.` | S | 07, 14 |
| TGT-093 | brandSuitability.totalCost | total CPM of selected options (indicative: ABS ~20.95, brand safety ~5.71, display viewability ~12.38, fraud/IVT ~5.71 in the demo currency) | I | `Total cost: ~{amount} CPM` | X | 07 |
| TGT-100 | audience.include / .exclude | an audience appears in both include and exclude | E | `[SIM] An item can't be both included and excluded.` ‡ | S | 07 |
| TGT-101 | audience.include | list not eligible for this LI type (filter "Audience eligibility: Display / YouTube / ..."). Lookalike lists are covered by TGT-105 and skipped here | E | `[SIM] This audience can't be used in {Type} line items.` | S | 07, 10 |
| TGT-102 | audience.include | list size bucket below the minimum for the inventory (`< 1K`) | W | `[SIM] This audience is small and may limit delivery.` | X | 10, 14 (alert "Limited audience size") |
| TGT-103 | audience.include | audience created less than 4 hours ago (sim time) and not a combined audience | E | `[SIM] This audience isn't available yet. New audiences take up to 4 hours.` | S | 10 |
| TGT-104 | audience.include | line item targets a list the advertiser has no permission for | W | `[SIM] You don't have permission to use this audience list.` | S | 14 (alert "Restricted audience list") |
| TGT-105 | audience.include (lookalike) | lookalike list used in a line item that is not `YT_VIDEO`, `YT_AUDIO` or `DEMAND_GEN` ("Google & partners") | E | `[SIM] Lookalike audiences can only be used in YouTube & partners and Demand Gen line items.` | S | 10 |
| TGT-110 | demographics.age | `min > max` | E | `[SIM] Choose a valid age range.` | S | 07 |
| TGT-111 | demographics.gender, .parentalStatus, .householdIncome | every option of the dimension unchecked | E | `[SIM] Select at least one option.` | S | 07 |
| TGT-120 | dayTime.segments | row added with zero segments, or a segment with `start >= end` | E | `[SIM] Choose a start time that is before the end time.` | B, S | 07 |
| TGT-121 | dayTime.timeZone | not `LOCAL` / `ADVERTISER` | E | `[SIM] Choose a time zone.` | S | 07 |
| TGT-122 | dayTime.segments | two segments overlap on the same day | W | `[SIM] Overlapping times were merged.` | B | 07 |
| TGT-130 | device.type | all four device types excluded ("4 items included; 0 items excluded" is the default) | E | `[SIM] Select at least one option.` ‡ | S | 07 |
| TGT-131 | connectionSpeed | not one list value (default "All connection speeds") | E | `[SIM] Choose a connection speed.` | S | 07 |
| TGT-132 | carrierIsp, browser | row added with nothing chosen | E | `[SIM] Select at least one item.` ‡ | S | 07 |
| TGT-140 | optimizedTargeting | ticked: info only (average ~25% improvement) | I | `[SIM] Optimized targeting can improve results by about 25% on average.` | X | 05, 07 |
| TGT-150 | targeting merge | engine: AND across dimensions, OR inside a dimension, audience group logic as in 07; advertiser rules merged and locked first | I | (none) | X | 07, 14 |

### 2.17 TPL: targeting templates
| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| TPL-001 | template.type | not chosen in step 1 (cards: Display, Video, Audio, Connected TV, Demand Gen, YouTube & partners video) | E | `A selection is required` ‡ | S | 15 |
| TPL-002 | template.type | type is `DOOH_*`, `MOBILE_APP_INSTALL`, `ADS_IN_MOBILE_APPS`, `YT_AUDIO` or `YT_ON_CTV` | I | `[SIM] Targeting templates aren't available for {Type} line items.` | n/a (cards absent) | 15 |
| TPL-003 | template.name | empty | E | `Enter a value` ‡ | B, S | 15 |
| TPL-004 | template.name | longer than 240 | E | `[SIM] Use 240 characters or fewer.` | S | 15 |
| TPL-005 | template.description | longer than 600 (optional) | E | `[SIM] Use 600 characters or fewer.` | S | 15 |
| TPL-006 | template.targeting | advertiser targeting rules are merged in and locked; template cannot override them | E | `[SIM] This targeting is set in the advertiser's targeting rules.` ‡ | S | 14, 15 |
| TPL-007 | li.targeting.templateId | applying a template to a line item of a different type (also bulk apply) | E | `[SIM] This template is for {Type} line items.` ‡ | S | 15 |

### 2.18 CRE: creatives
Create forms for upload, native, video, audio and VAST were not visible (17). Rules for them are `(from public docs)`; only third-party display and the image creative page were seen.

| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| CRE-001 | creative.name | empty | E | `Enter a value` ‡ | B, S | 08 |
| CRE-002 | creative.name | longer than 512 (`0 / 512`) | E | `[SIM] Use 512 characters or fewer.` | S | 08, 17 |
| CRE-003 | creative.dimensions | third-party display: width or height `<= 0` (default `0 x 0`) | E | `[SIM] Enter the creative's width and height.` | B, S | 08 |
| CRE-004 | creative.landingPageUrl | empty or still the prefill `http://`; or invalid; or longer than 1,024 | E | `Enter a value` ‡ for empty; `[SIM] Enter a valid URL.` otherwise | B, S | 08 |
| CRE-005 | creative.thirdPartyTag | third-party tag textarea empty | E | `Enter a value` ‡ | S | 08 |
| CRE-006 | creative.thirdPartyTag | tag has no click macro (`${CLICK_URL}` and variants) | W | `[SIM] The tag doesn't contain a click macro. Clicks may not be counted.` | B | 08, (from public docs) |
| CRE-007 | creative.expandsOnHover | ticked while expanding direction is `None` | E | `[SIM] Choose an expanding direction.` | X | 08 |
| CRE-008 | creative.requiresMraid | MRAID creative targeted at web-only inventory (environment `Web` only) | W | `[SIM] MRAID creatives only serve in app inventory.` | X | 08, (from public docs) |
| CRE-009 | creative.integrationCode | longer than 500 bytes | E | `[SIM] Use {max} characters or fewer.` | S | 08 |
| CRE-010 | creative.status | not `ACTIVE` / `PAUSED` / `ARCHIVED`. Status dropdown shown only when editing | E | `[SIM] Choose a status.` | S | 08 |
| CRE-011 | creative.sslCompliant | tag or asset URL not `https` for an SSL-required exchange: that exchange status becomes Disapproved with an SSL reason | W | `[SIM] This creative isn't SSL compliant, so some exchanges will reject it.` | S | 08 |
| CRE-012 | creative.consentNotice | third-party tag form shows the user-data collection responsibility notice | I | `[SIM] You are responsible for complying with user-data collection and consent requirements, including the EU User Consent Policy.` | n/a | 08 |
| CRE-020 | creative.mainAsset | uploaded image: file type not `gif`, `png`, `jpg`, `jpeg`, or size over 150 KB (MX-09b) | E | `[SIM] Upload a GIF, PNG or JPEG file of 150 KB or less.` | S | 17, (from public docs), Q11 |
| CRE-021 | creative.mainAsset | HTML5: not a `.zip` with one entry HTML file, or over the size limit (MX-09b) | E | `[SIM] Upload a ZIP file that contains an HTML file.` | S | (from public docs), Q11 |
| CRE-022 | creative.mainAsset | video file: format, duration or bitrate outside MX-09b | E | `[SIM] Upload a supported video file.` | S | (from public docs), Q11 |
| CRE-023 | creative.mainAsset | audio file: format or duration outside MX-09b | E | `[SIM] Upload a supported audio file.` | S | (from public docs) |
| CRE-024 | creative.vastTag | third-party video/audio: VAST URL/XML missing or not VAST 2/3/4 | E | `Enter a value` ‡ for empty; `[SIM] Enter a valid VAST tag.` otherwise | S | 08, (from public docs) |
| CRE-025 | creative.youtubeVideo | YouTube video creative: URL/ID not resolved | E | `[SIM] We couldn't find that video. Check the URL or ID.` ‡ | B, S | 08 |
| CRE-026 | creative.dimensions | size not in the standard size list (MX-09b) | W | `[SIM] This creative size can't serve on most exchanges.` ‡ | S | (from public docs) |
| CRE-030 | creative.aiLabel | radio `LABEL_AI` / `NO_LABEL`; no default error. Google may still label in some cases | I | `[SIM] Laws in some regions may require labelling AI-made ads.` ‡ | n/a | 17 |
| CRE-040 | creative.review.dv360 | engine state: `PENDING` to `SERVABLE` or `NOT_SERVABLE` (section 4.5). Servable creative may have restrictions | I | `Creative is servable` (feedback box) | n/a | 08 |
| CRE-041 | creative.review.exchanges[] | per-exchange `PENDING`, `APPROVED`, `DISAPPROVED`. Summary text "Approved by n of m exchanges" | I | `Approved by {n} of {m} exchanges` | n/a | 08 |
| CRE-042 | creative.restrictions[] | a restriction (for example legal, country) exists and the LI targets that country | W | `This creative is restricted from serving in line items that target {country}.` | X | 08 |
| CRE-043 | creative.appeal | appeal started on a creative that is servable and approved everywhere | E | `[SIM] Only creatives that were disapproved can be appealed.` | S | 08, 17 |
| CRE-050 | bulk creative upload | CSV from the downloaded template: each row validated by CRE-001..CRE-026; result file lists failed rows | E | row-level message of the failed rule | S | 08, (from public docs) |
| CRE-060 | creative.source | `Third party (CM360)` creatives: asset fields read-only, only name and status editable | E | `[SIM] This creative is synced from Campaign Manager 360 and can't be edited here.` | S | 08, (from public docs) |
| CRE-070 | creative.status | archive/pause a creative assigned to active line items | W | `[SIM] This creative is assigned to {n} active line items.` | S | (from public docs) |
| CRE-080 | creative.format | format gallery: only formats buildable in DV360 have **Create**; "ONLY IN GWD" formats (Parallax, Swirl) show only **Details** | I | (none) | n/a | 08 |
| CRE-090 | creatives list | **New** menu hidden for users without creative write access ("Limited Access") | E | (control hidden) | n/a | 17 |

### 2.19 AUD: audiences
| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| AUD-001 | audience.name | empty (all types; label "Required") | E | `Enter a value` ‡ | B, S | 10 |
| AUD-002 | audience.name | longer than 255 (lookalike shows `0/255`; other types use the same limit) | E | `[SIM] Use 255 characters or fewer.` | S | 10 |
| AUD-010 | audience.floodlightActivityId | tag-based: no Floodlight activity chosen (label "Required") | E | `[SIM] Select a Floodlight activity.` | S | 10 |
| AUD-011 | audience.customVariables[] | rule row exists but variable, operator or value is empty | E | `Enter a value` ‡ | S | 10 |
| AUD-012 | audience.floodlightActivityId | activity does not have Remarketing turned on | E | `[SIM] Turn on remarketing for this Floodlight activity first.` | S | 10, 11 |
| AUD-020 | audience.customerMatch.dataSource | no choice among Connect a new product, Upload a file manually, Skip this step (Continue disabled) | E | `A selection is required` ‡ | S | 10 |
| AUD-021 | audience.customerMatch.file | manual upload: file not CSV, or no identifier column (email, phone, address, mobile ID) | E | `[SIM] Upload a CSV file with at least one identifier column.` | S | (from public docs), Q13 |
| AUD-022 | audience.customerMatch.size | matched users under 1,000 when used in a line item | W | `[SIM] This list has fewer than 1,000 matched users and may not deliver.` | X | 10, (from public docs) |
| AUD-030 | audience.combined.include | no audience in Include | E | `[SIM] Add at least one audience to include.` | S | 10 |
| AUD-031 | audience.combined | same audience in Include and Exclude | E | `[SIM] An item can't be both included and excluded.` ‡ | S | 10 |
| AUD-040 | audience.lookalike.seeds | zero seeds, or more than 10 first-party lists ("Up to 10 first-party lists can be selected.") | E | `[SIM] Select between 1 and 10 first-party lists.` | S | 10 |
| AUD-041 | audience.lookalike.seeds[] | any seed list has fewer than 1,000 active users | E | `The first-party list must have a minimum of 1,000 active users.` | S | 10 |
| AUD-042 | audience.lookalike.reachPct | not one of 2.5, 5, 7.5, 10 (slider "Least reach (2.5%)" to "Most reach (10%)", default 5) (RC-008) | E | `[SIM] Choose a reach between 2.5% and 10%.` | S | 10 |
| AUD-043 | audience.lookalike.geo | no country or region chosen | E | `[SIM] Choose at least one country or region.` | S | 10 |
| AUD-044 | audience.lookalike | **Save** disabled until AUD-001, 040, 041, 043 pass | E | (button disabled) | X | 10 |
| AUD-050 | audience.customAffinity | no interest, URL or app entered | E | `[SIM] Add at least one interest, URL or app.` | S | 10 |
| AUD-051 | audience.customAffinity | right panel "Impressions Estimator" while AUD-050 fails | I | `Audience forecasting is not available for this configuration.` | X | 10 |
| AUD-052 | audience.customAffinity.urls[] | URL not valid | E | `[SIM] Enter a valid URL.` ‡ | B, S | 10 |
| AUD-060 | audience (availability) | list created less than 4 sim-hours ago. Combined audiences are available immediately | I | `Recently added audiences will be available within 4 hours, except for Combined Audiences which are immediately available.` | n/a | 10 |
| AUD-070 | audience.size | size buckets displayed: `< 1K`, `1K-10K`, ... per inventory (Display, YouTube, Mobile app, CTV) | I | (none) | n/a | 10 |
| AUD-080 | audience.customIntent | Custom intent (Display, Video) and (YouTube): at least one keyword or URL | E | `[SIM] Add at least one keyword or URL.` | S | 10, (from public docs) |
| AUD-090 | audience.youtubeUsers | YouTube users list needs a linked YouTube channel (Data manager, Linked accounts) | E | `[SIM] Link a YouTube channel before creating this audience.` | S | 10, 14, (from public docs) |
| AUD-091 | audiences list | **New Audience** disabled without audience write access ("Limited Access") | E | (control disabled) | n/a | 17 |
| AUD-100 | audience.status | archive an audience that active line items target | W | `[SIM] {n} active line items target this audience.` | S | (from public docs) |

### 2.20 INV: inventory (deals, instant deals, groups, negotiations)
| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| INV-001 | instantDeal.sellerId | no seller card chosen | E | `A selection is required` | S | 09 |
| INV-002 | instantDeal.name | empty, or longer than 200 (`0/200`) | E | `Enter a value` ‡ / `[SIM] Use 200 characters or fewer.` | B, S | 09 |
| INV-003 | instantDeal.commitment | fixed to Non-guaranteed ("you receive potential inventory") | I | (none) | n/a | 09 |
| INV-004 | instantDeal.targeting | zero targeting settings (seller specific: Country & Region, Format, Verticals, Device, Publisher; each default "All values") | E | `At least 1 targeting setting is required` | S | 09 |
| INV-005 | instantDeal.advertiserAccess | no advertiser ticked (default: the current one, "1 selected") | E | `[SIM] Select at least one advertiser.` | S | 09 |
| INV-006 | instantDeal.forecast | **Accept** pressed before a forecast was requested | E | `You will be able to accept an instant deal after reviewing the forecast.` | S | 09 |
| INV-007 | instantDeal.sellerId | seller is YouTube and the "YouTube guaranteed instant deals" terms are not accepted for the advertiser | E | `[SIM] Accept the YouTube guaranteed instant deals terms in Advertiser configurations.` | S | 02 |
| INV-010 | deal.* (settings page) | user lacks write access to all advertisers assigned to the deal: all fields read-only | I | `Inventory is view only. It is editable by users with write access to all advertisers assigned to this deal.` | n/a | 09 |
| INV-011 | deal.programmaticGuaranteedDirect | locked once the deal has started | E | `[SIM] This setting can't be changed after it is created.` | S | 09 |
| INV-012 | deal (PG) | guaranteed deal with no line item assigned: row shown in "Action required" | W | `[SIM] This deal isn't assigned to a line item.` | X | 09 |
| INV-013 | deal.status | transitions per section 4.7; `NOT_SERVABLE` is set by the seller side/engine only | E | `[SIM] This status change isn't allowed for the deal's current status.` | S | 09 |
| INV-014 | deal.allowPausing | `No` and a buyer tries to pause | E | `[SIM] The seller doesn't allow this deal to be paused.` | S | 09 |
| INV-015 | dealGroup.name | empty | E | `Enter a value` ‡ | B, S | 09, (from public docs) |
| INV-016 | dealGroup.deals | group saved with zero deals | W | `[SIM] This group has no deals.` | S | 09 |
| INV-017 | package.bulkAssign | package format (Audio, Display, Video) does not match the target line item type (MX-09) | E | `[SIM] This package can't be assigned to {Type} line items.` | S | 09 |
| INV-018 | negotiation.rfpId | **Import negotiation** with empty or unknown RFP ID | E | `Enter a value` ‡ | S | 09, (from public docs) |
| INV-019 | deal.rate vs li.bid | non-guaranteed deal and the line item's fixed bid or max bid is below the deal rate | W | `[SIM] The bid is below the deal rate, so this line item may not win the deal.` | X | (from public docs) |
| INV-020 | deal.dates | `endDate < startDate` | E | `[SIM] End date must be on or after the start date.` ‡ | X | 09 |

### 2.21 Resources: CH, KW, LOC, FL, CB
| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| CH-001 | channel.name | empty | E | `Enter a value` ‡ | B, S | 17 |
| CH-002 | channel.name | longer than 255 | E | `[SIM] Use 255 characters or fewer.` | S | (from public docs) |
| CH-003 | channel.sites[] | line is not a URL or an app ID (`{App name} - Android ({package})`, `{App name} - iOS ({id})`) | E | `[SIM] Enter a valid URL or app ID.` ‡ | S | 17 |
| CH-004 | channel.sites | more than 10,000 entries (counter `1,234 / 10000`) | E | `[SIM] Use 10,000 entries or fewer.` | B, S | 17 |
| CH-005 | channel | **Save** disabled until the form is changed and valid | E | (button disabled) | X | 17 |
| CH-006 | channel (leave editor with edits) | warns before closing the panel or switching tab | I | `You have made changes to this channel that have not yet been saved and will be lost.` | n/a | 17 |
| CH-007 | channel.sites | duplicate entries removed on save; count shown after | I | (none) | S | (from public docs) |
| CH-008 | channel (delete) | channel included/excluded by line items | W | `[SIM] {n} line items use this channel.` | S | 11 |
| KW-001 | keywordList.name | empty | E | `Enter a value` ‡ | B, S | 17 |
| KW-002 | keywordList.keywords | more than 5,000 keywords | E | `Your list can contain up to 5,000 keywords.` | S | 17 |
| KW-003 | keywordList.keywords | separators: one per line or comma; trimmed, de-duplicated | I | `Enter or paste keywords to exclude, one per line or separated by commas.` (help) | B | 17 |
| KW-004 | keywordList.keywords[] | one keyword longer than 80 characters | E | `[SIM] Use 80 characters or fewer.` ‡ | B, S | (from public docs) |
| KW-005 | keywordList (delete) | list used by line items | W | `[SIM] {n} line items use this list.` ‡ | S | 17 |
| LOC-001 | locationList.name | empty | E | `Enter a value` ‡ | B, S | 11 |
| LOC-002 | locationList.type | not `REGIONAL` / `PROXIMITY`; edit: differs from stored | E | `A selection is required` ‡ | S | 11 |
| LOC-003 | locationList.entries | zero entries (counter "0 locations") | E | `Enter a value` ‡ | S | 11 |
| LOC-004 | locationList.entries[] | `REGIONAL`: line is not a postal code or DMA region. `PROXIMITY`: not a street address or `lat,long` pair | E | `[SIM] Line {n} isn't a valid {kind}.` | S | 11 |
| LOC-005 | locationList.entries | over the maximum number of entries | E | `[SIM] Use {max} locations or fewer.` | S | Q10 |
| FL-001 | floodlightGroup.name | empty (partner level, enabled even in the demo) | E | `Enter a value` ‡ | B, S | 02, (from public docs) |
| FL-010 | floodlightConversion.platform | not `WEB`, `MOBILE_APP`, `CONNECTED_TV` | E | `A selection is required` ‡ | S | 11 |
| FL-011 | floodlightConversion.name | empty | E | `Enter a value` ‡ | B, S | 11 |
| FL-012 | floodlightConversion.format | not `GOOGLE_TAG`, `IFRAME_TAG`, `IMAGE_TAG` | E | `A selection is required` ‡ | S | 11 |
| FL-013 | floodlightConversion.type | not `COUNTER` / `SALE` | E | `A selection is required` ‡ | S | 11 |
| FL-014 | floodlightConversion.countingMethod | not allowed for the type (MX-08) | E | `[SIM] This counting method isn't available for the selected type.` | X | 11, (from public docs) |
| FL-015 | floodlightConversion.valueBasedBidding | ticked while "Enable Floodlight optimization for YouTube" is off | E | `[SIM] Turn on Floodlight optimization for YouTube first.` | X | 11 |
| FL-016 | floodlightConversion.remarketing | ticked: first-party list can take up to an hour | I | `[SIM] The first-party list can take up to an hour to fill.` | X | 11 |
| FL-017 | floodlightConversion.status | filter chip default `Active`; status `ACTIVE` / `ARCHIVED`... | E | `[SIM] Choose a status.` | S | 11 |
| FL-020 | floodlightGroup.attribution.clickDays, .impressionDays | not a whole number from 1 to 90 | E | `[SIM] Enter a number between 1 and 90.` | B, S | 11, (from public docs) |
| FL-021 | floodlightGroup.viewableImpressionPct | outside 0-100 | E | `[SIM] Enter a number between 0 and 100.` ‡ | B, S | 11 |
| FL-022 | floodlightGroup.customVariables | variable key not `u1`..`u100` | E | `[SIM] Variable names run from u1 to u100.` | S | 11 |
| FL-023 | floodlightGroup (Google tag tab) | read-only mode for users without write access | I | (chip "Read-only mode") | n/a | 17 |
| CB-001 | customBidding.name | empty | E | `Enter a value` ‡ | B, S | 11 |
| CB-002 | customBidding.objective | not `BRAND_AWARENESS`, `CLICKS`, `CONVERSIONS`, `CUSTOM` | E | `A selection is required` ‡ | S | 11 |
| CB-003 | customBidding.source | `SCRIPT` allowed only when objective is `CUSTOM`; other objectives use `RULES` | E | `[SIM] Scripts are only available for the Custom objective.` | X | 11 [RC-037: dormant in v1, the Script card is disabled] |
| CB-004 | customBidding.rules | zero rules ("Match ANY of the following") | E | `At least 1 rule is required` | S | 11 |
| CB-005 | customBidding.rules[].score | score missing or not a number (default 1) | E | `Enter a value` ‡ | B, S | 11 |
| CB-006 | customBidding.multipliers | more than 4 | E | `[SIM] You can add up to 4 multipliers.` | S | 11 |
| CB-007 | customBidding.multipliers[].type | not one of Ad position, Creative dimension, Day and time, Device type, Genre, Delivery type, Duration; or a type used twice | E | `[SIM] Each multiplier can only be used once.` | X | 11 |
| CB-008 | customBidding.wizard | **Save** (step 3) reachable only after **Test** (step 2) completed | E | (stepper blocks) | X | 11 |
| CB-009 | customBidding.script | `SCRIPT` source and script does not compile | E | `[SIM] The script has errors. Fix them and test again.` | S | (from public docs) [RC-037: dormant in v1] |
| CB-010 | customBidding.status | algorithm `TRAINING` or `NOT_READY` used by an active LI | W | `[SIM] This algorithm is still training, so bids use a fallback until it is ready.` | X | 11 |
| CB-011 | customBidding.status | algorithm `SUSPENDED` used by an active LI | E | see LI-047 | X | 11 |

### 2.22 AB: A/B tests (`/experiments/new`)
Public docs fill what the create form could not show under Limited Access (18 was captured with the form open).

| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| AB-001 | test.name | empty | E | `Enter a value` | B, S | 18 |
| AB-002 | test.name | longer than 100 | E | `[SIM] Use 100 characters or fewer.` | S | 18 |
| AB-003 | test.hypothesis | longer than 400 (optional) | E | `[SIM] Use 400 characters or fewer.` | S | 18 |
| AB-004 | test.startDate | empty (default today) | E | `Enter a value` ‡ | S | 18 |
| AB-005 | test.endDate | optional; when set `< startDate` | E | `[SIM] End date must be on or after the start date.` | X | 18 |
| AB-006 | test.startDate, .endDate | edit: test started and dates changed ("dates locked after start") | E | `[SIM] Dates can't be changed after the test has started.` | S | 18 |
| AB-007 | test.armType | not `INSERTION_ORDER` / `LINE_ITEM` (radio, default IO) | E | `A selection is required` ‡ | S | 18 |
| AB-008 | test.arms | fewer than 2 arms | E | `[SIM] Add at least 2 arms.` | S | 18 |
| AB-009 | test.arms[].name | empty (default "Arm {n}") or longer than 200 | E | `Enter a value` ‡ / `[SIM] Use 200 characters or fewer.` | B, S | 18 |
| AB-010 | test.arms[].split | empty | E | `Enter a value` ‡ | B, S | 18 |
| AB-011 | test.arms[].split | `<= 0` (new arm default 0%) | E | `Enter a larger number` | B, S | 18 |
| AB-012 | test.arms | sum of splits is not 100 (defaults 50 / 50) | E | `[SIM] Audience splits must add up to 100%.` | X | 18 |
| AB-013 | test.arms[].isControl | more than one control arm. Control is required for the report comparison | E | `[SIM] Choose one control arm.` | S | 18, Q14 |
| AB-014 | test.arms[].entities | an arm with no insertion order or line item ("Select insertion orders / line items") | E | `[SIM] Select at least one {kind} for each arm.` | S | 18 |
| AB-015 | test.arms[].entities | the same IO or LI appears in two arms | E | `[SIM] An item can only be in one arm.` | S | 18, (from public docs) |
| AB-016 | test.measurement | goal missing (default Conversions) or not allowed for the entity type/channel (MX-14) | E | `[SIM] Choose a measurement goal that applies to these arms.` | X | 18 |
| AB-017 | test.confidence | not 90 (default) or 95 | E | `[SIM] Choose a confidence level.` | S | 18 |
| AB-018 | test.lift | arm type `LINE_ITEM`, or a cross-exchange IO in an arm: lift section disabled | I | `Lift studies are not applicable for line items, or cross-exchange insertion orders…` | X | 18 |
| AB-019 | test.excludeUnidentified | only for cross-exchange insertion orders; warning that results may be non-representative | W | `[SIM] Excluding traffic without third-party IDs can make results less representative.` | X | 18 |
| AB-020 | test.arms | arm delete (trash) only shown when more than 2 arms | E | (control hidden) | X | 18 |
| AB-021 | test.arms[] | IOs and LIs mixed in one test | E | `[SIM] All arms must compare the same kind of item.` | X | 18 |
| AB-022 | test.lift.brandLift | pacing is fixed `ASAP`; needs IOs that contain YouTube & partners or Demand Gen LIs, excluding PG YouTube LIs | E | `[SIM] Brand lift needs insertion orders with YouTube & partners or Demand Gen line items.` | X | 18 |
| AB-023 | test.arms[].entities[] | IO whose line item budgets exceed its budget (warning icon in the picker) | W | `The total budget of all line items is greater than the insertion order budget.` | X | 18 |
| AB-024 | test.arms | edit: test started and arms or splits changed | E | `[SIM] Arms can't be changed after the test has started.` | S | 18, (from public docs) |
| AB-025 | test (End action) | **End** is disabled when the test is Completed; confirm dialog DLG-07 | E | (control disabled) | n/a | 18 |

### 2.23 LS: lift studies (`/brand-lift-measurements/new`)
| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| LS-001 | study.name | empty or longer than 128 (`0 / 128`) | E | `Enter a value` ‡ / `[SIM] Use 128 characters or fewer.` | B, S | 15, 18 |
| LS-002 | study.ioFilter | picker radio: "YouTube programmatic guaranteed" or "All other insertion orders": IOs of both groups cannot be mixed | E | `[SIM] Choose insertion orders from one group.` | S | 15, 18 |
| LS-003 | study.insertionOrders | zero eligible IOs selected (lift types disabled) | E | `Select at least one eligible insertion order to add a lift study` | S | 15 |
| LS-004 | study.liftTypes | at least one eligible IO is selected and neither Brand lift nor Search lift is ticked | E | `[SIM] Select at least one lift type.` | S | 18 |
| LS-005 | study.liftTypes | type disabled when its measurable line item count is 0 (MX-13). Brand lift: YouTube, Demand Gen, Display, Audio, Video. Search lift: YouTube, Demand Gen | E | `[SIM] No line items in the selected insertion orders can be measured.` | X | 15, 18 |
| LS-006 | study.brandLift.metrics | none ticked, or more than 3 (4th is disabled). Options: Video ad recall, Awareness, Consideration, Favorability, Purchase intent, Association | E | `[SIM] Select between 1 and 3 metrics.` | S | 15, 18 |
| LS-007 | study.survey.brandName | empty, or longer than 30; must match the name used in the ads | E | `Enter a value` ‡ / `[SIM] Use 30 characters or fewer.` | B, S | 15, 18 |
| LS-008 | study.survey.competitors[] | more than 3, or one longer than 30 (0 to 3 allowed) | E | `[SIM] Use 30 characters or fewer.` | B, S | 15, 18, Q15 |
| LS-009 | study.survey.language, .objectType | info line above the survey settings | I | `The selected metrics only support certain languages and object types.` | n/a | 18 |
| LS-010 | study.survey.objectType | not chosen ("Select an option") | E | `[SIM] Select an object type.` | S | 15, 18 |
| LS-011 | study.survey.intendedAction | `Purchase intent` ticked and action (`BUY`, `CHOOSE`, `USE`) not chosen | E | `[SIM] Select an intended action.` | S | 18 |
| LS-012 | study.strength | `ENHANCED` strength on a study whose measurable line items are not all YouTube (the 3x media cost is checked by LS-014) | E | `[SIM] Enhanced lift is only available for YouTube and needs 3 times the standard budget.` | X | 18 |
| LS-013 | study.searchLift.groups | more than 5 groups, or a group with fewer than 1 or more than 3 terms | E | `[SIM] Add 1 to 3 search terms per group, up to 5 groups.` | S | 18 |
| LS-014 | study.eligibility | media cost of the selected IOs for the window is below the required media cost (example ₹470,000.00; brand lift window ~10 days, search lift ~4 weeks) | E | `Not eligible` with the lines `Required media cost: {x}` and `Your media cost: {y}` | X | 18 |
| LS-015 | study.liftTypes | edit ("Review & fix"): lift type changed after it was set | E | `[SIM] This setting can't be changed after it is created.` | S | 18 |
| LS-016 | study (End, Add flight) | actions per DLG-07 and section 4.8 | I | (dialog) | S | 18 |

### 2.24 BLK: bulk actions and SDF
| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| BLK-001 | sdf.download.entities | none of Campaigns, Media Products, Insertion orders, Line items, Ad groups, Ads ticked (Next disabled) | E | `[SIM] Select at least one entity type.` | S | 15 |
| BLK-002 | sdf.upload.files | more than one CSV per entity type, or a file that is not CSV | E | `[SIM] Upload one CSV file per entity type.` | S | 15 |
| BLK-003 | sdf.upload.rows | campaign or IO row has a value in an Inventory source or Targeting column ("leave those columns empty to avoid errors") | E | `[SIM] Inventory source and targeting are managed at the line item level. Leave these columns empty.` | S | 15 |
| BLK-004 | sdf.upload.rows | line item row has a blank EU political ads value: value `No` applied | I | `Line items without an answer for EU political ads will get "No"` | S | 15 |
| BLK-005 | sdf.upload.result | every row is validated with the module rules of its entity; result zip has separate success and failed files, failed rows carry rule ID and message | E | row-level message of the failed rule | S | 15 |
| BLK-006 | sdf.version | advertiser SDF version is `9`: deprecation notice in the dialogs | I | `SDF version 9 will no longer be supported starting January 28, 2027. Upgrade to the latest version… upgrade to SDF version 11.` | n/a | 15 |
| BLK-010 | bulk status change | per-row eligibility per section 4.9 (Activate disabled if already active, etc.) | E | `[SIM] {n} of {m} selected items couldn't be updated.` | S | 03, 04 |
| BLK-011 | bulk edit, bulk apply | edit items disabled for users without write access (Limited Access) | E | (items greyed) | n/a | 15 |
| BLK-012 | bulk apply template | selected line items of other types than the template type are skipped | W | `[SIM] {n} line items were skipped because the template is for {Type} line items.` | S | 15 |
| BLK-013 | duplicate | number of copies is not a whole number `>= 1` ("Duplicating 1 line item with 3 copies") | E | `Enter a number greater than 0` ‡ | B, S | 01 |
| BLK-014 ~LI-006 | duplicate | target parent missing, archived, or of an incompatible type (line item type must be allowed by the target IO objective, MX-03) | E | `{Type} line items aren't compatible with your insertion order's objective setting.` ‡ | S | 01, 04 |
| BLK-015 | bulk status page | only the 100 most recent bulk actions are listed | I | `Only showing 100 most recent bulk actions` | n/a | 01 |

### 2.25 PLN, RPT, USR
| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| PLN-001 | plan.name | default for untitled: `New Plan ({Mon D, YYYY})`; copy: `Copy of {name}` | I | (none) | n/a | 13 |
| PLN-002 | plan.* | start date has passed: Location, Dates, Demographics, Additional Settings locked, forecast tabs show the empty state | I | `Your start date has passed` + `Make a copy of this plan with new dates to work on it again.` | n/a | 13 |
| PLN-003 | plan | **Save** disabled until changed | E | (button disabled) | X | 13 |
| PLN-004 | plan.status | `PLANNED` to `TRAFFICKED` only by the convert flow; plan deleted by **Remove plan** (DLG-06) | E | `[SIM] This status change isn't allowed for the plan's current status.` | S | 13 |
| PLN-010 | crossMediaReach.country | not chosen | E | `A selection is required` ‡ | S | 13 |
| PLN-011 | crossMediaReach.subLocation | mode `SUB_LOCATION` with no sub-location chosen | E | `A selection is required` ‡ | S | 13 |
| PLN-012 | crossMediaReach.insertionOrders | zero IOs and zero TV campaigns (Create report disabled). Campaigns with 0.00 spend are disabled in the picker | E | `[SIM] Select at least one insertion order or TV campaign.` | S | 13 |
| PLN-013 | crossMediaReach.subLocation | info under the sub-location control | I | `Reach and impressions data is available from January 2024 if you select sub-location(s)` | n/a | 13 |
| PLN-014 | crossMediaReach.insertionOrders | IO data window is the last 24 months | I | `Data is available for the last 24 months.` | n/a | 13 |
| RPT-001 | report.name | empty | E | `Enter a value` ‡ | B, S | 12, (from public docs) |
| RPT-002 | report.schedule | **Schedule** disabled until the report is saved | E | (button disabled) | X | 12 |
| RPT-003 | report.offline.schedule | `expires < starts`; repeat interval not a whole number `>= 1` | E | `[SIM] End date must be on or after the start date.` ‡ | X | 12 |
| RPT-004 | report.offline.delivery.fileName | empty; date and time are appended automatically | E | `Enter a value` ‡ | B, S | 12 |
| USR-001 | user.name, user.email | empty / not an email | E | `Enter a value` ‡ / `[SIM] Enter a valid email address.` | B, S | 02 |
| USR-002 | user.access | zero partners or advertisers added (Save disabled) | E | `You can give users different roles for each advertiser or partner they have access to` (empty state) | S | 02 |
| USR-003 | user.access[].role | row without a role | E | `A selection is required` ‡ | S | 02 |
| USR-004 | user.email | email already belongs to a user | E | `[SIM] A user with this email already exists.` | S | (from public docs) [RC-016: uniqueness applies to login users; simulated colleagues created on /users/new are stored as sandbox-local `SandboxContact` rows] |

### 2.26 ACC: account management (`/manage/**`, module 19)

Owner requirement of 2026-10-28 (RC-068 to RC-076). The table below is copied from `modules/19-account-management.md` 4.9, which is its definition. `SIM-001` (`Incorrect email or password.`) and `SIM-002` (lockout) from module 18 still apply to sign in; `ACC-073` is reserved. Rules `ACC-020` to `ACC-027` are authorisation rules: the server enforces them for every action, and the UI hides what the actor may not do.

| Rule ID | Entity.field | Condition | Sev | Message | Trigger | Src |
|---|---|---|---|---|---|---|
| ACC-001 | account.email | empty, not an address, or longer than 254 | E | `[SIM] Enter a valid email address.` | B, S | 19 |
| ACC-002 | account.email | exists (any status, case-insensitive) | E | `[SIM] An account with this email already exists.` / archived: `[SIM] This email belongs to an archived account. Restore it instead.` | S | 19 |
| ACC-003 | account.name | empty / over 100 | E | `Enter a value` ‡ / `[SIM] Use 100 characters or fewer.` | B, S | 19 |
| ACC-004 | account.notes | over 500 | E | `[SIM] Use 500 characters or fewer.` | B, S | 19 |
| ACC-010 | password | shorter than the minimum (10) / longer than 128 | E | `[SIM] Use at least 10 characters.` / `[SIM] Use 128 characters or fewer.` | B, S | 19 |
| ACC-011 | password | fewer than 3 of 4 classes (lower, upper, digit, symbol) | E | `[SIM] Use at least 3 of: lowercase, uppercase, number, symbol.` | B, S | 19 |
| ACC-012 | password | equals email, contains the email local part (4+ characters), or is on the common list | E | `[SIM] Choose a password that is harder to guess.` | B, S | 19 |
| ACC-013 | password.confirm | differs from the new password | E | `[SIM] The passwords do not match.` | X | 19 |
| ACC-014 | password.next | equals the current password | E | `[SIM] Your new password must be different from the current one.` | S | 19 |
| ACC-015 | password.current | wrong (counts toward lockout) | E | `[SIM] Your current password is incorrect.` | S | 19 |
| ACC-020 | account.role | actor level may not create this role (Admin to ADMIN or SUPER_ADMIN; anyone to a role above their own) | E | `[SIM] You can't create accounts with this role.` | S | 19 |
| ACC-021 | account.role | role change by a non Super admin, or on self | E | `[SIM] You can't change this role.` | S | 19 |
| ACC-022 | account.id | target is outside the actor's scope or does not exist | E | `[SIM] Account not found.` | S | 19 |
| ACC-023 | account.* | actor disables, archives or changes the role of their own account | E | `[SIM] You can't do this to your own account.` | S | 19 |
| ACC-024 | account.status, account.role | the change would leave no active Super admin | E | `[SIM] At least one active super admin is required.` | S | 19 |
| ACC-025 | account.role, account.status | demote or archive an Admin who still owns Users or cohorts without `transferTo` | E | `[SIM] Move this admin's users and cohorts to another admin first.` | S | 19 |
| ACC-027 | account.status | disable an Admin who still owns Users or cohorts | W | `[SIM] This admin still owns {n} users and {m} cohorts.` | S | 19 |
| ACC-026 | account.* | delete (archive) or purge a Super admin | E | `[SIM] Super admin accounts can be disabled but not deleted.` | S | 19 |
| ACC-030 | account.cohortId | role USER without a cohort | E | `[SIM] Choose a cohort.` | S | 19 |
| ACC-031 | account.cohortId | cohort not in the actor's scope or archived | E | `[SIM] Cohort not found.` | S | 19 |
| ACC-032 | cohort.capacity | active, disabled and locked Users plus new ones exceed capacity | E | `[SIM] This cohort is full ({n} of {cap}).` | S | 19 |
| ACC-033 | cohort.name | empty / over 100 / already used by the same owner admin | E | `Enter a value` ‡ / `[SIM] Use 100 characters or fewer.` / `[SIM] You already have a cohort with this name.` | B, S | 19 |
| ACC-034 | cohort.capacity | not 1 to 60, or above 25 set by a non Super admin | E | `[SIM] Use a number from 1 to 60.` / `[SIM] Only a super admin can raise the limit above {n}.` | B, S | 19 |
| ACC-035 | cohort.status | archive with non-archived Users | E | `[SIM] Move or archive the accounts in this cohort first.` | S | 19 |
| ACC-040 | account.accessEndsAt | end not after start | E | `[SIM] End time must be after the start time.` (same text as SIM-005) | X | 19 |
| ACC-041 | account.accessEndsAt | end already in the past for an ACTIVE account | W | `[SIM] This access period has already ended. The user won't be able to sign in.` | X | 19 |
| ACC-042 | account.accessEndsAt | period longer than 365 days | W | `[SIM] This access period is longer than a year.` | X | 19 |
| ACC-050 | import.header | a required column is missing (`email`, `name`; `cohort` unless a default cohort is chosen) | E | `[SIM] Missing column: {name}.` | S | 19 |
| ACC-051 | import.file | over 200 rows / over 200 KB / not CSV | E | `[SIM] Use 200 rows or fewer.` / `[SIM] The file is too large (200 KB maximum).` / `[SIM] Upload a CSV file.` | S | 19 |
| ACC-052 | import.row.email | invalid | E | `[SIM] Row {n}: enter a valid email address.` | S | 19 |
| ACC-053 | import.row.email | repeated inside the file | E | `[SIM] Row {n}: duplicate of row {m}.` | S | 19 |
| ACC-054 | import.row.email | already has an account | E | `[SIM] Row {n}: an account with this email already exists.` | S | 19 |
| ACC-055 | import.row.cohort | name not found in scope (or ambiguous) | E | `[SIM] Row {n}: cohort "{name}" was not found.` | S | 19 |
| ACC-056 | import.row.password | present and fails ACC-010 to ACC-012 | E | `[SIM] Row {n}: password is too weak. Leave it empty to generate one.` | S | 19 |
| ACC-057 | import.row.cohort | cohort capacity reached before this row | E | `[SIM] Row {n}: cohort "{name}" is full.` | S | 19 |
| ACC-058 | import.row.name | empty or over 100 | E | `[SIM] Row {n}: enter a name.` | S | 19 |
| ACC-060 | bulk.ids | more than 100 selected | E | `[SIM] Select 100 accounts or fewer.` | S | 19 |
| ACC-061 | bulk.confirm | delete without the typed text `DELETE`; purge without the exact email | E | `[SIM] Type DELETE to confirm.` / `[SIM] Type the account's email to confirm.` | S | 19 |
| ACC-062 | bulk.result | some ids were skipped (out of scope, own account, last Super admin, not allowed) | W | `[SIM] {n} accounts were skipped.` (per row: the ACC code and its message) | S | 19 |
| ACC-063 | bulk.reset | shared password mode with over 25 ids | E | `[SIM] Generate passwords when you reset more than 25 accounts.` | S | 19 |
| ACC-070 | auth | correct password, status `DISABLED` | E | `[SIM] Your account is disabled. Contact your admin.` | S | 19 |
| ACC-071 | auth | correct password, access period not started | E | `[SIM] Your access starts on {date}.` | S | 19 |
| ACC-072 | auth | correct password, access period ended | E | `[SIM] Your access ended on {date}. Contact your admin.` | S | 19 |
| ACC-074 | session | `sid` replaced by a newer sign in (single session) | I | `[SIM] You were signed out because this account signed in on another device.` | n/a | 19 |
| ACC-075 | session | idle, absolute or revoked session | I | `[SIM] Your session expired. Sign in again.` | n/a | 19 |

---

## 3. Cross-entity matrices (ready to become code constants)

Each matrix lists the enum keys from 1.3 so it can be pasted into `lib/validation/constants/*.ts`. `Y` allowed, `N` not allowed. A matrix or cell marked `(from public docs)` was not visible in the demo.

**Design decision D-V1 (unknown cells).** Where the demo and public docs do not settle a cell, the matrix allows the option unless the option is logically impossible (a visual dimension on audio, a video-only dimension on display). Classroom users then never hit a false error, and the instructor team can tighten cells after SOP-3.

### MX-01 Campaign goal to KPI (03)
KPI universe for the campaign form: `CPM`, `CPC`, `CPA`, `CTR`, `CPV`, `CPIAVC`, `VIEWABLE_PCT`, plus `OTHER`. Every list ends with `Other...` (free text "Enter your KPIs (optional)", never warns).

| Goal key | UI label | Recommended KPIs | Not recommended KPIs |
|---|---|---|---|
| `AWARENESS` | Raise awareness of my brand or product | `CPV`, `CPM`, `VIEWABLE_PCT`, `CPIAVC` | `CPA`, `CPC`, `CTR` |
| `ONLINE_ACTION` | Drive online action or visits | `CPM`, `CPC`, `CPA`, `CTR`, `VIEWABLE_PCT` | `CPV`, `CPIAVC` ("CPV (+ others)" in 03; `CPIAVC` is the only other member of the universe) |
| `OFFLINE_SALES` | Drive offline or in-store sales | `CPV`, `CPM`, `VIEWABLE_PCT`, `CPIAVC` | `CPA`, `CPC`, `CTR` |
| `APP_INSTALLS` | Drive app installs or engagements | `CPM`, `CPC`, `CPA`, `CTR`, `VIEWABLE_PCT` | `CPV`, `CPIAVC` |

Rule: `notRecommended(goal) = KPI_UNIVERSE \ recommended(goal)`. Dropdown order: "Recommended KPIs", "Not recommended", "Other...". Unit: money for `CPM CPC CPA CPV CPIAVC`, percent for `CTR VIEWABLE_PCT`. Consumed by CMP-013.

### MX-02 IO type × objective: enabled objectives, KPIs, bid strategies, line item types (04)
**A. Type rules**

| IO type | Enabled objectives | Allowed LI types | Notes |
|---|---|---|---|
| `STANDARD` | `BRAND_AWARENESS`, `CLICKS`, `CONVERSIONS`, `CUSTOM`, `NONE` | per table B | default type |
| `CTV_OTT` | `BRAND_AWARENESS`, `CONVERSIONS`, `CUSTOM`, `NONE` (`CLICKS` disabled) | `CTV`, `YT_ON_CTV` | only Brand awareness was opened (04); Conversions/Custom/None cells are `(from public docs)` |
| `DOOH` | `NONE` only | `DOOH_DISPLAY`, `DOOH_VIDEO` | KPI N/A; bid strategy `FIXED_BID` only |

CTV_OTT + `BRAND_AWARENESS`: KPIs `CPM`, `VALUE_COST`; bid strategies `MAX_REACH`, `FIXED_BID` at line item level (05). CTV_OTT + `CONVERSIONS`: KPIs `CPA`, `VALUE_COST`; strategies as the Standard Conversions row restricted to line item types `CTV`, `YT_ON_CTV` `(from public docs)`. CTV_OTT + `CUSTOM`: KPI `VALUE_COST`. CTV_OTT + `NONE`: any KPI, any strategy.

**B. STANDARD IO matrix**

| Objective | KPIs allowed | Bid strategies allowed | LI types allowed |
|---|---|---|---|
| `BRAND_AWARENESS` | `CPCL`, `CPCV`, `CPIAVC`, `CPM`, `CPV`, `COMPL_AUDIO`, `COMPL_VIDEO`, `TOS10`, `VCPM`, `VTR`, `VALUE_COST`, `VIEWABLE_PCT` | `MAX_COMPLETED_IN_VIEW_AUDIBLE`, `MAX_CUSTOM_VALUE_COST`, `MAX_REACH`, `MAX_VIEWABLE_10S`, `MAX_VIEWABLE_IMPRESSIONS`, `MAX_CPV`, `TARGET_CPM`, `TARGET_CPV`, `TARGET_CUSTOM_VALUE_COST`, `TARGET_VIEWABLE_IMPRESSIONS` | `DISPLAY`, `VIDEO`, `CTV`, `AUDIO`, `MOBILE_APP_INSTALL`, `ADS_IN_MOBILE_APPS`, `YT_VIDEO`, `YT_AUDIO` |
| `CLICKS` | `CPC`, `CTR`, `VALUE_COST` | `MAX_CLICKS`, `MAX_CUSTOM_VALUE_COST`, `TARGET_CPC`, `TARGET_CUSTOM_VALUE_COST` | `DISPLAY`, `VIDEO`, `MOBILE_APP_INSTALL`, `ADS_IN_MOBILE_APPS`, `DEMAND_GEN` |
| `CONVERSIONS` | `CPA`, `CLICK_CVR`, `IMPR_CVR`, `VALUE_COST` | `MAX_CONVERSION_VALUE`, `MAX_CONVERSIONS`, `MAX_CUSTOM_VALUE_COST`, `TARGET_CPA`, `TARGET_ROAS`, `TARGET_CUSTOM_VALUE_COST` | `DISPLAY`, `VIDEO`, `CTV`, `AUDIO`, `MOBILE_APP_INSTALL`, `ADS_IN_MOBILE_APPS`, `DEMAND_GEN` |
| `CUSTOM` | `VALUE_COST` | `MAX_CUSTOM_VALUE_COST`, `TARGET_CUSTOM_VALUE_COST` | `DISPLAY`, `VIDEO`, `CTV`, `AUDIO`, `MOBILE_APP_INSTALL`, `ADS_IN_MOBILE_APPS` |
| `NONE` | any | any (plus `FIXED_BID`) | `DISPLAY`, `VIDEO`, `AUDIO`, `CTV`, `MOBILE_APP_INSTALL`, `ADS_IN_MOBILE_APPS`, `YT_VIDEO`, `YT_AUDIO`, `DEMAND_GEN` |

Defaults on a new IO: KPI = the first KPI shown for the objective; observed `VCPM` for Brand awareness (04). Proposed first KPI for the other objectives: `CPC` (Clicks), `CPA` (Conversions), `VALUE_COST` (Custom) `[SIM]`, Q4. The preview pane header is `KPIs for {objective} objective`. Consumed by IO-040, IO-054, LI-007, LI-042.

### MX-03 Line item type × IO objective compatibility (05, 04)
`Y` = card enabled; `N` = card greyed with the info tooltip. Derived from MX-02 and confirmed in two IOs: Clicks (CTV, Audio, YouTube video and audio greyed) and Brand awareness (Demand Gen greyed).

| LI type | `BRAND_AWARENESS` | `CLICKS` | `CONVERSIONS` | `CUSTOM` | `NONE` |
|---|---|---|---|---|---|
| `DISPLAY` | Y | Y | Y | Y | Y |
| `VIDEO` | Y | Y | Y | Y | Y |
| `CTV` | Y | N | Y | Y | Y |
| `AUDIO` | Y | N | Y | Y | Y |
| `MOBILE_APP_INSTALL` | Y | Y | Y | Y | Y |
| `ADS_IN_MOBILE_APPS` | Y | Y | Y | Y | Y |
| `YT_VIDEO` | Y | N | N | N | Y |
| `YT_AUDIO` | Y | N | N | N | Y |
| `DEMAND_GEN` | N | Y | Y | N | Y |
| `DOOH_DISPLAY`, `DOOH_VIDEO` | only in a `DOOH` IO (objective `NONE`) | | | | |
| `YT_ON_CTV` | only in a `CTV_OTT` IO | | | | |

Disabled-reason message (all N cells): `{Type} line items aren't compatible with your insertion order's objective setting.` with `{Type}` = the UI name from 1.3 (for example `Demand Gen`). Step 1 also lets the user switch IO; the matrix is re-evaluated against the new IO. Consumed by LI-006, LI-007, LI-DG-002, LI-YT-019, BLK-014.

### MX-04 Bid strategy options per objective and per line item type (04, 05, 06)
Objective-level lists are in MX-02 B. Line-item level refinements:

| Context | Automated bidding options | Fixed bid | Notes |
|---|---|---|---|
| IO `CLICKS`, `DISPLAY` LI | "Optimized towards": `MAX_CLICKS`, `MAX_CUSTOM_VALUE_COST`. Second dropdown: "while prioritizing spending my full budget (recommended)" or, for `MAX_CLICKS`, "while prioritizing a target CPC" (shows target input) | `FIXED_BID` (CPM) | 05 |
| IO `BRAND_AWARENESS`, `DISPLAY`/`VIDEO` LI | list of the Brand awareness strategies | `FIXED_BID` | default `MAX_VIEWABLE_IMPRESSIONS` (04) |
| IO `BRAND_AWARENESS`, `CTV` LI | `MAX_REACH` | `FIXED_BID` | 05 |
| `AUDIO` LI | listed per objective | **default** `FIXED_BID` (automated not pre-selected) | 05 |
| `YT_VIDEO` | locked by subtype (MX-07) | none | 06 |
| `DOOH_*` | none | `FIXED_BID` only | 04 |
| IO `IO_AUTOMATED` | taken from the IO's "Optimized towards" | none | LI-044 |

Target input per strategy (consumed by LI-043):
| Strategy | Needs target value | Unit |
|---|---|---|
| `TARGET_CPM`, `TARGET_CPV`, `TARGET_CPC`, `TARGET_CPA`, `TARGET_VIEWABLE_IMPRESSIONS` (vCPM), `TARGET_CUSTOM_VALUE_COST`, `MAX_CPV` | yes (> 0) | advertiser currency |
| `TARGET_ROAS` | yes (> 0) | percent (return per unit cost) `(from public docs)` |
| `MAX_*` strategies | no; `MAX_CLICKS` may add an optional target CPC | n/a |
| `FIXED_BID` | yes (> 0) | CPM in advertiser currency |

### MX-05 Pacing combinations and IO automation (04, 05, 06)
**Insertion order**
| Period | Allowed types | Extra field |
|---|---|---|
| `FLIGHT` ("Recommended") | `AHEAD` (new default), `EVEN` | none. `Flight` auto-calculates the daily target |
| `DAILY` | `EVEN`, `ASAP` | daily amount (required, > 0) |

**Line item** (IO mode `LI_CONTROLLED`)
| Period | Allowed types | Extra field |
|---|---|---|
| `FLIGHT` | `EVEN`, `AHEAD`, `ASAP` `(from public docs)`; an existing display LI showed `EVEN` (05) | none |
| `DAILY` | `EVEN`, `ASAP` | daily amount (required, > 0) |
| YouTube & partners | period `DAILY` is the default for new LIs, `FLIGHT` also offered; type `EVEN` (06) | amount "Required" |

**IO automation forcing line item pacing**
| IO `optimization.mode` | LI `pacing.type` | LI `bid` | LI `pacing.period` |
|---|---|---|---|
| `IO_AUTOMATED` | forced `ASAP`, control locked (05) | forced to the IO strategy (LI-044) | not selectable; stored as `FLIGHT` and locked (Q3, RC-039) |
| `LI_CONTROLLED` | free per the table above | free per MX-04 | free |

Consumed by IO-031, LI-034, LI-035, LI-036, IO-053.

### MX-06 Frequency cap nesting (03, 04, 05, 06)
Chain: **campaign → IO → line item**. YouTube line items have two caps (exposure and view). Deals also carry their own cap (09), and the advertiser's cap is not editable in the demo.

| Level | "No limit" label | Info shown when unlimited |
|---|---|---|
| Campaign | `No limit` | none |
| IO | `Unlimited up to the campaign's frequency cap` | `The campaign's frequency cap is set to {n} exposures per {period}` |
| Line item | `Unlimited up to the higher level frequency cap` | `The higher level frequency cap is set to {n} exposures per {period}` |

All caps that exist are enforced together; the effective cap is the strictest. Unit minutes: `MINUTE=1`, `HOUR=60`, `DAY=1440`, `WEEK=10080`, `MONTH=43200` (30 days). Cap = `n` exposures per `k` units (k default 1).

```
windowMin(cap)    = cap.periodCount * unitMinutes[cap.period]
impliedMax(cap,w) = cap.n * ceil(w / windowMin(cap))
looserThan(low, high) = impliedMax(high, windowMin(low)) <= low.n      // low cap never bites
```
Example: campaign 3 / week, LI 10 / day → `impliedMax = 3 * ceil(1440/10080) = 3 <= 10`, LI cap is redundant (info `LI-053`). Campaign 3 / week, LI 10 / month → `3 * ceil(43200/10080) = 15 > 10`, LI cap is meaningful (no issue). Engine: an impression is blocked when any enforced cap is reached for that user. Consumed by IO-063, LI-053.

### MX-07 YouTube & partners subtype → ad formats, bid strategy (06)
Subtype = optimization + ad format choice, fixed after step 1. `(from public docs)` marks the cells the demo did not show.

| Subtype key | Optimization / choice | Ad format checkboxes (step 2) | LI bid strategy | Ad group bid field | Frequency |
|---|---|---|---|---|---|
| `EFFICIENT_REACH` | Reach / Efficient ad formats | In-stream (skippable, bumper), In-feed, Shorts; new LI all ticked; at least 1 | `MAX_REACH` locked | `TARGET_CPM` required (demo showed Target CPM ₹75.00) | exposure cap, view cap |
| `NON_SKIPPABLE_REACH` | Reach / Non-skippable ad formats (mix of non-skippable 5-30 s) | non-skippable in-stream only (no choice) | `MAX_REACH` `(from public docs)` | `TARGET_CPM` `(from public docs)` | exposure cap, view cap |
| `TARGET_FREQUENCY` | Target frequency / bumper, skippable, in-feed or Shorts | In-stream, In-feed, Shorts; at least 1 | `TARGET_CPM` `(from public docs)` | `TARGET_CPM` | target frequency (required, LI-YT-012) |
| `TARGET_FREQUENCY_IN_STREAM` | Target frequency / only in-stream (skippable, bumper, non-skippable up to 15 s) | in-stream only | `TARGET_CPM` `(from public docs)` | `TARGET_CPM` | target frequency (required) |
| `TRUEVIEW_VIEWS` | TrueView views (no format choice) | in-stream skippable + in-feed `(from public docs)` | `MAX_CPV` `(from public docs)` | `MAX_CPV` | exposure cap, view cap |
| `AD_SEQUENCE` | Ad sequence (under "Show more"; bumper, skippable, non-skippable) | per sequence step | `TARGET_CPM` `(from public docs)`, Q6 | `TARGET_CPM` | exposure cap |

Ad creative duration hints shown at ad group level (06): skippable in-stream and in-feed horizontal 10-60 s; bumper horizontal 6 s; Shorts vertical 5 s. YouTube audio mirrors video with audio ads (Q5). Allowed IO objectives for any YouTube subtype: `BRAND_AWARENESS`, `NONE` (MX-03).

### MX-08 Conversion counting (05, 11)
**Floodlight counting method by activity type**
| Method key | Label | Meaning | `COUNTER` | `SALE` |
|---|---|---|---|---|
| `STANDARD` | Standard | count every conversion | Y | N |
| `UNIQUE` | Unique | first per user per 24-hour day, US Eastern | Y | N |
| `PER_SESSION` | Per session | one per user per session | Y | N |
| `TRANSACTIONS` | Transactions | all conversions + sales count + revenue | N | Y |
| `ITEMS_SOLD` | Items sold | per transaction + per item + revenue | N | Y |

Type/method split is `(from public docs)`; the demo only showed the method list.

**Line item conversion counting** (`LI-071`, `LI-072`)
| Key | Label |
|---|---|
| `ALL` | Count all conversions |
| `POST_CLICK_ONLY` | Count only post-click conversions |
| `PERCENTAGE` | Count a percentage of conversions: `Count [100] % of post-views and all post-clicks`; `postViewPct` 0-100, default 100 |

Attribution model default `Primary model`; other options are the advertiser's Floodlight attribution models. Floodlight group windows: click lookback and impression lookback, 1-90 days each `(from public docs)`. The Floodlight activity picker shows Status `Active` by default and columns Name · ID · Source (Google tag / Iframe tag) · Type (Counter / Sale) · Counting method.

### MX-09 Creative type ↔ line item compatibility and exchange approval (08, 05)
**A. Creative formats allowed per LI type** `(from public docs)` except the card descriptions in 05 (Display: image, HTML5 incl. rich media, native display and video; Video: video ads; Audio: audio ads). YouTube & partners and Demand Gen line items do not use library creatives: ads are built in the ad group / ad (AD rules, LI-DG rules). Mobile app install and Ads in mobile apps follow the chosen `adType`.

| Creative format | `DISPLAY` | `VIDEO` | `CTV` | `AUDIO` | Apps, adType `DISPLAY` | Apps, adType `VIDEO` | `DOOH_DISPLAY` | `DOOH_VIDEO` |
|---|---|---|---|---|---|---|---|---|
| `IMAGE` | Y | N | N | N | Y | N | Y | N |
| `HTML5` | Y | N | N | N | Y | N | N | N |
| `NATIVE_SITE` | Y | N | N | N | Y | N | N | N |
| `NATIVE_VIDEO` | Y | Y | N | N | N | Y | N | N |
| `VIDEO_FILE` | N | Y | Y | N | N | Y | N | Y |
| `YOUTUBE_VIDEO` | N | Y | N | N | N | N | N | N |
| `AUDIO_FILE` | N | N | N | Y | N | N | N | N |
| `TP_DISPLAY` | Y | N | N | N | Y | N | N | N |
| `TP_VIDEO` (VAST) | N | Y | Y | N | N | Y | N | Y |
| `TP_AUDIO` | N | N | N | Y | N | N | N | N |

**B. Serving eligibility of an assigned creative** (consumed by LI-060, LI-061, LI-064, CRE-040..042 and by the engine)
A creative can serve for a line item on exchange `e` only if all hold:
1. `creative.status = ACTIVE`;
2. DV360 review = `SERVABLE`;
3. `exchangeStatus[e] = APPROVED` (`PENDING` and `DISAPPROVED` do not serve; an exchange with no entry does not serve). The list shows `Servable (1 of 2)`; the status tab shows `Approved by 1 of 2 exchanges`;
4. no restriction applies to a country the LI targets (08: `This creative is restricted from serving in line items that target China`);
5. the creative size / duration matches the slot (MX-09b);
6. SSL: if `e` requires SSL and the creative is not SSL compliant, `exchangeStatus[e]` becomes `DISAPPROVED` with an SSL reason (CRE-011).

### MX-09b Creative size and file limits (SIM defaults, Q11)
These are simulator defaults chosen to be realistic, not claims about DV360's exact values.

| Item | Constant |
|---|---|
| Standard display sizes (W×H) | 300×250, 336×280, 728×90, 300×600, 320×50, 320×100, 160×600, 120×600, 970×250, 970×90, 468×60, 250×250, 200×200, 300×1050, 320×480, 480×320, 1024×768, 768×1024 |
| Image file types / max size | `gif`, `png`, `jpg`, `jpeg` / 150 KB |
| HTML5 | `.zip` with one HTML entry file / 10 MB |
| Video file | `mp4`, `mov`, `webm` / duration 5-600 s |
| Audio file | `mp3`, `ogg` / duration 5-180 s |
| VAST | versions 2.0, 3.0, 4.x |
| Third-party tag | click macro `${CLICK_URL}` expected (CRE-006); `${GDPR}` and `${GDPR_CONSENT_755}` accepted |

### MX-10 Targeting dimension availability per line item type (05, 06, 07)
`Y` available · `P` pre-added on create, removable · `L` pre-added and locked (cannot be removed or weakened) · `N` not available (LI-102 / TGT-003 reject).
Columns: DSP `DISPLAY`, VID `VIDEO`, CTV `CTV`, AUD `AUDIO`, MAI `MOBILE_APP_INSTALL`, AIA `ADS_IN_MOBILE_APPS`, YTLI `YT_VIDEO`/`YT_AUDIO` line item level, YTAG YouTube ad group level, DG `DEMAND_GEN`, DOOH `DOOH_*`.
Display column fully observed (07). YTLI and YTAG observed (06). Every other column is `(from public docs)` plus D-V1.

> Resolved RC-011: the column labels here (`INVENTORY_SOURCES`, `APPS_URLS`, `AUDIENCE_LISTS`, `KEYWORD_EXCLUSIONS`, `LIVESTREAM`, `DOOH_VENUE_SCREEN`) are matrix labels. `lib/validation/constants/targeting-availability.ts` maps them to the DM `TargetingDimension` keys (`INVENTORY_SOURCE`, `APPS_AND_URLS`, `AUDIENCE_LIST`, `KEYWORD` with mode EXCLUDE, `CONTENT_STREAM_TYPE`, `DOOH_VENUE`) and tests the mapping.

| Dimension key | DSP | VID | CTV | AUD | MAI | AIA | YTLI | YTAG | DG | DOOH |
|---|---|---|---|---|---|---|---|---|---|---|
| `INVENTORY_SOURCES` (exchanges, deals, groups, quality) | Y | Y | Y | Y | Y | Y | L (YouTube, Google TV, Video partners) | N | N | Y (DOOH exchanges only) |
| `BRAND_SUITABILITY` (inventory mode locked, 3P verification) | L | L | L | L | L | L | L | N | N | N |
| `APPS_URLS` | Y | Y | Y | Y | Y | Y | N | Y (placements) | N | N |
| `KEYWORDS` (include) | Y | Y | N | N | N | Y | N | Y | N | N |
| `KEYWORD_EXCLUSIONS` | Y | Y | N | N | Y | Y | Y | Y | N | N |
| `CATEGORIES` | Y | Y | Y | Y | Y | Y | N | Y | N | N |
| `ENVIRONMENT` (Web, App) | Y | Y | N | Y | N | L (Include: App) | N | N | N | N |
| `POSITION` | Y | Y | P (In-stream, all positions) | N | Y | Y | N | N | N | N |
| `VIEWABILITY` | L (Open Measurement) + Y (predicted) | Y | N | N | Y | Y | N | N | N | N |
| `LANGUAGE` | Y | Y | Y | Y | Y | Y | Y | N | Y | N |
| `AUDIENCE_LISTS` | Y | Y | Y | Y | Y | Y | N | Y (+ expansion) | Y (+ lookalike) | N |
| `GEOGRAPHY` | Y | Y | Y | Y | Y | Y | P (All locations) | N | Y | Y |
| `DAY_TIME` | Y | Y | Y | Y | Y | Y | Y | N | Y | Y |
| `DEMOGRAPHICS` | Y | Y | Y | Y | Y | Y | N | Y | Y | N |
| `BROWSER` | Y | Y | N | N | N | N | N | N | N | N |
| `DEVICE` | Y | Y | P (Include CTV; exclude Computer, Smartphone, Tablet; CTV must stay, LI-CTV-004) | Y | Y | L (Include: Smartphone, Tablet) | Y | N | Y | N |
| `CONNECTION_SPEED` | Y | Y | N | N | Y | Y | N | N | N | N |
| `CARRIER_ISP` | Y | Y | N | Y | Y | Y | N | N | N | N |
| `VIDEO_PLAYER_SIZE` | N | Y | P (Large, HD) | N | N | Y if adType `VIDEO` | N | N | N | N |
| `CONTENT_DURATION` | N | Y | Y | Y | N | Y if adType `VIDEO` | N | N | N | N |
| `LIVESTREAM`, `REWARDED` | N | Y | Y (livestream only) | N | N | Y if adType `VIDEO` | N | N | N | N |
| `OPTIMIZED_TARGETING` | Y | Y | Y | Y | Y | Y | N | N | N | N |
| `DOOH_VENUE_SCREEN` | N | N | N | N | N | N | N | N | N | Y |

Per-type notes (consumed by LI-AUD-003, LI-CTV-004, LI-DOOH-005, LI-VID-003):
* **Audio**: most audio serves in mobile apps, so no viewability, position, browser, connection speed or visual dimensions; public inventory is limited to 11 exchanges; Google Ad Manager and Spotify Ad Exchange support public inventory for audio (05).
* **CTV**: device is fixed to Connected TV; position and player size are pre-added; no browser, connection speed or carrier targeting; "Target DV360 curated CTV auction inventory" checkbox on `CTV` and `VIDEO` only; 46 exchanges in the demo (05).
* **DOOH**: only Geography, Day & time, Inventory sources (DOOH exchanges Hivestack, Place Exchange, VIOOH Digital Out of Home, Vistar, plus deals) and venue/screen targeting; fixed bid; no targeting templates (15).
* **Demand Gen**: Audience lists with expansion and lookalike, Demographics, Geography, Language, Device, Day & time `(from public docs)`.
* **Targeting templates** exist for `DISPLAY`, `VIDEO`, `AUDIO`, `CTV`, `DEMAND_GEN`, `YT_VIDEO` only (TPL-002).
* **Advertiser targeting rules** are merged into every LI and locked: Brand suitability (Inventory mode "Maximum inventory", content types, embedded YouTube videos and live streaming excluded), Channels & YouTube URLs, Keywords, Viewability (Open Measurement) (14).

Exchange counts used for defaults (05, 02): Display 45 of the partner's 54 enabled exchanges, Video 46, Connected TV 46, Audio 11.

### MX-11 Floodlight, Demand Gen and other prerequisites
| Feature | Prerequisite | Source of truth | Rule |
|---|---|---|---|
| Demand Gen line item | advertiser setting "Use Floodlight data for conversion optimization on Demand Gen line items" = on | `advertiser.demandGenFloodlightOptimization` | LI-DG-001 |
| Demand Gen / YouTube line items | partner "Google & partner inventory" enabled for the advertiser | `advertiserConfig.googleInventory` | LI-DG-004 |
| Maximize conversions, Max conversion value, Target CPA, Target ROAS | at least one active Floodlight activity on the LI | `li.conversions.activities` | LI-046 |
| Demand Gen in a Conversions IO | at least one Floodlight activity | same | LI-DG-005 |
| Floodlight value-based bidding | "Enable Floodlight optimization for YouTube" | `advertiser.youtubeFloodlight` | FL-015 |
| Tag-based audience | activity with Remarketing turned on | `floodlightActivity.remarketing` | AUD-012 |
| Custom bidding objective on a line item | algorithm `ACTIVE` | `customBidding.status` | LI-047 |
| YouTube product feed | linked Merchant Center account | `advertiser.linkedAccounts` | LI-YT-013 |
| App install measurement | app attribution partner link in the Floodlight group | `floodlightGroup.partnerIntegrations` | LI-APP-009 |
| Third-party verification | provider enabled in Advertiser settings, Third-party services | `advertiser.thirdParty` | TGT-092 |
| YouTube ads | business name and logo (from 12 Oct 2026) | `advertiser.businessName`, `.logo` | AD-011, AD-014 |
| YouTube guaranteed instant deals | terms accepted in Advertiser configurations | `advertiserConfig.ytGuaranteedTerms` | INV-007 |
| Advanced ad serving rate on creatives | "Accept advanced creative fees" in Advertiser configurations | `advertiserConfig.advancedAdServing` | info only |

### MX-12 Audience prerequisites (10)
| Item | Constant |
|---|---|
| Availability delay | 4 sim-hours after creation; Combined audiences immediate (AUD-060, TGT-103) |
| Lookalike seed lists | 1 to 10 first-party lists; each ≥ 1,000 active users (AUD-040, AUD-041) |
| Lookalike reach | slider stops 2.5%, 5%, 7.5%, 10% (default 5%) (AUD-042, RC-008) |
| Lookalike usable in | `YT_VIDEO`, `YT_AUDIO`, `DEMAND_GEN` (TGT-105) |
| Customer match minimum | 1,000 matched users to deliver `(from public docs)` (AUD-022) |
| Small-list warning | display size bucket `< 1K` (TGT-102) |
| Size buckets shown | `< 1K`, `1K-10K`, `10K-100K`, `100K-1M`, `1M-10M`, `10M+` per inventory (Display, YouTube users, Mobile app, CTV devices) |
| Audience eligibility filter | Display, YouTube, Mobile app, CTV `(from public docs)` |

### MX-13 Lift study eligibility and required media cost (15, 18)
| Item | Constant |
|---|---|
| Lift types | `BRAND_LIFT`, `SEARCH_LIFT` |
| Measurable LI types | Brand lift: `YT_VIDEO`, `YT_AUDIO`, `DEMAND_GEN`, `DISPLAY`, `AUDIO`, `VIDEO`. Search lift: `YT_VIDEO`, `DEMAND_GEN` |
| IO groups in picker | "YouTube programmatic guaranteed" or "All other insertion orders", not mixed (LS-002) |
| Eligible IO | IO contains ≥ 1 measurable LI; for the cross-exchange and AB-linked case, excludes PG YouTube LIs |
| Metrics | Brand lift: 1 to 3 of `VIDEO_AD_RECALL`, `AWARENESS`, `CONSIDERATION`, `FAVORABILITY`, `PURCHASE_INTENT`, `ASSOCIATION` |
| Survey | brand ≤ 30, competitors 0 to 3 each ≤ 30, language default English (US), object type required, intended action (`BUY`, `CHOOSE`, `USE`) required with Purchase intent |
| Study strength | `STANDARD` detects lift ≥ 2%; `ENHANCED` (YouTube only) detects ≥ 1.2%, requires 3× budget |
| Search lift | 1 to 5 groups, 1 to 3 terms per group |
| Spend window for the requirement | Brand lift ~10 days; Search lift ~4 weeks |
| Required media cost | observed example `₹470,000.00` for Brand lift (INR partner); `required = base[liftType] * strengthFactor * fx(currency)` with `strengthFactor` STANDARD 1, ENHANCED 3. `base[BRAND_LIFT] = 470000 INR`, `base[SEARCH_LIFT]` unknown, Q16 |
| Eligibility | `Eligible` iff measurableLiCount ≥ 1 and `yourMediaCost >= required`; otherwise `Not eligible` and the list action becomes **Review & fix** |
| Report slices | Brand/YouTube & Demand Gen tab: Overall, Age, Gender, Insertion order, Line item, Device, YouTube ad video. Cross exchange tab: Overall, Age, Gender, Insertion order, Line item, Device, Creative, Publisher domain, Publisher vertical. Lift views: Absolute, Relative, Headroom |

> Resolved RC-034: the required media cost values here are generated from the engine parameter `lift.requiredMediaCost` (ENG 6.8); do not hard-code the numbers in `lib/validation`.

### MX-14 A/B test constants (18)
| Item | Constant |
|---|---|
| Arm kinds | `INSERTION_ORDER` (default), `LINE_ITEM`; no mixing |
| Minimum arms | 2. New arm default split 0% (error `Enter a larger number`). Default two-arm split 50 / 50. Splits are whole numbers ≥ 1 and must total 100. Maximum arms: Q17 |
| Control | exactly one arm flagged as control, Q14 |
| Confidence | 90 (default) or 95 |
| Name / hypothesis / arm name | 100 / 400 / 200 |
| Measurement goals | Standard (YouTube, Demand Gen, cross exchange): `CLICKS`, `CONVERSIONS` (default), `REACH`. Channel specific: `CUSTOM_IMPRESSION_VALUE` (cross exchange), `VIDEO_COMPLETIONS` (cross exchange), `VIEWS` (YouTube) |
| Goals by arm content | cross-exchange IOs: Clicks, Conversions, Reach, Custom impression value, Video completions. YouTube IOs: Clicks, Conversions, Reach, Views. Demand Gen IOs: Clicks, Conversions, Reach |
| Report metrics | Impressions, Clicks, Conversions, Reach; Video completions, AVOC, Custom impression value, Engagements (Demand Gen, cross exchange), Engagements (YouTube), Views (YouTube) |
| Exclude unidentified users | cross-exchange only, default off |
| Lift study inside a test | IO arms with YouTube / Demand Gen LIs (excluding PG YouTube LIs); pacing `ASAP` (AB-022) |
| Locked after start | dates, arms, splits, control (AB-006, AB-024) |

### MX-15 Custom bidding limits (11)
| Item | Constant |
|---|---|
| Objectives | `BRAND_AWARENESS`, `CLICKS`, `CONVERSIONS` (rules), `CUSTOM` (rules or script) |
| Rules | at least 1; "Match ANY of the following"; each rule has a signal condition and a numeric score (default 1) |
| Multipliers | 0 to 4; types `AD_POSITION`, `CREATIVE_DIMENSION`, `DAY_TIME`, `DEVICE_TYPE`, `GENRE`, `DELIVERY_TYPE`, `DURATION`; each type once |
| Wizard | Set up → Test → Save; Save only after Test |
| Status | `TRAINING`, `ACTIVE`, `SUSPENDED` (LI can use only `ACTIVE`; `TRAINING` warns, `SUSPENDED` blocks) |
| Owner | `ADVERTISER` or `PARTNER` |
| Score model | `score = Σ(rule scores) × Π(multipliers)`; used by `MAX_CUSTOM_VALUE_COST` and `TARGET_CUSTOM_VALUE_COST` |

### MX-16 Limits catalogue (character, count and numeric limits)
| Key | Limit | Applies to | Src |
|---|---|---|---|
| `NAME_MAX_240` | 240 | campaign (public docs), IO, line item, targeting template, | 04, 05, 15 |
| `NAME_MAX_255` | 255 | ad group, ad, lookalike audience, other audience names, channel name (public docs) | 06, 10 |
| `NAME_MAX_512` | 512 | creative name | 08, 17 |
| `NAME_MAX_200` | 200 | instant deal name, A/B arm name | 09, 18 |
| `NAME_MAX_128` | 128 | lift study name | 15, 18 |
| `NAME_MAX_100` | 100 | A/B test name | 18 |
| `HYPOTHESIS_MAX` | 400 | A/B test hypothesis | 18 |
| `TEMPLATE_DESC_MAX` | 600 | targeting template description | 15 |
| `AD_HEADLINE_MAX` | 30 | YouTube ad headline | 06 |
| `AD_LONG_HEADLINE_MAX` | 90 | YouTube ad long headline | 06 |
| `AD_DESCRIPTION_MAX` | 90 | YouTube ad description | 06 |
| `AD_CTA_MAX` | 10 | YouTube ad call to action | 06 |
| `AD_BUSINESS_NAME_MAX` | 25 | ad / advertiser business name | 06, 14 |
| `AD_DISPLAY_PATH_MAX` | 15 | display URL path 1 and path 2 | 06 |
| `DG_HEADLINE_MAX` | 40 | Demand Gen headline `(from public docs)` | Q8 |
| `LANDING_URL_MAX` | 1024 | creative landing page URL | 08 |
| `INTEGRATION_CODE_MAX` | 500 bytes | integration code fields `(from public docs)` | 04, 08, 14 |
| `KEYWORDS_MAX_NEG_LIST` | 5,000 | negative keyword list | 17 |
| `KEYWORD_MAX_LEN` | 80 | single keyword `(from public docs)` | 07 |
| `KEYWORDS_MAX_LI` | 5,000 | positive keywords per line item `(from public docs)` | 07 |
| `CHANNEL_ENTRIES_MAX` | 10,000 | URLs and apps per channel | 17 |
| `CAMPAIGN_KEYWORDS_MAX` | 5 | campaign recommendation keywords | 03 |
| `LIFT_BRAND_NAME_MAX` / `LIFT_COMPETITOR_MAX` | 30 / 30 (competitors ≤ 3) | lift study survey | 15, 18 |
| `LIFT_METRICS_MAX` | 3 | brand lift metrics | 15, 18 |
| `LIFT_SEARCH_GROUPS_MAX` | 5 groups × 1-3 terms | search lift | 18 |
| `LOOKALIKE_SEEDS_MAX` / `LOOKALIKE_SEED_MIN_USERS` | 10 / 1,000 | lookalike audience | 10 |
| `LOOKALIKE_REACH_RANGE` | 2.5% to 10% | lookalike | 10 |
| `CUSTOM_BID_MULTIPLIERS_MAX` / `CUSTOM_BID_RULES_MIN` | 4 / 1 | custom bidding | 11 |
| `AB_MIN_ARMS` / `AB_SPLIT_TOTAL` | 2 / 100 | A/B test | 18 |
| `FEES_MAX_PER_KIND` | 5 `(from public docs)` | partner costs | 04 |
| `FLOODLIGHT_WINDOW_DAYS` | 1 to 90 `(from public docs)` | click / impression lookback | 11 |
| `ALERT_UNDERPACING_DEFAULT` | 90 (%) | advertiser alert | 14 |
| `AUDIENCE_DELAY_HOURS` | 4 | new audiences | 10 |
| `SDF_VERSIONS` | 9, 9.1, 9.2, 10, 10.1, 11 | partner / advertiser | 02, 14 |
| `BULK_STATUS_ROWS` | 100 most recent | bulk status page | 01 |
| `GEO_RADIUS_RANGE` | 1 to 500 km `(from public docs)` | geography radius | Q10 |

### MX-17 Partner cost fee types (04)
CPM fee and media fee "Type" options: `Default`, `Third-Party Ad Server`, `DoubleVerify`, `Adsafe`, `AdXpose`, `Vizu`, `Aggregate Knowledge`, `Teracent`, `Evidon`, `Agency Trading Desk Fee`, `ShopLocal`, `TrustMetrics`, `Integral Ad Science Video`, `MOAT Video`, `Scope3`, `Custom Fee 1`..`Custom Fee 5`. Media fee 1 is always the locked "Automated cost - Display & Video 360 Fee" (invoiced). Amount: CPM fee in money, media fee in percent. In the simulator these are renamed to fictional vendor labels (R5) but keep the count and structure.

> Resolved RC-046: third-party rate-card vendors (DM 5.2 `ThirdPartyRateCard`) are extra fee types in this list and in IO and LI partner costs; the engine reads fees from `partnerCosts` only (ENG 8.2).

### MX-18 Date rules (03, 04, 05, 18)
| Entity | Start | End | Locked after start | Order |
|---|---|---|---|---|
| Campaign | required, default today | optional | start date locked once started | `end >= start` (CMP-032) |
| Campaign budget row | optional | optional | n/a | `end >= start` |
| IO budget segment | required, default today | required, default last day of month | start locked once the segment started | `end >= start`; segments do not overlap; IO flight = earliest start to latest end |
| Line item | "Use same dates as insertion order" or custom | same | start locked once started `(from public docs)` | custom range inside the IO flight |
| A/B test | required, default today | optional | both locked after start | `end >= start` |
| Deal | required | optional | per section 4.7 | `end >= start` |
| Offline report schedule | Starts | Expires | n/a | `expires >= starts` |
| Lift study | derived from the IO flights | derived | n/a | spend window per MX-13 |

Past dates: not accepted as a new start date on create (CMP-034, LI-024) `(from public docs)`; "today" is the advertiser time zone date.

---

## 4. State machines and bulk-action constraints

### 4.0 Conventions
* `status` is what users and bulk jobs write. `effectiveStatus` is computed and decides serving and the status icon. `COMPLETED` is never written by users: it is derived when the entity is `ACTIVE` and its flight (last budget segment end, or end date) is in the past, and for deals it is also stored by the engine.
* Status icons (03, 04, 09): green dot Active · grey pause Paused · hollow circle Draft · Archived is hidden from the default `Status: Active` filter · deals also show Completed and Not servable.
* A parent that is not serving stops all children without changing their stored status. Serving formula:
  `serving(li) = advertiser.ACTIVE ∧ campaign.ACTIVE ∧ io.ACTIVE ∧ li.ACTIVE ∧ now ∈ flight ∧ budgetRemaining ∧ servableCreativeOrAd`.
* Every successful transition writes a `ChangeLog` row `{field: "status", old, new, actor}` (16, 17). Bulk transitions write one `BulkJob` row (01).

**Roles** (02 lists Standard, Read only, Partner client, Reporting only; Admin and Creative come from public docs)
| Role key | Maps to | May change status / archive | May create | Notes |
|---|---|---|---|---|
| `ADMIN` | DV360 Admin; simulator instructor and admin | yes | yes | also schedule advertiser for deletion, manage users, force any state (scenario tools) |
| `STANDARD` | DV360 Standard; simulator student default | yes within own sandbox | yes | cannot manage users |
| `READ_ONLY` | DV360 Read only | no | no | all bulk edit items greyed, Save hidden |
| `REPORTING_ONLY` | DV360 Reporting only | no | no | only the Reports app; entity pages return the 404 page (17) |
| `PARTNER_CLIENT` | DV360 Partner client | view and report; changes need Standard `(from public docs)` | no | |
| `CREATIVE` | DV360 Creative | creatives only | creatives only | `(from public docs)` |
| `SYSTEM` | engine, sync jobs, seller | engine-driven transitions | n/a | logged as a system user so the "Include system changes" toggle works (16) |
| **Limited Access** | restriction profile on any role (chip on page titles) | edit items greyed | Create advertiser, channel, custom bidding, New audience, creative **New ▾**, A/B **Create new**, New plan disabled | seen across 02, 13, 14, 15, 17; used for scenarios |

**State applicability** (`S` stored, `D` derived, `-` not used)
| Entity | Draft | Active | Paused | Archived | Completed | Scheduled for deletion |
|---|---|---|---|---|---|---|
| Advertiser | - | S | S | - | - | S |
| Campaign | - | S | S | S | - | - |
| Insertion order | S | S | S | S | D | - |
| Line item | S | S | S | S | D | - |
| Ad group / Ad | - | S | S | - (deleted via trash) | - | - |
| Creative | - | S | S | S | - | - |
| Audience | - (processing, 4.6) | S | - | S | - | - |
| Deal | S | S | S | S | S | - |
| A/B test | - (scheduled, 4.8) | S | - | - | S | - |
| Lift study | - | S (in progress) | S | - | S | - |

### 4.1 Advertiser (14, 02)
States `ACTIVE`, `PAUSED`, `SCHEDULED_FOR_DELETION`.

| From | To | Who | Trigger | Guard | Side effects |
|---|---|---|---|---|---|
| (create) | `ACTIVE` | `ADMIN`, `STANDARD` with partner write | Create advertiser | partner write access; currency and time zone chosen (locked afterwards) | Floodlight group, defaults copied from partner |
| `ACTIVE` | `PAUSED` | `ADMIN`, `STANDARD` | Status dropdown beside Name, then Save | ADV-005 | banner ADV-009 on all advertiser pages; nothing serves; entity statuses unchanged |
| `PAUSED` | `ACTIVE` | same | same | none | banner removed; children resume per their own status |
| `ACTIVE`, `PAUSED` | `SCHEDULED_FOR_DELETION` | `ADMIN` | footer **Schedule for deletion**, DLG-05 | ADV-010 | serving stops; hidden from default Advertisers list (`Status: Active`); filter popover offers Active / Paused / Scheduled for deletion (02) |
| `SCHEDULED_FOR_DELETION` | `ACTIVE`, `PAUSED` | `ADMIN` | **Cancel deletion** `(from public docs)` | before purge | restored with previous entity statuses |
| `SCHEDULED_FOR_DELETION` | (purged) | `SYSTEM` | retention elapsed (instructor setting, Q18) | | data removed, ChangeLog kept |

### 4.2 Campaign (03)
States `ACTIVE`, `PAUSED`, `ARCHIVED`. No Draft.

| From | To | Who | Trigger | Guard | Side effects |
|---|---|---|---|---|---|
| (create) | `ACTIVE` or `PAUSED` | `ADMIN`, `STANDARD` | **Create** with status chip (default Active) | CMP rules, no `E` | opens the campaign page |
| `ACTIVE` | `PAUSED` | same | inline row ▾ **Pause**, bulk **Pause**, status chip on settings, Save | not archived | IOs and LIs stop serving; statuses unchanged |
| `PAUSED` | `ACTIVE` | same | inline **Activate**, bulk **Activate** | not archived; advertiser may be paused (still allowed, warns by banner) | serving resumes if children active |
| `ACTIVE`, `PAUSED` | `ARCHIVED` | same | bulk **Archive**, DLG-03 | none | cascade: IOs and LIs become `ARCHIVED` `(from public docs)`, Q19; leaves default Active filter |
| `ARCHIVED` | `PAUSED` | same | **Unarchive** from the Archived list `(from public docs)` | | children stay archived until unarchived individually |
| any | (copy) | same | bulk **Duplicate** | | `BulkJob` "Duplicating 1 campaign to advertiser {id}"; copy status Q20 |

### 4.3 Insertion order (04)
States `DRAFT`, `ACTIVE`, `PAUSED`, `ARCHIVED`; `COMPLETED` derived.

| From | To | Who | Trigger | Guard | Side effects |
|---|---|---|---|---|---|
| (create) | `DRAFT` (default) or `ACTIVE` | `ADMIN`, `STANDARD` | **Create** with status chip | IO step 1 and step 2 rules; if `ACTIVE`, A rules too | IO page opens |
| `DRAFT` | `ACTIVE` | same | status chip, bulk **Activate** | IO-090, IO-091, IO-092 | engine starts pacing from now; hollow circle becomes green dot |
| `ACTIVE` | `PAUSED` | same | row ▾, bulk **Pause**, chip | | its LIs stop; budget segments keep dates |
| `PAUSED` | `ACTIVE` | same | row ▾, bulk **Activate** | IO-091, IO-092 | resumes |
| `DRAFT` | `PAUSED` | not offered | n/a | | Pause is disabled for Draft rows |
| `DRAFT`, `ACTIVE`, `PAUSED` | `ARCHIVED` | same | bulk **Archive**, DLG-03 | | cascade to its LIs `(from public docs)`; appears under ⋮ → Archived → Insertion orders (04) |
| `ARCHIVED` | `PAUSED` | same | unarchive `(from public docs)` | parent campaign not archived | |
| `ACTIVE` | `COMPLETED` (derived) | `SYSTEM` | latest segment end date passed | | shown as Completed; no spend; can still be edited or archived |

### 4.4 Line item, ad group, ad (05, 06)
Line item states and transitions are those of 4.3, with these differences.

| Item | Difference |
|---|---|
| Guards | LI-110, LI-111; parent IO and campaign must not be archived |
| `DRAFT` to `ACTIVE` | warnings LI-063 / LI-YT-018 / LI-DG-010 shown, never block |
| Archive | line item stays in ⋮ → Archived → Line items; creatives, deals, audiences unaffected |
| YouTube / Demand Gen | an active LI without an active ad group (or ad) stays `ACTIVE` but cannot deliver; AG-005 warns |
| Ad group | `ACTIVE` ⇄ `PAUSED` (Status filter default `Active`); trash icon deletes with DLG-08 (no archive state) |
| Ad | status chip `ACTIVE` ⇄ `PAUSED` (06); trash deletes with DLG-08 |
| Completed | derived from LI flight end |

### 4.5 Creative (08, 17)
Two independent machines: user status and review state (written by the engine).

User status
| From | To | Who | Trigger | Guard | Side effects |
|---|---|---|---|---|---|
| (create) | `ACTIVE` | `ADMIN`, `STANDARD`, `CREATIVE` | Save | CRE rules | review starts: DV360 `PENDING`, each exchange `PENDING` |
| `ACTIVE` | `PAUSED` | same | status dropdown (edit only) | CRE-070 warns | creative not eligible for any LI |
| `ACTIVE`, `PAUSED` | `ARCHIVED` | same | bulk archive | CRE-070 warns | removed from assignment pickers; stays on existing LIs but cannot serve |
| `ARCHIVED` | `PAUSED` | same | unarchive | | |

Review state
| Machine | From | To | Who | Trigger | Side effects |
|---|---|---|---|---|---|
| DV360 review | `PENDING` | `SERVABLE` | `SYSTEM` (`CREATIVE_APPROVAL_SYNC`) | simulated delay | feedback "Creative is servable"; restrictions may attach |
| DV360 review | `PENDING` | `NOT_SERVABLE` | `SYSTEM` | policy failure (scenario seed or validation, for example no click macro) | feedback box with **Appeal** |
| DV360 review | `NOT_SERVABLE` | `PENDING` | `ADMIN`, `STANDARD` | **Appeal** (CRE-043) | row added to Appeal history (Ad or creative appealed, Campaign impact, Appeal type, Inventory, Policy, Status, Created, Completed, Result); engine decides after a delay |
| any | `PENDING` | any | `SYSTEM` | creative asset, tag or landing URL edited | review restarts |
| Exchange review (per exchange) | `PENDING` | `APPROVED` or `DISAPPROVED` | `SYSTEM` | simulated exchange response; SSL check (CRE-011) | list text `Servable (1 of 2)`; summary `Approved by {n} of {m} exchanges`; last sync time updates |
| Exchange review | `DISAPPROVED` | `PENDING` | `ADMIN`, `STANDARD` | **Appeal** per exchange | message "Contact the respective exchange directly to resolve issues." for non-GAM exchanges |

### 4.6 Audience (10)
| From | To | Who | Trigger | Guard | Side effects |
|---|---|---|---|---|---|
| (create) | `PROCESSING` | `ADMIN`, `STANDARD` | Save | AUD rules | available in 4 sim-hours (AUD-060); list shows `< 1K` until filled |
| (create, Combined) | `ACTIVE` | same | Save | AUD-030, AUD-031 | immediately available |
| `PROCESSING` | `ACTIVE` | `SYSTEM` | 4 sim-hours elapsed | lookalike: every seed still ≥ 1,000 | size per inventory bucketed |
| `PROCESSING` | `ACTIVE` (size `< 1K`) | `SYSTEM` | | seeds below minimum | usable only with TGT-102 warning |
| `ACTIVE` | `ARCHIVED` | same | archive | AUD-100 warns | line items keep the reference; the engine stops matching it |
| `ARCHIVED` | `ACTIVE` | same | unarchive | | |
Tag-based audiences fill from simulated Floodlight hits of the chosen activity (11). Customer match uploads take effect after the same 4 h delay.

> Resolved RC-008: the DB state is `PROCESSING` (this table said `POPULATING`). `INACTIVE` (an empty customer match list) and `ARCHIVED` also apply to Audience; `PAUSED` does not.

### 4.7 Deal (09)
States exactly as the Status filter shows them: `DRAFT`, `ACTIVE`, `PAUSED`, `ARCHIVED`, `COMPLETED`, `NOT_SERVABLE`. Default filter selects Active, Paused, Draft, Completed, Not servable (5 selected); Archived is off.

| From | To | Who | Trigger | Guard | Side effects |
|---|---|---|---|---|---|
| (create instant deal) | `ACTIVE` | `STANDARD` with write on all assigned advertisers | **Accept** after reviewing forecast | INV-001..INV-006 | deal appears under an order; non-guaranteed |
| (import / seller push) | `DRAFT` | `SYSTEM` (seller) | negotiation accepted or seller creates | | needs buyer action; row in "Action required" |
| `DRAFT` | `ACTIVE` | `ADMIN`, `STANDARD` with write | **Activate** | INV-010 (write access) | line items can target it |
| `ACTIVE` | `PAUSED` | same | **Pause** | INV-014 (`Allow Pausing` = Yes) | LIs stop bidding on the deal |
| `PAUSED` | `ACTIVE` | same | **Activate** | | |
| `ACTIVE`, `PAUSED` | `ARCHIVED` | same | **Archive** | not assigned to active LIs, or warn | removed from default list |
| `ARCHIVED` | `PAUSED` | same | unarchive | | |
| `ACTIVE` | `COMPLETED` | `SYSTEM` | end date passed or quantity delivered (PG) | | terminal |
| `ACTIVE` | `NOT_SERVABLE` | `SYSTEM` | exchange disabled at partner, seller revoked access, or deal invalid | | alert "Deals offline" after 48 h without inventory (14) |
| `NOT_SERVABLE` | `ACTIVE` | `SYSTEM` | cause resolved | | |
Programmatic Guaranteed: price, quantity and "Programmatic Guaranteed Direct" are locked once started (INV-011); a PG deal with no LI shows the red alert (INV-012).

### 4.8 A/B test and lift study (18)
**A/B test**
| From | To | Who | Trigger | Guard | Side effects |
|---|---|---|---|---|---|
| (create) | `ACTIVE` | `ADMIN`, `STANDARD` (not Limited Access) | **Save** with start ≤ today | AB rules | engine splits simulated users by arm percentages; arms deliver only to their slice |
| (create) | `SCHEDULED` `[SIM]` | same | **Save** with future start | | becomes `ACTIVE` at start |
| `SCHEDULED`, `ACTIVE` | `COMPLETED` | same | **End** (DLG-07) | not already completed (AB-025) | arms return to normal delivery; report frozen; **End** disabled |
| `ACTIVE` | `COMPLETED` | `SYSTEM` | end date reached | | same |
There is no restart. While `ACTIVE`, settings panel allows name / hypothesis / end date only (AB-006, AB-024).

**Lift study** (list shows per-flight text such as `Flight 1 (Complete)`, `Flight 1 (0% complete) In progress`, `Flight 1 (Not eligible) Paused`)
| From | To | Who | Trigger | Guard | Side effects |
|---|---|---|---|---|---|
| (create) | `IN_PROGRESS` | `ADMIN`, `STANDARD` | **Create** | LS rules, LS-014 eligible | survey simulation starts with the IO flights |
| (create) | `NOT_ELIGIBLE` | same | **Create** with LS-014 failing | | action button **Review & fix** (red) opens the edit form (lift type locked, LS-015) |
| `NOT_ELIGIBLE` | `IN_PROGRESS` | same | **Review & fix** then save | LS-014 passes | |
| `IN_PROGRESS` | `PAUSED` | `SYSTEM` | all IOs paused or eligibility lost | | list shows "Paused" |
| `PAUSED` | `IN_PROGRESS` | `SYSTEM` | IO active again and eligible | | |
| `IN_PROGRESS` | `COMPLETE` | `SYSTEM` | flight ended and required responses reached | | **View report** enabled (slices in MX-13) |
| `IN_PROGRESS`, `COMPLETE` | `ENDED` | same users | **End** under Lift Actions (DLG-07) | | |
| `COMPLETE`, `IN_PROGRESS` | adds a flight | same | **Add flight** | eligibility re-checked | new flight row |

### 4.9 Other stateful entities (short)
| Entity | States | Notes |
|---|---|---|
| Plan (13) | `PLANNED` → `TRAFFICKED` | trafficked when converted to a campaign / IO / LIs; past-dated plan is read-only (PLN-002); remove plan uses DLG-06 |
| Custom bidding (11) | `TRAINING` → `ACTIVE` ⇄ `SUSPENDED`; `ARCHIVED` | `SUSPENDED` blocks LI (LI-047) |
| Floodlight activity (11) | `ACTIVE`, `ARCHIVED` | list filter default Active |
| Bulk job (01) | `RUNNING`, `COMPLETED`, `FAILED` | list shows ✓ Completed / ⚠ Failed |

### 4.10 Bulk-action constraints
Bulk bar text: `{n} row(s) selected` · **Action ▾** · **Segment by** · ✕. Items are greyed when not applicable to the selection (03, 04, 05).

**Applicability rule** `isApplicable(action, rows)`: enabled iff at least one selected row is eligible for the action and the user has write access (Q2: demo only showed the "already active" case). The job runs on the eligible rows, skips the rest, and the Bulk status description reads `Status edited on {n} campaigns` / `line items`. If rows were skipped, BLK-010 shows how many.

| Action | Campaigns grid | IO grid | LI grid | Eligible rows | Disabled when |
|---|---|---|---|---|---|
| Status: Activate | yes | yes | yes | `PAUSED`, `DRAFT` (IO, LI); `PAUSED` (campaign) | every selected row is already `ACTIVE`, or `ARCHIVED` (03: "disabled if already active") |
| Status: Pause | yes | yes | yes | `ACTIVE` | every row is `PAUSED`, `DRAFT` or `ARCHIVED` |
| Bulk apply: Targeting template | no | yes | yes | LIs of the template type | no LI of a supported type selected; skipped rows reported (BLK-012) |
| Bulk edit: Settings | no | yes | yes | any non-archived | read-only role or Limited Access |
| Bulk edit: Inventory ▸, Content ▸, Audience ▸, Technology ▸ | no | no | yes | LIs where the dimension is available (MX-10) | Limited Access; selected types all lack the dimension |
| Bulk edit: Creative assignment | no | yes | yes | LIs that use library creatives | all selected are `YT_*` or `DEMAND_GEN` |
| Bulk action: Archive | yes | yes | yes | not archived | all selected archived. DLG-03 shows the cascade |
| Bulk action: Duplicate (⌘+D) | yes | yes | yes | any | none; copies >= 1 (BLK-013); target must accept the type (BLK-014); `BulkJob` "Duplicating {n} {entity} to {parent} {id}" |
| SDF: Download (⌘+Shift+K), Download QA | yes | yes | yes | any | never disabled by status; allowed under Limited Access |
| SDF: Upload, Download metadata | campaigns list ⋮ | IO and LI ⋮ (Upload only) | | | read-only role |

After any bulk action the selection clears, the grid refreshes, and a snackbar links to **Bulk status** (`/bulk-status`). Only the 100 most recent jobs are kept in the list (BLK-015).

### 4.11 Account (19)
- Status: `ACTIVE`, `DISABLED`, `LOCKED`, `ARCHIVED` (stored in `User.status`). `LOCKED` is set by the system after the failure threshold and clears by time, **Unlock** or **Reset password**.
- Transitions: `ACTIVE` to `DISABLED` (Disable), `DISABLED` to `ACTIVE` (Enable), `ACTIVE` to `LOCKED` (system), `LOCKED` to `ACTIVE` (time, Unlock, Reset), `LOCKED` to `DISABLED`, any of `ACTIVE`, `DISABLED`, `LOCKED` to `ARCHIVED` (Delete; never for `SUPER_ADMIN`, ACC-026), `ARCHIVED` to `DISABLED` (Restore), `ARCHIVED` to removed (Purge, Super admin).
- Not allowed: `ARCHIVED` to `ACTIVE` directly; any change that leaves no active Super admin (ACC-024); disable or archive of the actor's own account (ACC-023).
- Side effects: disable, archive, role change and password change bump `sessionVersion`; disable and archive freeze or archive the User's sandbox (module 19 4.10).
- Matrix of who may do each transition: module 19 4.2.

---

## 5. "Unsaved Changes" and confirm-dialog behaviour

### 5.1 Unsaved Changes (verbatim from 03, 04, 05)
Modal, centred, with scrim.
| Part | Text / behaviour |
|---|---|
| Title | `Unsaved Changes` |
| Body | `You have made changes that have not been saved and will be lost.` |
| Buttons | **Discard changes** (primary) · **Continue editing** |
| Result | Discard: closes the form, no write, navigates to the page the user was leaving for. Continue: closes the modal, form unchanged, focus returns to the last focused field |
| Dismiss | `Esc` and a click on the scrim act as **Continue editing** |
| Focus on open | `[SIM]` **Continue editing** (the safe action), though **Discard changes** is the primary style |

**When it opens** (rule UC-1..UC-5)
1. UC-1. The user leaves a **full-page form** with edits: close ✕, **Cancel**, breadcrumb or left-nav click, router back. Applies to New campaign, New IO (both steps), New line item, New creative, New audience forms, New targeting template, New lift study, New A/B test, campaign / IO / LI details pages, creative page, advertiser settings, partner settings, user edit. The modal is **not** shown when the form is pristine.
2. UC-2. Browser tab close, reload or external link with edits: native `beforeunload` prompt (text cannot be customised).
3. UC-3. Slide-overs (targeting editors, ad group, ad, third-party services, exchanges, arm picker, select-creatives panel): **Cancel**, ✕ or scrim discards the slide-over's own edits without a modal (07 footer Apply · Cancel). **Apply** copies the edits into the parent form, which then becomes dirty. Closing the parent form follows UC-1.
4. UC-4. Plain-text editors that save on their own (channel panel, negative keyword list): leaving with edits shows the editor-specific text from `CHANNEL_UNSAVED`: `You have made changes to this channel that have not yet been saved and will be lost.` (DLG-02). Same pattern with "keyword list" for the keyword editor `[SIM]`.
5. UC-5. Switching a tab inside an entity page (for example LI Details → Troubleshooter) with edits on the details form follows UC-1.

**Dirty state**: `isDirty = !deepEqual(normalize(current), normalize(initial))` where `initial` is the snapshot taken after defaults were applied on first render, and `normalize` trims strings, drops empty trailing budget rows and sorts unordered lists. Typing then reverting is clean. Locked fields, counters, expanded or collapsed panels and the change note do not count. **Save** is disabled while clean (14, 17, 13). **Reset** (details footer: Save · Reset · change note) restores the saved values without a modal.

**Submit behaviour** (03, 04, 05)
* **Create** or **Save** with any `E` issue: no navigation, no modal, red borders and inline text, focus on the first invalid field, the page scrolls to it. Warnings remain visible and do not block.
* With only warnings: the save succeeds; a toast `Saved` appears and the warnings stay inline on the saved page.
* Server-side `E` issues from a race (for example a locked field changed elsewhere) come back as `Issue[]` and render exactly like client issues.
* Optional change note: placeholder `Optional: Enter a note about this change`, stored on the ChangeLog group.

### 5.2 Dialog catalogue
Texts marked `[SIM]` were not seen in the demo and are written in DV360's style for sign-off.

| ID | Trigger | Title | Body | Buttons | Result | Src |
|---|---|---|---|---|---|---|
| DLG-01 | leave a dirty form | `Unsaved Changes` | `You have made changes that have not been saved and will be lost.` | **Discard changes** · **Continue editing** | see 5.1 | 03, 04, 05 |
| DLG-02 | leave a dirty channel / list editor | (none) | `You have made changes to this channel that have not yet been saved and will be lost.` | `[SIM]` **Discard** · **Keep editing** | discards or stays | 17 |
| DLG-03 | Archive (single or bulk) | `[SIM] Archive {n} {entity}?` | `[SIM] Archived items stop serving and are hidden from the default view.` + for campaign / IO: `[SIM] Their insertion orders and line items will also be archived.` | `[SIM]` **Archive** · **Cancel** | bulk job; ChangeLog | 03, 04 |
| DLG-04 | SDF Download / Upload | `Download Structured Data Files` / `Upload structured data files` | per 15 (checkbox list, EU political ads note, SDF 9 deprecation note, drop zone) | **Next** · **Cancel** / **Upload** · **Cancel** | BLK-001 / BLK-002 validation; Bulk status job | 15 |
| DLG-05 | Schedule advertiser for deletion | `[SIM] Schedule {name} for deletion?` | `[SIM] Its campaigns, insertion orders and line items will stop serving. You can cancel the deletion until {date}.` | **Schedule for deletion** · **Cancel** | status `SCHEDULED_FOR_DELETION` | 14 |
| DLG-06 | Remove plan | `[SIM] Remove plan?` | `[SIM] {name} will be removed. This can't be undone.` | **Remove** · **Cancel** | plan deleted | 13 |
| DLG-07 | End A/B test, End lift study | `[SIM] End {name}?` | `[SIM] Ending stops the {test or study}. This can't be undone.` | **End** · **Cancel** | `COMPLETED` / `ENDED` | 18 |
| DLG-08 | Delete ad group / ad (trash) | `[SIM] Delete {name}?` | `[SIM] This ad group and its ads will be deleted.` | **Delete** · **Cancel** | removed | 06 |
| DLG-09 | trash on a targeting row | no dialog | the row is removed from the form and the form becomes dirty | | | 07 |
| DLG-10 | Copy settings from an existing campaign | `Copy settings` (dialog with search, campaign list, Settings checkboxes: Frequency cap, Campaign goal, Creative type) | n/a | **Cancel** · **Copy Settings** (disabled until a campaign and one setting are chosen, CMP-070) | copies only ticked settings | 03 |
| DLG-11 | save when a newer version exists | `[SIM] This item changed` | `[SIM] Someone else saved changes while you were editing. Reload to see the latest version.` | **Reload** · **Keep my changes** | reload or overwrite with a new ChangeLog row | n/a |
| DLG-12 | Demand Gen card without prerequisite | yellow toast (not a modal) | `To create Demand Gen line items:` · `Enable Floodlight optimization in this advertiser` | **Dismiss** | picker stays | 05 |

Keyboard: `Esc` closes any dialog as its safest button (Continue editing, Cancel). `Enter` triggers the primary button only when focus is on a button.

---

## 6. TypeScript design (`lib/validation/`)

### 6.1 Goals
1. One rule definition runs in the browser form, in server actions, in SDF import, in bulk jobs and in the engine's alert generator.
2. Rules are pure and synchronous: no network, no Prisma, no React. All data a rule needs is passed in `ValidationContext`.
3. The catalogue in this file is the source of truth. A docs-sync test fails when a rule's severity or verbatim message drifts from this document.
4. The Vitest case table in 6.7 is the first acceptance suite for P3-06 (Campaign → IO → LI CRUD with full validation).

### 6.2 Folder structure
```
lib/validation/
├─ index.ts                    public API: validate, validateAll, RULES, MSG, types
├─ types.ts                    Severity, Trigger, Issue, Rule, Violation, ValidationContext, EntityKind
├─ engine.ts                   selection by trigger and path, suppression, dedupe, ordering
├─ registry.ts                 RULES by EntityKind; asserts unique IDs and complete metadata
├─ messages.ts                 MSG constants (1.2) and format(template, params)
├─ primitives.ts               required(), positive(), maxLen(), isUrl(), dateRange(), isWhole(), pct()
├─ constants/                  matrices MX-01..MX-18 as typed `as const` data
│  ├─ goals-kpis.ts  io-matrix.ts  li-compat.ts  pacing.ts  frequency.ts  youtube.ts
│  ├─ conversions.ts  creatives.ts  targeting-availability.ts  prerequisites.ts
│  ├─ audiences.ts  experiments.ts  custom-bidding.ts  limits.ts  fees.ts  dates.ts
├─ rules/                      one file per module; each exports Rule<T>[]
│  ├─ partner.ts advertiser.ts campaign.ts io.ts
│  ├─ line-item.ts            (LI-xxx shared)
│  ├─ li-display.ts li-video.ts li-ctv.ts li-audio.ts li-app.ts li-youtube.ts li-demand-gen.ts li-dooh.ts
│  ├─ ad-group.ts ad.ts targeting.ts template.ts creative.ts audience.ts inventory.ts
│  ├─ resources.ts            (CH, KW, LOC, FL, CB)
│  └─ experiments.ts bulk.ts misc.ts       (AB, LS · BLK · PLN, RPT, USR)
├─ state/
│  ├─ transitions.ts          section 4 tables as data + canTransition(entity, from, to, actor, ctx)
│  ├─ effective-status.ts     serving formula and COMPLETED derivation
│  └─ bulk.ts                 isApplicable(action, rows, actor) per 4.10
├─ dialogs.ts                 DLG-01..DLG-12 texts and the dirty-state rules (section 5)
├─ client/                    may import react / next
│  ├─ useValidatedForm.ts     react-hook-form resolver + blur subset
│  ├─ useUnsavedChanges.ts    dirty tracking, route guard, beforeunload
│  └─ issues.ts               Issue[] to field errors, banner list, focus-first-error
├─ server/                    may import prisma / next/server
│  ├─ context.ts              buildContext(db, kind, ids, actor) → ValidationContext
│  └─ withValidation.ts       wrapper for server actions
└─ testing/fixtures.ts        valid*() factories used by every test
tests/validation/
├─ cases.campaign.ts  cases.io.ts  cases.li.ts  cases.youtube.ts  cases.targeting.ts ...
├─ catalogue.test.ts          runs every case table
├─ coverage.test.ts           every non-alias rule ID has ≥ 1 case
├─ docs-sync.test.ts          parses docs/specs/validation.md, compares IDs, severities, verbatim messages
└─ state.test.ts  dirty.test.ts
```
Lint rule: files outside `client/` and `server/` may not import `react`, `next/*`, `@prisma/client` or `node:*`. Money and dates inside rules use plain numbers (minor units) and `Date`.

### 6.3 Core types
```ts
// types.ts
export type Severity = 'error' | 'warning' | 'info';
export type Trigger = 'blur' | 'save' | 'cross' | 'activate';          // B, S, X, A in the tables
export type EntityKind =
  | 'partner' | 'advertiser' | 'campaign' | 'insertionOrder' | 'lineItem'
  | 'adGroup' | 'ad' | 'targetingTemplate' | 'creative' | 'audience' | 'instantDeal' | 'deal' | 'dealGroup'
  | 'channel' | 'keywordList' | 'locationList' | 'floodlightGroup' | 'floodlightConversion'
  | 'customBidding' | 'abTest' | 'liftStudy' | 'plan' | 'report' | 'user' | 'sdfUpload';

export interface Issue {
  ruleId: string;                         // 'CMP-013'
  severity: Severity;
  path: string;                           // 'kpi.type', 'budget.segments[1].amount'
  message: string;                        // already formatted
  params?: Record<string, string | number>;
  blocking: boolean;                      // severity === 'error'
}

export interface Violation {              // what check() returns; the engine adds id/severity/message
  path: string;
  params?: Record<string, string | number>;
  message?: string;                       // only when one rule has two wordings (LI-072, CRE-004)
}

export interface Rule<T> {
  id: string;
  kind: EntityKind;
  severity: Severity;
  triggers: readonly Trigger[];           // first moment the rule may run; save/activate always run everything
  reads: readonly string[];               // field paths the rule depends on (used for blur and cross selection)
  message: string | null;                 // null = documentation-only info rule (never emitted)
  needs?: readonly (keyof ValidationContext['lookups'])[];   // rule is skipped when the lookup is not loaded
  suppressedBy?: readonly string[];       // dropped when one of these fired on the same entity
  appliesTo?: (e: T, ctx: ValidationContext) => boolean;     // gates by type, mode, status
  check: (e: T, ctx: ValidationContext) => Violation | Violation[] | null;
  since?: string; retired?: boolean;      // registry metadata, IDs are never reused
}

export interface ValidateOptions {
  trigger?: Trigger;                      // 'save' (default) runs all rules; 'blur'/'cross' run the subset
  changedPath?: string;                   // with 'blur': only rules whose `reads` contain this path
  targetStatus?: 'ACTIVE' | 'DRAFT' | 'PAUSED';  // 'ACTIVE' adds the 'activate' rules
  includeInfo?: boolean;                  // default true
}

export function validate<T>(kind: EntityKind, entity: T, ctx: ValidationContext, opts?: ValidateOptions): Issue[];
```

`ValidationContext` (built by the caller, never by a rule):
```ts
export interface ValidationContext {
  mode: 'create' | 'edit';
  now: Date;                              // simulation clock; "today" uses advertiser.timeZone
  actor: { userId: string; role: RoleKey; limitedAccess: boolean };
  original?: unknown;                     // stored entity (edit mode) for lock rules
  partner: PartnerSnapshot;               // enabled exchanges, SDF version, advertiser configs
  advertiser: AdvertiserSnapshot;         // currency, tz, flags (demandGenFloodlightOptimization, ...), third-party services
  campaign?: CampaignSnapshot;            // goal, frequencyCap, status
  io?: IoSnapshot;                        // type, objective, mode, budget, flight, frequencyCap, status
  children?: { lineItems?: LineItemSnapshot[]; adGroups?: AdGroupSnapshot[] };
  lookups: Partial<{
    exchanges: Map<string, ExchangeInfo>; deals: Map<string, DealInfo>;
    audiences: Map<string, AudienceInfo>; creatives: Map<string, CreativeInfo>;
    floodlightActivities: Map<string, FloodlightInfo>; customBidding: Map<string, CustomBiddingInfo>;
    channels: Map<string, ChannelInfo>; templates: Map<string, TemplateInfo>;
  }>;
}
```
Snapshots are plain serialisable DTOs (derived from the Prisma models of P2-01), so the same context can be sent to the browser.

### 6.4 Engine behaviour
1. **Selection.** `trigger: 'save'` (default) runs every rule of the kind whose `appliesTo` passes. `trigger: 'activate'` is the same, plus rules whose only trigger is `activate`. `trigger: 'blur'` with `changedPath` runs rules whose `triggers` include `blur` and whose `reads` contain the path; it also runs `cross` rules that read the path, so the inline warning in CMP-013 updates as soon as the goal or KPI changes. This reproduces the B / S / X / A column.
2. **Skips.** A rule whose `needs` lookup is missing from `ctx.lookups` is skipped and `validate` adds a hidden marker so the server knows the client run was partial. The server always builds the full context and is authoritative.
3. **Suppression.** If a rule in `suppressedBy` produced an issue, the dependent rule is dropped (for example `LI-042` is suppressed by `LI-006`, `LI-007`, `LI-YT-009`; `IO-040` by `IO-003`, `IO-004`). This stops cascades such as an incompatible line item type also reporting its bid strategy.
4. **Alias rows.** A catalogue row whose ID cell shows `~X` is an alias of rule `X`: it documents how a shared rule bites for a type and is not registered or emitted separately.
5. **Info rules with `message: null`** are documentation only; they are not emitted.
6. **Ordering.** Errors first, then warnings, then infos; inside a severity by the field order of the form (`path` order table kept next to each form), then by rule ID. `focusFirstInvalid` uses the first error.
7. **Dedupe.** Two issues with the same `(path, message)` collapse into the one with the lower rule ID.
8. **Locked fields.** `...-LOCK`-style rules compare `entity` to `ctx.original`; in create mode they do not run.
9. **Determinism.** No `Math.random`, no `Date.now()`; time comes from `ctx.now`. The engine alert generator can therefore re-run rules every tick.

### 6.5 Rule examples
```ts
// rules/campaign.ts
export const CMP_001: Rule<CampaignInput> = {
  id: 'CMP-001', kind: 'campaign', severity: 'error', triggers: ['blur'], reads: ['name'],
  message: MSG.ENTER_VALUE,
  check: (c) => (isBlank(c.name) ? { path: 'name' } : null),
};

export const CMP_013: Rule<CampaignInput> = {
  id: 'CMP-013', kind: 'campaign', severity: 'warning', triggers: ['cross'], reads: ['goal', 'kpi.type'],
  message: MSG.KPI_NOT_RECOMMENDED,
  appliesTo: (c) => !!c.goal && !!c.kpi?.type && c.kpi.type !== 'OTHER',
  check: (c) => (notRecommended(c.goal!).includes(c.kpi!.type) ? { path: 'kpi.type' } : null),
};

// rules/line-item.ts
export const LI_006: Rule<LineItemInput> = {
  id: 'LI-006', kind: 'lineItem', severity: 'error', triggers: ['cross'], reads: ['type', 'ioId'],
  message: MSG.LI_TYPE_INCOMPAT,                       // '{Type} line items aren't compatible ...'
  appliesTo: (_l, ctx) => !!ctx.io,
  check: (l, ctx) =>
    LI_TYPE_BY_OBJECTIVE[ctx.io!.objective][l.type] ? null : { path: 'type', params: { Type: LI_TYPE_LABEL[l.type] } },
};

// rules/experiments.ts
export const AB_012: Rule<AbTestInput> = {
  id: 'AB-012', kind: 'abTest', severity: 'error', triggers: ['cross'], reads: ['arms[].split'],
  message: 'Audience splits must add up to 100%.',
  check: (t) => (sum(t.arms.map((a) => a.split)) === AB_SPLIT_TOTAL ? null : { path: 'arms' }),
};
```
The `[SIM]` marker exists only in this document. In code the string has no marker; `docs-sync.test.ts` strips it when comparing, and it skips the exact-text comparison for `[SIM]` rows (it only checks ID, severity and parameter names).

### 6.6 Sharing between client forms and server actions
```
Server component                      Client form                          Server action
─────────────────                     ───────────                          ─────────────
buildContext(db, kind, ids, actor) ─► <Form ctx={ctx} defaults={...}>      'use server' createCampaign(input)
(serialisable DTOs)                     useValidatedForm('campaign', ...)      ctx = await buildContext(...)
                                        ├─ onBlur(path): validate(...,         issues = validate('campaign', input, ctx,
                                        │    {trigger:'blur', changedPath})       { trigger: 'save', targetStatus })
                                        ├─ on cross change: re-run X rules     if (issues.some(i => i.blocking))
                                        └─ onSubmit: validate(trigger:'save')     return { ok: false, issues }
                                             blocking → show, focus first      persist in a transaction (re-check lock rules
                                             ok → call server action              against the row read inside the tx)
                                        issues from server render the same     return { ok: true, id, issues /* warnings */ }
```
* **One context shape.** The server component loads the parents (advertiser, campaign, IO) and the lookups the form needs (for example `exchanges`, `creatives` for the LI form) and passes them as props. Large lookups (all audiences) load lazily on the client through SWR; until they arrive, rules with `needs` are skipped. Server validation is always complete.
* **Form integration.** `useValidatedForm` supplies a react-hook-form `resolver` that calls `validate(kind, values, ctx, { trigger: 'save' })` and maps `Issue.path` to field errors. Blur handlers call the subset form. Warnings and infos go to a separate `softIssues` array so they never set `formState.errors`.
* **Server actions** call the same `validate` with the full context. Errors short-circuit the write; warnings are returned with the success result and displayed on the saved page.
* **SDF upload and bulk edit** call `validate` per row. Each row gets its own `ctx` built from cached parents. The failed-rows file lists `rowNumber, ruleId, path, message` (BLK-005). EU political ads blanks are defaulted to `NO` before validation (LI-081).
* **Engine alerts** (P2-05) import the same rules and filter by ID: `IO-093`, `IO-094`, `IO-092`, `AG-005`, `LI-063`, `LI-064`, `TGT-102`, `TGT-104`, `CB-010`, `INV-012`. Their severity maps to the alert groups: `error` → Critical, `warning` → Needs attention.
* **State machine** helpers (`canTransition`, `isApplicable`) are used by the status chip, row menus, the bulk bar and the server action, so a forged request fails the same way.
* **Messages** live only in `messages.ts` or in `Rule.message`. Parameters use `{name}`; `format()` leaves unknown placeholders visible so missing params show up in tests.
* **Scenario hook (P5).** `ValidationContext` may carry `disabledRules: string[]` so an instructor scenario can switch a soft rule off or on; blocking rules cannot be disabled.

### 6.7 Vitest design and case table
**Pattern** (table-driven, one file per area):
```ts
// tests/validation/cases.campaign.ts
export const campaignCases: Case[] = [
  { id: 'T-02', kind: 'campaign', base: validCampaign, patch: { name: '' }, expect: ['CMP-001:error'] },
  { id: 'T-06', kind: 'campaign', base: validCampaign, patch: { goal: 'AWARENESS', kpi: { type: 'CPA', value: 500 } }, expect: ['CMP-013:warning'] },
];
// tests/validation/catalogue.test.ts
describe.each(allCases)('$id $kind', (c) => {
  it('raises exactly the expected issues', () => {
    const entity = applyPatch(c.base(), c.patch);
    const ctx = makeCtx(c.ctx);                                    // valid ctx + c.ctx overrides
    const got = validate(c.kind, entity, ctx, c.opts).filter((i) => c.includeInfo || i.severity !== 'info');
    expect(got.map((i) => `${i.ruleId}:${i.severity}`).sort()).toEqual([...c.expect].sort());
    if (c.message) expect(got[0].message).toBe(c.message);       // for verbatim rows
  });
});
```
**Fixture facts** (`testing/fixtures.ts`): `now` = 2026-10-28 12:00 advertiser tz; advertiser INR, `demandGenFloodlightOptimization: true`, 54 enabled exchanges, no business-name default; campaign `AWARENESS`, KPI `CPM 50`, creative types `[DISPLAY]`, no cap; IO `STANDARD` / `BRAND_AWARENESS`, mode `LI_CONTROLLED`, budget `CURRENCY`, one segment ₹10,000 from 2026-10-01 to 2026-10-31, pacing `FLIGHT/AHEAD`, KPI `VCPM 100`, no cap; line items are valid for their type inside an IO of the objective stated in the row; "Clicks IO" = `STANDARD`/`CLICKS`, `LI_CONTROLLED`, same budget. Helpers: `validCampaign()`, `validIo()`, `validLineItem(type)`, `validAdGroup()`, `validAd()`, `validCreative(format)`, `validAudience(kind)`, `validAbTest()`, `validLiftStudy()`.
Cell conventions: infos are ignored unless the cell shows `:info`. "Create"/"Edit" = `ctx.mode`. "Activate" = `opts.targetStatus = 'ACTIVE'`.

| # | Entity | Scenario (patch on the valid fixture) | Expected issues |
|---|---|---|---|
| T-01 | campaign | valid fixture, no change | none |
| T-02 | campaign | `name: ''` | CMP-001:error |
| T-03 | campaign | `name` of 241 characters | CMP-002:error |
| T-04 | campaign | `goal` and `kpi` unset | CMP-010:error |
| T-05 | campaign | goal `AWARENESS`, `kpi` unset | CMP-011:error |
| T-06 | campaign | goal `AWARENESS`, KPI `CPA` 500 | CMP-013:warning |
| T-07 | campaign | goal `ONLINE_ACTION`, KPI `CPV` 1 | CMP-013:warning |
| T-08 | campaign | goal `ONLINE_ACTION`, KPI `CPC` with value `''` | CMP-012:error |
| T-09 | campaign | goal `ONLINE_ACTION`, KPI `CTR` value `0` | CMP-014:error |
| T-10 | campaign | goal `ONLINE_ACTION`, KPI `CTR` value `150` | CMP-015:error |
| T-11 | campaign | KPI `OTHER` with free text, no value | none |
| T-12 | campaign | `creativeTypes: []` | CMP-020:error (message `Please select at least one creative type.`) |
| T-13 | campaign | `startDate` 2026-11-10, `endDate` 2026-11-01 | CMP-032:error |
| T-14 | campaign | Create, `startDate` 2026-10-20 | CMP-034:error |
| T-15 | campaign | Edit of a started campaign, `startDate` moved | CMP-033:error |
| T-16 | campaign | cap `limit`, `maxImpressions` empty | CMP-040:error |
| T-17 | campaign | cap `limit`, `maxImpressions: 0` | CMP-041:error |
| T-18 | campaign | budget row with name `Q4`, amount empty | CMP-050:error |
| T-19 | campaign | budget row with amount 100, name empty | CMP-051:error |
| T-20 | campaign | 6 comma-separated keywords | CMP-061:warning |
| T-21 | io | valid fixture | none |
| T-22 | io | type `CTV_OTT`, objective `CLICKS` | IO-003:error |
| T-23 | io | type `DOOH`, objective `BRAND_AWARENESS` | IO-004:error |
| T-24 | io | `name: ''` | IO-010:error |
| T-25 | io | segment amount empty | IO-021:error |
| T-26 | io | segment amount `0` | IO-022:error (message `Enter a number greater than 0`) |
| T-27 | io | segment end 2026-10-05, start 2026-10-10 | IO-024:error |
| T-28 | io | segments Oct 1-20 and Oct 15-31 | IO-027:error |
| T-29 | io | Edit, segment amount 5,000 with spent 6,000 | IO-026:error |
| T-30 | io | pacing `DAILY` + `AHEAD`, daily amount 500 | IO-031:error |
| T-31 | io | pacing `DAILY` + `EVEN`, daily amount empty | IO-032:error |
| T-32 | io | pacing `DAILY` + `EVEN`, daily amount 20,000 | IO-034:warning |
| T-33 | io | KPI `VCPM` value `0` | IO-041:error |
| T-34 | io | objective `BRAND_AWARENESS`, KPI `CPC` 1 | IO-040:error |
| T-35 | io | KPI `VTR` value `120` | IO-042:error |
| T-36 | io | mode `IO_AUTOMATED`, child line item type `AUDIO` | IO-052:error |
| T-37 | io | cap `limit`, `maxImpressions` empty | IO-060:error |
| T-38 | io | campaign cap 3 / week, IO cap 10 / day | IO-063:info (with `includeInfo`) |
| T-39 | io | CPM fee amount `-1` | IO-070:error |
| T-40 | io | media fee 120% | IO-071:error |
| T-41 | io | children budgets 15,000 against IO budget 10,000 | IO-093:warning |
| T-42 | io | Activate, only segment ended 2026-10-20 | IO-092:error |
| T-43 | lineItem | Display in Clicks IO, valid | none |
| T-44 | lineItem | `name: ''` | LI-001:error |
| T-45 | lineItem | Audio LI in Clicks IO | LI-006:error (message `Audio line items aren't compatible with your insertion order's objective setting.`) |
| T-46 | lineItem | Demand Gen LI moved to a `BRAND_AWARENESS` IO | LI-006:error (LI-042 suppressed) |
| T-47 | lineItem | Demand Gen LI, advertiser flag off | LI-DG-001:error |
| T-48 | lineItem | `DOOH_DISPLAY` LI in a `STANDARD` IO | LI-007:error |
| T-49 | lineItem | custom flight 2026-11-01 to 2026-11-30, IO flight Oct | LI-022:error |
| T-50 | lineItem | custom flight end 2026-10-10, start 2026-10-20 | LI-021:error |
| T-51 | lineItem | budget mode amount, value empty | LI-030:error |
| T-52 | lineItem | budget 20,000 against IO budget 10,000 | LI-033:warning |
| T-53 | lineItem | IO `IO_AUTOMATED`, LI pacing `EVEN` | LI-035:error |
| T-54 | lineItem | pacing `DAILY`, daily amount empty | LI-036:error |
| T-55 | lineItem | `bid.mode: FIXED`, fixed CPM empty | LI-041:error |
| T-56 | lineItem | `MAX_CLICKS` prioritising a target CPC, target empty | LI-043:error |
| T-57 | lineItem | IO `CONVERSIONS`, `TARGET_CPA` 500, no activities | LI-046:error |
| T-58 | lineItem | cap `limit`, `maxImpressions` empty | LI-050:error |
| T-59 | lineItem | campaign cap 3 / week, LI cap 10 / day | LI-053:info (with `includeInfo`) |
| T-60 | lineItem | conversions `PERCENTAGE`, value 150 | LI-072:error |
| T-61 | lineItem | `euPoliticalAds` unset, Create | LI-080:error |
| T-62 | lineItem | Activate a Display LI with no creatives | LI-063:warning (LI-062:info with `includeInfo`) |
| T-63 | lineItem | assign `VIDEO_FILE` creative to a Display LI | LI-060:error |
| T-64 | lineItem | assign creative with review `NOT_SERVABLE` | LI-061:error |
| T-65 | lineItem | assign creative restricted for China, LI targets China | LI-064:warning |
| T-66 | lineItem | no exchange, deal or group selected | LI-011:error |
| T-67 | lineItem | apply a Video template to a Display LI | LI-101:error |
| T-68 | lineItem | Audio LI with Viewability targeting row | LI-102:error |
| T-69 | lineItem | CTV LI whose Device include list drops Connected TV | LI-CTV-004:error |
| T-70 | lineItem | Ads in mobile apps LI whose Environment adds Web | LI-APP-005:error |
| T-71 | lineItem | Mobile app install, no app selected | LI-APP-002:error |
| T-72 | lineItem | YT Efficient reach, all three ad formats unticked | LI-YT-005:error |
| T-73 | lineItem | YT LI budget amount empty | LI-YT-006:error |
| T-74 | lineItem | YT Target frequency, no exposure target | LI-YT-012:error |
| T-75 | lineItem | YT Reach LI, bid strategy set to `TARGET_CPM` | LI-YT-009:error (LI-042 suppressed) |
| T-76 | adGroup | `Active` ad group with 0 ads | AG-005:warning (message `This active ad group doesn't have any ads. It won't run until you create ads.`) |
| T-77 | adGroup | `name: ''` | AG-001:error |
| T-78 | adGroup | Target CPM bid empty | AG-003:error |
| T-79 | ad | `longHeadline: ''` | AD-006:error |
| T-80 | ad | `headline` of 31 characters | AD-005:error |
| T-81 | ad | `businessName` empty, `now` 2026-10-28 | AD-011:error |
| T-82 | ad | no logo, `now` 2026-10-28 | AD-014:error |
| T-83 | ad | `landingPageUrl: 'ftp://x.example'` | AD-017:error |
| T-84 | lineItem | keywords include and exclude both contain `shoes` | TGT-034:error |
| T-85 | lineItem | Device excludes all four types | TGT-130:error |
| T-86 | lineItem | Demographics age range min 45, max 25 | TGT-110:error |
| T-87 | lineItem | Day & time segment start 18:00, end 09:00 | TGT-120:error |
| T-88 | lineItem | Display LI targets a lookalike audience | TGT-105:error |
| T-89 | lineItem | same audience in include and exclude | TGT-100:error |
| T-90 | lineItem | targeted audience created 1 sim-hour ago | TGT-103:error |
| T-91 | lineItem | targeted audience size bucket `< 1K` | TGT-102:warning |
| T-92 | lineItem | DoubleVerify "Authentic Brand Safety" + "Fraud & invalid traffic" | TGT-091:error |
| T-93 | lineItem | bulk radius paste line `not an address` | TGT-011:error |
| T-94 | creative | third-party display, `name: ''` | CRE-001:error |
| T-95 | creative | third-party display, dimensions `0 x 0` | CRE-003:error |
| T-96 | creative | third-party tag empty | CRE-005:error |
| T-97 | creative | tag without `${CLICK_URL}` | CRE-006:warning |
| T-98 | creative | expands on hover, direction `None` | CRE-007:error |
| T-99 | creative | appeal on a creative that is servable and approved everywhere | CRE-043:error |
| T-100 | creative | uploaded image of 200 KB | CRE-020:error |
| T-101 | audience | lookalike with a seed of 500 active users | AUD-041:error (message `The first-party list must have a minimum of 1,000 active users.`) |
| T-102 | audience | lookalike with 11 seed lists | AUD-040:error |
| T-103 | audience | lookalike reach 12% | AUD-042:error |
| T-104 | audience | combined audience, Include empty | AUD-030:error |
| T-105 | audience | tag-based, no Floodlight activity | AUD-010:error |
| T-106 | audience | tag-based on an activity without Remarketing | AUD-012:error |
| T-107 | abTest | valid 50 / 50 test | none |
| T-108 | abTest | new arm with split `0` and the other arm 100 | AB-011:error (message `Enter a larger number`) |
| T-109 | abTest | splits 60 / 30 | AB-012:error |
| T-110 | abTest | single arm | AB-008:error |
| T-111 | abTest | both arms flagged control | AB-013:error |
| T-112 | abTest | same IO in both arms | AB-015:error |
| T-113 | abTest | `name: ''` | AB-001:error |
| T-114 | abTest | one IO arm and one LI arm | AB-021:error |
| T-115 | liftStudy | no insertion order selected | LS-003:error (message `Select at least one eligible insertion order to add a lift study`) |
| T-116 | liftStudy | 4 brand lift metrics | LS-006:error |
| T-117 | liftStudy | Purchase intent chosen, intended action empty | LS-011:error |
| T-118 | liftStudy | brand name of 31 characters | LS-007:error |
| T-119 | liftStudy | 6 search lift groups | LS-013:error |
| T-120 | liftStudy | media cost ₹100,000 against required ₹470,000, Standard | LS-014:error |
| T-121 | liftStudy | Enhanced strength, media cost ₹600,000 (needs ₹1,410,000) | LS-014:error |
| T-122 | customBidding | no rules | CB-004:error (message `At least 1 rule is required`) |
| T-123 | customBidding | 5 multipliers | CB-006:error |
| T-124 | customBidding | two `DEVICE_TYPE` multipliers | CB-007:error |
| T-125 | keywordList | 5,001 keywords | KW-002:error |
| T-126 | channel | 10,001 entries | CH-004:error |
| T-127 | locationList | no entries | LOC-003:error |
| T-128 | floodlightConversion | type `COUNTER`, method `TRANSACTIONS` | FL-014:error |
| T-129 | instantDeal | no seller selected | INV-001:error (message `A selection is required`) |
| T-130 | instantDeal | no targeting setting | INV-004:error (message `At least 1 targeting setting is required`) |
| T-131 | instantDeal | Accept before forecast | INV-006:error |

**State, bulk and dirty tests** (`state.test.ts`, `dirty.test.ts`)
| # | Scenario | Expected |
|---|---|---|
| S-01 | IO `DRAFT` → `PAUSED` | not allowed (`NOT_OFFERED`) |
| S-02 | IO `DRAFT` → `ACTIVE`, role `STANDARD`, valid | allowed |
| S-03 | IO `ACTIVE` → `PAUSED`, role `READ_ONLY` | not allowed (`ROLE`) |
| S-04 | Campaign `ARCHIVED` → `ACTIVE` | not allowed; `ARCHIVED` → `PAUSED` allowed |
| S-05 | Deal `ACTIVE` → `PAUSED` with `allowPausing: false` | not allowed, INV-014 |
| S-06 | Deal `NOT_SERVABLE` → `ACTIVE`, role `STANDARD` | not allowed (system only) |
| S-07 | A/B test `COMPLETED` → `ACTIVE` | not allowed |
| S-08 | Advertiser `PAUSED` → `SCHEDULED_FOR_DELETION`, role `STANDARD` | not allowed (admin only) |
| S-09 | Bulk Activate on rows `[ACTIVE, ACTIVE]` | not applicable (disabled) |
| S-10 | Bulk Activate on rows `[ACTIVE, PAUSED, DRAFT]` | applicable; eligible 2, skipped 1 |
| S-11 | Bulk Pause on rows `[DRAFT]` | not applicable |
| S-12 | Bulk Archive on rows `[ARCHIVED]` | not applicable |
| S-13 | Limited Access: bulk edit Settings; SDF Download | disabled; enabled |
| S-14 | Serving: LI `ACTIVE` under a `PAUSED` IO | `serving = false`, LI status unchanged |
| S-15 | IO `ACTIVE`, last segment ended yesterday | `effectiveStatus = COMPLETED` |
| D-01 | edit name then restore the original | `isDirty = false` |
| D-02 | add two empty trailing budget rows | `isDirty = false` |
| D-03 | type only a change note | `isDirty = false`, Save stays disabled |
| D-04 | change IO name | `isDirty = true`; closing opens DLG-01 |
| D-05 | slide-over Cancel after edits | parent form stays clean; no dialog |

**Meta tests**
* `coverage.test.ts`: every non-alias rule in `RULES` appears in at least one case of 6.7 or in a module case file (131 representative cases above; the build adds cases until coverage is 100%).
* `docs-sync.test.ts`: parses the rule tables of this file; asserts same ID set (minus aliases), same severity, and verbatim messages for rows without `[SIM]`.
* `uniqueness.test.ts`: IDs unique, format `^[A-Z]+(-[A-Z]+)?-\d{3}$`, no inline string equal to an `MSG` value.

### 6.8 Dependencies on sibling specs
* **P2-01 data model**: field paths used here (`budget.segments[]`, `pacing.dailyAmount`, `frequencyCap.{maxImpressions,periodCount,period}`, `optimization.mode`, `conversions.{activities,countingMode,postViewPct,attributionModelId}`, `inventory.quality`) should be adopted or mapped; add `version` (optimistic lock, DLG-11) and `status` / derived `effectiveStatus`.
* **P2-02 routes**: forms need the unsaved-changes guard on the route groups listed in UC-1.
* **P2-03 design system**: error text, warning (amber) and info styles, `Enter a value` placement under fields, the Unsaved Changes modal.
* **P2-05 engine**: consumes `effectiveStatus`, creative eligibility (MX-09 B), pacing/automation (MX-05), alert rule IDs (6.6) and the lift/A-B constants (MX-13, MX-14).

---

## 7. Open questions
Priority tags: **H** blocks a P3 task, **M** fix before fidelity review, **L** later.

| # | Pri | Question | Why it matters / current default |
|---|---|---|---|
| Q1 | H | Every `[SIM]` message needs confirming on a full-access account. First: required dropdown messages (goal, KPI, status), invalid date ranges (03 and 04 list them as not tested), overlapping or reversed budget segments, EU political ads left blank, A/B split not 100%, lift study errors | Students compare wording with the real tool. Current: DV360-style wording invented |
| Q2 | M | Bulk bar when the selection is mixed (some rows eligible): does DV360 disable the item or apply it to the eligible rows? | 03 only shows "Activate disabled if already active". Current: enabled if ≥ 1 eligible row, skipped rows counted (4.10) |
| Q3 | H | IO automation: does the LI pacing period also lock, or only the type to ASAP? Is `ASAP` also available on `Flight` period when LI-controlled? | MX-05, LI-034, LI-035. Current: type forced `ASAP`, period stored `FLIGHT` **Resolved RC-039**: type `ASAP` and period `FLIGHT`, both locked. |
| Q4 | M | Default objective selected in New IO step 1, and the default first KPI for Clicks, Conversions, Custom (04 shows `VCPM` for Brand awareness although the list starts with CPCL) | MX-02, IO-040. Current: Brand awareness default; `CPC`, `CPA`, `VALUE_COST` |
| Q5 | M | YouTube & partners **audio** line item subtypes and form | LI-YT mirrors video until seen |
| Q6 | M | Ad sequence builder rules (min steps, allowed formats per step) and bid strategy for Target frequency, TrueView views, Ad sequence | MX-07 marks these `(from public docs)`; LI-YT-020 assumes ≥ 2 steps |
| Q7 | H | Targeting availability for Audio, CTV, DOOH, Demand Gen, Mobile app install, Ads in mobile apps beyond what 05 notes (D-V1 allows unknowns) | MX-10; wrong `N` cells give false errors, wrong `Y` cells let invalid LIs through |
| Q8 | M | Demand Gen ad text limits (headline 40? description 90? business name 25?) and required assets | LI-DG-007..009 |
| Q9 | L | Full text of the lift-not-applicable message (source ends with "…") | AB-018 |
| Q10 | M | Limits: geography radius range, max entries in location lists, max locations per LI | TGT-012, LOC-005 **Resolved**: 10,000 entries per geography dimension and per apps-and-URLs dimension (module 10 Q-10-04); 5,000 per location list (RC-037). |
| Q11 | M | Creative size list and file limits (image size, HTML5 zip size, video/audio durations) | MX-09b are simulator defaults |
| Q12 | L | Maximum number of CPM fees and media fees | IO-074 uses 5 |
| Q13 | L | Customer match file format and minimum matched users | AUD-021, AUD-022 |
| Q14 | M | A/B test: is a control arm required, and can there be none? Does the report pick control from the form? | AB-013 current: exactly one |
| Q15 | L | Lift study competitors: is at least 1 required? | LS-008 current: 0 to 3 |
| Q16 | M | Search lift required media cost and currency conversion for Brand lift (observed only ₹470,000.00 on an INR partner) | MX-13, LS-014 |
| Q17 | L | Maximum number of A/B arms | MX-14: none beyond splits being whole numbers ≥ 1 |
| Q18 | L | Advertiser deletion: retention period and whether deletion can be cancelled | 4.1 **Resolved RC-046**: deletion can be cancelled until the retention date; retention is a classroom setting (default 7 sim days). |
| Q19 | M | Archiving a campaign or IO: does it cascade to children, or is it blocked until children are archived? | 4.2, 4.3, DLG-03. Current: cascade after confirm **Resolved RC-040**: cascade after confirm. |
| Q20 | L | Duplicate: status and name of the copy (Draft? "Copy of ..."?) | 4.10 **Resolved RC-040**: campaign copy PAUSED, IO and LI copy DRAFT, ad group and ad copy PAUSED; name `Copy of {name}`. |
| Q21 | M | Campaign: is KPI selection mandatory when a goal is chosen? Is the KPI value mandatory? | CMP-011, CMP-012 |
| Q22 | M | Are past start dates accepted when creating a campaign or LI? | CMP-034, LI-024 **Resolved RC-040**: past start dates are rejected on create (CMP-034, LI-024). |
| Q23 | L | Can an IO be activated with zero line items? Are overlapping segments across different IOs allowed? | IO-090..092 |
| Q24 | M | Does saving with warnings ever show a confirm dialog (for example LI budget above IO budget)? | Current: never |
| Q25 | M | Optimized targeting compatibility with fixed bid and with Audio / CTV / YouTube | MX-10 `OPTIMIZED_TARGETING` |
| Q26 | L | Campaign keywords above 5: warning or error | CMP-061 current: warning |
| Q27 | L | PROJECT.md §5.3 mentions YouTube "Video reach / action / view" variants; 06 shows Reach, Target frequency, TrueView views, Ad sequence. Is "Video action" still a subtype? | MX-07 lists only what was seen |
| Q28 | L | Limited Access as a scenario flag: should students ever get it, and should role `PARTNER_CLIENT` be simulated? | 4.0 roles |
