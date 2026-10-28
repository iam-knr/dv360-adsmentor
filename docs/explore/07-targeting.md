# 07 — Targeting (shared panel)
Path: LI form → Targeting → "Add targeting" / ✎ on a row   Level: LI (also IO bulk edit, partner/advertiser defaults, targeting templates, YT ad group)
Explored: 2026-10-28 on a new Display LI (Clicks IO). Every editor opened and cancelled; nothing applied/saved.

## Common editor pattern
- Right slide-over, header "X {Dimension}" + AI/orbit icon; footer **Apply** · Cancel · 🗑 (remove dimension).
- List editors: search box "Search for {x} to include or exclude"; each row has ✓ include and ⊘ exclude toggles; selected items move to a "Included … / Excluded …" summary with ⓧ remove and "Clear".
- Added dimension shows as a row in the LI Targeting card with summary text, ✎, and "Save as template".
- "Add targeting" menu groups: **Content** (Brand suitability, Apps & URLs, Keywords, Categories, Environment, Position, Viewability, Language) · **Audience** (Audience lists, Geography, Day & time, Demographics) · **Technology** (Browser, Device, Connection speed, Carrier & ISP). Already-added items show "Added".
- YouTube LI menu is smaller (see 06): Keyword exclusions, Language, Inventory sources, Geography, Day & time, Device; ad group: Placements/keywords/categories, Demographics, Audience lists & expansion.

## Editors

### Geography
- "Add targeting selections" radio: ● **Region** (states, cities, postal codes, airports, universities) / ○ **Radius** (distance around a point of interest, business chains or location lists).
- Search "Search for locations" → dropdown "Regional Locations" with rows like "Mumbai, Maharashtra, India (City)", "(District)"; each ✓ / ⊘; footer Cancel / Done.
- Bulk icon → "Bulk add points of interest" textarea: "Paste in line separated street addresses or latitude/longitude pairs." ✓ Include / Cancel.
- Summary: "Included regions and targeted locations (n) — Clear", grouped "Region", each with ⓧ.
- Right: Google Map (Map/Satellite, fullscreen, zoom), selected regions shaded green, "Fit targeted locations".
- Default row: "All locations".

### Apps & URLs
- "Choose a category:" Channels (custom groups of apps/URLs, e.g. to exclude) › · Collections (dynamic groups of related apps provided by platform) › · URLs (individual websites/pages) › · Apps (CTV, Android, iOS apps) ›.
- "None selected"; actions "Add multiple apps and URLs at once", "Download composite list".
- "URL suggestions" card (needs landing page URLs/keywords in campaign) — View suggestions / Dismiss.

### Keywords
- Note: negative keyword exclusions can now be set at advertiser level (Learn more).
- Tabs/toggle **Include | Exclude**; textarea "Enter a list of keywords, either one item to a line or separated by commas." with counter.
- "Keyword suggestions — generated from existing keywords and/or landing page URL" → Generate suggestions.

### Categories
- Search + ✓/⊘ list of top-level categories: Arts & Entertainment, Autos & Vehicles, Beauty & Fitness, Books & Literature, Business & Industrial, Computers & Electronics, Finance, Food & Drink, Games, Health, Hobbies & Leisure, Home & Garden, Internet & Telecom, Jobs & Education, Law & Government, News, Online Communities, People & Society, Pets & Animals, Real Estate, Reference, Science, Shopping, Sports, Travel & Transportation, World Localities (each expandable to sub-categories).
- "Category suggestions" card.

### Environment
- Checkboxes: **Web** (inventory displayed in browsers) · **App** (inventory displayed in apps). Hint "Looking for related options? See position and device targeting."

### Position
- "Select position on screen" — Display: Above the fold · Below the fold · Unknown.
- **AND**
- "Select position in content" — Display: In-article · In-feed · Interstitial · In-banner · Unknown; Native: In-article · In-feed · Peripheral · Recommendation · Unknown.
- (Video/CTV LIs: "Position in content — In-stream …" and Video player size Large/HD etc.; see 05.)

### Viewability
- Open Measurement 🔒 "Target only Open Measurement enabled mobile display inventory." (pre-added for Display).
- Active View — Predicted Viewability dropdown: 90% or greater (most viewable) · 80% · 70% · 60% · 50% · 40% · 30% · 20% · 10% or greater · All impressions (greatest reach) (default).

### Language
- Search + ✓/⊘ list: Arabic, Bengali, Bulgarian, Catalan, Chinese (simplified), Chinese (traditional), Croatian, Czech, Danish, Dutch, English, Estonian, Filipino, Finnish, French, German, Greek, Gujarati, Hebrew, Hindi, Hungarian, Icelandic, Indonesian, Italian, Japanese, Kannada, Korean, Latvian, Lithuanian, Malay, Malayalam, Marathi, Norwegian, Persian, Polish, Portuguese, Punjabi, Romanian, Russian, Serbian, Slovak, Slovenian, Spanish, Swedish, Tamil, Telugu, Thai, Turkish, Ukrainian, Urdu, Vietnamese.

### Brand suitability
- LI row (pre-added): Inventory mode 🔒 Maximum inventory / Not yet labeled (advertiser-level only) + notes that sensitive-category and digital-content-label exclusions move to Advertiser settings › Targeting rules from Oct 2026.
- Editor: collapsible "Third-party brand suitability — n items selected". Provider dropdown: No third party verification (default, "Total cost: ~₹0.00 CPM") · DoubleVerify · Integral Ad Science · Scope3.
- DoubleVerify options with indicative CPM cost: Authentic Brand Safety (~₹20.95 CPM; note standard brand safety and fraud/IVT are disabled when ABS applied) · Brand safety (~₹5.71) · Display viewability (~₹12.38) · Fraud & invalid traffic (~₹5.71). Running total "Total cost: ~₹x CPM". (IAS / Scope3 sub-options not opened.)

### Audience lists (audience builder)
- **Include** section, groups joined by "OR":
  - First-party and partner audiences — "Add first-party and partner audiences to 'AND & OR' together." [Add] — side tip: combine into a new one; add in a group to expand, intersect groups to narrow.
  - Google audiences — "Add affinity, in-market, and other audiences to 'OR' together." [Add]
  - Combined audiences — previously created, OR together [Add]
  - Custom lists — "Add (or create new) custom lists to 'OR' together." [Create] [Select]
- **Exclude** section: First-party and partner audiences [Add] · Google audiences [Add].
- Right **Impressions summary** (blue header; "Based only on flight dates and targeting (without expansion)"): Overall impressions (e.g. 7.31T), Included impressions, Excluded impressions, Other targeting; Venn-style circle "(Diagram not to scale)"; **Gender** donut (Male 51% / Female 49%, "Data available for 95% of impressions"); **Age** bar chart 18-24…65+; **Desktop vs. Mobile** bars (Desktop, Mobile, Tablet, CTV).
- Picker (e.g. "Google audiences"): "Audience type" dropdown (Google: Affinity / In-market; First-party picker: First-party / PAIR / Partner / Commerce / Linear TV / Third-party); filter chip "Audience eligibility: Display"; search; rows = Name + full path (e.g. "Display & Video 360 Audiences » Affinity Categories » Sports & Fitness » Sports Fans » Basketball Fans") + ID; right pane "None selected — Clear all"; "Audience suggestions" card; Apply / Cancel.

### Demographics
- Gender: Male · Female · Unknown.
- Age: range slider 18 · 25 · 35 · 45 · 55 · 65 · 65+ ("Ages 18–65+") + ☐ Unknown.
- Parental status: Parent · Not a parent · Unknown.
- Household income: range Top 10% · Top 11-20% · Top 21-30% · Top 31-40% · Top 41-50% · Lower 50% + Unknown.

### Day & time
- "Your ads will only run during these times": columns Day · Time; "ADD SEGMENT"; "Apply preset schedule" (Custom · All days · Mondays-Fridays · Saturdays-Sundays).
- Time zone: Local · Advertiser.
- Right grid M–S × 12 AM…12 AM (3-hour ticks), shaded = "Targeted days and times".

### Browser
- Search + ✓/⊘: Android Browser, Firefox, Google Chrome, Microsoft Edge, Microsoft Internet Explorer 5–11 / Other, Mozilla, Netscape Navigator, Opera, Opera Next, Other, Safari, Safari 1…n, …

### Device
- Device Type: "4 items included; 0 items excluded" — Computer · Smartphone · Tablet · Connected TV.
- Operating System: "All items included" (expand to list).
- Make & Model: "All items included".

### Connection speed
- "Target by Include", "Netspeeds" dropdown: Unknown connection speed · Dialup (56kbps and slower) · Broadband/4G (2mbps and faster) · EDGE/2G (57kbps and faster) · UMTS/3G (384kbps and faster) · Basic DSL (768kbps and faster) · HSDPA/3.5G (1.8mbps and faster) · All connection speeds (default).

### Carrier & ISP
- Filter dropdown Any / ISP / Carrier; search; ✓/⊘ rows "Name — ISP|Carrier" (e.g. "3 - Australia — Carrier", "2KOM — ISP").

## Simulator rules (derived)
- Each dimension = include/exclude set; LI matches a bid opportunity only if every dimension passes (AND across dimensions, OR within a dimension; audiences use the group logic above).
- Impressions summary + demographics charts are forecasts → engine must estimate reachable supply per targeting combo.
- 3P verification adds CPM cost to the LI (feeds partner/media cost and reporting).

## Open questions
- Apps & URLs sub-pages (Channels / Collections / URLs / Apps) and Channels creation — see P1-11 Resources.
- Video-only targeting options (player size, content duration, livestream, rewarded) — open on a Video LI later.
- Custom lists create flow; lookalike/expansion options.
- IAS / Scope3 option lists.
