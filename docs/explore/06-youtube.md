# 06 — YouTube & partners line items, ad groups, ads
Path: Campaign → IO (Brand awareness) → YouTube & partners video LI → Ad groups → Ads   Level: LI / Ad group / Ad
Explored: 2026-10-28. Nothing saved (forms discarded; temporary name typed into unsaved form). Names/IDs are placeholders (R5).

## Routes
| Page | Route |
|---|---|
| YT LI → Ad groups tab (default) | `/c/{cid}/io/{ioId}/li/{liId}/adgroups` |
| YT LI → details | `/li/{liId}/details` |
| New YT LI | `/io/{ioId}/lis/new` → card "YouTube & partners video" |

## Views

### IO with YouTube LIs
- LI grid label "YouTube & partners video line items"; Type column "YouTube video"; extra column **TrueView Views**; goal e.g. "90% Compl. rate (Video)"; footer "Total: Youtube Video".
- In a Brand awareness IO the type picker enables CTV, Audio, YouTube video/audio; Demand Gen greyed ("not compatible with your insertion order's objective").

### YT LI page tabs
**Ad groups | Line item details | Troubleshooter | History** (Ad groups first and default).
- Ad groups tab: "New ad group" button, date dropdown, filter (default chip Status: Active). Grid header groups: Ad group | Delivery | Interactions | Conversions. Columns: checkbox · alert · status · **Responsive** (ad group name, sorted) · ID · Ad source · CM360 ID · Impressions · Impr. (Co-viewed) · Revenue · Avg. CPM · TrueView: Views · TrueView: View Rate · TrueView: Avg. CPV · Conversions (YouTube) · Avg. CPA. Total row. Pager "Show rows: 100".

### New YT & partners video LI — step 1
Header "New YouTube & partners video line item".
- Line item name (required, "Required" hint, 0/240) + status Draft ▾.
- **Optimization** — "Select what your line item will optimize towards" (radio):
  - Reach — reach as many unique users as possible (default)
  - Target frequency — reach the same users multiple times (Learn more)
  - TrueView views — drive as many TrueView views as possible
  - "Show more" → Ad sequence — tell a story by showing ads in a sequence (bumper, skippable, non-skippable)
- **Ad format** (depends on optimization):
  - Reach: ● Efficient ad formats (bumper, skippable, in-feed, Shorts) / ○ Non-skippable ad formats (mix non-skippable 5–30 s)
  - Target frequency: ● bumper, skippable, in-feed or Shorts / ○ Only in-stream ad formats (skippable, bumper, non-skippable up to 15 s)
  - TrueView views, Ad sequence: no ad format choice
- Next (name required) / Cancel.

### New / existing YT LI — step 2 (details form)
- Apply a targeting template carousel (YT templates).
- Line item name + status.
- **Line item subtype** (read-only after step 1), e.g. "Efficient reach (help) — Reach people using bumper, skippable, in-feed, or Shorts ads."
- **Ad format** (help) — "Your video ad will be shown using as many ad formats as possible…": ☑ In-stream ads (skippable, bumper) · ☑ In-feed ads · ☑ Shorts ads (new LI all checked; can uncheck).
- **Targeting** (LI level): pre-added Geography (All locations), Brand suitability (Inventory mode 🔒 Maximum inventory), Inventory sources (✓ YouTube, Google TV, Video partners). Existing example also had Device (Include Connected TV; Exclude Computer, Smartphone, Tablet). "Add targeting" menu for YT: **Content:** Keyword exclusions · Language · Inventory sources (Added). **Audience:** Geography (Added) · Day & time. **Technology:** Device. (Audience lists, demographics, placements are set per ad group.) "Save as template".
- Flight dates: ● Use same dates as insertion order / ○ Custom dates.
- Budget and pacing: Daily (new default) or Flight ▾ · Even ▾ · ₹ amount **Required** · note "Actual spend on a given day may vary."
- Bid strategy (help): "Automated bidding, optimized towards [Maximize reach ▾]" + "[while prioritizing spending my full budget ▾]" — locked by subtype for Reach.
- Frequency cap (help): two blocks — **Exposure Frequency** (○ No limit / ○ Limit frequency to [n] exposures per [Day/Week…]) and **View Frequency** (○ No limit / ○ Limit to [n] views per [period]).
- Product feed (help): ☐ Use a Google Merchant Center product feed to show relevant products in your ads.
- Related videos (help): "Add videos related to your video ads to increase engagement" ✎.
- Conversion tracking (help): search box "Search conversion Floodlight activities"; counting dropdown (Count all conversions…); attribution model dropdown (Primary model).
- Disclosures: EU political ads (required radio).
- **Ad groups** section inline: each ad group card shows name, "Responsive ads", Targeting summary (e.g. Demographics: Gender All, Age Range 18-24/25-34, Parental status All, Household income All; Audience lists: "Target people on any of the following lists: Display & Video 360 Audiences » Affinity Categories » Sports & Fitness » Sports Fans » Basketball Fans", In-Market paths…), Settings: Bid strategy Target CPM ₹75.00, Ads: warning "This active ad group doesn't have any ads. It won't run until you create ads." ✎. Link "Create new ad group".
- Additional settings expander; footer Create/Save · Cancel/Reset · change note.

### Create ad group (right slide-over)
- Ad group name (required, 0/255).
- Ad group targeting: "No targeting" + "Add targeting" menu: **Content:** Placements, keywords, & categories. **Audience:** Demographics · Audience lists & expansion.
- Settings → Bid strategy (help): Target CPM ₹ (required) — field depends on LI bid strategy.
- Ads: info "Get more reach by including at least: 1 horizontal video ad, 10–60 sec. (Skippable in-stream and in-feed); 1 horizontal video ad, 6 sec. (Bumper); 1 vertical video ad, 5 sec. (Shorts)"; warning no ads; "Create new ad". After an ad exists: ad thumbnail card "Responsive", "Show trackers", status chip ● Active ▾.
- Footer: Create ad group · Cancel · 🗑 delete.

### Create ad (right slide-over over ad group)
- Banner: from 12 Oct 2026 business name and logo required for YouTube ads; default set in Advertiser settings › YouTube and Demand Gen (Learn more, Edit settings).
- Ad name (required, 0/255).
- **Media**: Video (help) — "Search for a video or paste the URL from YouTube" (required); Logo (help) — Add logo; Companion banner (help, desktop in-stream only) — ● No companion banner / ○ Upload my own image. Info about AI-generated asset labeling (EU, India, New York).
- **Text**: Headline (0/30) · Long headline (required, 0/90) · Description (required, 0/90) · Call to action (0/10) · Business name (0/25).
- **URLs and tracking**: Display URL "example.com / [Path 1 0/15] / [Path 2 0/15]"; Landing page URL (http:// ▾ protocol + required); Click tracker URL (http:// ▾); "More options" expander.
- **Ad preview** pane: format dropdown (All formats / In-stream / In-feed video / Shorts), ‹ › to cycle, device toggles (phone / computer / TV), surface tabs YouTube / Google video partners / Google TV, caption e.g. "Mobile phone example of your bumper ad on YouTube" with mock player.
- Footer: Create ad · Cancel · 🗑.

## Dependencies
- Audience taxonomy (affinity / in-market paths) from P1-10.
- YouTube & Demand Gen advertiser settings (business name, logo) from P1-14.
- Engine: YouTube metrics (TrueView views, view rate, CPV, co-viewed impressions).

## Open questions
- YouTube & partners audio form not opened (expect same structure with audio ads).
- Target frequency / TrueView / Ad sequence step-2 forms not opened (bid strategy and frequency differ).
- Ad sequence builder UI not seen.
