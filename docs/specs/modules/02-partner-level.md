# Module 02: Partner level

Task P2-06a. Source: PROJECT.md 5.2, `docs/explore/02-partner-level.md`. Related explore: 01 (nav, Overview), 11 (brand controls at advertiser level), 14 (advertiser fields used by Create advertiser), 17 (404).
Specs used: `data-model.md` (DM), `routes.md` (RT), `design-system.md` (DS), `validation.md` (VAL), `engine.md` (ENG). Cited as `DM 5.2`, `RT 3.2` and so on.
Build phases: P3-02 (roles), P3-05 (seed), P4-09 (this module), with the Advertisers list also needed by P3-03 for advertiser switching.

---

## 1. Scope and out of scope

### 1.1 In scope

| Area | Pages / features | Explore |
|---|---|---|
| Advertisers list | Summary cards (Budget at risk, Pacing), status filter, Segment by, date picker, columns, pager, **Create advertiser** | 02 |
| Create advertiser | Full-screen form `advertisers/new` (from public docs) | 02 gap, DM 5.3 |
| Partner settings: Basic details | Name, status, locked time zone and currency, Nielsen country, measurement settings, exchanges summary, SDF version, SDF administrator email, data protection contacts, third-party rate cards | 02 |
| Exchanges slide-over | ~70 exchanges, enable and disable, nested App mediation group, extra ID fields, **Review fees** | 02 |
| Partner settings: Targeting | Default inventory source and default targeting (opens the shared targeting editors) | 02, 07 |
| Partner settings: Advertiser configurations | 6 cards with per-advertiser scope ("Select Advertisers") | 02 |
| Users and roles | `/users`, `/users/new`, `/users/{userId}`, role per partner or advertiser, "Your profile" table | 02 |
| Email preferences page | `/email-preferences` with Alerts and News toggles (page only; top-bar entry is module 01) | 02, 14 |
| Partner Brand controls | Tabs Display and video, YouTube; coverage bars per advertiser | 02 |
| Partner nav landing pages for Channels, Custom bidding, Floodlight groups, Reports, Cross-media reach | Entry rows only: nav links and the "Limited Access" create-button behaviour. Page contents belong to other modules (see 1.2) | 02 |

### 1.2 Out of scope (owned elsewhere)

| Item | Owner |
|---|---|
| Overview (`home_v3`), top bar, nav renderer | Module 01 |
| Partner Channels, Custom bidding, Floodlight groups pages | Resources modules (P4-04, P4-05). They own the lists; module 02 only guarantees partner-scope access and the "New" button disabled state for `READ_ONLY` |
| Reports app, Cross-media reach reports | P4-07 reporting; module 04 (cross-media) |
| Targeting editors (geo, apps and URLs, environment, position) | P3-07 targeting panel. Module 02 mounts them with `ownerType = PARTNER` |
| SDF dialogs | P4-10. Module 02 only places the **SDF > Upload** item in the list overflow menu |
| Instructor class management and sandbox users | Phase 5 (`/sim/instructor`, RT 7.2). `/users` here is the DV360-style page for people inside a sandbox |

### 1.3 Blocked in the demo, filled from public docs or by us

| Item | Gap in the demo | What we build |
|---|---|---|
| Create advertiser | Button disabled (Limited Access) | Form in 2.2. Fields from DM 5.3 (name, website, currency, time zone, ad server, Floodlight, billing profile) plus `industry` (Q2) |
| Billing profiles, invoices, partner costs and revenue models | Not in the demo partner nav | **Deferred.** Data tables exist in DM 5.2 (`BillingProfile`, `Invoice`). No route in RT (RT 3.2 last row, RT Q21). Decision in Q1; stub task 02-T14 behind a flag |
| Partner-level audiences, combined audiences, custom lists, location lists, negative keyword lists, inventory lists (listed in PROJECT.md 5.2) | Not in the demo partner nav; RT has no routes | **Not built in v1.** Conflict C-02-1 |
| Role picker | Not reachable | Roles from DM 5.1 with the permission matrix (6 roles) |
| Role dropdown on New user | Not reachable | Dropdown with the 6 role labels (Q4) |
| Email preference pages | Menu seen, pages not opened | Two toggles (4.9) |
| Terms and conditions text on configuration cards | Link only | Short Adsmetor-written terms dialog (not Google text) |
| Review fees button | Not clicked | Dialog listing the app mediation add-on fee (fictional rate) with **Accept** |
| Data protection checkbox content | Link only | Adsmetor-written terms text; once accepted it locks (PRT-006) |

---

## 2. Screens and views

Access codes per RT 2. All partner pages use frame P unless said. The grey **Limited Access** chip next to the page title shows for roles `READ_ONLY` and `PARTNER_CLIENT` (DS Q14, VAL 4.0).

| # | Screen | Route | Frame | Access view / write | Explore |
|---|---|---|---|---|---|
| S1 | Advertisers list | `[P]/advertisers` | P | RO / STD | 02 |
| S2 | Create advertiser | `[P]/advertisers/new` | F | STD / STD | gap |
| S3 | Basic details | `[P]/details` | P | RO / ADM | 02 |
| S4 | Exchanges slide-over | none (client slide-over on S3) | P | RO / ADM | 02 |
| S5 | Targeting defaults | `[P]/targeting` | P | RO / ADM | 02 |
| S6 | Advertiser configurations | `[P]/third-party-configuration` | P | RO / ADM | 02 |
| S7 | Brand controls | `[P]/brand/controls` (`?tab=youtube`) | P | RO / - | 02 |
| S8 | Users | `/users` | G (back arrow, no nav) | RO / ADM | 02 |
| S9 | New user | `/users/new` | G | ADM / ADM | 02 |
| S10 | Edit user | `/users/{userId}` | G | ADM / ADM | gap |
| S11 | Email preferences | `/email-preferences` | G | ANY / ANY | 02, 14 |

### 2.1 S1 Advertisers list

Layout (02): `DvPageHeader` "Advertisers" with Limited Access chip, two `DvSummaryCard`s on top, toolbar, `DvFilterBar`, `DvGrid`, pager.

| Block | Content |
|---|---|
| Card "Budget at risk (Today)" | Big value (for example `₹450K`) "of ₹450K total budget"; donut with legend Likely to spend % (green), At risk % (orange), Spend % (blue); footnote "Data for active budget segments" |
| Card "Pacing (Today)" | Big count "41 active insertion orders"; donut with legend Pacing % (blue), Underpacing % (red) |
| Toolbar | **Create advertiser** (primary, disabled with tooltip for read-only roles), date dropdown (single day, default = sim yesterday, RT R9), **Segment by** menu (None, Budget type), filter toggle, overflow menu with SDF > Upload |
| Filter bar | Funnel with count badge; chip "Status: Active" (popover "Matches: Active / Paused / Scheduled for deletion" with **Apply**); search input; clear all |
| Grid | Header groups: blank, "Delivery and Interactions", "Pacing" (collapsible), "Insertion order status" (collapsible). Columns: checkbox, status dot, Name (link) plus ID, Impressions, Revenue, Budget at risk, Current budget, Underpacing / Total active ("0 / 0") |
| Pager | "Show rows: 20", "1 - 1 of 1", first/prev/next/last |

Behaviour notes:
- Name link opens `[A]/cs` of that advertiser (this is the only way to switch advertiser, DS Q9, RT Q5).
- Money is in each advertiser's currency (a SGD advertiser under an INR partner shows SGD). Cards sum in partner currency using `FxRate` (DM 8 Q27).
- With **Segment by Budget type**, each advertiser row splits into sub-rows for Amount and Impressions budget types (04 budget types, DM 4.3).
- Paused and Scheduled-for-deletion advertisers are hidden by the default `Status: Active` filter.
- Selecting rows is allowed only for the SDF overflow. There is no bulk Action bar on this list in the demo (02 shows none); keep it that way.

States: loading (card skeleton, grid skeleton); empty (no advertisers: `DvEmptyState` "No advertisers" with **Create advertiser** if allowed); filtered-empty "No results."; error banner with Retry; read-only (Create disabled, chip shown); `REPORTING_ONLY` gets the 404 page.

### 2.2 S2 Create advertiser (from public docs)

Full-screen form (frame F, X and title "New advertiser"), footer **Create** and **Cancel**. Unsaved Changes dialog on leave (VAL 5.1).

| Field | Control | Default | Rule |
|---|---|---|---|
| Name (Required) | text, counter `n / 240` | empty | ADV-001 `Enter a value`; max 240 (GEN-004) |
| Website (Required) | URL text | empty | ADV-002, ADV-003 |
| Currency | dropdown (ISO list, partner currency first) | partner currency | Locked after creation, notice under field |
| Time zone | dropdown | partner time zone | Locked after creation |
| Ad server | radio: Third-party ad servers only / Campaign Manager 360 | Third-party only | CM360 option shows the Floodlight config selector (Q5) |
| Attribution (Floodlight config) | auto: "A Floodlight group is created for this advertiser" | n/a | creates `FloodlightGroup` |
| Billing profile | dropdown of `BillingProfile` | partner default, hidden when billing is deferred | see 1.3 |
| Industry | dropdown (list in Q2) | empty | optional; feeds `verticalMultiplier` (ENG 2.7) |
| Copy settings from | dropdown of existing advertisers (optional) | none | copies authorizations, alert preferences, SDF version, third-party config; not entities |

On success: the user lands on `[A]/cs` of the new advertiser (RT 6.3 says create goes to the entity page).

### 2.3 S3 Basic details

Sections as white cards with a sticky footer: **Save** (disabled until dirty, VAL 5.1), **Reset**, optional change note "Optional: Enter a note about this change".

| Field | Control | Rule IDs |
|---|---|---|
| Name (Required) | text plus status dropdown "Active" / "Paused" | PRT-001, PRT-002 |
| Timezone | locked, padlock | PRT-003 |
| Currency | locked, padlock | PRT-003 |
| Nielsen contract country | dropdown | none |
| Measurement settings | 2 checkboxes: "Include DV360 data in CM360 Data Transfer reports", "Report DV360 cost to CM360" | none |
| Partner ID | read only with help icon | |
| Exchanges | checkbox "Automatically enable new exchanges", text "N Exchanges enabled", pencil (opens S4). Info banner about app mediation add-on fees with **Review fees** | PRT-007 |
| Structured Data Files | SDF version dropdown (9, 9.1, 9.2, 10, 10.1, 11); SDF Administrator email | PRT-004, PRT-005; SDF 9 shows BLK-006 note |
| Data protection | checkbox accept terms (locks once accepted); tabs Primary contact / Data protection officer / EU representative (Name, Email, Address, Phone number); radio "Person to be contacted" | PRT-006 |
| Additional settings (expander) | Third-party rate cards list with pencil; empty "No third-party rate cards added" | |

States: loading; read-only (all controls disabled, Save hidden, chip); saving (button spinner); conflict (DLG-11); error toast.

### 2.4 S4 Exchanges slide-over (`DvSlideOver`, default width)

Header "Exchanges" with close; note "Partner Read and write permission is needed to modify"; alphabetical checkbox list; nested collapsible group **App mediation partners (n of 8)**; rows with extra inputs (Google Ad Manager: Network ID and Agency ID; SmartClip and Yieldlab: Seat ID) appear when the row is ticked; footer **Save** and **Cancel** (copy edits into the page draft; the page **Save** persists them, RT 5.4 draft-bound slide-over rule).
Seed list: DM `Exchange` rows (about 70; 54 enabled; names in 02). The count text updates live.
States: loading; empty search ("No exchanges match"); read-only (checkboxes disabled, PRT-007 tooltip).

### 2.5 S5 Targeting defaults

Two sections as cards with a pencil per row (02):
- **Inventory source** (note: defaults for new IOs and LIs): Public Inventory "54 Exchanges and 0 Subexchanges are selected" with checkbox "Targeting new exchanges"; Deals and Packages "0 deals and packages selected"; Deal groups "No inventory groups selected".
- **Targeting**: Geography (All locations), Environment (No restrictions for environment), Position (All positions selected), Apps & URLs (No restrictions). Note: Apps & URLs applies to existing and new LIs; the others to new LIs only.
Pencils open the shared targeting editors (P3-07) in `ownerType = PARTNER` mode. States and read-only behaviour as S3.

### 2.6 S6 Advertiser configurations

Six cards, each with checkbox and/or "Select Advertisers" link, Recommended chip where shown, one **Save** at the bottom.

| Card | Controls | Flag key (DM 5.2) |
|---|---|---|
| Enhanced automation settings (Recommended) | Checkbox "Enable Enhanced Automation", **View terms & conditions**, "Enabled advertisers: All advertisers" with pencil | `ENHANCED_AUTOMATION` |
| Product improvement | Checkbox; read-only while Enhanced automation is on (PRT-009) | `PRODUCT_IMPROVEMENT` |
| Google & partner inventory | Checkbox; terms text; Select Advertisers | `GOOGLE_PARTNER_INVENTORY` |
| YouTube guaranteed instant deals | Terms required; View terms; Select Advertisers | `YOUTUBE_GUARANTEED_INSTANT_DEALS` |
| Auto-tagging (Recommended) | Checkbox; Select Advertisers | `AUTO_TAGGING` |
| Advanced ad serving | Checkbox "Accept advanced creative fees"; Select Advertisers | `ADVANCED_AD_SERVING` |

"Select Advertisers" opens `DvTreeSelect` (partner root with advertisers, "None selected" pane) as a slide-over. Choosing All advertisers sets `scope = ALL_ADVERTISERS`; choosing a subset sets `SELECTED` and writes `PartnerFeatureAdvertiser` rows.

### 2.7 S7 Brand controls

Tabs `DvTabs`: Display and video | YouTube. Table per advertiser: Name plus ID, Active line items (count), four coverage bars `DvChartCard` horizontal-bar kind (blue fill, % right, "92% (46/50 Line items)" on hover): Digital content label exclusions, Apps / URL and channel exclusions, Keyword exclusions, Authorized sellers. Pager. States: loading; empty (no advertisers); error. Read-only page for everyone (no write column in RT 3.2).

### 2.8 S8 Users

Header: back arrow, "Users" (frame G with back header, no left nav). "Your profile" table (Name, Email, Role, Partners, Advertisers) for the signed-in person. Then "Users - Review users who have access to your partners and advertisers." with **New user** (primary), filter toggle, filter bar (search plus role chip), grid: checkbox, Name (link), Email, Role, Partners, Advertisers (comma list of IDs); pager "Show rows: 100".
Role values: Admin, Standard, Read only, Partner client, Reporting only, Creative. A user with several grants shows several roles ("Standard, Read only").
States: loading; empty "No other users have access" (`[SIM]`); read-only (New user disabled, rows open view-only); error.

### 2.9 S9 New user and S10 Edit user

Form (frame G, no nav): Name, Email, Type (only "Partner & advertiser"), Access section. Empty state in Access: "You can give users different roles for each advertiser or partner they have access to". **Add partners or advertisers** opens `DvTreeSelect` slide-over "Select partners and advertisers" (Search, tree, right pane "None selected", **Select** and **Cancel**). After selection each row shows a role dropdown. **Save** (disabled until valid) and **Cancel**. Edit user is the same form prefilled with a **Remove user** action (confirm `[SIM]` dialog).

### 2.10 S11 Email preferences

Page title "Email preferences" with two sections: **Alerts** and **News, announcements, and offers**, each a toggle. Link "Manage Global Email Configuration" in module 03 (Alert preferences) points here. Simulator emails are never sent (Q3); the toggles control what lands in the in-app inbox described in DM 5.14 (`ReportRun` notes).

---

## 3. Data

### 3.1 Entities used (names from DM)

| Entity | DM | Use |
|---|---|---|
| `Partner` | 5.2 | Basic details |
| `PartnerContact` | 5.2 | Data protection tabs |
| `PartnerExchange`, `Exchange` | 5.2 | Exchanges panel |
| `PartnerFeatureFlag`, `PartnerFeatureAdvertiser` | 5.2 | Advertiser configurations |
| `ThirdPartyRateCard` | 5.2 | Basic details > Additional settings |
| `BillingProfile`, `Invoice`, `InvoiceLine` | 5.2 | Deferred (1.3) |
| `Advertiser` | 5.3 | List, create |
| `AdvertiserAlertPreference`, `FloodlightGroup` | 5.3, 5.12 | Created with an advertiser |
| `TargetingAssignment` (`ownerType = PARTNER`) | 5.8 | Targeting defaults |
| `User`, `UserAccessGrant`, `Role`, `Permission`, `RolePermission` | 5.1 | Users page |
| `SimPacingSnapshot`, `SimDailyMetric` | 5.18 | List cards and columns |
| `ChangeGroup`, `ChangeEntry` | 6 | History of partner changes (shown on advertiser History, see module 05) |
| `Alert` | 5.19 | Nothing written here |

### 3.2 Spec deltas (new fields and tables)

| ID | Delta | Detail |
|---|---|---|
| DELTA-02-1 | `Exchange.engineKey` and `isModelled` | DM `Exchange.code` is a stable slug; ENG 2.7 models ~9 named exchanges plus `long_tail` and `youtube`. Add `engineKey str` (one of the ENG keys or `long_tail`) and `isModelled bool`. Disabling a non-modelled exchange scales the `long_tail` supply share by `enabledLongTail / allLongTail` |
| DELTA-02-2 | `SandboxPerson` (or `User.isSimulated`) | `User.email` is globally unique (DM 5.1). A student can add a colleague by email on `/users/new`, and another student can add the same address in their own sandbox. Add `User.isSimulated bool` plus `User.sandboxId` Y, and relax the unique index to `(email) WHERE NOT isSimulated` plus `(sandboxId, email) WHERE isSimulated`. Simulated users have no password and cannot sign in. Conflict C-02-3 |
| DELTA-02-3 | `UserAccessGrant.level` UI labels | DM `DvRole` values map to labels: ADMIN "Admin", STANDARD "Standard", READ_ONLY "Read only", REPORTING_ONLY "Reporting only", PARTNER_CLIENT "Partner client", CREATIVE "Creative". Constants in `lib/validation/constants/roles.ts` |
| DELTA-02-4 | `UserEmailPreference` | `userId`, `sandboxId` Y, `alerts` bool N true, `news` bool N true, `updatedAt`. Unique `(userId, sandboxId)` |
| DELTA-02-5 | `Partner.termsAcceptedAt` per flag text | `PartnerFeatureFlag.termsAcceptedAt/ById` exist; add `termsVersion int` so the Adsmetor terms text can change |
| DELTA-02-6 | `Advertiser` create inputs | `industry` is in DM 5.3 but not in `AdvertiserDetails` (RT 8.14); add `industry` to both (conflict C-02-5). `createdFromAdvertiserId` Y for "Copy settings from" |
| DELTA-02-7 | `PartnerExchange.feesAcceptedAt` | "Review fees" acceptance for app mediation partners. Nullable ts on the `PartnerFeatureFlag`-style acceptance, stored as key `APP_MEDIATION_FEES` in `PartnerFeatureFlag` (add to its key enum) |
| DELTA-02-8 | Brand control coverage definitions | Computed at read time (DM 7.1). Define the four predicates in `lib/services/brandControls.ts` (4.8) |

### 3.3 Seed data requirements

| Seed | Requirement |
|---|---|
| Partner | 1 per sandbox: name (synthetic), INR, Asia/Calcutta, SDF 11, Nielsen country set, measurement checkboxes off, data terms accepted, 3 contacts filled with `.invalid` emails |
| Exchanges | The ~70 names of 02 with 54 enabled, 6 of 8 app mediation partners enabled, Google Ad Manager with fake Network ID and Agency ID, SmartClip and Yieldlab with fake Seat IDs |
| Feature flags | Defaults from DM 5.2 (Enhanced automation on, Auto-tagging on, Google & partner inventory on, Advanced ad serving on, Instant deals off), all scope ALL_ADVERTISERS |
| Advertisers | 3 in the default template: 1 active INR advertiser with campaigns, 1 active SGD advertiser (currency demo), 1 paused (hidden by default filter). `healthy` and `needs-attention` variants change pacing |
| Users | The student (STANDARD on the partner), 2 simulated colleagues (READ_ONLY, REPORTING_ONLY), 1 Partner client, so the role column shows variety |
| Rate cards | 2 fictional bidding vendors (5% and 14%), not accepted |
| Brand controls | LIs set so coverage bars show different values per advertiser, for example 92%, 40%, 0%, 100% |
| Email prefs | Both toggles on |

---

## 4. Behaviour

Types `Id`, `Result<T>`, `Issue`, `WriteMeta`, `ListQuery`, `ListResult` come from RT 8.0. Permission codes from RT 2. Every write goes through `withChangeLog` (DM 6.3) and checks `assertAccess(session, ref, 'write')` in the service layer. Services in `lib/services/partner.ts`, `advertisers.ts`, `users.ts`.

### 4.1 Advertisers list

```ts
// GET /api/dv/partners/:pid/advertisers  (RT 8.2)
listAdvertisers(partnerId: Id, q: ListQuery<{ status: ('ACTIVE'|'PAUSED'|'SCHEDULED_FOR_DELETION')[] }>): Promise<Result<ListResult<AdvertiserRow>>>
// GET /api/dv/partners/:pid/advertisers/summary?d=
getAdvertiserSummary(partnerId: Id, d: DateRangeParam): Promise<Result<{ budgetAtRisk: { total: Money; likelyPct: number; atRiskPct: number; spendPct: number }; pacing: { active: number; underpacingPct: number } }>>
```
Read only, permission `RO`. Summary rules follow ENG 7.6: Likely to spend = projected at least budget; At risk = remainder; Spend % = spent to date over budget; Pacing % = share of active IOs not underpacing. Default date = sim yesterday.

### 4.2 Create advertiser

```ts
// action (RT 8.2)
createAdvertiser(input: {
  partnerId: Id; name: string; website: string; currency: string; timeZone: string;
  adServer: 'THIRD_PARTY_ONLY'|'CM360'; industry?: string; billingProfileId?: Id; copyFromAdvertiserId?: Id;
}): Promise<Result<{ id: Id }>>
```

| Rule | ID | Text |
|---|---|---|
| Name required | ADV-001 | `Enter a value` |
| Name max 240 | GEN-004 | `[SIM] Use 240 characters or fewer.` |
| Website required, valid | ADV-002, ADV-003 | `Enter a value` / `[SIM] Enter a valid URL.` |
| Currency and time zone must be chosen from the lists | GEN-005 | `A selection is required` |
| Partner write access | `ADV-021` (proposed) | `[SIM] You need write access to the partner to create an advertiser.` |
| Copy source must be in the same partner | `ADV-022` (proposed) | `[SIM] Choose an advertiser from this partner.` |
| Advertiser cap per partner (sandbox safety) | `ADV-023` (proposed) | `[SIM] This partner can have up to 50 advertisers.` |

Permission `STD`. Side effects: ChangeLog (CREATE group, up to 60 entries); a default `FloodlightGroup`; 10 `AdvertiserAlertPreference` rows with defaults (DM 5.3) or copied; `PartnerFeatureFlag` rows with scope ALL_ADVERTISERS apply automatically (SELECTED ones do not); `Advertiser.sdfVersion` set from the copy source or the partner `sdfVersion` (V11) (RC-045); status `ACTIVE`.

### 4.3 Advertiser status from the list

```ts
setAdvertiserStatus(input: { id: Id; status: 'ACTIVE'|'PAUSED' } & WriteMeta): Promise<Result<null>>
```
Rule `ADV-005`. Permission `STD` (RT 8.2, VAL 4.1) even though the details page write is `ADM` (conflict C-02-2). Side effect: ChangeLog `STATUS_CHANGE`; serving formula changes (VAL 4.0); banner ADV-009 on advertiser pages. The list in the demo has no inline status control; the call is exposed for module 03 (Save on details) and scenarios.

### 4.4 Partner basic details

```ts
// GET|PATCH /api/dv/partners/:pid  (RT 8.2)
updatePartner(input: WriteMeta & {
  id: Id; name: string; status: 'ACTIVE'|'PAUSED'; nielsenCountry?: string;
  measurement: { includeInCm360: boolean; reportCostToCm360: boolean };
  sdfVersion: '9'|'9.1'|'9.2'|'10'|'10.1'|'11'; sdfAdminEmail?: string;
  autoEnableNewExchanges: boolean;
  dataProtection: { accepted: boolean; contacts: Partial<Record<'PRIMARY'|'DATA_PROTECTION_OFFICER'|'EU_REPRESENTATIVE', { name?: string; email?: string; address?: string; phone?: string }>>; contactPerson: 'PRIMARY'|'DATA_PROTECTION_OFFICER'|'EU_REPRESENTATIVE' };
}): Promise<Result<null>>
```
Rules: PRT-001, PRT-002, PRT-003 (currency and time zone cannot change), PRT-004, PRT-005, PRT-006 (accepted cannot be unchecked), plus `PRT-011` (proposed) contact email must be valid `[SIM] Enter a valid email address.` and `PRT-012` (proposed) exactly one contact person (radio). Permission `ADM`; a `STANDARD` call returns `FORBIDDEN`.
Side effects: ChangeLog per field ("Partner name changed from ... to ..."); changing `sdfVersion` affects SDF files only (no re-write of data); setting `status = PAUSED` pauses serving of all advertisers (same formula as advertiser pause, VAL 4.0) and shows a partner-level banner `[SIM]` "This partner is currently paused. None of its advertisers are serving." (C-02-6, partner pause banner is not in RT 4.5).

### 4.5 Exchanges

```ts
// GET|PUT /api/dv/partners/:pid/exchanges  (RT 8.2)
saveExchanges(input: WriteMeta & { partnerId: Id; enabled: { exchangeId: Id; networkId?: string; agencyId?: string; seatId?: string }[]; autoEnableNew: boolean }): Promise<Result<{ enabledCount: number; affectedLineItems: number }>>
acceptAppMediationFees(input: { partnerId: Id }): Promise<Result<null>>
```
Rules: PRT-007 (needs `ADM`), PRT-008 (required extra IDs when enabled), PRT-010 (warning with the count of LIs that target a disabled exchange; save succeeds). Side effects: ChangeLog entries "1 ad exchange added" or removed per exchange (matches the History pattern in 16); recompute `Exchange` supply shares for the engine next tick (DELTA-02-1); line items keep their stored targeting; the Troubleshooter funnel simply sees no requests on a disabled exchange (ENG 3.1).

### 4.6 Targeting defaults

```ts
// GET|PUT /api/dv/partners/:pid/targeting-defaults  (RT 8.2)
saveTargetingDefaults(input: WriteMeta & { partnerId: Id; inventory: InventorySourceState; targeting: TargetingState }): Promise<Result<null>>
```
Validation: the shared TGT rules (VAL 2.16, for example TGT-012) run for each edited dimension. `Apps & URLs` merges live into every LI (DM 8 Q11); other dimensions are copied into new IOs and LIs at create time and do not alter existing entities. Permission `ADM`. ChangeLog entityType `PARTNER`.

### 4.7 Advertiser configurations

```ts
// GET|PUT /api/dv/partners/:pid/advertiser-configurations  (RT 8.2 shape AdvertiserConfigurations)
saveAdvertiserConfigurations(input: WriteMeta & { partnerId: Id; config: AdvertiserConfigurations }): Promise<Result<null>>
acceptConfigurationTerms(input: { partnerId: Id; key: 'ENHANCED_AUTOMATION'|'GOOGLE_PARTNER_INVENTORY'|'YOUTUBE_GUARANTEED_INSTANT_DEALS'|'ADVANCED_AD_SERVING' }): Promise<Result<null>>
```

| Rule | ID | Text |
|---|---|---|
| Product improvement read only while Enhanced automation is on | PRT-009 | `[SIM] This setting can't be changed while Enhanced automation is on.` |
| Instant deals need accepted terms | `PRT-013` (proposed) | `[SIM] Accept the terms and conditions to use YouTube guaranteed instant deals.` |
| A selected-scope flag needs at least one advertiser | `PRT-014` (proposed) | `A selection is required` |
| Turning Google & partner inventory off while YouTube, Demand Gen LIs exist | `PRT-015` (proposed, warning) | `[SIM] {n} YouTube & partners or Demand Gen line items will stop delivering for these advertisers.` |

Permission `ADM`. Side effects: ChangeLog by `PARTNER_SETTING_UPDATER` fan-out to each affected advertiser History (DM 6.3 item 7). `GOOGLE_PARTNER_INVENTORY` is read by the LI type picker as a precondition for YouTube & partners and Demand Gen (Demand Gen also needs `Advertiser.demandGenFloodlightOptimization`, VAL MX-11).

### 4.8 Brand controls

```ts
// GET /api/dv/partners/:pid/brand-controls?tab=DISPLAY_VIDEO|YOUTUBE
getBrandControls(partnerId: Id, tab: 'DISPLAY_VIDEO'|'YOUTUBE'): Promise<Result<ListResult<{ advertiserId: Id; name: string; publicId: string; activeLineItems: number;
  coverage: Record<'DIGITAL_CONTENT_LABELS'|'APPS_URL_CHANNEL'|'KEYWORDS'|'AUTHORIZED_SELLERS', { pct: number; covered: number; total: number }> }>>>
```
Definition (all over ACTIVE line items of the tab's type group): a line item is covered by
- `DIGITAL_CONTENT_LABELS` when it, its template-applied rows or the advertiser rule has a `DIGITAL_CONTENT_LABEL` or `SENSITIVE_CATEGORY` exclusion, or a `BRAND_SUITABILITY` row;
- `APPS_URL_CHANNEL` when a negative `APPS_AND_URLS` row exists at partner, advertiser or LI level;
- `KEYWORDS` when a negative keyword (`KEYWORD` EXCLUDE) or `NEGATIVE_KEYWORD_LIST` row exists at any level;
- `AUTHORIZED_SELLERS` when `LineItem.inventoryQuality` is `AUTHORIZED_DIRECT_SELLERS` or the default `..._AND_RESELLERS` (Q6: is default "enabled"?).
`pct = covered / total`, 0 when total is 0. Permission `RO`. The tab YouTube counts `YT_*` and `DEMAND_GEN` LIs; Display and video counts the rest.

### 4.9 Users and roles

```ts
// GET /api/dv/users, GET /api/dv/users/:id  (RT 8.3)
listUsers(q: ListQuery<{ role: string[]; partner: Id[]; advertiser: Id[] }>): Promise<Result<ListResult<UserRow>>>
createUser(input: { name: string; email: string; type: 'PARTNER_AND_ADVERTISER'; access: { scope: { partnerId?: Id; advertiserId?: Id }; level: AccessLevel }[] }): Promise<Result<{ id: Id }>>
updateUser(input: { id: Id; name?: string } & WriteMeta): Promise<Result<null>>
setUserAccess(input: { id: Id; access: { scope: { partnerId?: Id; advertiserId?: Id }; level: AccessLevel }[] } & WriteMeta): Promise<Result<null>>
deleteUser(input: { id: Id }): Promise<Result<null>>
// GET|PUT /api/dv/me/email-preferences
saveEmailPreferences(input: { alerts: boolean; news: boolean }): Promise<Result<null>>
```

| Rule | ID | Text |
|---|---|---|
| Name and email required | USR-001 | `Enter a value` / `[SIM] Enter a valid email address.` |
| At least one access row (Save disabled) | USR-002 | `You can give users different roles for each advertiser or partner they have access to` |
| Each row has a role | USR-003 | `A selection is required` |
| Email unique in sandbox | USR-004 | `[SIM] A user with this email already exists.` |
| Cannot remove the last `ADMIN` of a partner | `USR-010` (proposed) | `[SIM] A partner needs at least one admin.` |
| Cannot change your own role to a lower one | `USR-011` (proposed) | `[SIM] You can't reduce your own access.` |
| Only `ADMIN` manages users | RT 2 | action returns `FORBIDDEN` toast |

Permission `ADM` for writes; `RO` view of the list. A simulated user cannot sign in (DELTA-02-2); a real classroom user listed by email gets the grant immediately (instructors only, Q7). Side effects: ChangeLog entityType `PARTNER` with entries "User added", "Role of {email} on {advertiser} changed from "Read only" to "Standard"". Effective permissions are computed from `RolePermission` (DM 5.1 matrix) in `assertAccess`; scenarios can override a student's level (RT 2).

### 4.10 Side effects summary

| Action | ChangeLog | BulkJob | Alerts |
|---|---|---|---|
| createAdvertiser | yes (advertiser, group of CREATE entries) | no | defaults created, none raised |
| setAdvertiserStatus | yes (`STATUS_CHANGE`) | no (single entity) | engine may raise/resolve NO_SPEND etc. |
| updatePartner, saveExchanges, saveTargetingDefaults, saveAdvertiserConfigurations | yes, entityType `PARTNER`, plus fan-out rows by `PARTNER_SETTING_UPDATER` on affected advertisers | no | none |
| createUser, setUserAccess, deleteUser | yes | no | none |
| saveEmailPreferences | no (user pref, same exemption as module 01 C-01-1) | no | none |
| SDF Upload (overflow item) | per module P4-10 | yes | none |

---

## 5. Engine hooks

| UI | Engine output | Reference |
|---|---|---|
| Advertisers list cards and columns (Impressions, Revenue, Budget at risk, Current budget, Underpacing / Total active) | `SimDailyMetric` totals for the date range; pacing snapshot (projected, `budgetAtRisk`, `underpacing`) per active IO | ENG 7.6, 9.4 |
| Pacing donut | share of active IOs not underpacing | ENG 7.6 |
| Exchanges panel | Disabling or enabling changes enabled supply cells and `T.INVENTORY_SOURCE` pass share | ENG 2.3, 3.1, DELTA-02-1 |
| Advertiser configurations | `GOOGLE_PARTNER_INVENTORY` gates YT / Demand Gen LI eligibility in validation, not in the engine. `ENHANCED_AUTOMATION`, `AUTO_TAGGING`, `ADVANCED_AD_SERVING`: no engine effect in v1 (C-02-7) | VAL MX-11 |
| Partner pause | Serving formula (parent not serving stops children) | VAL 4.0 |
| Brand controls | None (counts over targeting rows) | DM 7.1 |
| Users and roles | None | |

Freshness: list and summary call `engine.ensureCaughtUp(sandboxId)` before reading snapshots (ENG 1.6).

---

## 6. Acceptance criteria

1. AC-02-1 (E) Opening `[P]/advertisers` as a student shows both summary cards, the grid with the 8 columns and 4 header groups, the default chip "Status: Active", pager "Show rows: 20", and hides the paused advertiser.
2. AC-02-2 (E) Changing the status chip to include Paused and Scheduled for deletion shows those advertisers; the URL has `f.status` keys.
3. AC-02-3 (V) Summary donut percentages sum to 100 and match the sum of IO snapshots from fixtures; a SGD advertiser is converted with `FxRate`.
4. AC-02-4 (E) Clicking an advertiser name opens `[A]/cs` and the Advertiser crumb appears.
5. AC-02-5 (E) **Create advertiser** opens the form; empty Create shows `Enter a value` under Name and Website and focuses Name; invalid URL shows `[SIM] Enter a valid URL.`.
6. AC-02-6 (E) Creating an advertiser adds it to the list, creates 10 alert preference rows and a Floodlight group, and writes a ChangeLog group with `CREATE` entries visible on its History.
7. AC-02-7 (E) Currency and time zone are locked on Basic details after creation (padlock, no change accepted by the API, PRT-003).
8. AC-02-8 (E) For `READ_ONLY` role, **Create advertiser** is disabled, the Limited Access chip shows on every partner page, and Save is hidden on Basic details.
9. AC-02-9 (E) Basic details: Save is disabled until a change; after editing Name and Save, a toast "Saved" appears and History shows "Partner name" old to new.
10. AC-02-10 (V) `updatePartner` rejects `sdfVersion = "12"` with PRT-004 and an invalid admin email with PRT-005; unchecking accepted terms returns PRT-006.
11. AC-02-11 (E) Exchanges pencil opens the slide-over with an alphabetical list, a nested "App mediation partners (6 of 8)" group, and Google Ad Manager showing Network ID and Agency ID when ticked. Saving with an empty required ID shows `Enter a value`.
12. AC-02-12 (E) Unticking an exchange targeted by 2 line items shows the PRT-010 warning with count 2 and still saves; the count text "N Exchanges enabled" updates.
13. AC-02-13 (V) `saveExchanges` writes one ChangeEntry per added or removed exchange with the summary "1 ad exchange added" or "N ad exchanges removed".
14. AC-02-14 (E) After disabling an exchange and stepping the clock one sim day, the line item Troubleshooter funnel shows no requests for that exchange (ENG 3.5).
15. AC-02-15 (E) Targeting defaults page shows the Inventory source and Targeting rows with the exact default summaries from 02; the pencil opens the shared editor; changing Geography affects a newly created LI but not an existing one, while Apps & URLs affects both.
16. AC-02-16 (E) Advertiser configurations: Product improvement is read only while Enhanced automation is on; turning Enhanced automation off makes it editable; Select Advertisers with none chosen shows PRT-014.
17. AC-02-17 (V) With `GOOGLE_PARTNER_INVENTORY` off for advertiser A, `validateLiTypeAvailability('YT_VIDEO', A)` fails and for advertiser B passes.
18. AC-02-18 (E) Brand controls shows two tabs, one row per advertiser, four coverage bars with the percent and "(n/total Line items)", and switching to YouTube changes the counts.
19. AC-02-19 (V) Coverage predicates match fixtures: LI with advertiser-level locked brand suitability counts as covered; archived and paused LIs are excluded; total 0 gives 0%.
20. AC-02-20 (E) `/users` shows "Your profile" and the Users grid with columns Name, Email, Role, Partners, Advertisers, page size 100. Students can open it and cannot click New user (disabled) unless a scenario raises them to Admin.
21. AC-02-21 (E) As Admin, New user with name, email and two access rows with different roles saves; the Users grid shows "Standard, Read only" for that user.
22. AC-02-22 (E) New user: Save is disabled until at least one access row has a role; USR-002 text visible when empty; duplicate email shows USR-004.
23. AC-02-23 (V) Two sandboxes can both add `colleague@example.com` as simulated users without collision (DELTA-02-2).
24. AC-02-24 (V) Removing the last Admin returns USR-010; lowering your own role returns USR-011.
25. AC-02-25 (E) A `REPORTING_ONLY` user sees only Reports in the partner nav and gets the 404 page for Advertisers, Details and Users pages other than their own profile.
26. AC-02-26 (E) Email preferences saves both toggles and survives reload; no email is sent anywhere.
27. AC-02-27 (V) Every write action in this module creates a `ChangeGroup` with the actor, `source = UI`, and, when `changeNote` is passed, the note.
28. AC-02-28 (E) Two browser tabs editing the same partner: second Save shows the DLG-11 conflict dialog.

### 6.1 Playwright scenario outlines

| ID | Steps |
|---|---|
| PW-02-1 Advertisers | List render, cards, filters, segment by, create advertiser happy path and validation, read-only role |
| PW-02-2 Partner settings | Basic details edit, locked fields, SDF 9 note, data protection lock, conflict dialog |
| PW-02-3 Exchanges | Open panel, search, toggle, extra IDs, warning count, save, History row, engine effect after clock step |
| PW-02-4 Targeting defaults | Edit Geography default, create LI, assert default copied; edit Apps & URLs, assert live effect |
| PW-02-5 Advertiser configurations | Terms dialog, scope selection, read-only product improvement, LI type picker reacts |
| PW-02-6 Users | Create, edit, delete users, last-admin guard, role display, email uniqueness across sandboxes |
| PW-02-7 Roles | Repeat key pages for the 6 roles and assert chips, disabled buttons and 404 where required |

### 6.2 Vitest unit cases

| File | Cases |
|---|---|
| `lib/services/partner.test.ts` | PRT-001 to PRT-006 and PRT-011 to PRT-015 rule cases; diff to ChangeEntry labels |
| `lib/services/advertisers.test.ts` | Create defaults (alert prefs, Floodlight, flags scope), copy-from, cap, status transitions |
| `lib/services/exchanges.test.ts` | Enabled count, extra ID requirements, warning count, long_tail scaling math (DELTA-02-1) |
| `lib/services/brandControls.test.ts` | Four predicates over fixtures, tab split, zero totals |
| `lib/services/users.test.ts` | Role labels, multi-role display string, USR-001 to USR-004, USR-010, USR-011, simulated user email scope |
| `lib/permissions.test.ts` | `RolePermission` matrix (DM 5.1) per role for the actions of this module |
| `lib/services/advertiserSummary.test.ts` | Donut math, currency conversion, empty partner |

---

## 7. Build tasks

| # | Task | Size | Depends on |
|---|---|---|---|
| 02-T1 | Roles constants, `RolePermission` seed, `assertAccess` unit tests (feeds P3-02) | M | P3-01, P3-05 |
| 02-T2 | Seed: partner, exchanges (70), flags, 3 advertisers, users, rate cards, brand-control mix | M | P3-05 |
| 02-T3 | Advertisers list page: cards, grid, filters, segment by | L | P3-03, P3-04, P3-09 (metrics columns), ENG 7.6 snapshot |
| 02-T4 | Create advertiser form and `createAdvertiser` service | M | 02-T3, P3-05 |
| 02-T5 | Basic details page and `updatePartner` | M | P3-04, 02-T1 |
| 02-T6 | Exchanges slide-over, `saveExchanges`, engine supply hook (DELTA-02-1) | L | 02-T5, P3-08 |
| 02-T7 | Advertiser configurations page, tree select, terms dialogs | M | 02-T5 |
| 02-T8 | Targeting defaults page, mounting the shared targeting editors with `ownerType = PARTNER` and the copy-on-create hook | M | P3-07, P3-06 |
| 02-T9 | Brand controls page and coverage service | M | P3-07, 02-T2 |
| 02-T10 | Users list, New user, Edit user, simulated users (DELTA-02-2) | L | 02-T1, P3-04 |
| 02-T11 | Email preferences page and table | S | 02-T10 |
| 02-T12 | Partner nav landing rows (Channels, Custom bidding, Floodlight groups) with disabled New buttons for read-only roles | S | P3-03 |
| 02-T13 | Playwright suites PW-02-1 to PW-02-7 | M | all above |
| 02-T14 | (Deferred, flagged) Billing profiles and invoices pages | L | Q1 decision, P4-07 |

---

## 8. Open questions and conflicts

### 8.1 Open questions

| # | Question | Default used here |
|---|---|---|
| Q1 | Is Billing (profiles, invoices, partner costs and revenue models, listed in PROJECT.md 5.2) in v1? RT 3.2 says no route | Deferred (02-T14), data tables stay in the schema |
| Q2 | `industry` list and whether Create advertiser asks for it. Public docs vary; ENG 2.7 uses `verticalMultiplier` | Optional dropdown with 8 values: e-commerce, lead gen, travel, finance, auto, CPG, media, other |
| Q3 | Are emails (alerts, news) simulated anywhere? | No. Toggles stored only; Reports "email owner" lands in an in-app inbox (DM 5.14) |
| Q4 | Role dropdown order and labels | Admin, Standard, Read only, Reporting only, Partner client, Creative |
| Q5 | CM360 ad server option: what does it change in a simulator? | Shows an extra Floodlight config select; no behaviour |
| Q6 | In Brand controls, is the default `AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS` counted as "enabled"? | Yes only for `AUTHORIZED_DIRECT_SELLERS`; the default does not count (explore 11 shows a partial % in the demo) |
| Q7 | May students add real classroom users (a classmate) to their sandbox for pair work? | No. Instructor-only via the instructor console. `/users/new` creates simulated users |
| Q8 | What happens to a paused partner's banner and Overview? | Banner added at partner level (C-02-6) |
| Q9 | Does `Segment by Budget type` also change the donuts? | No, grid only |

### 8.2 Conflicts and gaps between specs

> Resolved: every conflict below is consolidated in [`../conflicts.md`](../conflicts.md) (crosswalk table, rows `RC-nnn`). Where a proposal here and the RC row differ, the RC row wins.

| # | Conflict | Where | Proposed resolution |
|---|---|---|---|
| C-02-1 | PROJECT.md 5.2 lists partner-level audiences, combined audiences, custom lists, location lists, negative keyword lists, inventory lists, billing, partner costs and revenue models, and partner reporting; RT 3.2 and the demo partner nav have none of them (RT Q21 only covers billing) | `PROJECT.md` 5.2 vs `routes.md` 3.2, 4.2 | Treat 5.2 as aspirational. Update PROJECT.md 5.2 or add routes in a later phase |
| C-02-2 | Who may pause an advertiser: RT 3.11 gives `[A]/details` write `ADM`, VAL 4.1 allows `ADMIN, STANDARD`, RT 8.2 `setAdvertiserStatus` is `STD`, DM 5.1 permission `partner.settings.write` is ADMIN only. Students are `STANDARD` (RT Q10) | `routes.md` 3.11, 8.2; `validation.md` 4.1; `data-model.md` 5.1 | Make `entity.write` on Advertiser details `STD` for status, name, website, SDF, authorizations, EU ads and Demand Gen switch (module 03 edits), keep Schedule for deletion and partner settings `ADM`. Change RT 3.11 to `RO / STD` |
| C-02-3 | `User.email` is unique across the platform (DM 5.1) but `/users/new` needs sandbox-local fake colleagues; USR-004 says unique "user with this email already exists" | `data-model.md` 5.1 vs `validation.md` USR-004 | DELTA-02-2 |
| C-02-4 | SDF version defaults: partner `V11`, advertiser `V9`, VAL 4.1 says new advertiser copies defaults from the partner | `data-model.md` 5.2, 5.3 vs `validation.md` 4.1, ADV-006 | Resolved RC-045: a new advertiser copies the partner `sdfVersion` (V11); `V9` only on the seeded demo advertisers; "Copy settings from" can override |
| C-02-5 | `industry` exists in DM 5.3 and ENG 2.7 but not in `AdvertiserDetails` (RT 8.14), not in VAL ADV rules, not in explore 14 | `data-model.md` 5.3, `engine.md` 2.7 vs `routes.md` 8.14 | DELTA-02-6; add to RT 8.14 and to the Create form only |
| C-02-6 | Partner `status` can be Paused (02, DM 5.2) but RT 4.5 has banners only for advertiser pause; VAL 4.1 covers advertiser only | `routes.md` 4.5; `validation.md` 4.1 | Add partner pause banner and state table; or lock partner status to Active |
| C-02-7 | VAL, ENG and RT define no behaviour for Enhanced automation, Auto-tagging, Advanced ad serving or Product improvement beyond PRT-009; ENG has no hook | `engine.md` 4.x vs `routes.md` 8.2 | No effect in v1; optionally `ENHANCED_AUTOMATION` could raise the learning-phase speed (ENG 4.3) in a later spec |
| C-02-8 | ENG models ~9 exchanges plus `long_tail` and `youtube`; DM `Exchange` has ~70 rows and `simSupplyShare` per exchange (sum 1) | `engine.md` 2.7 vs `data-model.md` 5.2 | DELTA-02-1 |
| C-02-9 | Brand controls coverage: partner page has 4 bars (02) and advertiser page 5 (adds Verification services, 11); DM 7.1 lists the compute but VAL and ENG have none | `explore` 02 vs 11; `data-model.md` 7.1 | Use 4 at partner level; module for P4-04 owns the 5-bar advertiser page and shares the service |
| C-02-10 | RT 3.1 gives `/users` view `RO`, but RT 2 says `STANDARD` sees "everything except user admin" | `routes.md` 2 vs 3.1 | Page visible to all signed-in roles but New user and edits disabled (see AC-02-20) |
| C-02-11 | VAL has no rules for Create advertiser, partner targeting defaults, brand controls or email preferences; IDs `ADV-021..023`, `PRT-011..015`, `USR-010`, `USR-011` in this file are proposals | `validation.md` 2.2, 2.3, 2.25 | Register them |
