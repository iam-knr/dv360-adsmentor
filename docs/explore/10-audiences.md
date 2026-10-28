# 10 — Audiences
Path: Advertiser → Audiences ▸ All audiences / Analysis   Level: Advertiser
Explored: 2026-10-28. Nothing saved (all forms discarded). Names/IDs are placeholders (R5).

## Routes
| Page | Route |
|---|---|
| First-party tab | `/a/{aid}/first-party-audiences` |
| Custom lists tab | `/a/{aid}/custom-lists` |
| Combined tab | `/a/{aid}/combined-audiences` |
| Partner tab | `/a/{aid}/partner-audiences` |
| New audience (type picker) | `/a/{aid}/audience/new` |
| Tag-based | `/audience/tagbased/new` |
| Customer match | `/audience/customermatch/new` |
| Combined | `/combinedaudience/new` |
| Lookalike | `/audience/lookalike/new` |
| Custom affinity | `/customaudience/affinity/new` |
| Analysis hub | `/a/{aid}/audience-analysis` |
| Geographic distribution | `/audience-geo-distribution` |
| Audience insights | `/audience-composition-insights` |

## Views

### All audiences
- Tabs: **First-party | Custom lists | Combined | Partner**.
- Banner: "Recently added audiences will be available within 4 hours, except for Combined Audiences which are immediately available."
- First-party: "New Audience" button, filter bar. Header groups Audience Lists | Details | Delivery. Columns: Name + ID · Type (Tag-based, Customer match, YouTube users, Lookalike…) · Source (Display & Video 360) · Display size (e.g. "< 1K" + size bar) · YouTube users · Mobile app · CTV devices · Display line items (count link).
- Custom lists: "New Custom List ▾" → Custom affinity · Custom Intent (Display, Video) · Custom Intent (YouTube). Empty in demo.
- Combined: "New Combined Audience"; columns Name + ID · Display size · Active Display size · YouTube size ("Unavailable" possible).
- Partner: filter "Type: ✓ Commerce" (partner/commerce data audiences); empty in demo.

### New audience (type picker page "X New audience")
- **First-party data**: Customer match (upload customer data and match to users) · Tag-based audiences (based on Floodlight activity data) · YouTube users (based on your YouTube channel).
- **Mixed audience types**: Combined audience (combine existing ones).
- **Lookalike audience**: expand reach of a first-party list; only for Google & partners line items.
- Each card: illustration, title, description, Learn more.

### Tag-based audience form
- Audience details (Required): Name.
- Floodlight activity (Required): "Select the type of floodlight activity data you'd like to create an audience with" → searchable dropdown of Floodlight activities (row hover shows "Select").
- Custom variables (help, Required): "Add custom variable to narrow" → rule row [Select variable ▾] [Select operator ▾] ⓧ; "Add rule to narrow".
- Save · Cancel.

### Customer match ("New customer match list")
- "Choose a data source — Help your business gain more insights about customers or improve measurement":
  - Connect a new product (choose from products available for connections)
  - Upload a file manually (create list by uploading a customer list)
  - Skip this step and set up a data source later (connect later in Data Manager)
- Continue (disabled until choice) · Cancel.

### Combined audience form
- Audience details: Name · Description.
- Include → Audiences [Add] (tip: add to combine; expand by adding more to a group; intersect groups to narrow).
- Exclude → Audiences [Add].
- Right summary card (empty: "Add audiences to see summary").
- Save · Cancel.

### Lookalike audience form
- Audience name (0/255).
- Seed audience lists: "Add first-party audiences together. Up to 10 first-party lists can be selected." info "The first-party list must have a minimum of 1,000 active users." [Add].
- Audience reach: "Leverage Google intelligence to expand your reach" slider **Least reach (2.5%) … Most reach (10%)** (default middle).
- Geography: "Choose which countries or regions you want your lookalike audience to include." search.
- Save (disabled until valid) · Cancel.

### Custom affinity form ("New Custom Affinity Audience")
- Audience name · Description (Optional).
- Interests (help): topics, Enter after each or comma-separated.
- URLs (help): URLs audience is interested in.
- Apps (help): "Search for apps".
- Right "Impressions Estimator (help)" — "Audience forecasting is not available for this configuration." until filled.
- Create · Cancel. (Custom intent forms expected similar: keywords/URLs.)

### Analysis
- Hub cards: **Geographic distribution** (analyze ideal geo targeting for an audience; Display only) · **Audience insights** (insights about audience reached with optimized targeting; demographics, interests, behaviour).
- Geographic distribution: empty state "No seed audience selected — select seed audience"; explanation; note new/shared/edited audiences may not be available immediately.
- Audience insights: "Select a line item — Select only line items that have Optimized Targeting enabled."

## Simulator rules (derived)
- Audience sizes per inventory (Display / YouTube / Mobile app / CTV) bucketed ("< 1K", "1K–10K"…); LI can only use lists above minimum size.
- Tag-based lists fill from simulated Floodlight activity hits (P1-11); lookalike needs seed ≥ 1,000 users; combined lists available immediately, others after 4 h sim time.
- Google audience taxonomy (Affinity / In-market paths) — see 07.

## Open questions
- YouTube users form; Custom intent forms; customer match upload file format.
- Audience detail page (click on a list) not opened.
- Analysis output screens need a seed audience / LI with optimized targeting.
