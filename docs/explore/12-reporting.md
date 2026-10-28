# 12 — Reporting
Path: Reports ▸ Instant & offline (partner or advertiser nav, or top-bar Reports icon)   Level: Partner (filters narrow to advertiser etc.)
Explored: 2026-10-28. Nothing saved or run. The reporting app is a full-screen page (header "← Reports") rendered in a same-origin iframe at `/reporting/`.

## Routes
| Page | Route |
|---|---|
| Reports hub (Instant / Offline tabs) | `/ng_nav/p/{pid}/reporting` |
| Cross-media reach | `/p/{pid}/cross-media-reach` (see 02) |

## Views

### Reports hub
- Tabs **Instant reporting | Offline reporting**.
- Collapsible card "Generate report (help) BETA" — AI natural-language report generation.
- **Suggested templates** carousel (colored top border by family, chip label, title, description, "Open template"; "View all" expander):
  | Family | Template | Description |
  |---|---|---|
  | BASIC | Advertiser Overview | Key performance metrics by advertiser |
  | BASIC | Insertion Order Pacing | Budget pacing by insertion order |
  | BASIC | App/URL Viewability | Active View viewability performance by App or URL |
  | REACH | Unique Reach | Unique Reach performance by advertiser and line item |
  | REACH | Unique Reach and Cost | Unique Reach and cost performance by insertion order |
  | REACH | Unique Household Reach | Unique Household Reach by advertiser and line item |
  | VIDEO | Video Performance | Key video metrics by creative |
- "New instant report" button; filter chip "Created by: Me"; table: report icon · Report name (link) · Created by · Last modified (sorted ↓) · Report ID · Files (View).

### Instant report builder
- Top: "← Return to Instant Report List", "Guided tour"; title "Untitled Report" ✎.
- Toolbar: Schedule (disabled until saved) · Bulk edit · Reset · Save · Save as · **Auto-run** toggle · Run report (refresh icon) · Download.
- Undo / Redo; **Time zone** dropdown (Advertiser / UTC, help); **Date range** picker (e.g. "Oct 21 – 27, 2026"; presets as in 02); Filter button; collapse panel ›.
- Filter bar: chip "Partner includes {partner} ({id})" ⓧ · Add; delete-all icon.
- Canvas empty state "Build an instant report": select filters, metrics, dimensions and date range; Run report; Auto-run for real-time updates; Direct download (with auto-run off, configure then download without running).
- Right panel: "Generate report BETA" collapsible; visualisation dropdown (**Table**: flat table / pivot table · **Column** · **Time Series** · **Pie** · **Scatter** …); drop zones **DIMENSIONS (ROW)** (abc) and **METRICS (COLUMN)** (123).
- Field picker: search "Search metrics and dimensions", ⋮, "+ Custom data"; **Frequently used**: Advertiser, Advertiser Currency, Clicks, Impressions, Insertion Order, Revenue (Advertiser Currency); **All data** categories (counts of fields seen): Active View (60), Audience (40), Brand Controls (15), CM360, Computer System (9), Conversions (≈84), Cost (54), Custom Bidding, Custom Impression Value, Date, Digital Out Of Home, Fees (148), General (135), Impression Loss, In-Stream Audio, In-Stream Video (5+), Invalid Traffic, Location (9), Performance (22), Profit (10), Programmatic Guaranteed Savings, Refund, Rich Media, Savings, TV, Unique Household Reach, Unique Reach (26), Unique Reach Audience, Unique Reach Overlap, Unique Reach Overlap (pivoted), Unique Reach by Frequency (pivoted), Win Loss, YouTube (60). Some fields tagged "Download-only".

#### Field catalogue (seed for simulator)
- **General (dimensions)**: AMP Page Request; Active View Expected Viewability; Ad Position; Ad Type; Advertiser; Advertiser Currency; Advertiser ID; Advertiser Integration Code; Advertiser Status; Advertiser Time Zone; App/URL; App/URL Excluded; App/URL ID; Asset Combination; Audio Feed Type; Authorized Seller State; Bid Strategy Type; Billable Outcome; Budget Segment Budget / End Date / Name / Pacing Percentage / Start Date; Budget Type (Segment); Business Chain; CTV Audience Expansion; Campaign; Campaign ID; Category; Central Partner ID; Channel; Channel ID; Channel Type; Click Type; Commerce Partner Name; Commitment Deal Mode / ID / Name; Companion Creative / ID / Size; Conversion Ad Event Type (+ID); Conversion Source (+ID); Conversion Type; Creative; Creative Asset; Creative Attributes; Creative Height / ID / Integration Code / Rendered in AMP / Size / Source / Status / Type / Width; Data Provider (+ID); Digital Content Label (IAR); Exchange; Exchange Code; Exchange ID; Format; Insertion Order; IO Daily Frequency; IO Goal Type; IO Goal Value; IO ID; IO Integration Code; IO Status; Inventory Commitment Type; Inventory Delivery Method; Inventory Media Cost Type; Inventory Rate Type; Inventory Source (+Group, IDs, Type, Permissions); Keyword; Language; Line Item; LI Budget; LI Daily Frequency; LI End Date; LI ID; LI Integration Code; LI Lifetime Frequency; LI Pacing Percentage; LI Start Date; LI Status; LI Type; MRAID Support; Matched Genre Target; Max Video Duration; Media Type; Merchant ID; Optimized Targeting; Order ID; Partner; Partner Currency; Partner ID; Partner Status; Platform; Position in Content; Public Inventory; Rewarded; Seller Id; Served Pixel Density; Sponsored Product Id; Targeted Data Providers; Targeted location; Time to Conversion; Variant ID / Name / Version; Video Ad Position In Stream; Video Content Duration; Video Content Live Stream; Video Creative Duration (+Skippable); Video Format Support; Video Player Size; Video Skippable Support (+IAR).
- **Performance (metrics)**: Average Bid Boost Factor; Begin to Render Eligible Impressions; Begin to Render Impressions; Bid Boost Eligible Impressions; Billable Impressions; Blocked Impressions; Click Rate (CTR); Clicks; Cookie Consented / Unconsented Floodlight Impressions; Cookie Unconsented Clicks; Duplicate Consented Floodlight Impressions; Engagement Rate; Engagements; Floodlight Impressions; Impressions; Impressions with Bid Boost; Inactive Impressions; Percentage from Current IO Goal; Provisional Impressions; Tracked Ads; Vendor Blocked Ads.
- **Location**: City, City ID, Country, DMA, DMA Code, Region, Region ID, Zip Code, Zip Code ID.
- **Computer System**: Attributed Event Platform Type, Browser, Device Make, Device Model, Device Type, Environment, ISP or Carrier (+ID), Operating System.
- **Profit**: Profit (Advertiser / Partner / USD), Profit Margin, Profit Viewable eCPM (×3 currencies), Profit eCPM (×3).
- **Cost**: Media Cost (×3 currencies), Media Cost eCPM / Viewable eCPM / eCPA (incl. PC, PV) / eCPC (incl. PC, PV) (×3 currencies), Audio Media Cost eCPCL, Total Media Cost …, (Revenue / Total Media Cost in Fees & Conversions).
- **Conversions**: % Clicks Leading to Conversions; % Impressions Leading to Conversions; Client Cost (+ eCPM, Viewable eCPM, eCPA PC/PV, eCPC); CM360 Post-Click / Post-View Revenue; Cart Revenue; Audio client cost/revenue eCPCL; Total Conversions, Post-Click, Post-View … (≈84 fields).
- **Active View**: % Audible Impressions; % Audible and Visible at Start / First Quartile / Midpoint / Third Quartile / Completion; % Full-Screen; % Fully On-Screen 2 sec; % In Background; % Measurable Impressions; % Play Time Audible / Visible / Audible and Visible; % Viewable Impressions; % Visible 10 Seconds; % Visible at Start / Quartiles / Completion; % of Ad Played … (60 fields).
- **Audience**: Age (Targeted); Gender (Targeted); Audience List (+Cost, ID, Type); First / Third Party Audience List (+Cost, ID, Type); Attributed Userlist (+…); Commerce Partner; Is Commerce; Match Ratio; Potential (Viewable) Impressions; Eligible Cookies on First-Party / Third-Party lists; Unique Cookies with Impressions; Targeted Audience List (+ID).
- **Brand Controls**: Audibility At Start / Complete; Digital Content Label; Domain; Sensitive Category; Subdomain; Verifiable Impressions; Verification Video Player Size / Position; Video Player Size at Start / Quartiles / Completion; Video Resized.
- **In-Stream Video**: Companion Clicks (Video); Companion Views (Video); QR scans; Skips (Video); Video Continuous Play (+ starts, quartiles, completions, CPCV in other groups).
- **YouTube**: Age (YouTube); Ad sequence impressions; Asset / Asset Status / Asset Type (+upgraded); Audience Segment (+Type); Average Impression Frequency per User (+7 days); Average Watch Time per Impression; Brand Lift metrics (Absolute Lift, survey responses, baseline rate, cost per lifted user, …); TrueView views/view rate/CPV …
- **Unique Reach**: Impression Reach (+Co-Viewed); Average Impression Frequency (+Co-Viewed); Average Viewable Impression Frequency; Click Reach; Cost per Unique Impression Reach (×3 currencies, +Co-Viewed); Added Impression Reach From Frequency Cap; Added Unique Impression Reach From Digital / Linear TV Deduplication; Programmatic Guaranteed Added Unique Reach …
- **Fees** (148): CPM fees, media fees, DV360 fee, data fees, verification fees by vendor, per currency.

### Offline reporting
- "New Offline Report ▾" → **Floodlight** · **Inventory Availability**; filter "Created by: Me"; table Report name · Report type · Created by · Last modified · Report ID · Files (View).
- Offline report builder (classic form): "← Return to Offline Report List"; name field; "ID / Report type" shown at right.
  - Report properties: Date range ("Last 7 days : {dates}" ▾); Language formatting (English (raw) — numbers without commas/currency).
  - Report setup: Report template (Floodlight: Floodlight Impressions / Order ID) "Choose a template to load reports with commonly prefilled settings"; Filters (help): green chips Partner = {partner} [+ select], Advertiser [+ add], "+ add filter"; Dimensions (help) "+ add / remove"; Metrics (help) blue chips (e.g. Floodlight Impressions) "+ add / remove".
  - Schedule: ☐ Active; Time Zone (e.g. Pacific Time); Repeats (Daily…); Every (1 day); Starts; Expires; Summary sentence ("Runs every day at 12 am in … until …").
  - Delivery: Format (CSV…); File name (date/time appended); Email owner ☐ (+ Attachment ▾); Share with "+ add people".
  - Info: "You can also access this report as an Instant Report — OPEN IN INSTANT REPORTING".
  - Buttons: SAVE AND RUN · Save · Cancel.

## Simulator rules (derived)
- Reporting engine aggregates `SimDailyMetric` by any dimension in the catalogue; metrics computed (CTR = clicks/impr, eCPM = cost/impr×1000, eCPA, viewability %, reach estimates).
- Currency triplets (advertiser / partner / USD) derived via fixed FX table.
- Download CSV/XLSX; schedules run on sim clock and "email" into an in-app inbox.

## Open questions
- Full lists for Date, Fees, Conversions, YouTube categories (long); pivot table and chart rendering; report results grid; "Generate report" AI behaviour; Inventory Availability report builder fields.
