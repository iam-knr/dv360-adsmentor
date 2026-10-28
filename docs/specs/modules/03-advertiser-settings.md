# Module 03: Advertiser settings

Task P2-06a. Source: PROJECT.md 5.11, `docs/explore/14-advertiser-settings.md`. Related explore: 01 (paused banner), 05 (Demand Gen gate, EU political ads), 07 (locked targeting, verification), 11 (Google tag, Floodlight), 15 (alerts).
Specs used: `data-model.md` (DM), `routes.md` (RT), `design-system.md` (DS), `validation.md` (VAL), `engine.md` (ENG). Cited as `DM 5.3`, `RT 3.11`, and so on.
Build phase: P4-09 (with module 02). Alert preferences also feed P4-11.

---

## 1. Scope and out of scope

### 1.1 In scope

| Area | Page | Route |
|---|---|---|
| Basic details | Identity, SDF, ad server and attribution panel, authorizations, EU political ads, YouTube and Demand Gen settings, additional settings, third-party services panel, Schedule for deletion | `[A]/details` |
| Targeting rules | Advertiser-level locked targeting: Brand suitability, Channels and YouTube URLs, Keywords, Viewability | `[A]/targeting` |
| Data manager | Tab Connected products (Google tag card), tab Linked accounts (Link new account menu, counts) | `[A]/data-manager`, `[A]/linked-accounts` |
| Alert preferences | 10 alert toggles with two thresholds | `[A]/alert-config` |
| Policy center | One card per certificate type, request flow | `[A]/policy-center` |

PROJECT.md 5.11 also lists "Billing", "Creative settings (OBA icon, Dynamic creatives)", "Brand safety defaults", "Data access / Integrations" and "Industry". The demo showed none of the first four as separate pages: see 1.3 and conflict C-03-1.

### 1.2 Out of scope (owned elsewhere)

| Item | Owner |
|---|---|
| Creating an advertiser | Module 02 |
| Floodlight groups, activities, Google tag Manage page (`[A]/fl/google-tag`) | Resources module (P4-04, explore 11). Module 03 only links to it |
| Targeting editors | P3-07 shared targeting panel (module 03 mounts it in locked-rule mode) |
| Alert generation, Intelligence rows, Alerts tab | Engine (ENG 3.7) and module 01 (Intelligence), P4-11 (campaign Alerts page) |
| Instructor approval of certificate requests | Phase 5 instructor console (gap, see C-03-5) |
| Real account linking to Google products | Never. All linking is simulated |
| Email delivery of alerts | Never (module 02 Q3) |

### 1.3 Blocked in the demo, filled from public docs or by us

| Item | Gap | What we build |
|---|---|---|
| Ad server options other than "Third-party ad servers only" | Only one value visible | Add "Campaign Manager 360" (changes nothing but an extra Floodlight config select) |
| Attribution settings editing | Read only in the panel | Dropdown of the partner's Floodlight groups |
| Targeting rules edit panels | Rows not clickable (Limited Access) | For `ADM`: rows open the shared editors in locked-rule mode. Others: read only |
| Brand suitability "Inventory mode" options | Only "Maximum inventory" seen | Three modes `[SIM]`: Maximum inventory (default), Standard, Limited (affects nothing in the engine in v1) |
| Link new account flows | Menu only | A small dialog per type creating a synthetic `LinkedAccount` (4.6) |
| Google tag Manage page | Not opened | Link to module 11 page |
| Schedule for deletion dialog | Not clicked | DLG-05 in VAL 5.2 |
| Policy certificate request forms | External links | Internal request dialog then instructor approval (4.8) |
| "Request access to YouTube creator videos" card | Illustration and links | Static card; **Request access** creates a `LinkedAccount` of type `YOUTUBE_CREATOR_VIDEOS` in status `PENDING` |
| Vendor names in Third-party services | Real names present in the demo (not recorded) | Fictional names with the same counts: viewability 3, brand safety 3, reach 10, brand lift 4, conversion attribution 1 (Q3) |
| Billing, Creative settings (OBA icon, Dynamic creatives) | Not seen in the advertiser nav | Not built. See C-03-1 |

---

## 2. Screens and views

All pages use frame A (advertiser nav, RT 4.3). Access codes per RT 2. The grey **Limited Access** chip next to the title shows for `READ_ONLY` and `PARTNER_CLIENT`.

| # | Screen | Route | Access view / write | Explore |
|---|---|---|---|---|
| S1 | Basic details | `[A]/details` | RO / ADM (see C-03-2) | 14 |
| S2 | Ad server and attribution panel | slide-over on S1 | RO / ADM | 14 |
| S3 | Third-party services panel | slide-over on S1 | RO / ADM | 14 |
| S4 | Targeting rules | `[A]/targeting` | RO / ADM | 14 |
| S5 | Data manager: Connected products | `[A]/data-manager` | RO / ADM | 14 |
| S6 | Data manager: Linked accounts | `[A]/linked-accounts` | RO / ADM | 14 |
| S7 | Alert preferences | `[A]/alert-config` | RO / STD | 14 |
| S8 | Policy center | `[A]/policy-center` | RO / STD | 14 |
| S9 | Schedule for deletion dialog | DLG-05 | - / ADM | 14 |

### 2.1 S1 Basic details

Single long form, label column left and controls right, white cards by section. Sticky footer: **Save** (disabled until dirty, VAL 5.1), **Reset**, **Schedule for deletion**, optional change note "Optional: Enter a note about this change". Unsaved Changes dialog on leaving a dirty page (VAL 5.1 UC-1). Components: `DvPageHeader`, `DvStatusSelect`, form fields (DS 2.8), `DvBanner`, `DvSlideOver`, `DvHelp`.

| Section | Fields | Rule IDs |
|---|---|---|
| Identity | Name (Required), Status dropdown (Active, Paused), Website (Required, help), Currency (locked), Timezone (locked), Advertiser ID (read only) | ADV-001 to ADV-005 |
| Structured Data Files | SDF version (9, 9.1, 9.2, 10, 10.1, 11, default 9), Administrator email | ADV-006, ADV-007; BLK-006 note for version 9 |
| Ad server and attribution | Summary lines "Ad server: Third-party ad servers only" and "Attribution settings: {Floodlight config}"; pencil opens S2 | |
| Authorizations | 7 checkboxes in groups General, Ad badging, Commerce partners, Creatives (2), Third-party integrations. Texts paraphrased from 14 | ADV-014 |
| EU political ads | Question with two radios (Yes / No, default No) and the regulation note | ADV-011 |
| YouTube and Demand Gen | Checkbox "Use Floodlight data for conversion optimization on Demand Gen line items." with the blue info box of 4 bullets; Business name (counter `0 / 25`), Logo (**Add logo**) | ADV-012, ADV-013 |
| Additional settings (expander) | Entity Read Files Read Google Group (locked text), Integration code, Third-party services summary lines with pencil (opens S3) | ADV-008 |

States: loading skeleton; read-only (controls disabled, Save and Schedule hidden, chip); dirty; saving; conflict dialog (DLG-11); paused status shows the page banner ADV-009 after save; scheduled-for-deletion advertisers show their own banner and all fields read only except **Cancel deletion** (VAL 4.1 `(from public docs)`).

### 2.2 S2 Ad server and attribution panel

`DvSlideOver` default width. Rows: Ad server (help), Attribution settings (Floodlight config dropdown). Footer **Apply** and **Cancel**. Apply copies into the page draft (RT 5.4 draft-bound rule). Read-only role: values shown, controls disabled.

### 2.3 S3 Third-party services panel

`DvSlideOver` wide. Sections (14): Third-party verifier configuration (Integral Ad Science Client ID, number, default 0); Bidding rate cards (one row per vendor: checkbox "I affirm with the rate below and have read the {vendor} Terms and Conditions", read-only rate, for example 5% and 14%); Measurement vendors for YouTube & partners line items (info box plus checkboxes); Third-party viewability vendors (3); brand safety vendors (3); reach vendors (10); brand lift vendors (4); conversion attribution vendors (1). Footer **Apply** and **Cancel**. Vendor lists come from a global seed `ThirdPartyVendor` list (DELTA-03-2).

### 2.4 S4 Targeting rules

Info banner "Targeting rules are applied to all new and existing targeting templates and line items." Summary card with four rows:

| Row | Content |
|---|---|
| Brand suitability | Lock icon "Locked for campaigns, insertion orders, and line items."; Inventory mode (Maximum inventory); Content type exclusions (Embedded YouTube videos, Live streaming videos); two banners about sensitive categories and digital content labels becoming unavailable in Oct 2026 and the Brand suitability controls replacing them |
| Channels & YouTube URLs | "No restrictions" |
| Keywords | "No contextual keywords selected" |
| Viewability | Lock icon; "Open Measurement: target only OM-enabled mobile display inventory" |

For `ADM`, each row has a pencil that opens the shared editor (P3-07) with `ownerType = ADVERTISER`, `isLocked = true`. Others: rows are plain text. Rule: advertiser rules are inherited and locked at campaign, IO, LI and template level with a lock icon (07, LI-100).

### 2.5 S5 and S6 Data manager

Title "Data manager (formerly Linked accounts)" with tabs **Connected products** and **Linked accounts**.

- Connected products: button "+ Connect product" (disabled), section "Google tag" with a card (tag icon, tag name, **Manage** link to `[A]/fl/google-tag`).
- Linked accounts: **Link new account** primary button with menu Ads Data Hub, External Data Partner, YouTube channels, YouTube creator videos, Google Ads, BigQuery Exporter; promo card "Request access to YouTube creator videos" (Learn more, **Request access**); section "Connected products - Self-service product linking available in the new integration center for": rows Analytics (Web + App), Display & Video 360 with "Integration center" links (static); line "To link a Merchant Center account, use {partner id} as the ID you send to your Merchant Center account owner"; rows with counts "Google My Business for YouTube assets: 1 linked", "YouTube channels: 1 linked".
Content renders in the page itself (no iframe). States: loading; empty counts "0 linked"; read-only (Link new account disabled).

### 2.6 S7 Alert preferences

Intro text from 14 ("Select which alerts appear in the Alerts tab and Intelligence panel... Changes may take a few hours to apply." In the simulator the last sentence reads "Changes apply at the next simulated hour."). Toggle list grouped as in the table below. Footer **Save** (disabled until dirty) and link **Manage Global Email Configuration** (to `/email-preferences`, module 02).

| Group | Alert (DM `AlertType`) | Default | Extra control | Rule |
|---|---|---|---|---|
| Budget and pacing | No spend (`NO_SPEND`) | On | | |
| Budget and pacing | Underpacing (`UNDERPACING`) | On | "Alert if it's estimated that less than [90] % of the current budget segment will be spent by its end date." | ADV-015 |
| Performance | Underperforming (`UNDERPERFORMING`) | On | | |
| Targeting changes | Limited audience size | On | needs Underpacing on | ADV-019 |
| Targeting changes | Deals offline | On | needs Underpacing on | ADV-019 |
| Targeting changes | Restricted audience list | On | | |
| Creative or YouTube & partners ad | Rejected creative | On | | |
| Creative or YouTube & partners ad | Restricted creative | On | | |
| Advertiser spend threshold exceeded | Exceeded spend threshold | Off | "Alert if the advertiser spends more than [{currency} 0.00] in a day. ... applies to yesterday's spend and will not pause line item spend." | ADV-016 |
| Mismatched settings | Insertion order / line item settings | On | | |

Turning Underpacing off auto-disables the two dependent toggles and shows ADV-019 inline if the user turns them on again. The threshold input is disabled while its toggle is off.

### 2.7 S8 Policy center

Intro text and Learn more. One card per certificate kind (14 order): addiction service providers, cryptocurrency exchanges and software wallets, pharmaceutical manufacturer drug sales, speculative financial products, gambling, online pharmacy, pharmaceutical manufacturer, pharmaceutical non-prescription drug sales, political advertising (three links: European Union, India, United States), New York state registration documents, California elections advertisement information (shows Provided name / California ID / "Advertisements regarding" = "None provided"), social casino games. Left = title and description, right = status ("No certificates."), footer link **Request Certificate**. In the simulator the link opens `DvModal` "Request certificate" (country select for kinds that need one, Notes) with **Request** and **Cancel**. Status values: No certificates, Requested, Approved, Rejected (chips).
States: empty (all "No certificates."), read-only (links disabled), error.

---

## 3. Data

### 3.1 Entities used (names from DM)

| Entity | DM | Use |
|---|---|---|
| `Advertiser` (all the fields in 5.3) | 5.3 | Basic details |
| `AdvertiserAlertPreference` | 5.3 | Alert preferences |
| `LinkedAccount` | 5.3 | Data manager |
| `PolicyCertificate` | 5.3 | Policy center |
| `ThirdPartyRateCard` | 5.2 | Third-party services bidding rate cards |
| `TargetingAssignment` (`ownerType = ADVERTISER`, `isLocked`) | 5.8 | Targeting rules |
| `FloodlightGroup` | 5.12 | Attribution dropdown, Google tag card |
| `Partner` | 5.2 | `dataTermsAcceptedAt` (ADV-014), partner id on Merchant Center line |
| `LineItem` (EU political ads, Demand Gen) | 5.6 | Propagation, ADV-012 count |
| `Alert` | 5.19 | Resolved when a type is switched off |
| `ChangeGroup`, `ChangeEntry` | 6 | History |
| `BulkJob` | 5.17 | EU political ads fan-out |

### 3.2 Spec deltas

| ID | Delta | Detail |
|---|---|---|
| DELTA-03-1 | `AdvertiserAlertPreference.thresholdPct`, `thresholdAmount` | DM stores `underpacingPct` and `dailySpendThreshold` as threshold fields in the per-type table; use generic columns `thresholdPct int Y` (default 90 for UNDERPACING) and `thresholdAmount dec Y` (default 0 for EXCEEDED_SPEND_THRESHOLD) |
| DELTA-03-2 | `ThirdPartyVendor` (global seed) and `AdvertiserVendorSelection` | Vendor: `key`, `name` (fictional), `group` enum (VIEWABILITY, BRAND_SAFETY, REACH, BRAND_LIFT, CONVERSION_ATTRIBUTION, YT_MEASUREMENT, BIDDING), `onByDefault` bool, `feePct` Y (bidding vendors), `termsText`. Selection: `advertiserId`, `vendorKey`, `enabled`, `affirmedAt` Y. Replaces the free `thirdPartyConfig` json in DM 5.3 for queryability (keep the json for IAS client id) |
| DELTA-03-3 | `Advertiser.status` enum use | `SCHEDULED_FOR_DELETION` plus `scheduledDeletionAt`, `previousStatus` (to restore on cancel), `deletionCancelledAt` Y |
| DELTA-03-4 | `PolicyCertificate.notes` and `rejectionReason` | Request notes by the student; reason by the instructor |
| DELTA-03-5 | `BrandSuitabilityMode` enum | `MAXIMUM`, `STANDARD`, `LIMITED` (DM only has `inventoryMode: "MAXIMUM"` in json) |
| DELTA-03-6 | `LinkedAccount.displayName` rules | Synthetic names; `externalId` unique per advertiser |
| DELTA-03-7 | `EuPoliticalAds` change propagation record | `BulkJob` with `source = BULK_EDIT`, description "EU political ads set to No on N line items" so the Bulk status page explains the mass change |

### 3.3 Seed data requirements

| Seed | Requirement |
|---|---|
| Advertisers | Values for every field of 5.3: SDF 9, admin email empty, authorizations as the demo defaults, EU ads No, Demand Gen switch on for one advertiser and off for another (so the Demand Gen card is gated in one of them), business name empty |
| Alert prefs | All 10 rows with the demo defaults |
| Targeting rules | Brand suitability (Maximum inventory; excluded: embedded YouTube videos, live streaming), Viewability OM; Channels and Keywords empty. One advertiser has a keyword rule and a channel rule so the lock icons show downstream |
| Linked accounts | 1 Google My Business and 1 YouTube channel (synthetic ids) |
| Policy center | All kinds "No certificates"; one `APPROVED` certificate for `POLITICAL_EU` in the `needs-attention` template as a contrast |
| Vendors | Seed of 21 fictional vendors matching the group counts above, plus 2 bidding vendors with fees 5% and 14% |
| Floodlight | Each advertiser has a default `FloodlightGroup` and a Google tag record for the Manage link |

---

## 4. Behaviour

Types `Id`, `Result<T>`, `Issue`, `WriteMeta` from RT 8.0. Permissions per RT 2. Services in `lib/services/advertiserSettings.ts`. Every write uses `withChangeLog` (DM 6.3) with `entityType = ADVERTISER`.

### 4.1 Read

```ts
// GET /api/dv/advertisers/:aid  (RT 8.14)
getAdvertiserDetails(id: Id): Promise<Result<AdvertiserDetails & { version: number; limitedAccess: boolean; euPoliticalAdsPropagating: boolean }>>
```

### 4.2 Update basic details

```ts
// action (RT 8.14)
updateAdvertiser(input: AdvertiserDetails): Promise<Result<{ affectedLineItems?: number }>>
saveAdServerAttribution(input: { id: Id; adServer: 'THIRD_PARTY_ONLY'|'CM360'; attributionFloodlightConfigId: Id } & WriteMeta): Promise<Result<null>>
saveThirdPartyServices(input: { id: Id; iasClientId: number; rateCards: { vendorKey: string; affirmed: boolean }[]; vendors: Record<VendorGroup, string[]> } & WriteMeta): Promise<Result<null>>
scheduleAdvertiserDeletion(input: { id: Id }): Promise<Result<null>>
cancelAdvertiserDeletion(input: { id: Id }): Promise<Result<null>>
```

| Field / action | Rule IDs | Notes |
|---|---|---|
| name, website | ADV-001, ADV-002, ADV-003 | |
| currency, timeZone | ADV-004 | forged change rejected |
| status | ADV-005 | `ACTIVE` or `PAUSED` only. Paused triggers banner ADV-009 and stops serving (VAL 4.0) |
| sdfVersion, sdfAdminEmail | ADV-006, ADV-007 | version 9 shows BLK-006 |
| integrationCode | ADV-008 | |
| euPoliticalAds | ADV-011 | change is applied to all new and existing LIs (14): creates a `BulkJob` (DELTA-03-7), one `ChangeGroup` per LI with `source = BULK_EDIT`, `bulkJobId` |
| demandGenFloodlightOptimization | ADV-012 (W) | warning with the count of Demand Gen LIs that will stop; save succeeds. LI creation re-checks LI-DG-001 |
| businessName | ADV-013 | max 25 |
| authorizations.productImprovement | ADV-014 | blocked when `Partner.dataTermsAcceptedAt` is null and the box is unchecked |
| Third-party services | ADV-017, ADV-018 | IAS client id whole number, default 0; affirmation needed per rate card |
| Schedule for deletion | ADV-010, DLG-05 | `ADM` only. Status becomes `SCHEDULED_FOR_DELETION`; hidden from the default Advertisers list; nothing serves; purge after retention (VAL Q18 default 7 sim days; the instructor may set it) |
| Save with no change | ADV-020 | button disabled; server returns `ok` with no ChangeLog |

Permission: `ADM` for `updateAdvertiser`, panels, schedule/cancel deletion (conflict C-03-2: module 02 proposes `STD` for the non-sensitive fields). Side effects:
- ChangeLog entries per field, label "Advertiser name", "Status", "SDF version", and so on. Authorizations log as "Authorization: {label} changed from "Unchecked" to "Checked"".
- Rate cards: `ThirdPartyRateCard` rows with `termsAcceptedAt`; accepted rate cards add a selectable media fee type in IO/LI partner costs (DM 5.2; VAL MX-17).
- Verification vendors: `AdvertiserVendorSelection` feeds TGT-092 (provider must be enabled here).
- Paused or scheduled: serving formula changes immediately; alerts for entities under the advertiser are suppressed because they are not serving (ENG 3.6 `PARENT_PAUSED`).

### 4.3 Targeting rules

```ts
// GET|PUT /api/dv/advertisers/:aid/targeting-rules  (RT 8.14)
saveTargetingRules(input: { advertiserId: Id; rules: TargetingRules } & WriteMeta): Promise<Result<{ inheritedBy: { campaigns: number; insertionOrders: number; lineItems: number; templates: number } }>>
```
Rules: the shared `TGT` rules run on every row (VAL 2.16). Locked rows cannot be removed at lower levels (LI-100, LI-DSP-001). Saving brand suitability mode `LIMITED` shows warning `[SIM] This reduces the inventory available to all line items.` `ADV-024` (proposed). Permission `ADM`. Side effect: ChangeLog at advertiser level; no fan-out rows on LIs (inheritance is live; DM 5.3 "merged into every LI before the auction check"). The returned counts power a confirmation toast.

### 4.4 Alert preferences

```ts
// GET|PUT /api/dv/advertisers/:aid/alert-preferences  (RT 8.14 `AlertPreferences`)
saveAlertPreferences(input: { advertiserId: Id; prefs: AlertPreferences } & WriteMeta): Promise<Result<null>>
```
Rules: ADV-015 (1 to 100), ADV-016 (amount at least 0; currency symbol of the advertiser), ADV-019 (dependent toggles). Permission `STD`. Side effects: ChangeLog "Alert preference: Underpacing threshold changed from "90" to "80""; engine behaviour: at the next tick the alert generator (ENG 3.7) stops creating alerts of disabled types and resolves open ones with `resolvedAt = now` and `diagnosticCode = 'PREF_DISABLED'` (Q5); threshold changes re-evaluate underpacing with the new value (`budgetAtRisk` display does not change).

### 4.5 Data manager and linked accounts

```ts
// GET /api/dv/advertisers/:aid/data-manager, /linked-accounts  (RT 8.14)
linkAccount(input: { advertiserId: Id; type: LinkedAccountType; displayName: string; externalId?: string }): Promise<Result<{ id: Id }>>
removeLinkedAccount(input: { id: Id }): Promise<Result<null>>
requestCreatorVideoAccess(input: { advertiserId: Id }): Promise<Result<{ id: Id }>>
```
Rules: `ADV-025` (proposed): displayName required `Enter a value`; externalId unique per advertiser `[SIM] This account is already linked.` (`ADV-026`). Permission `ADM`. Side effects: ChangeLog; linked counts shown on the page; a `YOUTUBE_CHANNEL` link becomes selectable as a YouTube users audience source (audiences module, DM 5.3). Linking is instant in v1 (status `LINKED`); the creator-video request stays `PENDING` until an instructor flips it (Q6).

### 4.6 Policy center

```ts
// GET /api/dv/advertisers/:aid/policy-certificates  (RT 8.14)
requestPolicyCertificate(input: { advertiserId: Id; kind: PolicyCertificateKind; countryCode?: string; notes?: string }): Promise<Result<{ id: Id }>>
// instructor side (Phase 5, see C-03-5)
decidePolicyCertificate(input: { id: Id; decision: 'APPROVED'|'REJECTED'; reason?: string }): Promise<Result<null>>
```
Rules: `ADV-027` (proposed) country required for political, gambling and elections kinds `A selection is required`; `ADV-028` (proposed) duplicate pending request `[SIM] A request for this certificate is already pending.`. Permission request `STD`; decide `INS` (instructor). Side effects: ChangeLog on the advertiser, an instructor notification, and a student notification when decided. Engine rule (DM 5.3 "scenario hook"): LIs flagged as a restricted category without an `APPROVED` certificate for the targeted country do not serve; see Section 5 and C-03-4.

### 4.7 Side effects summary

| Action | ChangeLog | BulkJob | Alerts |
|---|---|---|---|
| updateAdvertiser (plain fields) | yes | no | none |
| updateAdvertiser (EU political ads) | yes, one group per LI | yes | none |
| updateAdvertiser (status) | yes `STATUS_CHANGE` | no | engine resolves or suppresses alerts under it |
| saveAlertPreferences | yes | no | open alerts of disabled types resolved |
| saveTargetingRules | yes | no | may create `LIMITED_AUDIENCE_SIZE` and `CONFLICTING_SETTINGS` through the engine |
| Policy / linked account | yes | no | `RESTRICTED_AUDIENCE_LIST` is unrelated |
| scheduleAdvertiserDeletion | yes | no | none |

---

## 5. Engine hooks

| Setting | Engine consumer | Reference |
|---|---|---|
| Alert preferences (10 toggles, underpacing %, spend threshold) | Alert generator reads them each tick. `thresholdPct` is the `thresholdPct` in the underpacing formula; spend threshold compares yesterday's advertiser spend | ENG 3.7, 7.6 |
| Targeting rules | Must be merged into each LI's targeting before the funnel: Brand suitability and Viewability into `T.*` pass fractions, keywords, channels into content filters. Engine text does not say this explicitly (C-03-3) | ENG 2.3, 3.3, DM 5.3 |
| Third-party verification and vendor selection | `T.VERIFICATION_3P` stage and `verificationCost` (CPM) | ENG 3.1 stage 17, 8.4 |
| Bidding rate cards | Media fee on affected LIs (fee type from the card). The engine uses IO/LI `partnerCosts` only; a rate card becomes available as a fee type but adds nothing by itself | ENG 8.2 |
| Paused or scheduled-for-deletion status | Serving formula, live status `PARENT_PAUSED` | VAL 4.0, ENG 3.6 |
| EU political ads, authorizations, business name | No engine effect | |
| Demand Gen Floodlight switch | Gate for the Demand Gen LI type; the engine treats Demand Gen as YouTube-like supply (ENG open question 11) | VAL MX-11 |
| Policy certificates | Proposed filter `C.GEO_POLICY`-like stage `T.POLICY`: LI in restricted category and country without approved certificate gets zero eligible requests (new reason code) (C-03-4) | ENG 3.2 |
| Linked accounts | None (YouTube channel link only enables an audience source) | |

---

## 6. Acceptance criteria

1. AC-03-1 (E) `[A]/details` renders all sections of 14 in order; Save is disabled on load; padlocks show on Currency and Timezone; Advertiser ID is read only.
2. AC-03-2 (E) Clearing Name shows `Enter a value`; clearing Website shows `Enter a value`; `abc` as Website shows `[SIM] Enter a valid URL.`. Save is blocked and focus moves to the first invalid field.
3. AC-03-3 (E) Changing Status to Paused and saving shows toast "Saved" and the banner "This advertiser is currently paused. None of its campaigns or deals are serving." on Campaigns, Creatives and Reports pages of this advertiser.
4. AC-03-4 (V) A forged `updateAdvertiser` with a different currency returns ADV-004 and writes no ChangeLog.
5. AC-03-5 (E) SDF version 9 shows the deprecation notice; 11 hides it. Invalid admin email shows `[SIM] Enter a valid email address.`.
6. AC-03-6 (E) Ad server and attribution pencil opens the panel; Apply makes the page dirty; Cancel with edits asks nothing (slide-over rule UC-3); page Save persists and History shows the change.
7. AC-03-7 (E) Third-party services panel shows the 6 vendor groups with counts 3, 3, 10, 4, 1 plus bidding rate cards; ticking a rate card without affirming blocks Apply with ADV-018; IAS client id `1.5` shows `[SIM] Enter a whole number.`.
8. AC-03-8 (E) Changing EU political ads to Yes and saving creates one Bulk status row "EU political ads set to Yes on N line items" and N History groups on the line items.
9. AC-03-9 (E) Turning off the Demand Gen Floodlight checkbox when 2 Demand Gen LIs exist shows the ADV-012 warning with `2`, still saves, and the "Demand Gen" card in the LI type picker shows the DG_PREREQ toast.
10. AC-03-10 (V) Business name of 26 characters is rejected by ADV-013; counter reads `26 / 25` in the UI only if paste is allowed (field stops at 25).
11. AC-03-11 (E) Schedule for deletion opens DLG-05; confirming sets status "Scheduled for deletion"; the advertiser disappears from the default Advertisers list; the deletion banner is shown; **Cancel deletion** restores the previous status.
12. AC-03-12 (E) As `STANDARD` (default student) Schedule for deletion is hidden; as Admin it is visible (see C-03-2).
13. AC-03-13 (E) Targeting rules page shows the four rows with the exact default texts and lock icons; as `ADM` pencils open the editors; as `STD` they do not.
14. AC-03-14 (E) After adding a negative keyword rule at advertiser level, an LI's Keywords targeting shows that keyword with a lock icon, cannot be removed (LI-100), and the Keyword exclusions bar of Brand controls (module 02) rises.
15. AC-03-15 (E) Data manager shows both tabs; **Link new account** menu lists 6 types; linking a YouTube channel increments "YouTube channels: n linked"; duplicate externalId shows ADV-026.
16. AC-03-16 (E) Alert preferences shows the 10 toggles with demo defaults; Save is disabled until a change; unticking Underpacing disables the two dependent toggles; entering `0` or `101` in the threshold shows ADV-015; spend threshold input is disabled while off.
17. AC-03-17 (E) Turning off "Rejected creative", stepping the clock 1 tick, then opening Intelligence shows no rejected-creative row and the campaign Alerts page has no Creatives alerts; turning it on again restores it after the next tick.
18. AC-03-18 (V) Changing `thresholdPct` from 90 to 50 changes `underpacing` for a fixture IO whose projected spend is 70% (true at 90, false at 50).
19. AC-03-19 (E) Policy center shows all card kinds in the order of 14 with "No certificates."; **Request Certificate** for Gambling asks for a country; submitting changes the status to Requested; a second request shows ADV-028.
20. AC-03-20 (E) When an instructor approves the request, the student receives a bell notification and the card shows Approved.
21. AC-03-21 (V) `getAdvertiserDetails` for a `READ_ONLY` caller returns `limitedAccess: true`; `updateAdvertiser` returns `FORBIDDEN`.
22. AC-03-22 (E) Leaving a dirty Basic details page via the left nav shows the Unsaved Changes dialog with focus on **Continue editing**.
23. AC-03-23 (V) Every `updateAdvertiser` diff produces one ChangeEntry per changed field with canonical old and new values; saving unchanged data writes none.
24. AC-03-24 (E) A `REPORTING_ONLY` user gets the 404 page on all six routes.

### 6.1 Playwright scenario outlines

| ID | Steps |
|---|---|
| PW-03-1 Basic details | Load, validation errors, edit and save, History row, locked fields, Unsaved Changes, read-only role |
| PW-03-2 Panels | Ad server panel, Third-party services panel validation, vendor effects on targeting verification provider (TGT-092) |
| PW-03-3 Status and deletion | Pause, banner on pages, resume, schedule deletion, list filter, cancel deletion |
| PW-03-4 EU and Demand Gen | EU propagation with Bulk status check; Demand Gen toggle and LI type picker gate |
| PW-03-5 Targeting rules | Admin edit, inheritance lock in an LI form, brand controls bar change |
| PW-03-6 Alert preferences | Toggles, dependency, thresholds, engine step, Intelligence reaction |
| PW-03-7 Data manager and Policy center | Link accounts, creator request, certificate request and instructor approval |

### 6.2 Vitest unit cases

| File | Cases |
|---|---|
| `lib/validation/adv.test.ts` | ADV-001 to ADV-019 each with one passing and one failing input; ADV-024 to ADV-028 proposals |
| `lib/services/advertiserSettings.test.ts` | Locked fields; diff to ChangeEntry; EU propagation count and bulk job; status transitions including cancel deletion; no-op save |
| `lib/services/alertPrefs.test.ts` | Dependency rule; defaults for new advertiser; threshold persistence; resolution of open alerts when disabled |
| `lib/services/policy.test.ts` | Duplicate request, country requirement, decision flow, engine flag helper |
| `lib/services/vendors.test.ts` | Group counts, TGT-092 helper `isProviderEnabled(advertiserId, provider)`, IAS client id 0 case |
| `lib/permissions.test.ts` | Role by action matrix for all endpoints in this module |

---

## 7. Build tasks

| # | Task | Size | Depends on |
|---|---|---|---|
| 03-T1 | Prisma additions: DELTA-03-1 to DELTA-03-5, vendor seed | M | P3-05 |
| 03-T2 | Basic details page with all sections, dirty/Reset/footers, `updateAdvertiser` and diff registry | L | P3-04 (forms, banners), 02-T1 (roles), P3-05 |
| 03-T3 | Ad server panel and Third-party services panel | M | 03-T2, 03-T1 |
| 03-T4 | Status, banner, Schedule/Cancel deletion, DLG-05 | S | 03-T2, module 01 banner stack |
| 03-T5 | EU political ads propagation (bulk job + per-LI ChangeLog) | M | 03-T2, module 01 `createBulkJob`, P3-06 |
| 03-T6 | Alert preferences page and service; engine alert generator reads prefs | M | P3-08, P4-11 |
| 03-T7 | Targeting rules page; locked-mode mounting of the shared editors; inheritance in LI forms | L | P3-07, P3-06 |
| 03-T8 | Data manager pages, linked accounts service, link dialogs | M | 03-T1 |
| 03-T9 | Policy center page, request dialog, instructor decision action (stub UI until P5-01) | M | 03-T1, P5-01 for the console |
| 03-T10 | Playwright suites PW-03-1 to PW-03-7 | M | all above |

---

## 8. Open questions and conflicts

### 8.1 Open questions

| # | Question | Default used here |
|---|---|---|
| Q1 | Can students edit Basic details, or is it Admin only? | Admin only per RT 3.11. Students can pause via module 02 `setAdvertiserStatus` (C-03-2) |
| Q2 | Retention before a scheduled deletion purges the advertiser | 7 sim days, instructor can change; purge removes data, keeps ChangeGroup rows |
| Q3 | Vendor names: fictional (explore 14) or real (DM Q8 keeps real names for verification providers in targeting)? | Fictional here; targeting keeps DoubleVerify, IAS, Scope3 because TGT-090 lists them. TGT-092 therefore needs a mapping from fictional vendor to provider key |
| Q4 | Does the demo apply EU political ads change per LI "editable per LI later"? | Yes, per-LI value stays editable and later advertiser changes overwrite it |
| Q5 | When an alert type is switched off, are open alerts resolved or hidden? | Resolved with `PREF_DISABLED` |
| Q6 | Who flips a `PENDING` creator-video request? | Instructor console action, same as certificates |
| Q7 | Brand suitability modes and what they do to supply | Names only in v1, no supply effect |
| Q8 | Is the Floodlight "Attribution settings" selection allowed to change after creation? | Yes (dropdown), but only to groups of the same partner |

### 8.2 Conflicts and gaps between specs

> Resolved: every conflict below is consolidated in [`../conflicts.md`](../conflicts.md) (crosswalk table, rows `RC-nnn`). Where a proposal here and the RC row differ, the RC row wins.

| # | Conflict | Where | Proposed resolution |
|---|---|---|---|
| C-03-1 | PROJECT.md 5.11 lists Ad serving (CM360 link), Creative settings (OBA icon, Dynamic creatives), Floodlight config, Linked accounts, Billing, Targeting defaults, Brand safety defaults, Data access / Integrations, and "industry". Explore 14 and RT 3.11 have five pages with a different content split (Targeting rules replaces "Targeting defaults" and "Brand safety defaults"; no OBA icon, Dynamic creatives or Billing) | `PROJECT.md` 5.11 vs `docs/explore/14` and `routes.md` 3.11 | Follow explore 14. Update PROJECT.md 5.11 |
| C-03-2 | Write rights: RT 3.11 `[A]/details` write `ADM`; VAL 4.1 lets `STANDARD` pause an advertiser; students are `STANDARD` (RT Q10); DM 5.1 `partner.settings.write` is ADMIN only. Alert preferences and Policy center are `STD` in RT 3.11 | `routes.md` 3.11, Q10; `validation.md` 4.1; `data-model.md` 5.1 | See C-02-2. Needs a decision before P4-09 |
| C-03-3 | Engine text does not say that advertiser-level locked targeting rules are merged into LI targeting before the funnel. DM 5.3 and explore 14 require it | `engine.md` 3.1, 3.3 vs `data-model.md` 5.3 | Add one sentence to ENG 3.1 and a test in ENG 11 |
| C-03-4 | DM 5.3 says the engine blocks LIs in restricted categories without an approved certificate. ENG 3.2 has no reason code for it and no field marks a LI or advertiser as "restricted category" | `data-model.md` 5.3 vs `engine.md` 3.2 | Add a `restrictedCategory` attribute (on Advertiser or LI) and reason code `T.POLICY`, or drop the rule in v1 and keep certificates informational |
| C-03-5 | RT has `requestPolicyCertificate` only. No route or API lets an instructor approve; RT 7.2 instructor console does not list it | `routes.md` 8.14, 7.2 | Add `decidePolicyCertificate` action and an instructor "Requests" tab; students get a notification |
| C-03-6 | Alerts: preference types in DM `AlertType` (10 + 2) do not all exist in ENG 3.7 (`UNDERPERFORMING_IO`, `RESTRICTED_AUDIENCE_LIST` missing). Same item as module 01 C-01-3 | `engine.md` 3.7 vs `data-model.md` 4.10 | Add the two codes to ENG |
| C-03-7 | ADV-015 says range 1 to 100 but the message is `Enter a number between 0 and 100` (GEN-009 range 0 to 100) | `validation.md` 2.3 ADV-015 vs GEN-009 | Pick 1 to 100 and word the message "between 1 and 100", or allow 0 |
| C-03-8 | `AdvertiserDetails` in RT 8.14 has no `industry` while DM 5.3 does (same as module 02 C-02-5), and DM `thirdPartyConfig` json vs RT `ThirdPartyServices` shape differ in naming | `routes.md` 8.14 vs `data-model.md` 5.3 | DELTA-03-2 resolves the second one; add `industry` to RT 8.14 |
| C-03-9 | Rate cards: DM 5.2 and explore 14 say they add fees in partner costs; ENG 8.2 computes fees from IO/LI `partnerCosts` and has no rate card concept; VAL MX-17 fee type list does not include rate card vendors | `engine.md` 8.2, `validation.md` MX-17 vs `data-model.md` 5.2 | Treat rate card vendors as extra fee types in MX-17 and in IO/LI partner costs |
| C-03-10 | DLG-05 body promises "You can cancel the deletion until {date}" but VAL Q18 asks if cancel is possible at all, and VAL 4.1 marks cancel `(from public docs)` | `validation.md` 5.2, 4.1, Q18 | Keep cancel; make the retention a classroom setting |
| C-03-11 | VAL has no rules for Targeting rules saves, Linked accounts or Policy center; `ADV-024` to `ADV-028` in this file are proposals | `validation.md` 2.3 | Register them |
