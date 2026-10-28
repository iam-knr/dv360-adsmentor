# 11 — Resources (advertiser level)
Path: Advertiser → Resources ▸ Brand controls / Channels & keywords / Floodlight group / YouTube assets / YouTube creator partnerships / Location lists / Custom bidding   Level: Advertiser
Explored: 2026-10-28. Nothing saved (forms discarded; one temporary name typed into an unsaved wizard). Names/IDs are placeholders (R5).

## Routes
| Page | Route |
|---|---|
| Brand controls | `/a/{aid}/brand/controls` |
| Channels | `/a/{aid}/channels` |
| Negative keyword lists | `/a/{aid}/negative-keywords` |
| Floodlight – conversions | `/a/{aid}/fl/events` (new: `/fl/events/new`) |
| Floodlight – basic details | `/fl/details` |
| Floodlight – Google tag | `/fl/google-tag` |
| YouTube assets | `/a/{aid}/location-extension` |
| YouTube creator partnerships | `/a/{aid}/creator-partnerships-hub/discover` |
| Location lists | `/a/{aid}/location-lists-v2` (new: `/ll/new`) |
| Custom bidding | `/a/{aid}/custom-bidding` (new: `/custom-bidding/new`) |

## Views

### Brand controls ("Settings overview")
- Header "Settings overview (help)" + "Edit settings (SDF)" link; tabs **Display and Video | YouTube**; sub-filter.
- Coverage rows (each: title, big % + "(n/total Line items)", progress bar, summary line, "View breakdown"):
  - Digital content label exclusions — "Advertiser restrictions: enabled"
  - Apps, URL, and channel exclusions — "Partner restrictions: none · Advertiser restrictions: none"
  - Keyword exclusions — "Advertiser restrictions: none"
  - Authorized sellers
  - Verification services
- Legend Enabled (blue) / Disabled (grey). Right card "Invalid traffic filtered pre-bid (help)" (chart or "No data available").

### Channels & keywords
- Tabs **Channels | Negative keyword lists**.
- Channels: "New channel"; filter; columns Channel · Mobile & CTV Apps (count) · URLs (count) · Included by line items · Excluded by line items; pager.
- Negative keyword lists: "New List"; columns Keyword list · Keywords (count) · Line items (count).

### Floodlight group
- Title "Floodlight group"; tabs **Basic details | Floodlight conversions | Google tag | History**.
- **Floodlight conversions**: "New Floodlight conversion"; filter chip Status: Active. Header groups Floodlight Conversion | DV360 Conversion | Web. Columns: Name + ID · Status · Source (Iframe tag / Google tag) · Type (Counter / Sale) · Counting Method (Standard…) · Category (Page view, —) · Remarketing List (Yes/No) · YouTube Conversion Tracking (Yes/No) · Line Items (count) · Impressions (Yesterday).
- **New Floodlight conversion**: type picker Web (visits, purchases on website) · Mobile app (installs, in-app conversions) · Connected TV (CTV app conversions). Web form:
  | Field | Options |
  |---|---|
  | Name + status (Active ▾) | |
  | Format (help) | Google tag · Iframe tag · Image tag |
  | Type (help) | Counter · Sale |
  | Counting method (help) | Standard (count every conversion) · Unique (first per user per 24-h day, US Eastern) · Per session (one per user per session) · Transactions (all conversions + sales count + revenue) · Items sold (per transaction + per item + revenue) |
  | Category (help) | Select · **Sales**: Purchase, Add to cart, Begin checkout, Subscribe (paid) · **Lead**: Contact, Submit lead form, Book appointment, Sign-up, Request quote, Get directions, Outbound click, Qualified lead, Converted lead · **More**: Page view |
  | Personalized ad exclusions | Don't exclude locations / Exclude all locations for this conversion |
  | Custom Floodlight variables | "No custom variables configured." ✎ |
  | DV360 conversion settings (advertiser-only) | ☐ Remarketing (enable for remarketing; first-party list can take up to an hour) · ☐ YouTube-enabled Floodlight · Value based bidding (needs "Enable Floodlight optimization for YouTube") · Commerce partner measurement (link sales data) |
  Footer Create · Reset.
- **Basic details**: Name, ID; Web tag settings: Image tag only (OFF), Dynamic tag (ON) + note; Personalized ad exclusions; Default consent settings for tag data ✎; for imported/uploaded data ✎; Services that can receive imported/uploaded data ✎; **Attribution**: Conversion window Clicks [n] Days · Impressions [n] Days; Attribution Models (e.g. "2 attribution models: Floodlight Attribution Model (0), Second … Last Click (id)") ✎; Viewable Impressions: % of Active View ineligible impressions to include (e.g. 50%); **Partner integrations**: App attribution (n app attribution partner links e.g. app – Adjust / Appsflyer), Google Analytics (none linked) ✎; **Conversion groups** (n groups) ✎; **Custom variables** (u1…u100 names, "show n more") ✎; Engaged View custom metric ✎; Active View custom metric ✎; Enhanced conversions (turn on).
- Google tag tab: content loads slowly (tag snippet / setup) — not captured.

### YouTube assets
- Tabs **Location | Affiliate location | Sitelink**. "Apply campaign filter" button, "Data for all time", ⋮. Columns Name · Filters · Status · Clicks · Impressions · CTR · Avg. CPC. Row "Advertiser level setting (All listings from {account})" expandable.

### YouTube creator partnerships (BETA)
- Tabs Overview · Creator search · Content discovery · Management · Analytics (embedded app; content not loaded in demo).

### Location lists
- "Create new"; columns Location list name · Id · Type (Proximity / Regional) · Number of locations · Line items.
- New location list: Location list name; Location list (help) radio **Regional Targeting** (postal codes or DMA regions) / **Proximity Targeting** (street addresses or lat/long pairs); textarea "Paste in line separated postal codes or DMA regions."; counter "0 locations"; Save · Cancel.

### Custom bidding
- Promo banner (e.g. third-party attention model) Learn more / Dismiss / Review.
- "New algorithm"; tabs/sections **Summary | Execution | My algorithms**. Columns: Name · Id · Source (Rule based / Script / Goal) · Owner (Advertiser/Partner) · Status (Suspended / Active / Training…) · Model Readiness · Updated · # of line items active · % of errors encountered.
- **New algorithm wizard**: stepper **1 Set up → 2 Test → 3 Save**.
  - Welcome card: signals like Active View, time on screen, player size; choose objective for relevant signals; multipliers for finer control.
  - Name (required); **Select an objective** cards: Brand awareness (RULES) · Clicks (RULES) · Conversions (RULES) · Custom (RULES, SCRIPT); Advertisers (current).
  - Settings → **Rules**: "Add rules to define which impressions are valuable and how they're scored." "At least 1 rule is required"; "Match ANY of the following"; group "Click rules" → Add rule (e.g. Clicked) → row [Clicked] is [True ▾] Score [1] ⓧ.
  - **Multipliers** (up to 4): Ad position · Creative dimension · Day and time · Device type · Genre · Delivery type · Duration.
  - Next → Test (not reached).

## Simulator rules (derived)
- Floodlight activity hits generated by engine from clicks/impressions with lag; counting method + attribution window determine reported conversions.
- Remarketing-enabled activities feed tag-based audiences (10).
- Custom bidding score = Σ rule scores × multipliers → used by LI bid strategy "Maximize custom value / cost".
- Brand controls percentages computed from LI settings.

## Open questions
- Channel create form, negative keyword list form, Floodlight Google tag tab, Mobile app / CTV conversion forms, custom bidding Test step, script editor.
