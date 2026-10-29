# 19 — Gap finish: creatives, line item types, YouTube ad groups, planning, A/B tests
Path: Advertiser B (second demo advertiser, INR, **paused**, has create access) → Creatives · Campaigns → New campaign → New IO → New LI (+ YouTube ad group) · Inventory ▸ Plans · Experiments   Level: Advertiser / Campaign / IO / LI
Explored: 2026-10-28 (Claude in Chrome on the iMac). The first demo advertiser is "Limited Access"; this advertiser allows create, so the gaps from 05, 08, 13 and 15 were finished here.
**Owner-approved writes** (advertiser is paused, nothing can serve or spend): 6 test campaigns (Paused), 6 test IOs (Draft), 1 YouTube test LI (Draft), and 1 empty plan that DV360 auto-saved. Names start with `ADSMETOR TEST` (see "Test entities" at the end). Every other LI form, ad group, ad and creative form was opened, recorded and cancelled. Validation messages come from pressing Save/Create on empty forms. Names/IDs of other entities are placeholders (R5).

**Precedence:** where this file differs from a spec, this file wins (it is observed behaviour). Spec files 04, 06, 07, 08, 09, 12 and 17 point here.

## 1. Creatives (fills 08)

### 1.1 New ▾ → form routes (`/a/{aid}/creatives/new?type={t}&hostingSrc={h}`)
| Menu item | type | hostingSrc | Title |
|---|---|---|---|
| Upload ▸ HTML5 or image | 0 | 2 | New HTML5 or image creative |
| Third party ▸ Third-party display | 0 | 1 | New third-party display creative (see 08) |
| Upload ▸ Video file | 2 | 2 | New video creative |
| Upload ▸ YouTube video | 2 | 2 + `&isYtHosted=true` | New YouTube video creative |
| Third party ▸ Third-party video | 2 | 1 | New third-party video creative |
| Upload ▸ Audio file | 16 | 2 | New audio creative |
| Third party ▸ Third-party audio | 16 | 1 | New third-party audio creative |
| Bulk add creatives ▸ {type} | — | — | `/creatives/bulk-upload?type={native,…}` |

All forms: full screen, ✕ + title, footer **Save** · **Cancel**; sections are cards with chevron expanders. Error banner at top lists every error; same text shows under each field.

### 1.2 Forms
| Form | Cards and fields | Save-on-empty errors |
|---|---|---|
| HTML5 or image | Basic details: Name (help, 0/512) · Main asset (help) "Drop file here or **Browse**" · ☐ Don't scale to fit device width (help) · (after upload) Landing page URL (0/1024) · AI label · Additional details | "Enter a name for the creative" · "Select a main asset" · landing URL message (below) |
| YouTube video | Basic: Name · YouTube URL · Landing page URL · Video options: Skip button ☐ Include skip button · Universal Ad ID (optional, help) + Registry ▾ (default "Display & Video 360") · Companion creatives: **Assign companions**, empty "No companion creatives assigned" · Serving properties: Third-party URLs (help) table with **Add URL** / Delete, warning "You are responsible for ensuring that your collection and use of user information complies with your legal agreements and applicable laws and policies, including the EU User Consent Policy.", columns ☐ Name · Url · AI label · Additional details (Integration code (Optional), Notes (Optional)). Right: Preview card "Add an asset to preview" | "Enter a name for the creative" · "Enter a YouTube video URL or ID" · "Enter a valid landing page URL. A landing page URL must start with "http://" or "https://", and may only include alphanumeric characters and the following symbols: "%-._~:/?#[]＠!&'()*+,;=$"." |
| Video file | Basic: Name · Assets: Source file (help) drop/Browse · Landing page URL · Video options: skip button · UAID + Registry · "Ad badging, transparency, and reporting ☐ Use custom solution" · Companion creatives · Serving properties · AI label · Additional details · Preview | as above + source file |
| Third-party video (VAST) | Basic: Name · VAST tag URL · Additional details: ☐ Requires ping for attribution (help) · Integration code · Notes | "Enter a name for the creative" · "URL must start with https:// and can only use letters, numbers, and these special characters: # ! : . ? + = & % ＠ ! - /" |
| Third-party audio | same as third-party video (Name, VAST tag URL, Additional details) | same |
| Audio file | Tabs **Ad Canvas** · **Creative details**. Ad Canvas: left Assets (Source file drop/Browse, Landing page URL) and Companion creatives (Companion asset drop/Browse, **Assign** link); centre audio player preview with zoom "100% ▾". Creative details: Basic (Name) · Serving properties · YouTube uploads ("Looks like something is missing — To upload, save your creative.") · AI label · Additional details | name, source file |
| Bulk upload native site | ✕ "Bulk upload native site creatives"; **Add creative**; "Template last updated: {date}" + **Download template**; grid ☐ Creative name · Advertiser name · Main image · Logo · Square image (optional) · Headline · Long Headline (optional) · Body text · Long Body Text (optional) · Caption URL · Landing page URL · Call to action; empty state Browse + "Or drag your assets and optional spreadsheet here. … Before you upload, make sure you have the latest template"; footer SAVE (disabled) · Cancel | — |

AI label card (all upload forms): "Laws in some regions may require you to label ads that use certain assets that were created or edited with AI." + Learn more; ○ Label this creative as created or edited with AI · ○ Don't label this creative; disclaimer.

## 2. Campaign → IO → LI create chain (fills 05, refines 03/04)

### 2.1 New campaign → after Create
- Lands on campaign page `/c/{cid}/explorerios`, tabs **Combined** · **Insertion orders** · **Line items**; empty IO grid "No results. New Insertion Order".
- Intelligence panel opens automatically: "Improve recommendations — Add details about your campaign for better insights — **Get started**"; section **INSERTION ORDER RECOMMENDATIONS** cards: URLs (webpages visited by your audience) · Page categories · Keywords · In-market audiences · Third-party audiences … each with **Preview**.
- Goal → KPI lists seen: Awareness: recommended CPV · CPM · Viewable % · CPIAVC, not recommended CPA · CPC. Online action and App installs: recommended CPM · CPC · CPA · CTR · Viewable %, not recommended CPV.
- Stray click note: the "Additional budget details" grid opens inline cell editors on single click.

### 2.2 New IO (`/c/{cid}/ios/new`)
Step 1 "Select a type": ● **Standard** (Open auction line items serving on DV360) · ○ **Connected TV and OTT streaming** (TV content across over-the-top streaming devices) · ○ **Digital out of home** (billboards, bus stations, airports, etc.). Info: objective can be changed to "Insertion order without objective" after creation. Objective card per choice:
| Type / objective | KPIs | Bid strategies | LI types |
|---|---|---|---|
| Standard · Brand awareness | (see 04) | (see 04) | Display · Video · CTV · Audio · Mobile app install · Ads in mobile apps · YouTube & partners video · YouTube & partners audio |
| Standard · Clicks | CPC · CTR · Value/Cost | Maximize clicks · Maximize custom value / cost · Target CPC · Target custom value / cost | Display · Video · Mobile app install · Ads in mobile apps · Demand Gen |
| Standard · Conversions | CPA · Click CVR · Impression CVR · Value/Cost | Maximize conversion value · Maximize conversions · Maximize custom value / cost · Target CPA · Target ROAS · Target custom value / cost | Display · Video · CTV · Audio · Mobile app install · Ads in mobile apps · Demand Gen |
| CTV · Brand awareness | CPM · Value/Cost (Clicks disabled) | same list as Standard awareness | Connected TV · YouTube & partners on CTV |
| DOOH | only "Insertion order without objective" enabled; KPIs N/A | Fixed bid | Display Digital out of home · Video Digital out of home |

Step 2 differences:
- Title "New Insertion Order"; CTV shows "New Connected TV insertion order".
- KPI default: VCPM (Standard awareness), CPM (CTV), CPC (Clicks), CPA (Conversions). Empty KPI → "Enter a number greater than 0".
- Budget info "Your campaign's planned budget couldn't be loaded, so it's possible this budget segment will exceed your planned campaign budget". Budget segment default today → +1 month.
- Optimization default **Automate bid & budget at insertion order level**, Optimized towards: Maximize viewable impressions (awareness) · Maximize reach (CTV) · Maximize clicks (Clicks) · Maximize conversions (Conversions). Info box: Standard awareness/conversions "Your insertion order may only contain cross-exchange display, video and Connected TV line items"; Clicks "…display and video line items"; CTV "…cross-exchange Connected TV line items".
- **Rule:** with IO automation on, YouTube & partners (video, audio, on CTV) and Mobile app install cards are disabled in the LI picker ("…aren't compatible with your insertion order's optimization settings"); choose "Control bid and budget at the line item level" to allow them.
- **DOOH IO form:** name, objective (read-only "Insertion order without objective"), Budget (budget type INR locked), Pacing — **no KPI, no Optimization, no Frequency cap cards**.
- Additional settings (all types): Partner costs — CPM Fees (CPM fee 1, 2: Amount ₹ · Type Default ▾ · ☐ Invoiced · ✕) and Media Fees (Media fee 1 "Automated cost", type "Display & Video 360 Fee", ☑ Invoiced 🔒; Media fee 2 % · Default ▾ · ☐ Invoiced) + **Add fee**; Integration Code (code, Detail). (DOOH shows only Media fees.)
- Footer: Create · Cancel · "Optional: Enter a note about this change". IO list Type column values: Standard · Connected TV · Digital Out of Home.
- IO details page (edit): segment row adds **Spent** and **Remaining** + toggle "Show actualized"; footer Save · Reset · note.

### 2.3 LI picker per IO
| IO | Cards enabled | Disabled (with reason) |
|---|---|---|
| Standard awareness, LI-level control | all 8 awareness types | Demand Gen (objective) |
| Standard conversions, LI-level | Display · Video · CTV · Audio · Mobile app install · Ads in mobile apps · Demand Gen | YouTube video, YouTube audio ("…aren't compatible with your insertion order's objective settings") |
| CTV | Connected TV | YouTube & partners on CTV ("…aren't compatible with your insertion order's optimization settings") when IO automates |
| DOOH | Display Digital Out of Home · Video Digital Out of Home | — |

### 2.4 LI forms (all: name + Draft chip; "Apply a targeting template" header with empty state "No {type} targeting templates yet. Create targeting templates to streamline your line item setup." + **Go to targeting templates**; "Help me select audience lists and demographics" ✨ button; footer Create · Cancel · note; right rail Intelligence "Spend Forecast — Can't determine the risk of underspending. You may need to add: Budget · Bid · Creatives" with ticks as filled)
| Type | Distinct parts |
|---|---|
| **Connected TV** | Inventory: Quality, Public inventory, Deals and Packages + ☑ "Target DV360 curated CTV auction inventory" (help). Default targeting rows: Brand suitability; **Position** In-stream all positions; **Video** player size Large, HD; **Device** include Connected TV, exclude Computer, Smartphone, Tablet. Budget and pacing 🔒 "Budget is set at the insertion order level." Flight · ASAP. Bid strategy 🔒 "Bid strategy is set at the insertion order level." "Spend full budget and Maximize reach". Frequency cap. Creatives: "Advanced ad serving rate: ₹0.00 CPM" (help), Assign creatives, Creative optimization "Optimize towards line item's bid strategy". Conversions: Conversion tracking (Select conversions), Conversion counting "Count all conversions" ▾, Attribution model "Primary model" ▾. Disclosures: EU political ads (Required) |
| **Video** (standard) | "Copy settings from an existing line item" link under name; Inventory (☐ Target DV360 curated CTV auction inventory); Brand suitability; Optimized targeting ☐ + tip "Advertisers who use optimized targeting … on average, a 25% improvement"; bid locked "Spend full budget and Maximize quality impressions — Where 'quality impressions' are defined as: Viewable" (IO automated) |
| **Display DOOH** | Inventory: only **Deals and Packages** and **Deal groups and preferred deal groups** (no exchanges/quality). Targeting: "Select your targeting criteria to control where your ads will be displayed." (help); Add targeting ▸ (Audience) **Geography · Day & time** only. Budget and pacing ● Unlimited up to the IO budget / ○ [₹] INR; Flight ▾ ASAP ▾. Bid strategy ● **Fixed bid** [₹0.00] + Additional options. Creatives. **No frequency cap, no conversions.** EU political (Required). Video DOOH: same layout (not opened) |
| **Mobile app install** step 1 | Title "New mobile app install line item". Mobile app: "Select the app you would like to promote" platform ▾ All platforms · iOS · Android + search "Search for Android or iOS apps" → rows (icon, name, developer, "Android - {package}" / "iOS - {id}"); chosen app card with ⊗. Ad type ● Display ("Run App install ads with image, H5 and Rich Media creatives") / ○ Video ("…with video creatives"). Next · Cancel |
| **Mobile app install** step 2 | App card + ad type (read-only). Inventory (Quality, Public, Deals, Groups). Targeting defaults: **Environment** include App (locked); **Viewability** Open Measurement 🔒; **Device** Smartphone, Tablet + **OS** from app platform (e.g. Android). Optimized targeting. Budget ○ Unlimited / ● [₹]; Flight ASAP. Bid: ● Automated bidding — "Maximize installs (recommended)" ▾ + "while prioritizing spending my full budget (recommended)" ▾ + Additional options / ○ Fixed bid. Frequency cap. Creatives: "Select from existing creatives — Choose from ads and creatives that you've already made." Select existing. Conversions: ○ "Automatically track Google Play Store installs as Conversions. Create a Play Install Floodlight in DCM" (disabled) / ● Select my own pixel → Select conversions; counting "Count only post-click conversions" ▾; Attribution Primary model ▾. EU political |
| **YouTube & partners video** step 1 | Optimization ● Reach · ○ Target frequency · ○ TrueView views · Show more → ○ Ad sequence (each with Learn more). Ad format ● Efficient ad formats (bumpers, skippable, in-feed, Shorts) · ○ Non-skippable (5–30 s). Next |
| **YouTube & partners video** step 2 | Targeting template carousel (cards with Apply template / View) · subtype "Efficient reach" (help) · Ad format ☑ In-stream (skippable, bumper) ☑ In-feed ☑ Shorts · Targeting (Geography All locations, Brand suitability, Inventory sources YouTube / Google TV / Video partners …) · Flight dates · Budget and pacing Daily ▾ Even ▾ [₹] ("Enter an amount") · Bid "Automated bidding — Maximize reach — while prioritizing spending my full budget" · Frequency cap: Exposure frequency and View frequency (No limit / Limit to n per Day) · Product feed ☐ "Use a Google Merchant Center product feed to show relevant products in your ads" · Related videos ✎ · Conversion tracking (search Floodlight activities, Count all conversions ▾, Primary model ▾) · Disclosures EU political (Required) · **Ad groups — Create new ad group** · Additional settings |

**YouTube LI create:** after Create, modal **"Add geography targeting?"** "Geography targeting for YouTube line items is not inherited from the insertion order and your line item will serve globally." [Add targeting] [Got it] → toast "Line item saved" → LI grid row "YouTube & partners video line items", Type "YouTube video".

### 2.5 YouTube ad group and ad (after the LI)
- LI page tabs: **Ad groups** · Line item details · Troubleshooter · History. **New ad group**; filter Status: Active; empty "New ad group".
- New ad group `/li/{liId}/adgroups/new`: "No targeting template applied"; Ad group name (Required, 0/255); **Ad group targeting** "No targeting" + Add targeting ▸ Content: Placements, keywords, & categories · Audience: Demographics · Audience lists & expansion; **Settings → Bid strategy** "Target CPM" [₹] (Required) — "Gathering bid suggestion…" then "Improve potential reach and performance by using a bid of ₹{x}. **Apply** — Suggestion based on line item settings (budget, flights, targeting, ad format) and estimated auction dynamics."; **Ads**: info "Get more reach by including at least: 1 horizontal video ad, 10-60 sec. (Skippable in-stream and in-feed) · 1 horizontal video ad, 6 sec. (Bumper) · 1 vertical video ad, 5 sec. (Shorts)"; warning "This active ad group doesn't have any ads. It won't run until you create ads."; **Create new ad**; footer Create ad group · Cancel.
- Create ad side panel: banner "Rolling out starting October 12, 2026, business name and logo will be required for YouTube ads. To set a default, go to Advertiser settings > YouTube and Demand Gen." [Learn more] [Edit settings]. Ad name (Required, 0/255). **Media:** Video (help) "Search for a video or paste the URL from YouTube" (Required) · Logo (help) Add logo · Companion banner (help, in-stream desktop only) ● No companion banner / ○ Upload my own image · AI-label info. **Text:** Headline (0/30) · Long headline (Required, 0/90) · Description (Required, 0/90) · Call to action (0/10) · Business name (0/25). **URLs and tracking:** Display URL `example.com / [Path 1 0/15] / [Path 2 0/15]` · Landing page URL (http:// ▾ + URL, Required) · Click tracker URL · More options. Footer Create ad · Cancel · 🗑. **Preview:** "All formats ▾", ‹ ›, device mobile / desktop / TV; tabs YouTube · Google video partners · Google TV; caption e.g. "Mobile phone example of your bumper ad on YouTube". Draft ad card in the group: thumbnail · "Responsive" · Show trackers · Active ▾.

## 3. Planning (fills 13)
- Plans list: **New plan** enabled with create access.
- Step 1 "Select channels" (`/marketplace/plan/new`, ✕): Name (default "New Plan ({Mon D, YYYY})") · Location and currency (collapsed "United States | INR"; expanded "Show your ads to people located in, or who show interest in, a geographic location": Country/Region · Currency ▾) · Channels: **Digital** ("Discover new audiences and reach the right customers on digital formats, including Display, Video (YouTube, third-party, connectedTV), and Audio (YouTube, third-party)" ✓ Always included in your plan) · **Linear TV** (help) "Include linear TV in your plan to compare against digital channels and see the optimal split of your budget" [Add] · Next.
- Step 2: Name · summary "Channels Digital | Location and currency … ✎" · **Dates** (default next calendar month, "Nov 1 – 28, 2026 | 28 days") · **Demographics** ● All people / ○ Specific age and gender → Age [18 ▾] to [65+ ▾], Gender ☑ Female ☑ Male · **Sub-location** "Add (optional)" + help · [**Next: Add products**] · Cancel.
- **"Next: Add products" saves the plan** (URL becomes `/pr/{planId}/marketplace/plan`).
- Editable plan page ("Adjust your plan and view forecast"): header Location ▾ · Dates ▾ · On-target demographics ▾ · Additional Settings; dismissible banners ("View metrics have been updated to 'TrueView views' and 'YouTube public views' for clearer reporting" [Got it]; "Forecasts now include additional reach, frequency, and impressions from people watching connected TVs together." [Got it] [Learn more]); forecast card empty "Empty forecast — Add formats to show forecast — Add ad formats"; **+** FAB ▸ YouTube & partners · Open Auction · Publishers · Existing deals; table empty "Add products to your plan to see a forecast"; right panel **"Adjust your plan — See how different budgets and metric adjustments may affect your forecast"**: Total Budget [₹] + slider; Plan Metrics: On-target reach % · TRPs · TrueView views · Conversions; card "How are my forecasts calculated?" ✕. Save (disabled until change) · Copy · ⋮.
- "+ ▸ Open Auction" dialog **Select ad formats**: Add ad format; row Pricing ▾ (Auction) · Ad format ▾ (group "Open auction": Open auction display · Open auction video) · ₹Budget · ₹CPM (Optional) · % share; "Total added budget — 100%"; "Total plan budget ₹0.00"; Cancel · Apply.
- **Additional Settings** side panel: banner "Note that any changes you make to the plan settings will not affect your campaign." [Dismiss]; Inventory source (pre-selected from the advertiser's most common LI settings): Quality default "Authorized and Non-Participating Publishers" · Public Inventory ✎; Targeting: Brand suitability ✎ · Viewability ✎ ("No restrictions"); Apply · Cancel.
- Not seen: forecast charts with data, plan → campaign conversion.

## 4. A/B tests and Intelligence (fills 15, complements 18)
- A/B list (`/experiments`): **Create new**; columns ↑ Test name (link + ID) · Participants ("2 arms") · Status ("Active — {start} – End date not set" / "Completed — {start} – {end}") · Actions **View report** · **End** (disabled when completed).
- Create (`/experiments/new`): **Test details** Name (0/100) · "Enter your test hypothesis statement (optional)" (0/400, example placeholder) · **Test duration** Start date (today) · End date (optional) · **Test arms** "What are you comparing?" ● Insertion orders / ○ Line items; arm cards Arm name* (0/200) · Audience split* (50 %) · ○ Control (Arm 1 default) · Select insertion orders; **Add arm** · **Measure** Measurement goal* (Conversions ▾) · Confidence level* (90% ▾) · Participation text + toggle "Exclude unidentified users" (cross-exchange IOs/LIs only; warning about non-representative results) · note "Lift studies are only applicable for insertion orders containing YouTube & partners or Demand Gen line items." · **Lift study setup** ☐ Brand lift · Pacing ASAP · Save · Cancel. Right rail "Lift eligibility".
- Intelligence panel with live data (advertiser scope): ADVERTISER HEALTH ❗ "{n} insertion orders haven't spent anything today or yesterday" · ❗ "{n} line items haven't spent anything today or yesterday" · ⚠ "{n} insertion orders are underpacing" · ⚠ "{n} active ad groups don't have any eligible ads and won't run" (each Investigate + clock icon; "+ n more"). OPTIMIZATION SUGGESTIONS 💡 "Enable automated bidding for line items in {n} insertion orders…" · "Enable automatic budget allocation for {n} insertion orders…" · "Enable automated bid & budget at insertion order level for {n} insertion orders…" (each Investigate).

## 5. Build requirements (what the simulator must do)
These flows are required functionality. Where the module specs already cover them, implement to this file's observed details.
| Flow | Owning spec / session |
|---|---|
| Campaign create → land on campaign IO tab + Intelligence recommendations | module 06 (P3-06b) |
| IO step 1 types Standard / CTV / DOOH with the objective cards and gating in 2.2; DOOH IO without KPI/optimization/frequency; automation info box; partner costs CPM + Media fees | module 07 (P3-06b) |
| LI picker gating in 2.3 (objective and optimization reasons) | module 08 (P3-06c), VAL MX-01 to MX-10 |
| CTV, Video, Display DOOH, Video DOOH, Mobile app install (2 steps) LI forms in 2.4 | module 08 (P3-06c; DOOH and app install are cut-order item 5 — do not cut) |
| YouTube LI 2 steps, geography modal, ad group, ad create panel with preview (2.4, 2.5) | module 09 (Phase 4 P4-06) |
| Creative forms and routes in 1 | module 12 (P4-01) |
| New plan wizard and editable plan (3) | module 04 (P4-08) |
| A/B create and list (4) | module 17 (P4-10) |
| Intelligence alerts and suggestions (4) | modules 01 and 11 (P4-11) |

## 6. Test entities in the demo (archive when done)
All in the paused advertiser B: campaigns "ADSMETOR TEST - {YouTube Awareness | CTV | DOOH | App install | Video | Display} - do not use" (Paused), each with one IO "ADSMETOR TEST IO - {…}" (Draft); one LI "ADSMETOR TEST LI - YouTube Reach" (Draft, YouTube & partners video) without ad groups; one empty plan "New Plan (Oct 28, 2026)". No creative, ad group or ad was saved.

## 7. Still not seen
Video DOOH form (assumed same as Display DOOH), YouTube audio / non-skippable / target frequency / ad sequence step-2 variants, plan forecast charts with data and plan → campaign, A/B View report, bulk edit Settings / Creative assignment panels, Demand Gen (skipped by owner decision).
