# P2-02 - Route map, navigation, layouts and API map
Spec for: Next.js App Router app that mirrors DV360 navigation.
Status: draft 1 (2026-10-28). Inputs: `PROJECT.md`, `docs/PROJECT-LOG.md`, `docs/explore/01..18`.
Sibling specs written at the same time (not read, names only): `data-model.md` (P2-01), `design-system.md` (P2-03), `validation.md` (P2-04), `engine.md` (P2-05). DTO names in section 8 are wire types; reconcile with `data-model.md` when both land (Open question Q22).

How to read this file
- A mark `†` after a path or route means the path was **not recorded** in the demo (blocked, hidden, or SPA-internal). The route is inferred from DV360 naming patterns or chosen by us. All other paths come straight from an explore file.
- The simulator URL is the DV360 path **without** the `/ng_nav` prefix. They are identical unless a row says `≠`.
- Dynamic segment names: `[partnerId]`, `[advertiserId]`, `[campaignId]`, `[ioId]`, `[liId]`. In tables the DV360 form `{pid}` `{aid}` `{cid}` `{ioId}` `{liId}` is used for the same things.

Path aliases used in tables
| Alias | Meaning |
|---|---|
| `[P]` | `/p/{pid}` |
| `[A]` | `/p/{pid}/a/{aid}` |
| `[C]` | `[A]/c/{cid}` |
| `[IO]` | `[C]/io/{ioId}` |
| `[LI]` | `[IO]/li/{liId}` |
| `$P` `$A` `$C` `$IO` `$LI` | Same, as folders: `p/[partnerId]`, `p/[partnerId]/a/[advertiserId]`, `$A/c/[campaignId]`, `$C/io/[ioId]`, `$IO/li/[liId]` |

---

## 1. Decisions (short ADR list)

| # | Decision | Why |
|---|---|---|
| R1 | Drop the `/ng_nav` prefix. `/ng_nav/**` is accepted and 308-redirected to `/**`. | Teachers can paste a real DV360 URL and land on the same screen. Real DV360 is a SPA under `/ng_nav/`; we do not need the prefix. |
| R2 | Keep DV360 spelling for every segment, even odd ones (`home_v3`, `explorerios`, `explorerlis`, `fl/events`, `tid`, `location-extension`, `brand-lift-measurements`, `featured-v3`). | Fidelity rule (R2 in PROJECT.md). Students may compare URLs with the real product. |
| R3 | Tabs are **path segments** (`/explorerios`, `/details`, `/history`, `/troubleshooter`, `/adgroups`). The only exception is the deal page, which uses `?activeTab=` because DV360 does. | Matches DV360 and gives each tab its own `page.tsx` and its own loading state. |
| R4 | Everything simulator-only lives under `/sim/**` (pages) and `/api/sim/**` (API). Simulator-only query params start with `sim_`. DV360 paths never start with `sim`. | No collision with any current or future DV360 path. |
| R5 | Two physical route trees under one route group: `(app)` has the top bar, left nav, right rail. `(full)` has no top bar and no nav (full-screen forms, plan page, reports app). Both trees use the same URL prefix `p/[partnerId]/...`. | A parent layout cannot remove its own chrome, so full-screen pages must sit in a sibling tree. Cost: thin duplicate context layouts, solved with shared loaders. |
| R6 | Right-rail panels and dialogs are client state. Draft-bound slide-overs are client state inside the form draft. Entity slide-overs use `?sim_panel=`. The two A/B test panels use a parallel + intercepting route because DV360 gives them real URLs. See section 5.4. | Each surface gets the mechanism that matches its lifetime. |
| R7 | Reads for tables go through `GET /api/dv/**` route handlers. Form writes go through server actions that call the same service function. File up/download and polling use route handlers. | Tables need cacheable, refetchable URLs. Forms benefit from typed actions. One service layer keeps validation in one place. |
| R8 | Every page is dynamic (`export const dynamic = 'force-dynamic'`). No static caching of tenant data. `params` and `searchParams` are Promises (Next 15+), always `await` them. | Data is per student sandbox and changes with the simulated clock. |
| R9 | "Today" and "Yesterday" mean the **simulated** date of the user's class clock, in the advertiser time zone. Never the real date. | Engine spec (PROJECT.md 7.3): students must see sim spend for "yesterday". |
| R10 | Entity chain is always verified: `/p/1/a/2/c/3` is valid only if campaign 3 is in advertiser 2 which is in partner 1 and the user can see partner 1. Otherwise render the 404 page. | Stops ID guessing across sandboxes. |

---

## 2. Roles and access model

Two layers.

**Simulator role** (`User.role`, from Auth.js session): `student`, `instructor`, `admin`.
**DV360 access level** (per partner or advertiser, `UserAccess.level`): `ADMIN`, `STANDARD`, `READ_ONLY`, `REPORTING_ONLY`, plus `PARTNER_CLIENT` and `CREATIVE` (seen / documented, see Q11).

| Simulator role | Gets by default |
|---|---|
| student | `STANDARD` on their own sandbox partner (all advertisers in it). No `/sim/instructor/**`. Can open `/sim/scenarios`. |
| instructor | `ADMIN` on every sandbox partner of their classes. All `/sim/instructor/**`. Can use "view as student". |
| admin | Everything, plus `/sim/admin/**`. |

A scenario may override a student's access level on the sandbox (for example `READ_ONLY` to practise "why can I not edit?").

What each DV360 level can do

| Level | View | Write | UI effect |
|---|---|---|---|
| `ADMIN` | everything, incl. `/users` for their partners | everything, incl. users and partner settings | none |
| `STANDARD` | everything; `/users` opens read-only (New user and edits need `ADMIN`, RC-048) | create / edit / activate / pause / archive / bulk / SDF / reports | none |
| `READ_ONLY` | all pages except report building | nothing. Create buttons disabled, bulk edit items disabled, forms render read-only | grey "Limited Access" chip next to the page title (as seen in the demo) |
| `REPORTING_ONLY` | only reporting routes (`[P]/reporting/**`, cross-media reach) and `/bulk-status` of own jobs | create and run reports | left nav shows only Reports. Any other DV360 route renders the 404 page |
| `PARTNER_CLIENT` | like `READ_ONLY`, hides partner-level fee and cost columns | nothing | Limited Access chip (Q11) |
| `CREATIVE` | creatives routes plus read of parents | creatives only | (Q11) |

Access column in route tables is `view / write`.
View codes: `REP` (Reporting only and above), `RO` (Read only and above, excludes Reporting only), `STD`, `ADM`.
Write codes: `STD`, `ADM`, `-` (no write on this page).
Simulator pages use `ANY` (any signed in user), `STU`, `INS`, `ADMIN-SIM`, `PUBLIC`.
Rule of thumb: view check happens in the context layouts. Write check happens in the service layer for every action, so a hand-made POST cannot bypass the UI.

---

## 3. Route table

Frame codes in the "Frame" column (layouts are in section 5)
`G` global app shell with no left nav (top bar + right rail), `P` partner shell, `A` advertiser shell, `C` campaign shell, `IO` IO page frame (no left nav, "Overview" breadcrumb row + tabs), `LI` LI page frame, `F` full-screen form frame (X + title, no top bar), `R` reports frame (back arrow + "Reports"), `-` redirect only.
Each file entry below is a folder holding `page.tsx`. Tree root is `app/(dv)/(app)/` for frames `G P A C IO LI` and `app/(dv)/(full)/` for `F R`.

### 3.1 Global (no partner in the path)

| DV360 path | Simulator folder | Frame | Purpose | Level | Explore | Access |
|---|---|---|---|---|---|---|
| (DV360 product home) | `app/page.tsx` | - | Redirect: student to their sandbox `[P]/home_v3`, instructor to `/sim/instructor`, admin to `/sim/admin`. `≠` simulator-only entry | Global | 01 | ANY |
| `/bulk-status` | `(global)/bulk-status` | G | Bulk job history grouped by year and day, filter, auto refresh, "Show changes by all users" | Global | 01 | RO / - (all-users toggle: ADM) |
| `/users` | `(global)/users` | G (no left nav, back arrow) | Your profile table + Users table, filter, New user | Global | 02 | RO / ADM |
| `/users/new` | `(global)/users/new` | G (no left nav) | New user: name, email, type, access (select partners and advertisers slide-over), role per row | Global | 02 | ADM / ADM |
| `/users/{userId}` † | `(global)/users/[userId]` | G | Edit user and role assignments | Global | 02 | ADM / ADM |
| `/email-preferences` † | `(global)/email-preferences` | G | Top bar menu "Email preferences": Alerts, News, announcements and offers | Global | 02, 14 | ANY / ANY |
| `/ng_nav/404?url={path}` `≠` `/404?url={path}` | `404` | none (own page) | Full-page 404 (section 6.5) | Global | 17 | PUBLIC |

### 3.2 Partner level (frame P unless stated)

| DV360 path | Simulator folder | Frame | Purpose | Level | Explore | Access |
|---|---|---|---|---|---|---|
| `[P]` | `$P` (redirect in `page.tsx`) | - | Redirect to `home_v3` | Partner | 01 | RO |
| `[P]/home_v3` | `$P/(partner)/home_v3` | P | Partner Overview: workspaces, Pacing card, Rejected creatives, Underperforming IOs, tutorials, pinned items, recently opened | Partner | 01 | RO / - (workspaces are per-user prefs) |
| `[P]/advertisers` | `$P/(partner)/advertisers` | P | Advertisers list with Budget at risk and Pacing cards, Segment by, status filter, SDF upload | Partner | 02 | RO / STD |
| `[P]/advertisers/new` † | `$P/advertisers/new` | F | Create advertiser (form from public docs: name, website, currency, time zone, SDF, ad server) | Partner | 02 gap | STD / STD |
| `[P]/details` | `$P/(partner)/details` | P | Partner basic details, exchanges panel (client slide-over), SDF version, data protection | Partner | 02 | RO / ADM |
| `[P]/targeting` | `$P/(partner)/targeting` | P | Partner targeting defaults (inventory source, geography, environment, position, apps and URLs) | Partner | 02 | RO / ADM |
| `[P]/third-party-configuration` | `$P/(partner)/third-party-configuration` | P | Advertiser configurations (Enhanced automation, Google and partner inventory, instant deals, auto-tagging, advanced ad serving) | Partner | 02 | RO / ADM |
| `[P]/brand/controls` | `$P/(partner)/brand/controls` | P | Partner brand controls, tabs Display and video / YouTube (`?tab=youtube`) | Partner | 02 | RO / - |
| `[P]/channels` | `$P/(partner)/channels` | P | Partner channels list | Partner | 02, 11 | RO / STD |
| `[P]/custom-bidding` | `$P/(partner)/custom-bidding` | P | Partner custom bidding algorithms | Partner | 02, 11 | RO / STD |
| `[P]/custom-bidding/new` † | `$P/custom-bidding/new` | F | New algorithm wizard (partner owner) | Partner | 11 | STD / STD |
| `[P]/floodlights` | `$P/(partner)/floodlights` | P | Partner Floodlight groups | Partner | 02, 11 | RO / STD |
| `[P]/cross-media-reach` | `$P/(partner)/cross-media-reach` | P | Cross-media reach reports list (empty state "Welcome to Cross-media reach!") | Partner | 02, 13 | REP / STD |
| `[P]/cross-media-reach/new` † | `$P/cross-media-reach/new` | F | Create a report (progressive form) | Partner | 13 | REP / STD |
| `[P]/cross-media-reach/{reportId}` † | `$P/cross-media-reach/[reportId]` | F | Cross-media reach report detail (RC-052, module 04) | Partner | 13 | REP / STD |
| (billing, invoices, partner costs) | not routed | - | Hidden in demo (Limited Access). No nav entry, no route (Q21) | Partner | 02 | - |

### 3.3 Advertiser level (frame A)

| DV360 path | Simulator folder | Frame | Purpose | Level | Explore | Access |
|---|---|---|---|---|---|---|
| `[A]` | `$A` (redirect) | - | Redirect to `cs` | Advertiser | 01 | RO |
| `[A]/cs` | `$A/(advertiser)/cs` | A | Campaigns list (tab Campaigns), alerts, status, KPI columns, bulk Action bar, SDF menu | Advertiser | 03 | RO / STD |
| `[A]/cs/new` | `$A/cs/new` | F | New campaign form (goal, KPI, budgets, frequency cap, details) | Advertiser | 03 | STD / STD |
| `[A]/explorerios` | `$A/(advertiser)/explorerios` | A | Insertion orders across the advertiser (tab on Campaigns page). No "New insertion order" button here | Advertiser | 04 | RO / STD |
| `[A]/explorerlis` † | `$A/(advertiser)/explorerlis` | A | Line items across advertiser. Reached from IO list menu: Archived > Line items (`?f.status=ARCHIVED`) | Advertiser | 04 | RO / STD |
| `[A]/history` | `$A/(advertiser)/history` | A | Advertiser change history (spend chart, day cards) | Advertiser | 16 | RO / - |
| `[A]/templates` | `$A/(advertiser)/templates` | A | Targeting templates list | Advertiser | 15 | RO / STD |
| `[A]/templates/new` | `$A/templates/new` | F | New template: step 1 type cards, step 2 form (`?type=display`) | Advertiser | 15 | STD / STD |
| `[A]/templates/{templateId}` † | `$A/templates/[templateId]` | F | Edit template | Advertiser | 15 | STD / STD |
| `[A]/experiments` | `$A/(advertiser)/experiments` | A | Experiments, tab A/B tests | Advertiser | 18 | RO / STD |
| `[A]/experiments/new` | `$A/experiments/new` | F | Create A/B test | Advertiser | 18 | STD / STD |
| `[A]/e/{testId}` | `$A/e/[testId]` | F | A/B test report. Has `@panel` slot (section 5.4) | Advertiser | 18 | RO / STD |
| `[A]/e/{testId}/report/settings` | `$A/e/[testId]/report/settings` | F | A/B settings (panel when soft navigated, full page when opened directly) | Advertiser | 18 | RO / STD |
| `[A]/e/{testId}/report/diff` | `$A/e/[testId]/report/diff` | F | A/B differences (same panel behaviour) | Advertiser | 18 | RO / - |
| `[A]/brand-lift-measurements` | `$A/(advertiser)/brand-lift-measurements` | A | Experiments, tab Lift studies | Advertiser | 15, 18 | RO / STD |
| `[A]/brand-lift-measurements/new` | `$A/brand-lift-measurements/new` | F | New lift study (eligibility rail) | Advertiser | 15, 18 | STD / STD |
| `[A]/brand-lift-measurements/{studyId}/report` | `$A/brand-lift-measurements/[studyId]/report` | F | Brand lift report (back arrow "Brand Lift Report") | Advertiser | 18 | RO / - |
| `[A]/brand-lift-measurements/{studyId}/edit` | `$A/brand-lift-measurements/[studyId]/edit` | F | Review and fix | Advertiser | 18 | STD / STD |

### 3.4 Campaign level (frame C)

| DV360 path | Simulator folder | Frame | Purpose | Level | Explore | Access |
|---|---|---|---|---|---|---|
| `[C]` | `$C` (redirect) | - | Redirect to the user's pinned tab (default `explorerios`) | Campaign | 03 | RO |
| `[C]/explorerios` | `$C/(campaign)/explorerios` | C | Campaign page, tab Insertion orders: chart strip, "New Insertion Order", column views, bulk Action bar | Campaign | 03, 04 | RO / STD |
| `[C]/explorerlis` † | `$C/(campaign)/explorerlis` | C | Campaign page, tab Line items | Campaign | 03 | RO / STD |
| `[C]/explorercombined` † | `$C/(campaign)/explorercombined` | C | Campaign page, tab Combined | Campaign | 03 | RO / STD |
| `[C]/details` | `$C/(campaign)/details` | C | Campaign settings (same form as New campaign, start date locked once started) | Campaign | 03 | RO / STD |
| `[C]/alerts` | `$C/(campaign)/alerts` | C | Campaign alerts: Critical / Needs attention, filters | Campaign | 03 | RO / - |
| `[C]/history` † | `$C/(campaign)/history` | C | Campaign change history | Campaign | 03, 16 | RO / - |
| `[C]/marketplace/inventory` † | `$C/(campaign)/marketplace/inventory` | C | Campaign "My inventory" (same page component as advertiser, campaign scope) | Campaign | 09 | RO / STD |
| `[C]/marketplace/inventory/package` † | `$C/(campaign)/marketplace/inventory/package` | C | Packages tab, campaign scope | Campaign | 09 | RO / STD |
| `[C]/marketplace/inventory/groups` † | `$C/(campaign)/marketplace/inventory/groups` | C | Deal groups tab, campaign scope | Campaign | 09 | RO / STD |
| `[C]/tid/{tid}/marketplace/inventory/details` † | `$C/(campaign)/tid/[tid]/marketplace/inventory/details` | C | Deal page, campaign scope | Campaign | 09 | RO / STD |
| `[C]/marketplace/featured-v3` † | `$C/(campaign)/marketplace/featured-v3` | C | Marketplace Featured, campaign scope | Campaign | 09 | RO / STD |
| `[C]/marketplace-discovery` † | `$C/(campaign)/marketplace-discovery` | C | Marketplace Discover, campaign scope | Campaign | 09 | RO / STD |
| `[C]/marketplace/negotiations` † | `$C/(campaign)/marketplace/negotiations` | C | Negotiations, campaign scope | Campaign | 09 | RO / STD |
| `[C]/ios/new` | `$C/ios/new` | F | New insertion order: step 1 type + objective, step 2 settings (`?type=&objective=`) | Campaign | 04 | STD / STD |

### 3.5 Insertion order level (frame IO)

| DV360 path | Simulator folder | Frame | Purpose | Level | Explore | Access |
|---|---|---|---|---|---|---|
| `[IO]` | `$IO` (redirect) | - | Redirect to `explorerlis` | IO | 04 | RO |
| `[IO]/explorerlis` | `$IO/explorerlis` | IO | IO page, tab Line items: chart strip, "New line item", grid "{Type} line items" | IO | 04, 05 | RO / STD |
| `[IO]/details` | `$IO/details` | IO | Tab Insertion order details (step 2 form, objective editable, Save / Reset / change note) | IO | 04 | RO / STD |
| `[IO]/history` | `$IO/history` | IO | Tab History | IO | 04, 16 | RO / - |
| `[IO]/lis/new` | `$IO/lis/new` | F | New line item: type picker, then type form. `?type=DISPLAY` selects the form (`?step`-less) | IO | 05, 06 | STD / STD |

### 3.6 Line item and ad group level (frame LI)

| DV360 path | Simulator folder | Frame | Purpose | Level | Explore | Access |
|---|---|---|---|---|---|---|
| `[LI]` | `$LI` (redirect) | - | YouTube / Demand Gen types go to `adgroups`, all others to `details` | LI | 06 | RO |
| `[LI]/details` | `$LI/details` | LI | Line item details (same form as create, prefilled; Save / Reset / change note) | LI | 05, 06 | RO / STD |
| `[LI]/troubleshooter` | `$LI/troubleshooter` | LI | Delivery funnel with filter reasons | LI | 05 | RO / - |
| `[LI]/history` | `$LI/history` | LI | LI change history | LI | 05, 16 | RO / - |
| `[LI]/adgroups` | `$LI/adgroups` | LI | YouTube LI tab Ad groups (first tab). Create ad group and create ad are slide-overs (`?sim_panel=adgroup:new`, `?sim_panel=ad:new&adgroup={id}`) | Ad group | 06 | RO / STD |

Tabs shown by LI type: YouTube video/audio: Ad groups, Line item details, Troubleshooter, History. Others: Line item details, Troubleshooter, History.

### 3.7 Creatives (frame A, creative page and forms F)

| DV360 path | Simulator folder | Frame | Purpose | Level | Explore | Access |
|---|---|---|---|---|---|---|
| `[A]/creatives` | `$A/(advertiser)/creatives` | A | Creatives library, New menu, list / grid toggle | Advertiser | 08 | RO / STD |
| `[A]/creatives/new?type={n}&hostingSrc={n}` | `$A/creatives/new` | F | New creative. Third-party display = `type=0&hostingSrc=1`. Other codes: Q7. Simulator also accepts `?kind=third-party-display` and friends | Advertiser | 08 | STD / STD |
| `[A]/creatives/{creativeId}` | `$A/creatives/[creativeId]` | F | Creative page, tab Creative details | Advertiser | 08, 17 | RO / STD |
| `[A]/creatives/{creativeId}/status` † | `$A/creatives/[creativeId]/status` | F | Tab Creative status (DV360 review, exchange review, LIs, eligibility) | Advertiser | 08 | RO / - |
| `[A]/creatives/{creativeId}/history` † | `$A/creatives/[creativeId]/history` | F | Tab History (filterable table, not day cards) | Advertiser | 17 | RO / - |
| `[A]/formats` | `$A/(advertiser)/formats` | A | Format gallery | Advertiser | 08 | RO / STD |
| `[A]/appeals-history` | `$A/(advertiser)/appeals-history` | A | Appeal history table | Advertiser | 08 | RO / - |

### 3.8 Audiences (frame A, forms F)

| DV360 path | Simulator folder | Frame | Purpose | Level | Explore | Access |
|---|---|---|---|---|---|---|
| `[A]/first-party-audiences` | `$A/(advertiser)/first-party-audiences` | A | All audiences, tab First-party (default) | Advertiser | 10 | RO / STD |
| `[A]/custom-lists` | `$A/(advertiser)/custom-lists` | A | Tab Custom lists | Advertiser | 10 | RO / STD |
| `[A]/combined-audiences` | `$A/(advertiser)/combined-audiences` | A | Tab Combined | Advertiser | 10 | RO / STD |
| `[A]/partner-audiences` | `$A/(advertiser)/partner-audiences` | A | Tab Partner | Advertiser | 10 | RO / - |
| `[A]/audience/new` | `$A/audience/new` | F | New audience type picker | Advertiser | 10 | STD / STD |
| `[A]/audience/tagbased/new` | `$A/audience/tagbased/new` | F | Tag-based audience | Advertiser | 10 | STD / STD |
| `[A]/audience/customermatch/new` | `$A/audience/customermatch/new` | F | Customer match (choose data source) | Advertiser | 10 | STD / STD |
| `[A]/audience/youtubeusers/new` † | `$A/audience/youtubeusers/new` | F | YouTube users audience | Advertiser | 10 gap | STD / STD |
| `[A]/combinedaudience/new` | `$A/combinedaudience/new` | F | Combined audience | Advertiser | 10 | STD / STD |
| `[A]/audience/lookalike/new` | `$A/audience/lookalike/new` | F | Lookalike audience | Advertiser | 10 | STD / STD |
| `[A]/customaudience/affinity/new` | `$A/customaudience/affinity/new` | F | Custom affinity list | Advertiser | 10 | STD / STD |
| `[A]/customaudience/intent/new` † | `$A/customaudience/intent/new` | F | Custom intent list (`?surface=display` or `youtube`) | Advertiser | 10 gap | STD / STD |
| `[A]/audience/tagbased/{audienceId}/details` | `$A/(advertiser)/audience/tagbased/[audienceId]/details` | A | Audience details (tabs Audience details, Line items) | Advertiser | 17 | RO / STD |
| `[A]/audience/{audienceId}/explorerlis` | `$A/(advertiser)/audience/[audienceId]/explorerlis` | A | LIs targeting this list (standard LI grid) | Advertiser | 17 | RO / STD |
| `[A]/audience/{kind}/{audienceId}/details` † | `$A/(advertiser)/audience/[kind]/[audienceId]/details` | A | Details for other kinds (lookalike, customermatch, ...) | Advertiser | 17 | RO / STD |
| `[A]/audience-analysis` | `$A/(advertiser)/audience-analysis` | A | Analysis hub | Advertiser | 10 | RO / - |
| `[A]/audience-geo-distribution` | `$A/(advertiser)/audience-geo-distribution` | A | Geographic distribution | Advertiser | 10 | RO / - |
| `[A]/audience-composition-insights` | `$A/(advertiser)/audience-composition-insights` | A | Audience insights | Advertiser | 10 | RO / - |

`/a/{aid}/audiences` and `/a/{aid}/reporting` are **not valid** in DV360 (17). They must render the 404 page.

### 3.9 Inventory, Marketplace, Planning (frame A, plan page F)

| DV360 path | Simulator folder | Frame | Purpose | Level | Explore | Access |
|---|---|---|---|---|---|---|
| `[A]/marketplace/inventory` | `$A/(advertiser)/marketplace/inventory` | A | My inventory, tab Orders and deals | Advertiser | 09 | RO / STD |
| `[A]/marketplace/inventory/package` | `$A/(advertiser)/marketplace/inventory/package` | A | Tab Packages | Advertiser | 09 | RO / STD |
| `[A]/marketplace/inventory/groups` | `$A/(advertiser)/marketplace/inventory/groups` | A | Tab Deal groups (New group slide-over `?sim_panel=group:new`) | Advertiser | 09 | RO / STD |
| `[A]/tid/{tid}/marketplace/inventory/details?activeTab=` | `$A/(advertiser)/tid/[tid]/marketplace/inventory/details` | A | Deal page. `activeTab` = `overviewTab`, `accessTab`, `settingsTab`, `historyTab` (only `accessTab` was recorded) | Advertiser | 09 | RO / STD |
| `[A]/marketplace/inventory/instant-deal/new` † | `$A/marketplace/inventory/instant-deal/new` | F | "New instant deal": seller cards, targeting, advertiser access, forecast | Advertiser | 09 | STD / STD |
| `[A]/marketplace/featured-v2` | `$A/marketplace/featured-v2` (redirect) | - | Redirect to `featured-v3` (DV360 does the same) | Advertiser | 09 | RO |
| `[A]/marketplace/featured-v3` | `$A/(advertiser)/marketplace/featured-v3` | A | Marketplace, tab Featured | Advertiser | 09 | RO / STD |
| `[A]/marketplace-discovery` | `$A/(advertiser)/marketplace-discovery` | A | Marketplace, tab Discover. Item detail slide-over `?sim_panel=item:{id}` | Advertiser | 09 | RO / STD |
| `[A]/marketplace/plans` | `$A/(advertiser)/marketplace/plans` | A | Plans list. "New plan" creates an untitled plan and redirects to the plan page | Advertiser | 09, 13 | RO / STD |
| `[A]/pr/{planId}/marketplace/plan` | `$A/pr/[planId]/marketplace/plan` | F | "Adjust your plan and view forecast" (full screen, X close) | Advertiser | 13 | RO / STD |
| `[A]/marketplace/negotiations` | `$A/(advertiser)/marketplace/negotiations` | A | Negotiations list, Import negotiation | Advertiser | 09 | RO / STD |
| `[A]/cross-media-reach` | `$A/(advertiser)/cross-media-reach` | A | Cross-media reach reports (advertiser scope) | Advertiser | 13 | REP / STD |
| `[A]/cross-media-reach/new` | `$A/cross-media-reach/new` | F | Create a report | Advertiser | 13 | REP / STD |
| `[A]/cross-media-reach/{reportId}` † | `$A/cross-media-reach/[reportId]` | F | Cross-media reach report detail (RC-052, module 04) | Advertiser | 13 | REP / STD |

### 3.10 Resources (frame A, forms F)

| DV360 path | Simulator folder | Frame | Purpose | Level | Explore | Access |
|---|---|---|---|---|---|---|
| `[A]/brand/controls` | `$A/(advertiser)/brand/controls` | A | Brand controls "Settings overview" (`?tab=youtube`) | Advertiser | 11 | RO / - |
| `[A]/channels` | `$A/(advertiser)/channels` | A | Channels & keywords, tab Channels. Channel editor: `?sim_panel=channel:{id}` | Advertiser | 11, 17 | RO / STD |
| `[A]/negative-keywords` | `$A/(advertiser)/negative-keywords` | A | Tab Negative keyword lists. Editor is inline: `?list={id}` | Advertiser | 11, 17 | RO / STD |
| `[A]/fl/events` | `$A/(advertiser)/fl/events` | A | Floodlight group, tab Floodlight conversions | Advertiser | 11 | RO / STD |
| `[A]/fl/events/new` | `$A/fl/events/new` | F | New Floodlight conversion (`?type=web`, `app`, `ctv`) | Advertiser | 11 | STD / STD |
| `[A]/fl/events/{eventId}` † | `$A/fl/events/[eventId]` | F | Edit conversion | Advertiser | 11 | RO / STD |
| `[A]/fl/details` | `$A/(advertiser)/fl/details` | A | Tab Basic details | Advertiser | 11 | RO / STD |
| `[A]/fl/google-tag` | `$A/(advertiser)/fl/google-tag` | A | Tab Google tag (read-only mode) | Advertiser | 17 | RO / - |
| `[A]/fl/history` † | `$A/(advertiser)/fl/history` | A | Tab History | Advertiser | 11 | RO / - |
| `[A]/location-extension` | `$A/(advertiser)/location-extension` | A | YouTube assets (tabs Location, Affiliate location, Sitelink: `?tab=`) | Advertiser | 11 | RO / STD |
| `[A]/creator-partnerships-hub/discover` | `$A/(advertiser)/creator-partnerships-hub/discover` | A | YouTube creator partnerships (BETA; tabs Overview, Creator search, Content discovery, Management, Analytics as sub-paths †) | Advertiser | 11 | RO / STD |
| `[A]/location-lists-v2` | `$A/(advertiser)/location-lists-v2` | A | Location lists | Advertiser | 11 | RO / STD |
| `[A]/ll/new` | `$A/ll/new` | F | New location list | Advertiser | 11 | STD / STD |
| `[A]/ll/{listId}` † | `$A/ll/[listId]` | F | Edit location list | Advertiser | 11 | RO / STD |
| `[A]/custom-bidding` | `$A/(advertiser)/custom-bidding` | A | Custom bidding list | Advertiser | 11 | RO / STD |
| `[A]/custom-bidding/new` | `$A/custom-bidding/new` | F | Wizard 1 Set up, 2 Test, 3 Save (`?step=setup`, `test`, `save` †) | Advertiser | 11 | STD / STD |
| `[A]/custom-bidding/{algorithmId}` † | `$A/custom-bidding/[algorithmId]` | F | Edit / view algorithm | Advertiser | 11 | RO / STD |

### 3.11 Advertiser settings (frame A)

| DV360 path | Simulator folder | Frame | Purpose | Level | Explore | Access |
|---|---|---|---|---|---|---|
| `[A]/details` | `$A/(advertiser)/details` | A | Basic details (identity, SDF, ad server panel, authorizations, EU political ads, YouTube / Demand Gen, additional settings, Schedule for deletion) | Advertiser | 14 | RO / STD |
| `[A]/targeting` | `$A/(advertiser)/targeting` | A | Targeting rules (locked summary) | Advertiser | 14 | RO / ADM |
| `[A]/data-manager` | `$A/(advertiser)/data-manager` | A | Data manager, tab Connected products | Advertiser | 14 | RO / ADM |
| `[A]/linked-accounts` | `$A/(advertiser)/linked-accounts` | A | Data manager, tab Linked accounts | Advertiser | 14 | RO / ADM |
| `[A]/alert-config` | `$A/(advertiser)/alert-config` | A | Alert preferences (10 toggles, underpacing threshold, spend threshold) | Advertiser | 14 | RO / STD |
| `[A]/policy-center` | `$A/(advertiser)/policy-center` | A | Policy center certificates | Advertiser | 14 | RO / STD |

> Resolved RC-047: write on `[A]/details` is `STD` for name, status, website, SDF version, authorizations, EU political ads and the Demand Gen switch. "Schedule for deletion" and partner settings stay `ADM`.

### 3.12 Reporting app (frame R)

DV360 serves this as a same-origin SPA at `/reporting/` inside an iframe. Only the hub URL was recorded. The sub-paths below are our choice.

| DV360 path | Simulator folder | Frame | Purpose | Level | Explore | Access |
|---|---|---|---|---|---|---|
| `[P]/reporting` | `$P/reporting` | R | Reports hub, tabs via `?tab=instant` (default) or `offline`. Generate report (BETA), suggested templates, report list | Partner | 12, 17 | REP / STD |
| `[P]/reporting/instant/new` † | `$P/reporting/instant/new` | R | Instant report builder, untitled. `?template={key}` opens a template | Partner | 12 | REP / STD |
| `[P]/reporting/instant/{reportId}` † | `$P/reporting/instant/[reportId]` | R | Instant report builder, saved report | Partner | 12 | REP / STD |
| `[P]/reporting/{kind}/{reportId}/runs` † | `$P/reporting/[kind]/[reportId]/runs` | R | Report runs list ("Files > View"): file id, date range, creator, completion time, CSV / Excel. `kind` = `instant` or `offline` | Partner | 17 | REP / STD |
| `[P]/reporting/offline/new?type=` † | `$P/reporting/offline/new` | R | Offline builder. `type` = `floodlight` or `inventory-availability` | Partner | 12 | REP / STD |
| `[P]/reporting/offline/{reportId}` † | `$P/reporting/offline/[reportId]` | R | Offline builder, saved report | Partner | 12 | REP / STD |

The advertiser nav item Reports > Instant & offline links to `[P]/reporting?sim_aid={aid}`. The query param only pre-fills the "Advertiser includes" filter chip (simulator convenience, real DV360 has no advertiser-scoped reporting URL).

### 3.13 History (shared component, mounted at four levels)

`[A]/history`, `[C]/history`, `[IO]/history`, `[LI]/history` use one `HistoryPage` component. The entity is read from params. Creative history is a different component (table, section 3.7).

---

## 4. Navigation

Icon names are Material Symbols suggestions. The design system spec (P2-03) owns the final choice.

### 4.1 Top bar (all frames `G P A C IO LI`)

Left to right.

| # | Element | Action / href | Notes |
|---|---|---|---|
| 1 | Hamburger | Toggle `navCollapsed` (labelled nav <-> icon-only rail), stored in `localStorage` key `sim.nav.collapsed` | Hidden on frames with no left nav (`G`, `IO`, `LI`) |
| 2 | Logo + "DV360 Simulator by Adsmetor" | `/` | Static text. No Google marks (R1) |
| 3 | Home icon | `[P]/home_v3` of the current partner. With no partner, `/` | |
| 4 | Breadcrumb | See 4.5 | Two-line crumbs: small label ("Partner", "Advertiser", "Campaign") over the name |
| 5 | (spacer) | | |
| 6 | Search (tooltip "Search (/)") | Opens centred overlay (client state). Suggestion chips are saved filter links. Submit calls `POST /api/dv/advertisers/{aid}/search` | Advertiser-scope pages only. On partner pages shows partner search over advertisers |
| 7 | Sim clock chip `≠` | Shows simulated date and time, speed, pause state. Click opens a read-only popover (students) | Simulator-only. Hidden when the instructor disables it for the class |
| 8 | Notifications bell (badge dot) | Dropdown card list. "Learn more" opens the linked page. "Dismiss" calls `dismissNotification` | Content is instructor-authored announcements (16) |
| 9 | User management and email preferences (person-list icon) | Menu: User management > `/users`; Email preferences: Alerts, News, announcements and offers > `/email-preferences` | |
| 10 | Bulk status (checklist icon) | `/bulk-status` | |
| 11 | Reports (bar chart icon) | Advertiser pages: `[P]/reporting?sim_aid={aid}`. Partner pages: `[P]/reporting` | |
| 12 | Keyboard shortcuts (?) | Opens shortcuts dialog (client state) | Same as pressing `?` |
| 13 | Product switcher (grid icon) | Adsmetor product menu: Platform home (`/`), DV360 Simulator, Exercises (`/sim/scenarios`), Instructor console (`/sim/instructor`, instructors), Admin (`/sim/admin`, admins) | Replaces Google product list |
| 14 | Avatar | Adsmetor user menu: name, role, "Switch to student view" (instructor, sets `sim_as`), Sign out | Replaces Google account menu |

### 4.2 Left navigation, partner level (frame `P`)

Default active item: **Overview**. Dividers after Advertisers and after Reports.

| Order | Label | Type | Href | Active when path starts with |
|---|---|---|---|---|
| 1 | Overview | leaf | `[P]/home_v3` | `/home_v3` |
| 2 | Advertisers | leaf | `[P]/advertisers` | `/advertisers` |
| | (divider) | | | |
| 3 | Reports | group | caret only | |
| 3.1 | Instant & offline | leaf | `[P]/reporting` | (opens frame R) |
| 3.2 | Cross-media reach | leaf | `[P]/cross-media-reach` | `/cross-media-reach` |
| | (divider) | | | |
| 4 | Resources | group | caret only | |
| 4.1 | Brand controls | leaf | `[P]/brand/controls` | `/brand/controls` |
| 4.2 | Channels | leaf | `[P]/channels` | `/channels` |
| 4.3 | Custom bidding | leaf | `[P]/custom-bidding` | `/custom-bidding` |
| 4.4 | Floodlight groups (blue dot) | leaf | `[P]/floodlights` | `/floodlights` |
| 5 | Partner settings | group | caret only | |
| 5.1 | Basic details | leaf | `[P]/details` | `/details` |
| 5.2 | Targeting | leaf | `[P]/targeting` | `/targeting` |
| 5.3 | Advertiser configurations | leaf | `[P]/third-party-configuration` | `/third-party-configuration` |

### 4.3 Left navigation, advertiser level (frame `A`)

Default active item on landing (`[A]` redirects to `cs`): **Campaigns**. Divider after Reports.

| Order | Label | Type | Href | Active when path starts with |
|---|---|---|---|---|
| 1 | Campaigns | leaf | `[A]/cs` | `/cs`, `/explorerios`, `/explorerlis` |
| 2 | Audiences | group | | |
| 2.1 | All audiences | leaf | `[A]/first-party-audiences` | `/first-party-audiences`, `/custom-lists`, `/combined-audiences`, `/partner-audiences`, `/audience/` |
| 2.2 | Analysis | leaf | `[A]/audience-analysis` | `/audience-analysis`, `/audience-geo-distribution`, `/audience-composition-insights` |
| 3 | Creative | group | | |
| 3.1 | Creatives | leaf | `[A]/creatives` | `/creatives` |
| 3.2 | Format gallery | leaf | `[A]/formats` | `/formats` |
| 3.3 | Appeals history | leaf | `[A]/appeals-history` | `/appeals-history` |
| 4 | Inventory | group | | |
| 4.1 | Plans | leaf | `[A]/marketplace/plans` | `/marketplace/plans` |
| 4.2 | My inventory | leaf | `[A]/marketplace/inventory` | `/marketplace/inventory`, `/tid/` |
| 4.3 | Marketplace | leaf | `[A]/marketplace/featured-v3` | `/marketplace/featured`, `/marketplace-discovery` |
| 4.4 | Negotiations | leaf | `[A]/marketplace/negotiations` | `/marketplace/negotiations` |
| 5 | Reports | group | | |
| 5.1 | Instant & offline | leaf | `[P]/reporting?sim_aid={aid}` | (opens frame R) |
| 5.2 | Cross-media reach | leaf | `[A]/cross-media-reach` | `/cross-media-reach` |
| | (divider) | | | |
| 6 | Experiments | leaf | `[A]/experiments` | `/experiments`, `/e/`, `/brand-lift-measurements` |
| 7 | Targeting templates | leaf | `[A]/templates` | `/templates` |
| 8 | Resources | group | | |
| 8.1 | Brand controls | leaf | `[A]/brand/controls` | `/brand/controls` |
| 8.2 | Channels & keywords | leaf | `[A]/channels` | `/channels`, `/negative-keywords` |
| 8.3 | Floodlight group (blue "new" dot) | leaf | `[A]/fl/events` | `/fl/` |
| 8.4 | YouTube assets | leaf | `[A]/location-extension` | `/location-extension` |
| 8.5 | YouTube creator partnerships | leaf | `[A]/creator-partnerships-hub/discover` | `/creator-partnerships-hub` |
| 8.6 | Location lists | leaf | `[A]/location-lists-v2` | `/location-lists-v2`, `/ll/` |
| 8.7 | Custom bidding | leaf | `[A]/custom-bidding` | `/custom-bidding` |
| 9 | Advertiser settings | group | | |
| 9.1 | Basic details | leaf | `[A]/details` | `/details` |
| 9.2 | Targeting rules | leaf | `[A]/targeting` | `/targeting` |
| 9.3 | Data manager (Linked accounts) - two-line label | leaf | `[A]/data-manager` | `/data-manager`, `/linked-accounts` |
| 9.4 | Alert preferences | leaf | `[A]/alert-config` | `/alert-config` |
| 9.5 | Policy center | leaf | `[A]/policy-center` | `/policy-center` |
| 10 | History | leaf | `[A]/history` | `/history` |

### 4.4 Left navigation, campaign level (frame `C`) and IO / LI level

Campaign scope has its own nav (03). Default active item: **Campaign**.

| Order | Label | Type | Href | Active when |
|---|---|---|---|---|
| 1 | Campaign | leaf | `[C]` (redirects to pinned tab) | `/explorerios`, `/explorerlis`, `/explorercombined` |
| 2 | Inventory | group | | |
| 2.1 | My inventory | leaf | `[C]/marketplace/inventory` † | `/marketplace/inventory`, `/tid/` |
| 2.2 | Marketplace | leaf | `[C]/marketplace/featured-v3` † | `/marketplace/featured`, `/marketplace-discovery` |
| 2.3 | Negotiations | leaf | `[C]/marketplace/negotiations` † | `/marketplace/negotiations` |
| 3 | Campaign settings | leaf | `[C]/details` | `/details` |
| 4 | Alerts ("NEW" badge) | leaf | `[C]/alerts` | `/alerts` |
| 5 | History | leaf | `[C]/history` † | `/history` |

**IO and LI pages have no left nav.** They use the full width. Navigation there is:
- IO page: breadcrumb row "Overview >" (link to `[C]`) then the IO name as title, tabs Line items / Insertion order details / History.
- LI page: breadcrumb row "Overview > {IO name} >" ("Overview" goes to `[C]`, the IO name goes to `[IO]`), LI name as title, tabs from section 3.6.
- Full-screen forms (`F`) and the reports app (`R`) have no nav either; they have their own header (X + title, or back arrow + "Reports").

### 4.5 Expand behaviour, active state, breadcrumb

Expand behaviour
1. Click on a group header toggles its caret and its children. It does not navigate.
2. Leaf click navigates. The active leaf is a filled blue pill.
3. On load, the group that contains the active leaf is open. Other groups keep the state the user left them in (persisted in `localStorage` key `sim.nav.open.{level}`). First visit: only the active group is open (Q4).
4. Collapsed rail (hamburger): icons only. Groups open as a flyout with their children on click.
5. Navigating inside one level does not remount the nav (layout state survives). Moving between levels (partner to advertiser to campaign) swaps the tree.
6. Items are hidden by access level. `REPORTING_ONLY` sees only the Reports group.

Breadcrumb rules (top bar, item 4)
1. Partner crumb is always present: label "Partner" over the partner name. Links to `[P]/home_v3`.
2. Advertiser crumb appears on every page under `[A]`: label "Advertiser". Links to `[A]/cs`.
3. Campaign crumb appears under `[C]`: label "Campaign", text "Campaign {name}". Links to `[C]`.
4. The top bar stops at campaign level. IO and LI context lives in the page breadcrumb row (4.4).
5. Names longer than 24 characters are truncated with an ellipsis; hover shows the full name in a tooltip.
6. In DV360 the crumbs were not switchers (01). Crumb links are a simulator convenience. Switching advertiser is done from `[P]/advertisers`.

Page banner (under top bar, in the advertiser layout)
- Advertiser paused: "This advertiser is currently paused. None of its campaigns or deals are serving." + Learn more.
- Advertiser scheduled for deletion: same slot, own text.
- Simulator banners use the same slot, stacked below: view-as-student, access window ends in 5 minutes, active exercise (Phase 5).

> Resolved RC-049: the Partner status is not offered as Paused to students in v1 (no partner pause banner is built). Only the advertiser paused banner and the simulator banners exist.

### 4.6 Right rail

Vertical icon strip at the right edge (not in `F` and `R` frames). Order top to bottom.

| Icon | Panel | Shown on | Data |
|---|---|---|---|
| Ask Advisor (sparkle search) | AI chat "Ask Advisor" BETA. Simulator: Adsmetor tutor. Header icons history, new chat, close | all `(app)` pages | `POST /api/dv/advisor/chat` (stream) |
| Help (?) | "Quick help" BETA: most relevant, related to current page, search, "Ask Advisor" card | all `(app)` pages | `GET /api/dv/help?path=` (Adsmetor-written articles) |
| Intelligence (orbit) | "Intelligence - {entity}": ADVERTISER / CAMPAIGN HEALTH rows with Investigate, OPTIMIZATION SUGGESTIONS | advertiser, campaign, IO pages, and LI forms (shows Inventory availability / Spend forecast instead) | `GET /api/dv/intelligence?scope=` |
| Exercise `≠` | Task list for the active scenario attempt | only during an attempt | `GET /api/sim/attempts/{id}` |
| Panel toggle (bottom) | Collapse / expand the rail panel | always | client |

Rules
1. One panel at a time. Opening another replaces it. Clicking the active icon closes it (01).
2. Intelligence is open by default on first visit to `[A]/cs`, the campaign tabs and IO / LI pages. After that, the last choice is remembered per user (`localStorage` key `sim.rail`).
3. Panel state is client state. It survives route changes inside `(app)` and is lost when entering a `(full)` page.
4. Intelligence content variants by scope: `advertiser`, `campaign`, `io`, `li-form`.
5. Optional deep link `?sim_rail=intelligence` opens a panel once (used by scenarios).

### 4.7 Keyboard shortcuts (01)

`Ctrl` replaces `⌘` on non-Mac.

| Keys | Action | Target |
|---|---|---|
| `?` | Shortcuts dialog | client |
| `/` | Search overlay | client |
| Shift+N | New (entity of current list) | `[A]/cs/new` on Campaigns, `[C]/ios/new` on campaign IO tab, `[IO]/lis/new` on IO LI tab, etc. Disabled if the page has no create |
| Shift+I | New insertion order | `[C]/ios/new` (campaign scope only) |
| Shift+L | New line item | `[IO]/lis/new` (IO scope only) |
| ⌘+Shift+K | Download SDF | opens SDF dialog (grids) |
| ⌘+Shift+L | Download CSV of view | `POST /api/dv/exports/view-csv` |
| ⌘+D | Duplicate selected rows | bulk duplicate |

---

## 5. Layout hierarchy

### 5.1 Folder tree

```
app/
  layout.tsx                  root: <html>, ThemeProvider (MUI), SessionProvider, SnackbarHost, DialogHost
  not-found.tsx               renders <NotFoundPage/> (same markup as /404)
  error.tsx, global-error.tsx "Something went wrong" page (simulator-defined)
  page.tsx                    "/" role redirect
  404/page.tsx                the DV360-style 404
  [...unmatched]/page.tsx     redirect('/404?url=' + encodeURIComponent(path)); lowest priority catch-all
  sim/                        simulator-only pages (section 7), own layouts
  api/
    auth/[...nextauth]/route.ts
    dv/...                    DV360 module endpoints (section 8)
    sim/...                   simulator endpoints (section 8.19+)
  (dv)/
    layout.tsx                guard: session present, access window open, view-as banner; NO visual chrome
    (app)/                    tree WITH chrome
      layout.tsx              AppChrome: TopBar + RailHost + BannerStack + <main>
      (global)/bulk-status, users, email-preferences
      p/[partnerId]/
        layout.tsx            PartnerScope (loads partner, checks access, sets ScopeContext)
        (partner)/layout.tsx  <SideNav tree="partner"/> + children
          home_v3, advertisers, details, targeting, third-party-configuration,
          brand/controls, channels, custom-bidding, floodlights, cross-media-reach
        a/[advertiserId]/
          layout.tsx          AdvertiserScope (chain check, currency, tz, flags) + paused banner
          (advertiser)/layout.tsx  <SideNav tree="advertiser"/> + children
            cs, explorerios, explorerlis, history, templates, experiments, ...
          c/[campaignId]/
            layout.tsx        CampaignScope
            (campaign)/layout.tsx  <SideNav tree="campaign"/> + children
              explorerios, explorerlis, explorercombined, details, alerts, history, marketplace/...
            io/[ioId]/
              layout.tsx      IoFrame: breadcrumb row "Overview >", title, tabs (NO side nav)
              explorerlis, details, history
              li/[liId]/
                layout.tsx    LiFrame: breadcrumb row, title, tabs by LI type
                details, troubleshooter, history, adgroups
    (full)/                   tree WITHOUT top bar and nav
      layout.tsx              FullChrome: just <main> and DialogHost
      p/[partnerId]/
        layout.tsx            PartnerScope (shared loader, no nav)
        reporting/layout.tsx  ReportsFrame (back arrow + "Reports")
        reporting/...
        advertisers/new, custom-bidding/new, cross-media-reach/new
        a/[advertiserId]/
          layout.tsx          AdvertiserScope + paused banner
          cs/new, templates/new, audience/..., creatives/[creativeId], pr/[planId]/marketplace/plan,
          e/[testId] (+ @panel), brand-lift-measurements/new ...
          layout (per form) uses <FormFrame title onClose/> (X + title)
          c/[campaignId]/
            layout.tsx        CampaignScope
            ios/new
            io/[ioId]/lis/new
```

Shared loaders. `PartnerScope`, `AdvertiserScope`, `CampaignScope`, `IoScope`, `LiScope` are tiny server components in `lib/scope/*` that call a cached `resolveScope(params)` (React `cache()`), so both trees reuse one DB read per request. Each layout file in either tree is three lines.

### 5.2 What each layout owns

| Layout | Renders | Loads | Provides context |
|---|---|---|---|
| `app/layout.tsx` | html, theme, snackbar, dialog host | none | Theme, Session |
| `(dv)/layout.tsx` | nothing visible | session, class access window, view-as | `ViewerContext` (role, access levels, simClock) |
| `(app)/layout.tsx` | TopBar, RailHost (right rail), BannerStack, content slot | notifications count, clock | `ChromeContext` (navCollapsed, rail panel) |
| `(partner)/layout.tsx` | SideNav partner tree + content | none | none |
| `a/[advertiserId]/layout.tsx` | BannerStack item for paused / deleting | advertiser (status, currency, tz, flags: `demandGenEnabled`, `sdfVersion`, `limitedAccess`) | `ScopeContext.advertiser` |
| `(advertiser)/layout.tsx` | SideNav advertiser tree + content | none | none |
| `c/[campaignId]/layout.tsx` | none | campaign (name, status, dates) | `ScopeContext.campaign` |
| `(campaign)/layout.tsx` | SideNav campaign tree + content | alert count for badge | none |
| `io/[ioId]/layout.tsx` | breadcrumb row, title, tabs | IO header | `ScopeContext.io` |
| `li/[liId]/layout.tsx` | breadcrumb row, title, tabs by type | LI header (type) | `ScopeContext.li` |
| `(full)/layout.tsx` | bare `<main>` | none | none |
| form folders | `FormFrame`: X close, title, optional advertiser banner, footer slot | entity for edit | `FormDraftContext` |
| `reporting/layout.tsx` | ReportsFrame: back arrow + "Reports" | none | none |

`ScopeContext` is a client context with ids only (`partnerId`, `advertiserId`, `campaignId`, `ioId`, `liId`) plus level. The right rail, breadcrumb and shortcuts read it.

Page title pattern: `{Page} - {Entity} - DV360 Simulator by Adsmetor`.
Each table page has `loading.tsx` (grid skeleton) and each shell has `error.tsx`.

### 5.3 Guards (order of execution)

Edge `middleware.ts` (named `proxy.ts` on Next 16+):
1. `/ng_nav/**` to `/**` (308).
2. Not signed in and path is not `/sim/login` or `/api/auth/**`: redirect to `/sim/login?next={path}`.
3. Student outside an open access window: redirect to `/sim/closed`. Instructor and admin skip this.
4. `/sim/instructor/**` needs instructor or admin. `/sim/admin/**` needs admin. Else `/404`.

Node layout guards (section 5.1): chain check (R10), then access level. Failure of either renders the 404 page; a missing write right is returned by the action as an `Issue` with code `FORBIDDEN` and shown as a toast.

### 5.4 Right-rail panels, slide-overs and modals

Options considered
| Option | Fits | Does not fit |
|---|---|---|
| Client state (React context / store) | Things with no URL in DV360, tied to unsaved drafts, or that must survive navigation (chat) | Deep linking |
| Query param (`?sim_panel=`) | Panels that edit a real saved entity and where Back should close the panel | Panels tied to an unsaved draft (reload loses the draft) |
| Parallel route (`@slot`) + intercepting route `(.)` | Panels that DV360 already exposes as real URLs (soft nav shows panel, hard nav shows full page) | Everything else: would invent paths that DV360 does not have |

Chosen mapping

| Surface | Examples | Mechanism | Why |
|---|---|---|---|
| Right-rail panels | Ask Advisor, Quick help, Intelligence, Exercise | Client state in `RailHost`, persisted in `localStorage` | No URL in DV360. Must survive route changes. Chat history lives in memory and the API. A parallel route would remount on every layout change. |
| Draft-bound slide-overs | All 16 targeting editors (geo, apps and URLs, keywords, categories, environment, position, viewability, language, brand suitability, audience builder, demographics, day and time, browser, device, connection speed, carrier and ISP), creative picker "Select creatives", conversion picker "Add Floodlight activities...", Exchanges panel, Inventory source editors, Select partners and advertisers, Ad server and attribution, Third-party services, Select insertion orders (A/B and lift), audience pickers | Client state. Panel edits a copy of one field of the form draft (`FormDraftContext`). **Apply** writes into the draft. The form's Create or Save writes to the server | The data is not saved yet, so a URL would not reopen it. Esc / Cancel closes. Cancel with changes asks for confirmation. |
| Entity slide-overs | Channel editor, YouTube create ad group, create ad, deal group "New group", Marketplace Discover item detail, Notes panel (`?sim_panel=notes:{YYYYMMDD}`) | Query param `sim_panel`. Grammar: `kind:id` or `kind:new`; extra `adgroup={id}` for ads | These save independently, and Back / Forward should open and close them. Reload keeps the panel. No new path segments. |
| DV360-addressed panels | A/B test Settings and Difference (`/e/{id}/report/settings`, `/report/diff`) | Parallel slot `@panel` in `$A/e/[testId]/` with intercepting routes `@panel/(.)report/settings` and `@panel/(.)report/diff`, plus normal pages for hard navigation ("Open in full page") | DV360 gives them URLs. This reproduces both behaviours. |
| Modals and dialogs | Unsaved Changes, Copy settings from existing campaign, SDF Download and Upload, Select campaign, keyboard shortcuts, Make a copy, Schedule for deletion confirm, date picker popover, Modify columns | Client state through `useDialog()` (one `DialogHost` in root layout) | Short lived, no URL. |

**Unsaved Changes modal** (03, 04, 05)
- Component `UnsavedChangesDialog`: title "Unsaved Changes", text "You have made changes that have not been saved and will be lost.", buttons **Discard changes** (primary) and **Continue editing**.
- Trigger A: the X close button on any `F` form with a dirty draft.
- Trigger B: any in-app link click. Links go through `AppLink` (wraps `next/link`) which asks the active `useUnsavedGuard()` before navigating.
- Trigger C: browser Back (popstate) and tab close (`beforeunload`, native prompt only).
- Edit pages (`details` tabs with Save / Reset footers): soft guard, same dialog (Q8).
- Cancel on a create form navigates to the parent list (`router.back()` if the previous page is inside the same entity chain, else the parent list URL).
- Drafts live in memory only. Reload discards them (same as DV360).

---

## 6. URL conventions

### 6.1 Query parameters

Real DV360 params (recorded)
| Param | Used on | Values |
|---|---|---|
| `d` | History pages (16) | `YYYYMMDD:YYYYMMDD` |
| `s` | History pages | `1` = include system changes |
| `activeTab` | Deal page | `overviewTab`, `accessTab`, `settingsTab`, `historyTab` |
| `type`, `hostingSrc` | `creatives/new` | numeric codes (third-party display = 0, 1) |

Simulator params (our choice, used the same way on every list)
| Param | Meaning | Format and default |
|---|---|---|
| `d` | Date range for metrics. Extended to every list, chart strip, Troubleshooter, forecast | `YYYYMMDD:YYYYMMDD` or a preset token: `TODAY`, `YESTERDAY`, `THIS_WEEK`, `LAST_WEEK`, `LAST_7_DAYS`, `LAST_14_DAYS`, `LAST_30_DAYS`, `THIS_MONTH`, `LAST_MONTH`, `MONTH_TO_DATE`, `QUARTER_TO_DATE`, `YEAR_TO_DATE`, `LAST_2_YEARS`, `LIFETIME`, `{n}D_TODAY` (n days up to today), `{n}D_YESTERDAY`. Tokens resolve against the sim clock (R9). Default per page: lists `YESTERDAY`, History `90D_TODAY`, Troubleshooter `LAST_7_DAYS`, Partner Advertisers `YESTERDAY` |
| `q` | Free-text search ("Search for Name/ID containing") | string |
| `f.{key}` | Filter chip. Repeat the key for several values: `f.status=ACTIVE&f.status=PAUSED`. `f.status=*` means "no status filter" (chip removed) | Keys per grid in the module sections. Absent key = grid default (for example `Status: Active`) |
| `sort` | Column sort | `field:asc` or `field:desc`, comma separated for more |
| `rows` | Page size | `20` (default), `50`, `100` |
| `page` | 1-based page | `1` |
| `cv` | Column view | `performance` (default), `summary`, `pacing`, `optimization`, `c_{viewId}` for custom |
| `seg` | "Segment by" | `none` (default), `budgetType`, others per grid |
| `tz` | Time zone for reports and History | `advertiser` (default), `local`, `utc` |
| `tab` | Sub-tab on pages whose DV360 URL is unknown (Brand controls, YouTube assets, reports hub) | per page |
| `sim_panel` | Entity slide-over (5.4) | `kind:id` |
| `sim_aid` | Pre-filter advertiser on `[P]/reporting` | advertiser id |
| `sim_rail` | Open a right-rail panel once | `advisor`, `help`, `intelligence`, `exercise` |
| `sim_as` | View-as (instructor only), see 7.3 | user id |
| `returnTo` | Not used. Cancel and Close use history, not a param | |

Wizard state in the URL (enums only, never names or free text)
- `ios/new?type=STANDARD&objective=BRAND_AWARENESS` (step 2 once both are present).
- `lis/new?type=DISPLAY` (step 2 once `type` is present). Extra pre-step answers: `platform=ios`, `adType=display` for Mobile app install / Ads in mobile apps. YouTube step 1: `optimization=REACH&format=EFFICIENT`.
- `templates/new?type=display`, `fl/events/new?type=web`, `custom-bidding/new?step=setup`, `reporting/offline/new?type=floodlight`.
These are † (DV360 keeps wizard state inside the SPA). Reloading a step 2 URL restores the step with an empty draft.

### 6.2 Deep links

A shareable link carries `d`, `q`, `f.*`, `sort`, `rows`, `page`, `cv`, `seg` (and `tz` where relevant). It does not carry row selection, open dialogs or right-rail state (except `sim_panel`). Scenario tasks and instructor instructions can link to any list with pre-set filters (for example the Search chip "Paused line items" is just `[A]/explorerlis?f.status=PAUSED`).
AI-search suggestion chips (01) map to these saved filter links.
User prefs stored server side (`PUT /api/dv/me/prefs`): pinned campaign tab, default date range per grid, pinned column view per grid, custom column views, last workspace.

### 6.3 Redirects

| From | To | Kind | Note |
|---|---|---|---|
| `/ng_nav/**` | `/**` | 308 | R1 |
| `/` | role home (see 3.1) | 307 | |
| `[P]` | `[P]/home_v3` | 307 | |
| `[A]` | `[A]/cs` | 307 | |
| `[C]` | `[C]/explorerios` (or the pinned tab) | 307 | 03: `/c/{id}` goes to `/c/{id}/explorerios`. The pin icon on the tab strip can pin Combined, Insertion orders or Line items |
| `[IO]` | `[IO]/explorerlis` | 307 | |
| `[LI]` | `[LI]/adgroups` for YouTube / Demand Gen, else `[LI]/details` | 307 | |
| `[A]/marketplace/featured-v2` | `[A]/marketplace/featured-v3` | 308 | 09 |
| `[A]/fl` † | `[A]/fl/events` | 307 | |
| `[A]/audience/{id}/details` † | `[A]/audience/{kind}/{id}/details` | 307 | Resolves kind from the audience |
| `/p/{pid}/a/{aid}/audiences`, `.../reporting` | 404 page | | 17: not valid |
| `/404?url=` is the destination of the catch-all | | | 6.5 |

After-save navigation (not recorded in the demo, chosen to match DV360 habits; Q9)
| Action | Goes to |
|---|---|
| Create campaign | `[C]` (campaign page) |
| Create IO | `[IO]/explorerlis` |
| Create line item | `[LI]/details` (YouTube: `[LI]/adgroups`) |
| Create creative | `[A]/creatives/{id}` |
| Create audience / list / template / conversion | its list page |
| New plan / Copy plan | `[A]/pr/{newId}/marketplace/plan` |
| Archive / delete from a detail page | parent list |
| Cancel or X | back to where the user came from |

### 6.4 Param validation

Every param is parsed with Zod per route (`lib/routes/params.ts`). Bad id format or unknown `kind` gives the 404 page. Bad query value falls back to the default and the URL is cleaned with `router.replace`.

### 6.5 404 and error pages (from 17)

- Unknown path: the catch-all redirects to `/404?url={encoded path}` (matches `/ng_nav/404?url=`).
- Entity not found, wrong chain, or not visible to the user: render the same page in place, with HTTP 404 (no redirect), so existence is not leaked.
- Page content: Adsmetor logo, text "The page you're looking for wasn't found. The link you clicked may be broken or the page may have been removed.", link **Return to home page** (goes to `/`).
- No top bar, no nav, no right rail.
- Other pages: `/sim/closed` (outside access window), `/sim/session-expired`, `error.tsx` (500, text: "Something went wrong. Try again." with a Reload button).

---

## 7. Simulator-only routes

Everything lives under `/sim`. They use own layouts (`app/sim/layout.tsx` with a plain Adsmetor header). Student pages that need DV360 chrome link back into `(dv)`.

### 7.1 Public and student

| Route | Folder | Purpose | Access |
|---|---|---|---|
| `/sim/login` | `app/sim/login` | Adsmetor sign-in (credentials). `?next=` | PUBLIC |
| `/sim/logout` | route handler | Sign out and redirect | ANY |
| `/sim/closed` | `app/sim/closed` | "Class is not open right now" with next opening time and instructor contact | STU |
| `/sim/session-expired` | `app/sim/session-expired` | Session ended | PUBLIC |
| `/sim/forbidden` | `app/sim/forbidden` | Rare explicit "not allowed" for `/sim/**` pages | ANY |
| `/sim/welcome` | `app/sim/welcome` | First login: sandbox is ready, links to Overview and exercises | STU |
| `/sim/me` | `app/sim/me` | Profile, change password | ANY |
| `/sim/scenarios` | `app/sim/scenarios` | Exercises assigned to my class | STU |
| `/sim/scenarios/[scenarioId]` | `app/sim/scenarios/[scenarioId]` | Brief, tasks, Start / Resume | STU |
| `/sim/attempts/[attemptId]` | `app/sim/attempts/[attemptId]` | Attempt progress, auto-check results | STU |
| `/sim/progress` | `app/sim/progress` | My progress dashboard (P5-04) | STU |

### 7.2 Instructor console (`/sim/instructor`)

| Route | Purpose |
|---|---|
| `/sim/instructor` | Dashboard: today's class, open / close access, sim clock controls, quick reset |
| `/sim/instructor/classes` | My classes |
| `/sim/instructor/classes/[classId]` | Roster (add students by form or CSV), sandbox status |
| `/sim/instructor/classes/[classId]/access` | Access windows (create, edit, delete, open now, close now) |
| `/sim/instructor/classes/[classId]/clock` | Time controls: run / pause, speed, jump to date, step one tick |
| `/sim/instructor/classes/[classId]/students/[userId]` | Student detail: sandbox, attempts, change history, "View as student" |
| `/sim/instructor/sandboxes` | Reset one student, many, or the whole class. Snapshot and restore |
| `/sim/instructor/scenarios` | Library, assign to class, create |
| `/sim/instructor/scenarios/[scenarioId]` | Edit brief, seed template, tasks and auto-checks |
| `/sim/instructor/announcements` | Author notifications shown in the bell |
| `/sim/instructor/progress` | Class progress |

### 7.3 Admin and view-as

| Route | Purpose |
|---|---|
| `/sim/admin` | Admin home |
| `/sim/admin/users` | All users and roles |
| `/sim/admin/classes` | All classes |
| `/sim/admin/seed` | Seed templates and generator runs |
| `/sim/admin/engine` | Engine tuning (CPM, CTR, win-rate ranges) |
| `/sim/admin/audit` | Audit log of instructor / admin actions |

View-as: an instructor opens any DV360 URL with `?sim_as={userId}`. The server resolves the viewer as that student (read-only: writes are rejected unless "Act as student" is switched on), a banner shows "Viewing as {name}" with an Exit link. The param is kept by `AppLink`.

### 7.4 Rules
- Access windows, clock and sandbox reset are **class** properties. A student never sees `/sim/instructor/**`.
- The access window guard is in the middleware and also in every action (a long-open tab must stop writing when the window closes).
- Window ending: banner 5 minutes before the end; at the end all writes fail with `ACCESS_WINDOW_CLOSED` and the next navigation goes to `/sim/closed` (Q12).

---

## 8. API route and server action map

### 8.0 Conventions

- Base: `/api/dv/**` (DV360 modules), `/api/sim/**` (simulator), `/api/auth/**` (Auth.js).
- Each operation is one service function in `lib/services/{module}.ts`. A GET route handler and/or a server action in `lib/actions/{module}.ts` wrap it. Listing below: `GET /path` = route handler, `action name()` = server action. Some have both.
- Lists nest under their parent (`/advertisers/:aid/campaigns`). Single entities are flat (`/campaigns/:cid`). The service loads the chain and checks access (R10).
- Updates send `expectedVersion` (optimistic lock, the entity `version` int). A stale value returns `CONFLICT`.
- Writes return `Result<T>`. Validation text matches DV360 exactly ("Enter a value", "Enter a number greater than 0", "Please select at least one creative type.", "A selection is required"). Rules live in `lib/validation` (P2-04). `warnings` carry non-blocking items such as "This KPI is not recommended for the selected campaign goal."
- Every write appends `ChangeLog` rows (16) and may create a `BulkJob`.
- Uploads: files over about 4 MB cannot go through a Vercel function body. Use `POST /api/dv/uploads/sign` to get a signed blob URL, upload from the browser, then send the `uploadId` in the action (Q16).
- Auth: Auth.js session in every handler. `assertAccess(session, ref, 'view'|'write')`.

```ts
// ---- shared wire types ----
type Id = string;
type IsoDate = string;               // 'YYYY-MM-DD' in the entity's time zone
type IsoDateTime = string;           // UTC
type DateRangeParam = string;        // 'YYYYMMDD:YYYYMMDD' | preset token (6.1)
type Money = number;                 // major units in the entity's currency; storage is data-model.md's call
type Version = number;
type EntityStatus = 'ACTIVE'|'PAUSED'|'DRAFT'|'ARCHIVED'|'COMPLETED'|'SCHEDULED_FOR_DELETION';
type Period = 'MINUTE'|'HOUR'|'DAY'|'WEEK'|'MONTH';

interface ListQuery<F = Record<string, string[]>> {
  q?: string; filters?: F;
  sort?: { field: string; dir: 'asc'|'desc' }[];
  page?: number; pageSize?: 20|50|100;
  d?: DateRangeParam; columnView?: string; segmentBy?: string;
}
interface ListResult<R> {
  rows: R[]; total: number; page: number; pageSize: number;
  totalsRow?: Record<string, number|string|null>;   // footer "Total: Display"; null renders "-"
  asOf: IsoDateTime;                                 // sim clock when computed
}
interface Issue { path: string; severity: 'error'|'warning'; code: string; message: string }
type Result<T> = { ok: true; data: T; warnings?: Issue[] } | { ok: false; issues: Issue[] };
interface WriteMeta { expectedVersion?: Version; changeNote?: string }   // "Optional: Enter a note about this change"
interface FrequencyCap { mode: 'UNLIMITED'|'INHERIT'|'LIMITED'; exposures?: number; period?: Period }   // RC-018: mode replaces `enabled`; campaign uses UNLIMITED or LIMITED, IO and LI use INHERIT or LIMITED (DM FrequencyMode)

type BulkEntity = 'CAMPAIGN'|'INSERTION_ORDER'|'LINE_ITEM'|'CREATIVE'|'AD_GROUP'|'AUDIENCE'|'DEAL';   // RC-042: AD_GROUP supports ACTIVATE, PAUSE, DUPLICATE and DELETE only (no ARCHIVE)
type BulkAction =
  | { type: 'ACTIVATE' } | { type: 'PAUSE' } | { type: 'ARCHIVE' } | { type: 'UNARCHIVE' }
  | { type: 'DUPLICATE'; targetParentId?: Id; copies?: number }
  | { type: 'APPLY_TARGETING_TEMPLATE'; templateId: Id }
  | { type: 'EDIT_SETTINGS'; patch: Record<string, unknown> }
  | { type: 'EDIT_CREATIVE_ASSIGNMENT'; add?: Id[]; remove?: Id[] }
  | { type: 'EDIT_TARGETING'; group: 'INVENTORY'|'CONTENT'|'AUDIENCE'|'TECHNOLOGY'; patch: unknown };
interface BulkRequest { entity: BulkEntity; ids: Id[]; action: BulkAction }
interface BulkResponse { jobId: Id; status: 'QUEUED'|'RUNNING'|'COMPLETED'|'FAILED';   // RC-012 failed?: { id: Id; issue: Issue }[] }
```

> Resolved RC-052: the actions `setIoStatus(id, status)` and `setLineItemStatus(id, status)` (module 07 Δ-07-11, module 08 Δ-08-14), `POST /api/dv/insertion-orders/:ioId/creative-candidates` (module 08 Δ-08-5) and the wire types named in module sections 3.3 / 4 (`ForecastBand`, `AlertGroup`, `ChartCardSpec`, `PreviewModel`, `AdGroupRow`, `AdRow`, `OverviewData`) are part of this section. Where this file and a module Δ disagree on a type, the module Δ wins for the wire shape.

Disabled bulk items are decided by `GET .../bulk-capabilities?ids=` (returns which `BulkAction.type`s apply to the selection) so the menu can grey out items like DV360.

### 8.1 Session, scope, preferences, search, notifications

```ts
// GET /api/dv/context?pid&aid&cid&ioId&liId
getScope(ref): ScopeInfo   // names, status, currency, timeZone, flags { demandGenEnabled, sdfVersion, limitedAccess, paused }, viewerLevel, simNow
// GET /api/dv/me/access        -> tree partner > advertisers (feeds "Select partners and advertisers")
// GET|PUT /api/dv/me/prefs     action savePrefs(patch)
interface UserPrefs { pinnedCampaignTab?: 'combined'|'ios'|'lis'; navOpen?: Record<string,boolean>;
  dateDefaults?: Record<string, DateRangeParam>; pinnedColumnView?: Record<string,string>; lastWorkspaceId?: Id }
// POST /api/dv/me/recent {entityType, id}           log "Recently opened" (called by scope layouts)
// POST /api/dv/advertisers/:aid/search {query}  -> { interpretation: string; target: { route: string; query: Record<string,string[]> } | null }
// GET  /api/dv/advertisers/:aid/search/suggestions -> { label; route; query }[]
// GET  /api/dv/notifications -> Notification[]       action dismissNotification(id)
// GET|PUT /api/dv/me/email-preferences  { alerts: boolean; news: boolean }
// Column views (shared by Campaign / IO / LI grids)
// GET /api/dv/column-views?grid=  | action saveColumnView({grid, name, columns, pin?}) | deleteColumnView(id) | pinColumnView(id)
```

### 8.2 Partner: overview, advertisers, settings

```ts
// Overview
// GET /api/dv/partners/:pid/overview?workspaceId=
interface OverviewData { pacing: { underpacing: number; underperforming: number; rejectedCreatives: number;
    budgetAtRisk: Money; flightSpend: Money; rows: { ioId: Id; campaignId: Id; advertiserId: Id; names: string[];
    pacingPct: number; budgetAtRisk: Money; flightBudget: Money; daysLeft: number }[] };
  rejectedCreatives: unknown[]; underperformingIos: unknown[]; recent: RecentGroup[]; pinned: PinnedItem[] }
// action: createWorkspace(name) renameWorkspace(id,name) duplicateWorkspace(id) deleteWorkspace(id) shareWorkspace(id, userIds)
//         saveWorkspaceLayout(id, layout) pinItem({entityType,id}) unpinItem(id)

// Advertisers
// GET  /api/dv/partners/:pid/advertisers      ListQuery<{ status: ('ACTIVE'|'PAUSED'|'SCHEDULED_FOR_DELETION')[] }>
interface AdvertiserRow { id: Id; name: string; status: EntityStatus; currency: string; impressions: number; revenue: Money;
  budgetAtRisk: Money; currentBudget: Money; underpacingIos: number; activeIos: number }
// GET  /api/dv/partners/:pid/advertisers/summary?d=   { budgetAtRisk:{total,likelyPct,atRiskPct,spendPct}, pacing:{active:number,underpacingPct:number} }
// action createAdvertiser(partnerId, { name; website; currency; timeZone; sdfVersion?; adServer? })   // gap, from public docs
// action setAdvertiserStatus(id, 'ACTIVE'|'PAUSED')

// Partner settings
// GET|PATCH /api/dv/partners/:pid                  action updatePartner(WriteMeta & { name; status; nielsenCountry; measurement:{includeInCm360:boolean;reportCostToCm360:boolean}; sdfVersion; sdfAdminEmail; dataProtection:{...}; autoEnableNewExchanges:boolean })
// GET|PUT   /api/dv/partners/:pid/exchanges        action saveExchanges({ enabled: { exchangeId: Id; networkId?: string; agencyId?: string; seatId?: string }[] })
// GET|PUT   /api/dv/partners/:pid/targeting-defaults  action saveTargetingDefaults(TargetingState & InventorySourceState)
// GET|PUT   /api/dv/partners/:pid/advertiser-configurations
interface AdvertiserConfigurations { enhancedAutomation: { on: boolean; advertiserIds: Id[] | 'ALL' }; productImprovement: boolean;
  googleAndPartnerInventory: { on: boolean; advertiserIds: Id[] | 'ALL' }; youtubeGuaranteedInstantDeals: { termsAccepted: boolean; advertiserIds: Id[] };
  autoTagging: { on: boolean; advertiserIds: Id[] | 'ALL' }; advancedAdServing: { acceptFees: boolean; advertiserIds: Id[] | 'ALL' } }
// SDF at partner list menu: see 8.15 (partner scope)
```

### 8.3 Users and roles

```ts
// GET  /api/dv/users                ListQuery<{ role: string[]; partner: Id[]; advertiser: Id[] }> -> UserRow
interface UserRow { id: Id; name: string; email: string; roles: AccessLevel[]; partnerIds: Id[]; advertiserIds: Id[] }
// GET  /api/dv/users/:id
// action createUser({ name; email; type: 'PARTNER_AND_ADVERTISER'; access: { scope: {partnerId?:Id; advertiserId?:Id}; level: AccessLevel }[] })
// action updateUser(id, patch & WriteMeta)  | action setUserAccess(id, access[])  | action deleteUser(id)
type AccessLevel = 'ADMIN'|'STANDARD'|'READ_ONLY'|'REPORTING_ONLY'|'PARTNER_CLIENT'|'CREATIVE';
```
Simulator users and classes are in 8.20 (separate).

### 8.4 Campaigns

```ts
// GET  /api/dv/advertisers/:aid/campaigns   ListQuery<{ status: EntityStatus[] }>
interface CampaignRow { id: Id; name: string; status: EntityStatus; alertCount: number; budget: Money|null; spent: Money;
  kpiGoal: string|null /* "0.15% CTR" */; kpiActual: string|null; kpiActualTrueView: string|null }
// GET  /api/dv/campaigns/:cid
interface CampaignInput extends WriteMeta {
  name: string; status: 'ACTIVE'|'PAUSED';
  goal: 'AWARENESS'|'ONLINE_ACTION'|'OFFLINE_SALES'|'APP_INSTALLS';   // RC-001
  kpi: { type: 'CPM'|'CPC'|'CPA'|'CTR'|'CPV'|'VIEWABLE_PCT'|'CPIAVC'|'OTHER'; value?: number; otherText?: string };
  creativeTypes: ('DISPLAY'|'VIDEO'|'AUDIO')[];
  plannedSpend?: Money; startDate: IsoDate; endDate?: IsoDate;
  frequencyCap: FrequencyCap;
  budgetType: 'CURRENCY'|'IMPRESSIONS';
  budgets?: { amount: Money; name: string; startDate?: IsoDate; endDate?: IsoDate; invoiceGroupingId?: string; externalBudgetId?: string }[];
  landingPageUrls?: string[]; keywords?: string[];            // up to 5
}
// action createCampaign(advertiserId, CampaignInput) | updateCampaign(id, CampaignInput)
// action validateCampaign(advertiserId, Partial<CampaignInput>) -> Issue[]       (live goal -> KPI warnings)
// POST /api/dv/campaigns/bulk (BulkRequest, entity 'CAMPAIGN')  -> Activate, Pause, Archive, Duplicate (to advertiser)
// action setCampaignStatus(id, 'ACTIVE'|'PAUSED')                (row hover menu)
// GET  /api/dv/campaigns/:cid/charts?d=        -> ChartCard[]  (Total cost, Avg KPI, Impressions lost, Added reach, Budget options)
// GET  /api/dv/campaigns/:cid/alerts?ioId&liId&group=ALL|BUDGET|CREATIVES -> { critical: AlertGroup[]; needsAttention: AlertGroup[] }
// GET  /api/dv/campaigns/:cid/copy-source      -> settings that Copy settings can take { frequencyCap; goal; creativeTypes }
```

### 8.5 Insertion orders

```ts
// GET /api/dv/advertisers/:aid/insertion-orders   and   GET /api/dv/campaigns/:cid/insertion-orders
//     ListQuery<{ status: EntityStatus[]; type: string[] }> (archived rows are `f.status=ARCHIVED`, RC-052) (same handler, scope differs)
interface IoRow { id: Id; campaignId: Id; name: string; status: EntityStatus; alertCount: number; type: 'STANDARD'|'CTV_OTT'|'DOOH';
  budget: Money|null; goal: string; impressions: number; revenue: Money; interactions: number; conversions: number; cpa: Money|null;
  customImpressionValue: number|null; customImpressionCost: Money|null }
// GET /api/dv/insertion-orders/:ioId
// GET /api/dv/meta/io-objective-matrix?type=   -> per objective: kpis[], bidStrategies[], lineItemTypes[], disabled? (CTV disables CLICKS; DOOH only NONE)
interface InsertionOrderInput extends WriteMeta {
  type: 'STANDARD'|'CTV_OTT'|'DOOH';
  objective: 'BRAND_AWARENESS'|'CLICKS'|'CONVERSIONS'|'CUSTOM'|'NONE';
  name: string; status: 'DRAFT'|'ACTIVE';   // RC-040: create rejects PAUSED (IO-012); pause with setIoStatus
  budgetType: 'CURRENCY'|'IMPRESSIONS';                                 // locked after create
  segments: { id?: Id; amount: Money; description?: string; startDate: IsoDate; endDate: IsoDate }[];
  pacing: { period: 'FLIGHT'|'DAILY'; type: 'EVEN'|'AHEAD'|'ASAP'; dailyAmount?: Money };
  kpi: { type: string; value: number };
  optimization: { mode: 'IO_AUTOMATED'|'LI_CONTROLLED';   // RC-002
                   optimizedTowards?: string; prioritizeFullBudget?: boolean;
                  autoBudgetAllocation?: boolean; youtubeReachFrequency?: boolean };
  frequencyCap: FrequencyCap;                                           // mode INHERIT -> use the campaign cap
  partnerCosts: { cpmFees: Fee[]; mediaFees: Fee[] };                   // media fee 1 = locked DV360 fee
  integrationCode?: string; detail?: string;
}
interface Fee { slot: number; amount: number; percentage?: number; feeType: string; invoiced: boolean }   // RC-006: media fees may be a percentage
// action createInsertionOrder(campaignId, InsertionOrderInput) | updateInsertionOrder(id, InsertionOrderInput)
// action validateInsertionOrder(campaignId, Partial<InsertionOrderInput>) -> Issue[]
// action setIoObjectiveToNone(id)        (details page dropdown; unlocks any KPI / bid strategy)
// action patchIoBudget(id, segmentId, amount)    (inline budget cell edit)
// POST /api/dv/insertion-orders/bulk (BulkRequest)  Activate, Pause, Targeting template, Edit settings, Edit creative assignment, Archive, Duplicate (to campaign)
// GET  /api/dv/insertion-orders/:id/charts?d=   |  GET /api/dv/insertion-orders/:id/budget-options
```

### 8.6 Line items

```ts
// GET /api/dv/insertion-orders/:ioId/line-items | /api/dv/campaigns/:cid/line-items | /api/dv/advertisers/:aid/line-items | /api/dv/audiences/:audId/line-items
//     ListQuery<{ status: EntityStatus[]; type: LineItemType[] }>   // archived rows: f.status=ARCHIVED (RC-052)
type LineItemType = 'DISPLAY'|'VIDEO'|'CTV'|'AUDIO'|'MOBILE_APP_INSTALL'|'ADS_IN_MOBILE_APPS'|'YT_VIDEO'|'YT_AUDIO'|'YT_ON_CTV'|'DEMAND_GEN'|'DOOH_DISPLAY'|'DOOH_VIDEO';   // RC-003
interface LineItemRow { id: Id; ioId: Id; name: string; status: EntityStatus; alertCount: number; type: LineItemType;
  budget: Money|null; goal: string; impressions: number; revenue: Money; clicks: number; conversions: number; cpa: Money|null;
  trueViewViews?: number }
// GET /api/dv/insertion-orders/:ioId/line-item-types
//   -> { type: LineItemType; enabled: boolean; reason?: string }[]   reason e.g. "Audio line items aren't compatible with your insertion order's objective setting."
//   Demand Gen also returns reason "To create Demand Gen line items: Enable Floodlight optimization in this advertiser".
// GET /api/dv/line-items/:liId
interface LineItemInputBase extends WriteMeta {
  type: LineItemType; name: string; status: 'DRAFT'|'ACTIVE'|'PAUSED';
  targetingTemplateId?: Id;
  inventorySource: { quality: 'DIRECT'|'DIRECT_AND_RESELLERS'|'NON_PARTICIPATING'; exchangeIds: Id[]; targetNewExchanges: boolean;
                     curatedCtv?: boolean; dealIds: Id[]; dealGroupIds: Id[] };
  targeting: TargetingState;                                   // 8.8
  optimizedTargeting: boolean;
  flight: { mode: 'SAME_AS_IO' } | { mode: 'CUSTOM'; startDate: IsoDate; endDate: IsoDate };
  budget: { mode: 'UNLIMITED_TO_IO' } | { mode: 'AMOUNT'; amount: Money };
  pacing: { period: 'FLIGHT'|'DAILY'; type: 'EVEN'|'AHEAD'|'ASAP'; dailyAmount?: Money };
  bid: { mode: 'AUTOMATED'; optimizedTowards: string; prioritize: 'FULL_BUDGET'|'TARGET'; targetValue?: number } | { mode: 'FIXED'; cpm: Money };
  frequencyCap: FrequencyCap;
  creativeIds: Id[]; creativeOptimization: 'LI_BID_STRATEGY'|string;
  conversions: { activityIds: Id[]; counting: 'ALL'|'POST_CLICK_ONLY'|'PERCENTAGE';   // RC-006: DM keys
    percent?: number; attributionModelId?: Id };
  euPoliticalAds: 'YES'|'NO';                                   // required
  revenueModel?: { kind: 'TOTAL_MEDIA_COST_MARKUP'|'CPM_VALUE'; value: number };   // RC-006: DM keys
  partnerCosts: { cpmFees: Fee[]; mediaFees: Fee[] }; integrationCode?: string; detail?: string;
}
type LineItemInput = LineItemInputBase
  | (LineItemInputBase & { type: 'MOBILE_APP_INSTALL'; app: { platform: 'ALL'|'IOS'|'ANDROID'; appId: string }; adType: 'DISPLAY'|'VIDEO' })
  | (LineItemInputBase & { type: 'ADS_IN_MOBILE_APPS'; adType: 'DISPLAY'|'VIDEO' })
  | (LineItemInputBase & { type: 'YT_VIDEO'|'YT_AUDIO'|'YT_ON_CTV'; youtube: YoutubeLiSettings });   // 8.7
// action createLineItem(ioId, LineItemInput) | updateLineItem(id, LineItemInput) | validateLineItem(ioId, Partial<LineItemInput>) -> Issue[]
// POST /api/dv/line-items/bulk (BulkRequest)  all BulkAction types; DUPLICATE supports copies
// POST /api/dv/line-items/forecast  { ioId; draft: Partial<LineItemInput> }  -> { inventoryAvailability: ForecastBand|null; spendForecast: { risk: 'LOW'|'MEDIUM'|'HIGH'|null; missing: string[] } }
//      debounced 500 ms from the form; engine "dry run" (engine.md)
// GET  /api/dv/line-items/:liId/troubleshooter?inventory=ALL|{exchangeId}&d=
interface TroubleshooterData { banner?: { text: string; link: string };
  kpis: { availableRequests: number; bidResponses: number; impressionsWon: number; winRate: number };
  stages: { stage: 'FILTERED'|'ELIGIBLE'|'BIDS'|'RESPONSES'|'WON'; total: number; reasons: { reason: string; impressions: number; pct: number }[] }[] }
// GET  /api/dv/line-items/:liId/troubleshooter/download?d=   CSV
// action assignCreatives(liId, { add: Id[]; remove: Id[] })    (also used by the creative picker Apply)
// GET  /api/dv/line-items/:liId/creative-candidates?tab=ALL|ELIGIBLE|ASSIGNED&q&f.format&page   -> ListResult<CreativePickerRow>
// GET  /api/dv/advertisers/:aid/conversion-candidates?type=FLOODLIGHT|GA&status=ACTIVE&q       -> ListResult<ConversionPickerRow>
```

### 8.7 YouTube: ad groups and ads

```ts
interface YoutubeLiSettings {
  subtype: 'EFFICIENT_REACH'|'NON_SKIPPABLE_REACH'|'TARGET_FREQUENCY'|'TARGET_FREQUENCY_IN_STREAM'|'TRUEVIEW_VIEWS'|'AD_SEQUENCE'|'AUDIO_REACH';   // RC-005: DM keys   // step 1, read-only after
  adFormats: { inStream: boolean; inFeed: boolean; shorts: boolean };
  frequencyCap: { exposure: FrequencyCap; view: FrequencyCap };
  productFeed?: { merchantCenterId: string }; relatedVideoIds: string[];
}
// GET  /api/dv/line-items/:liId/ad-groups          ListQuery<{ status: EntityStatus[] }> -> AdGroupRow
interface AdGroupInput extends WriteMeta { name: string; status: 'ACTIVE'|'PAUSED'; targeting: TargetingState /* placements, demographics, audiences */; bidTargetCpm?: Money /* depends on LI strategy */ }
// action createAdGroup(liId, AdGroupInput) | updateAdGroup(id, AdGroupInput) | deleteAdGroup(id)
// GET  /api/dv/ad-groups/:id/ads
interface AdInput extends WriteMeta { name: string; status: 'ACTIVE'|'PAUSED'; videoId: string; logoAssetId?: Id; companionBanner?: { uploadId: Id };
  headline?: string; longHeadline: string; description: string; callToAction?: string; businessName?: string;
  displayUrl?: { domain: string; path1?: string; path2?: string }; landingPageUrl: string; clickTrackerUrl?: string }
// action createAd(adGroupId, AdInput) | updateAd(id, AdInput) | deleteAd(id)
// GET  /api/dv/youtube/video-lookup?q=<url or text>  -> synthetic { videoId; title; durationSec; orientation; thumbnailUrl }[]
// POST /api/dv/ads/preview  { draft: AdInput; format: 'ALL'|'IN_STREAM'|'IN_FEED'|'SHORTS'; device: 'PHONE'|'COMPUTER'|'TV'; surface: 'YOUTUBE'|'VIDEO_PARTNERS'|'GOOGLE_TV' } -> PreviewModel
```

### 8.8 Targeting (shared panel)

```ts
// One shape used by IO, LI, ad group, template, partner defaults.
interface TargetingState {
  geography?: { regions: Sel[]; radius?: { points: { lat: number; lng: number; radiusKm: number }[] }; locationListIds?: Id[] };
  appsAndUrls?: { channelIds: Sel[]; collections: Sel[]; urls: Sel[]; apps: Sel[] };
  keywords?: { include: string[]; exclude: string[] };
  categories?: Sel[]; environment?: { web: boolean; app: boolean };
  position?: { onScreen: string[]; inContent: string[]; native: string[] };
  viewability?: { predictedPct: number|null };               // null = all impressions
  language?: Sel[]; brandSuitability?: { thirdParty: { provider: 'NONE'|'DOUBLEVERIFY'|'IAS'|'SCOPE3'; options: string[] } };
  audienceLists?: { include: { groups: Id[][]; combined: Id[]; custom: Id[] }; exclude: { firstParty: Id[]; google: Id[] } };
  demographics?: { gender: string[]; ageRange: [number, number]; ageUnknown: boolean; parental: string[]; income: string[] };
  dayAndTime?: { segments: { day: string; from: string; to: string }[]; tz: 'LOCAL'|'ADVERTISER' };
  browser?: Sel[]; device?: { types: Sel[]; os: Sel[]; makeModel: Sel[] }; connectionSpeed?: string; carrierIsp?: Sel[];
  locked?: string[];                                           // dimensions inherited from advertiser targeting rules (read-only)
}
interface Sel { id: string; mode: 'INCLUDE'|'EXCLUDE' }
// Targeting is part of the IO / LI / ad group / template payload. These helper reads feed the editors:
// GET  /api/dv/targeting/options?dimension=geography|category|language|browser|carrier|app|url|...&q&cursor&type  -> { items: { id; label; sub?; type? }[]; next?: string }
// POST /api/dv/targeting/geo/parse-points    { text }                        -> { points: {lat;lng;label}[]; errors: Issue[] }
// POST /api/dv/targeting/impressions-summary { advertiserId; ioId?; draft: TargetingState; flight }   -> ImpressionsSummary  (overall / included / excluded, gender, age, device)
// POST /api/dv/targeting/suggestions         { kind: 'KEYWORD'|'CATEGORY'|'URL'|'AUDIENCE'; advertiserId; seed? }  -> { items: string[] }
// POST /api/dv/targeting/verification-cost   { provider; options[] }       -> { cpm: Money }
// Templates
// GET  /api/dv/advertisers/:aid/targeting-templates   ListQuery<{ status: EntityStatus[]; type: LineItemType[] }>   // RC-052: URL filter keys are f.status and f.type
// GET  /api/dv/targeting-templates/:id
// action createTargetingTemplate(aid, { type: LineItemType; name: string; description?: string; inventorySource; targeting: TargetingState; optimizedTargeting: boolean })
// action updateTargetingTemplate(id, ...) | archiveTargetingTemplate(id)
// Bulk apply: BulkAction APPLY_TARGETING_TEMPLATE
```

### 8.9 Creatives

```ts
// GET /api/dv/advertisers/:aid/creatives   ListQuery<{ status; type; format; dv360Status; exchangeStatus; source; lineItemId }>   (list and grid share one endpoint)
interface CreativeRow { id: Id; name: string; status: 'ACTIVE'|'PAUSED'|'ARCHIVED'; type: string; format: string; aiLabel?: string;
  dv360Status: 'PENDING'|'SERVABLE'|'NOT_SERVABLE'; exchangeStatus: { servable: number; total: number };
  companions: number; dimensions?: string; durationSec?: number; source: string; created: IsoDateTime; modified: IsoDateTime; tag: boolean; lineItems: number }
// GET /api/dv/creatives/:id
type CreativeInput = WriteMeta & { name: string; status: 'ACTIVE'|'PAUSED'; landingPageUrl: string; integrationCode?: string; notes?: string;
  appendTag?: boolean; aiLabel?: 'UNSET'|'AI_GENERATED'|'NOT_AI_GENERATED';   // RC-007: DM AiLabel dontScale?: boolean } & (
  | { kind: 'THIRD_PARTY_DISPLAY'; width: number; height: number; requiresMraid: boolean; requiresHtml5: boolean; expandingDirection: string; expandsOnHover: boolean; tag: string; requiresPing: boolean }
  | { kind: 'THIRD_PARTY_VIDEO'; vastTag: string }          | { kind: 'THIRD_PARTY_AUDIO'; vastTag: string }
  | { kind: 'UPLOAD_IMAGE_OR_HTML5'; uploadId: Id }          | { kind: 'UPLOAD_VIDEO'; uploadId: Id }
  | { kind: 'UPLOAD_AUDIO'; uploadId: Id }                   | { kind: 'YOUTUBE_VIDEO'; videoId: string }
  | { kind: 'NATIVE_SITE'; assets: Record<string, unknown> } | { kind: 'NATIVE_VIDEO'; assets: Record<string, unknown> }
  | { kind: 'FORMAT_GALLERY'; formatKey: string; assets: Record<string, unknown> });
// action createCreative(aid, CreativeInput) | updateCreative(id, CreativeInput)
// POST /api/dv/creatives/bulk (BulkRequest, entity 'CREATIVE')  archive, activate, pause, assign to line items
// POST /api/dv/uploads/sign { purpose: 'CREATIVE'|'SDF'|'CUSTOMER_MATCH'|'BULK_CREATIVE'; fileName; size; contentType } -> { uploadId; url; headers }
// GET  /api/dv/creatives/templates/:kind          download bulk-upload template CSV
// action bulkAddCreatives(aid, { kind; uploadId })   -> BulkResponse
// POST /api/dv/creatives/test-tag { tag } -> { html }       (Test tag link)
// GET  /api/dv/creatives/:id/preview
// GET  /api/dv/creatives/:id/status   -> { created; modified; reviewCompleted; dv360Review: { status; feedback?; restrictions: { text }[]; detectedUrls: string[] };
//                                         exchangeReview: { exchange; id; status: 'APPROVED'|'PENDING'|'DISAPPROVED'; ssl: string; feedback?: string; lastSync: IsoDateTime }[];
//                                         lineItems: { id; name }[]; eligibility: unknown }
// action appealCreative(id, { exchangeIds?: Id[]; reason?: string })
// GET  /api/dv/creatives/:id/history  ListQuery<{ d; user }>   -> { date; user; summary; lines: string[] }[]
// GET  /api/dv/advertisers/:aid/formats?tab=ALL|VIDEO|DISPLAY|NATIVE|OPTIMIZED  -> FormatCard[]
// GET  /api/dv/advertisers/:aid/appeals       ListQuery   -> AppealRow
```

### 8.10 Inventory, Marketplace, Planning

```ts
// My inventory (advertiser or campaign scope: ?campaignId=)
// GET /api/dv/advertisers/:aid/inventory/orders-deals   ListQuery<{ status: ('ACTIVE'|'ARCHIVED'|'PAUSED'|'DRAFT'|'COMPLETED'|'NOT_SERVABLE')[] }>
//     -> { actionRequired: DealRow[]; rest: (OrderRow | DealRow)[] }  (orders carry children)
// GET /api/dv/advertisers/:aid/inventory/packages        ListQuery
// GET /api/dv/advertisers/:aid/inventory/deal-groups     ListQuery
// action createDealGroup(aid, { name; dealIds: Id[]; type }) | updateDealGroup(id, ...) | deleteDealGroup(id)      // gap, public docs
// GET /api/dv/deals/:tid                  -> Deal (Overview, Access, Settings, History parts)
// GET /api/dv/deals/:tid/line-items?d=    -> ListResult<...>
// action updateDeal(tid, WriteMeta & { status; frequencyCap?; allowPausing?; advertiserAccess?: Id[] })    // most settings are view only
// Instant deals
// GET  /api/dv/instant-deals/sellers                      -> SellerCard[]  (kind 'EXCHANGE'|'PUBLISHER')
// POST /api/dv/instant-deals/forecast  { sellerId; name; targeting: Record<string,string[]>; advertiserIds: Id[] } -> { impressions; cpm; spendRisk }
// action acceptInstantDeal(aid, { sellerId; name; commitment: 'NON_GUARANTEED'; targeting; advertiserIds })
// Marketplace
// GET  /api/dv/advertisers/:aid/marketplace/featured -> { banner?; carousels: { title; count; items: PackageCard[] }[]; instantDealSellers: SellerCard[] }
// POST /api/dv/marketplace/bulk-assign { packageIds: Id[]; lineItemIds?: Id[]; advertiserIds?: Id[] } -> BulkResponse
// POST /api/dv/advertisers/:aid/marketplace/discover { mode: 'AI'|'KEYWORD'; query: string; filters: Record<string,string[]>; page? } -> ListResult<DiscoverRow>
// GET  /api/dv/marketplace/items/:id   -> { summary; scale: { impressions7d; gender; geo; device; format }; audiences: unknown; about: string }
// action assignMarketplaceItem(id, { advertiserIds?: Id[]; lineItemIds?: Id[] })
// Negotiations
// GET  /api/dv/advertisers/:aid/negotiations   ListQuery<{ status: string[] }> -> NegotiationRow
// action importNegotiation(aid, { rfpId }) | sendProposal(id) | acceptProposal(id) | declineProposal(id)           // gap, public docs
// Plans
// GET  /api/dv/advertisers/:aid/plans          ListQuery<{ status: ('PLANNED'|'TRAFFICKED')[] }> -> PlanListRow { id; name; totalBudget: Money|null; startDate; endDate; channels: string[] }   // RC-035: renamed, `PlanRow` is the plan line-item row (DM 5.15)
// GET  /api/dv/plans/:id                       -> Plan { header: { name; location; dates; demographics; additional }; forecast: PlanForecast|null; rows: PlanRow[]; savedAt: IsoDateTime; locked: boolean }
// action createPlan(aid)                       -> { id }   (name "New Plan (Mon D, YYYY)")
// action updatePlan(id, WriteMeta & { name; location; dates; demographics; additional; rows: PlanLineInput[] }) | copyPlan(id) | removePlan(id)
// POST /api/dv/plans/:id/forecast              -> PlanForecast { asOf; reachPct; avgFrequency; totalCpm; trps; cpp; population: Record<string,number>; cpa; viewableCpm; viewabilityRate; tabs: Record<'REACH'|'TRUEVIEW'|'CONVERSIONS'|'DEMOGRAPHICS'|'DEVICES', unknown> }
// GET  /api/dv/plans/:id/download              CSV
// action convertPlan(id, { target: 'CAMPAIGN'|'IO'; campaignId?: Id })     // gap, public docs; sets status TRAFFICKED
// Cross-media reach (partner or advertiser scope)
// GET  /api/dv/partners/:pid/cross-media-reports | /api/dv/advertisers/:aid/cross-media-reports  ListQuery
// GET  /api/dv/cross-media/options?country=   -> { currency; subLocations: Id[]; campaigns/IO tree; tvCampaigns by company }
// action createCrossMediaReport({ country; scope: 'NATIONAL'|'SUB_LOCATION'; subLocationIds?: Id[]; ioIds: Id[]; tvCampaignIds: Id[] })
// GET  /api/dv/cross-media-reports/:id
```

### 8.11 Audiences

```ts
// GET /api/dv/advertisers/:aid/audiences?tab=FIRST_PARTY|CUSTOM|COMBINED|PARTNER   ListQuery<{ type: string[] }>
interface AudienceRow { id: Id; name: string; type: 'TAG_BASED'|'CUSTOMER_MATCH'|'YOUTUBE_USERS'|'LOOKALIKE'|'COMBINED'|'CUSTOM_AFFINITY'|'CUSTOM_INTENT'|'COMMERCE';
  source: string; displaySize: string /* bucket "< 1K" */; youtubeUsers?: string; mobileApp?: string; ctvDevices?: string; activeDisplaySize?: string; displayLineItems?: number }
// GET /api/dv/audiences/:id
type AudienceInput = WriteMeta & { name: string; description?: string } & (
  | { kind: 'TAG_BASED'; floodlightActivityId: Id; rules: { variable: string; operator: string; value?: string }[] }
  | { kind: 'CUSTOMER_MATCH'; source: 'CONNECT'|'UPLOAD'|'LATER'; uploadId?: Id; fileFormat?: string }
  | { kind: 'YOUTUBE_USERS'; channelId: string; rule: string }
  | { kind: 'COMBINED'; include: Id[][]; exclude: Id[] }
  | { kind: 'LOOKALIKE'; seedIds: Id[] /* max 10 */; reachPct: 2.5|5|7.5|10; geography: Sel[] }
  | { kind: 'CUSTOM_AFFINITY'; interests: string[]; urls: string[]; apps: string[] }
  | { kind: 'CUSTOM_INTENT'; surface: 'DISPLAY_VIDEO'|'YOUTUBE'; keywords: string[]; urls: string[] });
// action createAudience(aid, AudienceInput) | updateAudience(id, AudienceInput) | archiveAudience(id)
// POST /api/dv/audiences/estimate     { advertiserId; draft: AudienceInput } -> { size: string } | { unavailable: true }   (Impressions Estimator)
// GET  /api/dv/audiences/taxonomy?type=AFFINITY|IN_MARKET|LIFE_EVENT|DETAILED_DEMOGRAPHICS&q&path  -> { id; name; path: string[]; eligibility: string[] }[]
// GET  /api/dv/advertisers/:aid/audience-pickers?type=FIRST_PARTY|PAIR|PARTNER|COMMERCE|LINEAR_TV|THIRD_PARTY&q&eligibility=DISPLAY
// POST /api/dv/audiences/analysis/geo-distribution  { seedAudienceId } -> GeoDistribution
// GET  /api/dv/line-items/:liId/audience-insights   (only LIs with optimized targeting) -> AudienceInsights
```

### 8.12 Resources

```ts
// Channels, keyword lists, location lists (advertiser or partner scope: parent is :aid or :pid)
// GET /api/dv/{advertisers|partners}/:id/channels          ListQuery -> { id; name; apps: number; urls: number; includedByLis: number; excludedByLis: number }
// GET /api/dv/channels/:cid   | action createChannel(parent, { name; sites: string[] /* max 10000 */ }) | updateChannel(id, ...) | deleteChannel(id)
// GET /api/dv/advertisers/:aid/negative-keyword-lists      ListQuery -> { id; name; keywords: number; lineItems: number }
// GET /api/dv/negative-keyword-lists/:id    -> { name; keywords: string[]; lineItems: { id; name }[] }
// action createNegativeKeywordList(aid, { name; keywords: string[] /* max 5000 */ }) | updateNegativeKeywordList(id, ...) | deleteNegativeKeywordList(id)
// GET /api/dv/advertisers/:aid/location-lists              ListQuery -> { id; name; type: 'PROXIMITY'|'REGIONAL'; count: number; lineItems: number }
// action createLocationList(aid, { name; type; entries: string[] }) | updateLocationList(id, ...) | deleteLocationList(id)
// Floodlight
// GET  /api/dv/{advertisers|partners}/:id/floodlight-group
// action updateFloodlightGroup(id, WriteMeta & { imageTagOnly; dynamicTag; personalizedAdExclusions; consent; attribution: { clickDays; impressionDays; models: Id[] };
//          viewableImpressionPct; appAttributionLinks; analyticsLinks; conversionGroups; customVariables: { slot: number; name: string }[]; enhancedConversions })
// GET  /api/dv/advertisers/:aid/floodlight-conversions  ListQuery<{ status: string[] }> -> FloodlightRow
// GET  /api/dv/floodlight-conversions/:id
// action createFloodlightConversion(aid, { platform: 'WEB'|'MOBILE_APP'|'CONNECTED_TV'; name; status; format: 'GOOGLE_TAG'|'IFRAME_TAG'|'IMAGE_TAG';   // RC-009: DM keys
    type: 'COUNTER'|'SALE';
//          counting: 'STANDARD'|'UNIQUE'|'PER_SESSION'|'TRANSACTIONS'|'ITEMS_SOLD'; category?: string; personalizedAdExclusion: boolean;
//          customVariableIds: string[]; remarketing: boolean; youtubeEnabled: boolean; valueBasedBidding?: boolean; commercePartner?: boolean })
// action updateFloodlightConversion(id, ...)
// GET  /api/dv/advertisers/:aid/google-tag (read only)
// Custom bidding
// GET  /api/dv/{advertisers|partners}/:id/custom-bidding  ListQuery<{ source: string[]; owner: string[]; status: string[] }> -> { id; name; source: 'RULE_BASED'|'SCRIPT'|'GOAL'; owner; status: 'ACTIVE'|'SUSPENDED'|'TRAINING'; readiness; updated; activeLis: number; errorPct: number }
// action saveCustomBiddingDraft(parent, { name; objective: 'BRAND_AWARENESS'|'CLICKS'|'CONVERSIONS'|'CUSTOM'; rules: { signal: string; value: boolean|string; score: number }[]; multipliers: { dimension: string; values: Record<string, number> }[] /* max 4 */ })
// POST /api/dv/custom-bidding/:id/test  -> TestResult   |  action activateCustomBidding(id) | suspendCustomBidding(id)
// YouTube assets / creator partnerships
// GET  /api/dv/advertisers/:aid/youtube-assets?tab=LOCATION|AFFILIATE|SITELINK&campaignId&d=   ListQuery
// GET  /api/dv/advertisers/:aid/creator-partnerships?tab=...        (static content)
// Brand controls
// GET  /api/dv/{advertisers|partners}/:id/brand-controls?tab=DISPLAY_VIDEO|YOUTUBE
//   -> { coverage: { key: 'DIGITAL_CONTENT_LABEL'|'APPS_URL_CHANNEL'|'KEYWORD'|'AUTHORIZED_SELLERS'|'VERIFICATION'; pct: number; lis: [number, number]; summary: string }[]; ivt?: unknown }
// GET  /api/dv/{advertisers|partners}/:id/brand-controls/:key/breakdown   ListQuery
```

### 8.13 Reporting

```ts
interface ReportDefinition {
  id?: Id; kind: 'INSTANT'|'OFFLINE'; offlineType?: 'FLOODLIGHT'|'INVENTORY_AVAILABILITY'; name: string;
  timeZone: 'ADVERTISER'|'UTC'; dateRange: DateRangeParam;
  filters: { field: string; op: 'IN'|'NOT_IN'|'EQ'; values: string[] }[];     // always includes Partner
  dimensions: string[]; metrics: string[];
  viz: { type: 'TABLE'|'PIVOT_TABLE'|'COLUMN'|'TIME_SERIES'|'PIE'|'SCATTER'; options?: unknown };
  schedule?: { active: boolean; timeZone: string; repeats: 'DAILY'|'WEEKLY'|'MONTHLY'|'QUARTERLY'|'YEARLY'; every: number; starts: IsoDate; expires?: IsoDate };
  delivery?: { format: 'CSV'|'XLSX'; fileName: string; emailOwner: boolean; attachment?: boolean; shareWith: Id[] };
}
// GET  /api/dv/partners/:pid/reports?kind=&createdBy=me      ListQuery -> { id; kind; name; createdBy; modified; files: number }
// GET  /api/dv/reports/templates                              -> { family: 'BASIC'|'REACH'|'VIDEO'; key; title; description; definition: ReportDefinition }[]
// GET  /api/dv/reports/fields?q&category&kind                 -> { key; label; category; type: 'DIMENSION'|'METRIC'; downloadOnly?: boolean }[]   (~700 fields, seed from 12)
// GET  /api/dv/reports/:id
// action saveReport(partnerId, ReportDefinition & WriteMeta) | saveReportAs(id, name) | deleteReport(id) | scheduleReport(id, schedule)
// POST /api/dv/reports/query    { partnerId; definition: ReportDefinition; limit? } -> { columns; rows; truncated: boolean }    (instant canvas, auto-run)
// action runReport(id | definition) -> { runId }              creates a ReportRun file
// GET  /api/dv/reports/:id/runs          -> { fileId: Id; dateRange; createdBy; completedAt: IsoDateTime|null; format: 'CSV'|'XLSX' }[]
// GET  /api/dv/report-runs/:runId/download?format=csv|xlsx    file stream
// POST /api/dv/reports/generate { prompt }                    -> ReportDefinition   (Generate report BETA; canned/LLM)
```

### 8.14 Advertiser settings

```ts
// GET|PATCH /api/dv/advertisers/:aid
interface AdvertiserDetails extends WriteMeta {
  name: string; status: 'ACTIVE'|'PAUSED'; website: string;
  currency: string /* locked */; timeZone: string /* locked */; id: Id /* read-only */;
  sdfVersion: '9'|'9.1'|'9.2'|'10'|'10.1'|'11'; sdfAdminEmail?: string;
  adServer: 'THIRD_PARTY_ONLY'|'CM360'; attributionFloodlightConfigId: string;
  authorizations: { productImprovement: boolean; orderIdReporting: boolean; adBadging: boolean; commercePartnerSharing: boolean;
    creativesContainTracking: boolean; videoCreativesForTv: boolean; prismaIntegration: boolean };
  euPoliticalAds: 'YES'|'NO';
  youtubeDemandGen: { useFloodlightForDemandGen: boolean; businessName?: string; logoAssetId?: Id };
  integrationCode?: string; thirdPartyServices: ThirdPartyServices;
}
// action updateAdvertiser(id, AdvertiserDetails) | saveAdServerAttribution(id, ...) | saveThirdPartyServices(id, ThirdPartyServices)
// action scheduleAdvertiserDeletion(id) -> status SCHEDULED_FOR_DELETION
// GET|PUT /api/dv/advertisers/:aid/targeting-rules    TargetingRules { brandSuitability; channelsAndYoutubeUrls; keywords; viewability }
// GET /api/dv/advertisers/:aid/data-manager           -> { googleTag: { name }; products: unknown[] }
// GET /api/dv/advertisers/:aid/linked-accounts        -> { type; linked: number }[]
// action linkAccount(aid, { type: 'ADS_DATA_HUB'|'EXTERNAL_DATA_PARTNER'|'YOUTUBE_CHANNEL'|'YOUTUBE_CREATOR_VIDEO'|'GOOGLE_ADS'|'BIGQUERY_EXPORTER'; ... })   // from public docs
// GET|PUT /api/dv/advertisers/:aid/alert-preferences
interface AlertPreferences { noSpend: boolean; underpacing: { on: boolean; thresholdPct: number /* default 90 */ }; underperforming: boolean;
  limitedAudienceSize: boolean; dealsOffline: boolean; restrictedAudienceList: boolean; rejectedCreative: boolean; restrictedCreative: boolean;
  spendThreshold: { on: boolean; amount: Money }; mismatchedSettings: boolean }
// GET /api/dv/advertisers/:aid/policy-certificates   -> { type; status: string }[]
// action requestPolicyCertificate(aid, { type; country? })      (internal request, instructor approves)
// action decidePolicyCertificate(certId, { decision: 'APPROVED'|'REJECTED'; note? })   ADMIN-SIM / INS only; RC-052 (shown in the instructor console "Requests" tab)
```

### 8.15 Bulk jobs, SDF, exports

```ts
// Bulk status page
// GET /api/dv/bulk-jobs   ListQuery<{ partnerId; advertiserId; source: ('DUPLICATION'|'BULK_EDIT'|'CAMPAIGN_DOWNLOAD'|'SDF_DOWNLOAD'|'SDF_UPLOAD')[]; allUsers: ['true'] }> (max 100 most recent)
interface BulkJobRow { id: Id; requested: IsoDateTime; partnerId: Id; advertiserId: Id|null; description: string; source: string; user: string; lastUpdated: IsoDateTime;
  status: 'RUNNING'|'COMPLETED'|'FAILED'; action?: { label: 'View'|'Results'; href: string } }
// GET /api/dv/bulk-jobs/:id/result       file stream (SDF-ResultFiles.zip, download zip)
// SDF (scope = campaign, IO or LI selection, or whole advertiser / partner list)
interface SdfDownloadRequest { scope: { advertiserId?: Id; partnerId?: Id; entity?: BulkEntity; ids?: Id[] };
  include: { campaigns: boolean; mediaProducts: boolean; insertionOrders: boolean; lineItems: boolean; adGroups: boolean; ads: boolean };
  kind: 'DATA'|'METADATA'|'QA'; version?: string /* default advertiser sdfVersion */ }
// action requestSdfDownload(SdfDownloadRequest) -> { jobId }       (file via bulk-jobs result)
// action requestSdfUpload({ advertiserId?; partnerId?; uploadIds: Id[] /* one CSV per entity */ }) -> { jobId }
//        result zip = SDF-ResultFiles.zip with separate success and failure files; row errors use validation.md codes
// POST /api/dv/exports/view-csv { gridKey; query: ListQuery }      -> file stream (⌘+Shift+L)
```

### 8.16 Experiments

```ts
// A/B tests
// GET /api/dv/advertisers/:aid/experiments  ListQuery -> { id; name; arms: number; status: 'ACTIVE'|'COMPLETED'; startDate; endDate: IsoDate|null }
// GET /api/dv/experiments/:id
interface AbTestInput extends WriteMeta {
  name: string; hypothesis?: string; startDate: IsoDate; endDate?: IsoDate;
  compare: 'INSERTION_ORDERS'|'LINE_ITEMS';
  arms: { name: string; splitPct: number; isControl: boolean; entityIds: Id[] }[];     // splits total 100; one control
  goal: 'CLICKS'|'CONVERSIONS'|'REACH'|'CUSTOM_IMPRESSION_VALUE'|'VIDEO_COMPLETIONS'|'VIEWS_YOUTUBE';
  confidence: 90|95; excludeUnidentifiedUsers: boolean; brandLift?: BrandLiftInput;
}
// action createAbTest(aid, AbTestInput) | updateAbTest(id, AbTestInput) | endAbTest(id)
// GET /api/dv/experiments/:id/report?controlArm&metric&confidence&d=   -> { tiles: unknown[]; series: unknown[]; best: string|'N/A' }
// GET /api/dv/experiments/:id/differences  -> { rows: { setting; arm1: string; arm2: string }[] }
// GET /api/dv/advertisers/:aid/experiment-candidates?compare=&q  -> { id; name; warning?: string }[]   (arm picker)
// Lift studies
// GET /api/dv/advertisers/:aid/lift-studies  ListQuery -> { id; name; ios: number; brandLift?: { flight: number; state: 'COMPLETE'|'IN_PROGRESS'|'NOT_ELIGIBLE'; pct?: number }; searchLift?: unknown }
interface BrandLiftInput { metrics: ('VIDEO_AD_RECALL'|'AWARENESS'|'CONSIDERATION'|'FAVORABILITY'|'PURCHASE_INTENT'|'ASSOCIATION')[] /* max 3 */;
  brandName: string; competitors: string[] /* max 3 */; language: string; objectType?: string; intendedAction?: 'BUY'|'CHOOSE'|'USE'; strength: 'STANDARD'|'ENHANCED' }
interface LiftStudyInput extends WriteMeta { name: string; ioIds: Id[]; brandLift?: BrandLiftInput; searchLift?: { termGroups: string[][] /* max 5 */ } }
// POST /api/dv/lift-studies/eligibility { advertiserId; ioIds; types; brandLift?: ... } -> { perType: { type; eligible: boolean; requiredMediaCost: Money; yourMediaCost: Money; window: [IsoDate, IsoDate] }[] }
// GET /api/dv/lift-studies/eligible-ios?advertiserId&pg=true|false&onlyEligible=true&q
// action createLiftStudy(aid, LiftStudyInput) | updateLiftStudy(id, LiftStudyInput) | endLiftStudy(id, 'BRAND'|'SEARCH') | addLiftFlight(id)
// GET /api/dv/lift-studies/:id/report?tab=YT_DG|CROSS_EXCHANGE&liftType=ABSOLUTE|RELATIVE|HEADROOM&slice=OVERALL|AGE|GENDER|IO|LI|DEVICE|VIDEO|CREATIVE|DOMAIN|VERTICAL&d=
```

### 8.17 History, notes, alerts, Intelligence

```ts
// GET /api/dv/history?entityType=ADVERTISER|CAMPAIGN|IO|LI&entityId&d=&s=0|1&tz=advertiser|local
//   -> { spend: SpendPoint[]; days: { date: IsoDate; weekday: string; entityLabel: string; count: number; notesCount: number;
//        changes: { time: string; user: string; system: boolean; summary: string; lines: string[] }[] }[] }
//   line format: "{field}: {label} changed from "{old}" to "{new}""; creation lines "{Field} is {value}" (17)
// GET /api/dv/history/download?...same params    CSV
// GET /api/dv/history/notes?entityType&entityId&date   |  action addHistoryNote({ entityType; entityId; date; text })   [STD write, RC-048]
// GET /api/dv/intelligence?scope=ADVERTISER|CAMPAIGN|IO|LI_FORM&id=
//   -> { health: { severity: 'ERROR'|'WARNING'; text: string; count: number; investigate: { route: string; query: Record<string,string[]> }; historyRoute?: string }[];
//        suggestions: { text: string; investigate: { route: string; query: Record<string,string[]> } }[] }
// Alerts tab data: see 8.4. Alert generator reads AlertPreferences (8.14).
// Custom charts
// GET /api/dv/chart-views?viewKey=&scope= | action saveChartView({ viewKey; cards: ChartCardSpec[] }) | resetChartView(viewKey)
// POST /api/dv/charts/ai { prompt; scope } -> ChartCardSpec        (AI prompt box; canned or LLM)
// GET /api/dv/charts/starters -> ChartCardSpec[]
```

### 8.18 Assistant

```ts
// POST /api/dv/advisor/chat   { sessionId?: Id; message: string; context: ScopeRef }  -> text/event-stream of tokens
// GET  /api/dv/advisor/sessions | GET /api/dv/advisor/sessions/:id    (history list, Resume most recent chat)
// POST /api/dv/advisor/feedback { messageId; vote: 'UP'|'DOWN' }
// GET  /api/dv/help?path=<route pattern>&q=   -> { relevant: Article[]; related: Article[]; results?: Article[] }
```

### 8.19 Simulator: auth, classes, access windows

```ts
// Auth.js: /api/auth/[...nextauth]  (credentials)
// GET /api/sim/session -> { user: { id; name; role: 'student'|'instructor'|'admin'; classId?: Id }; classOpen: boolean; nextWindow?: IsoDateTime; viewAs?: Id }
interface ClassInfo { id: Id; name: string; instructorIds: Id[]; studentCount: number; sandboxTemplateId: Id }
interface AccessWindow { id: Id; classId: Id; startsAt: IsoDateTime; endsAt: IsoDateTime; timeZone: string; repeat?: { freq: 'WEEKLY'; byDay: string[]; until: IsoDate }; note?: string; state: 'SCHEDULED'|'OPEN'|'CLOSED' }
// GET /api/sim/classes | GET /api/sim/classes/:id | action createClass / updateClass / archiveClass
// GET /api/sim/classes/:id/students | action addStudents({ classId; students: { name; email }[] } or csv uploadId) | removeStudent | resetPassword
// GET /api/sim/classes/:id/access-windows | action createAccessWindow / updateAccessWindow / deleteAccessWindow
// action openClassNow(classId, { until?: IsoDateTime }) | closeClassNow(classId)
```

### 8.20 Simulator: sandboxes, clock, scenarios, engine

```ts
// Sandboxes
// GET /api/sim/classes/:id/sandboxes -> { userId; partnerId; state: 'READY'|'RESETTING'|'FAILED'; lastResetAt }[]
// action resetSandbox({ scope: 'USER'|'CLASS'; userIds?: Id[]; classId?: Id; snapshotId?: Id })
// action createSnapshot(classId | userId, name) | restoreSnapshot(snapshotId)
// Clock (engine ticks are one simulated hour)
interface SimClock { classId: Id; simNow: IsoDateTime; mode: 'RUNNING'|'PAUSED'|'STEPPING'|'LOCKED'; speedX: number /* sim seconds per real second; 288 = 1 sim day per 5 real minutes */ }
// GET /api/sim/classes/:id/clock  | action setClock({ classId; mode?; speedX?; jumpTo?: IsoDateTime }) | action stepClock({ classId; ticks: number })
// Scenarios
interface Scenario { id: Id; title: string; brief: string /* markdown */; seedTemplateId: Id; accessOverride?: AccessLevel; estimatedMinutes: number;
  tasks: { id: Id; text: string; check: { kind: string; params: Record<string, unknown> } }[] }   // check kinds are defined in P5
// GET /api/sim/scenarios | GET /api/sim/scenarios/:id | action createScenario / updateScenario / assignScenario(classId, scenarioId, { opensAt?; dueAt? })
// action startAttempt(scenarioId) -> { attemptId }  (resets or forks the student's sandbox per scenario)
// GET /api/sim/attempts/:id -> { state; tasks: { id; done: boolean; evidence?: string }[] }
// POST /api/sim/attempts/:id/check     run auto-checks now (also run after each write by a hook)
// GET /api/sim/progress?classId&userId
// Announcements (feed the bell)
// GET /api/sim/announcements | action createAnnouncement({ classId; title; body; learnMoreRoute?; expiresAt? }) | deleteAnnouncement(id)
// Engine
// POST /api/sim/engine/tick      Vercel Cron, header x-cron-secret; advances every RUNNING class by the elapsed ticks
// action runEngineNow(classId)   instructor / admin; same code path as the cron
// View-as: GET any DV URL with ?sim_as=; no separate endpoint (resolved in `(dv)/layout.tsx`)
```

> Resolved RC-028: the clock is stored per sandbox (DM `SimClock`, ENG 1.2); a class-level action applies to every sandbox of the class. `speedX` is a display conversion of `minutesPerSimDay`.

---

## 9. Build notes for P3-03 (app shell) and P3-06

Route files to create first, in this order, so Phase 3 can run in parallel cloud sessions:
1. `middleware.ts`, `/sim/login`, `(dv)/layout.tsx`, `404`, catch-all.
2. `(app)/layout.tsx` (TopBar, RailHost, BannerStack), `ScopeContext`, `SideNav` driven by the three nav trees in section 4 (`lib/nav/trees.ts` as typed data: `{ key, label, icon, href(ctx), match[], children?, badge?, minLevel }`).
3. Partner: `home_v3`, `advertisers`. Advertiser: `cs`, `cs/new`. Campaign: tabs, `ios/new`. IO and LI pages with tab frames, `lis/new`.
4. Shared: `AppLink` + `useUnsavedGuard`, `DialogHost`, `useListParams()` (parses `d`, `q`, `f.*`, `sort`, `rows`, `page`, `cv`, `seg`), `DateRangePicker`, `DataGrid` wrapper.
5. Every other route can start as a stub page inside the correct frame ("Not built yet" card) so navigation, 404 behaviour and breadcrumbs are testable from day one.

Smoke tests (Playwright, P6-02): every row of section 3 returns 200 for a `STANDARD` student, 404 for another student's sandbox ids, 404 for `REPORTING_ONLY` on non-reporting routes; redirects in 6.3 land on the target; `/a/{aid}/audiences` returns the 404 page; closing the access window sends a student to `/sim/closed` on the next navigation.

---

## 10. Open questions

| # | Question | Default used in this spec |
|---|---|---|
| Q1 | Do `F` pages keep the Google-style top bar? 03 says "Full-screen form, header X + title, Advertiser banner stays" but does not say if the top bar is hidden. | Top bar hidden, paused banner kept. |
| Q2 | URLs for the campaign page Line items and Combined tabs, the campaign History tab and the campaign-level Inventory pages were not captured. | `explorerlis`, `explorercombined`, `history`, and `[C]/marketplace/...` by pattern. |
| Q3 | The pin icon on the campaign tab strip: is the pinned tab per user or per campaign, and does `/c/{cid}` really redirect to it? | Per user, redirect honours it. |
| Q4 | Which nav groups are open on first load in DV360? | Only the group of the active item. |
| Q5 | How do users switch advertiser? Crumbs were not switchers. | Partner > Advertisers list; crumbs are plain links. |
| Q6 | Real URLs inside the reporting app (builder, runs, offline). Only the hub is known. | Section 3.12 paths. |
| Q7 | `type` and `hostingSrc` codes for the other creative kinds (only third-party display = 0 / 1 was seen). | Simulator also accepts `?kind=`; codes assigned in `lib/routes/creative-kinds.ts`. |
| Q8 | Does DV360 warn when leaving a `details` edit page with unsaved changes? Only X-close on forms and the channel editor were seen. | Soft guard on details pages with the same dialog. |
| Q9 | Where do Create buttons land afterwards (not tested, forms were discarded). | Table in 6.3. |
| Q10 | Should students be `STANDARD` or `ADMIN` on their sandbox partner? `ADMIN` lets them practise Users, but also lets them change partner settings. | `STANDARD`; scenarios can raise it. |
| Q11 | Exact abilities of `PARTNER_CLIENT` and `CREATIVE` roles (seen once / documented only). | Section 2 table. |
| Q12 | When the access window ends: hard stop, or a grace period to save work? | Hard stop for writes, banner 5 minutes before. |
| Q13 | Should students see the sim clock chip, and may they change speed? | Visible, read-only. |
| Q14 | Public ID shape. DV360 ids are numeric (7 to 10 digits, orders start with "MP", packages are UUIDs). Same shape in the simulator, or short opaque ids? Affects URL param validation. | Opaque strings; validation by regex per segment. |
| Q15 | Keep `/ng_nav/**` redirect permanently? | Yes, cheap and useful. |
| Q16 | Vercel body limit (about 4.5 MB per function) vs SDF uploads, creative zips and videos. Confirm Vercel Blob (or equivalent) is acceptable. | `uploads/sign` flow. |
| Q17 | Live refresh: should lists poll as the sim clock advances (SSE vs 30-second polling vs manual Refresh)? | Manual refresh + 30-second poll on list pages. |
| Q18 | Edit conflicts when an instructor "views as" or two tabs edit the same entity. | `expectedVersion` on all updates. |
| Q19 | Deal Settings are "view only" for most users in DV360. Which fields may students edit? | Only status, frequency cap, advertiser access. |
| Q20 | Advertiser-level LI list (`[A]/explorerlis`) is only implied by the Archived menu. Is there a visible tab? | Route exists, reached only from the IO list ⋮ menu. |
| Q21 | Billing, invoices, partner costs and revenue models are not in the demo nav. Build routes later from docs? | No routes now. |
| Q22 | Reconcile DTO names and enums with `data-model.md` (P2-01), issue codes with `validation.md` (P2-04), diagnostics and forecast shapes with `engine.md` (P2-05). | This file is the source for route and endpoint names; the other specs are the source for field names. |
| Q23 | Are Back / Forward expected to close slide-overs? Chosen for `sim_panel` panels only. | Yes for `sim_panel`, no for draft-bound editors (Esc / Cancel). |
| Q24 | Should `READ_ONLY` students see the "Limited Access" chip exactly as in the demo? | Yes, same grey chip next to the page title. |
