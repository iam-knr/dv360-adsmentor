# Module 09: YouTube & partners (line items, ad groups, ads, ad preview) (P2-06b)

Owner session: P2-06b. Status: draft 1 (2026-10-28).
Inputs: `docs/explore/06-youtube.md` (primary), `05`, `07`, `14`, `17`; specs `data-model.md` (DM), `routes.md` (RT), `design-system.md` (DS), `validation.md` (VAL), `engine.md` (ENG).
Conventions as in `06-campaigns.md`. `Δ` = spec delta, `(from public docs)` = not seen in the demo, `[SIM]` = simulator wording. Rule IDs, `MX-nn`, `DLG-nn` come from `validation.md`.

---

## 1. Scope and out-of-scope

### In scope
1. YouTube & partners **video** line item (LI): step 1 (name, optimization, ad format), step 2 details form, LI page with **Ad groups** as the first tab.
2. YouTube & partners **audio** LI (mirror of video with audio ads, `(from public docs)`).
3. Demand Gen **ad groups and ads** (they reuse the ad group and ad editors with different fields). The Demand Gen LI form shell is in module 08.
4. Ad groups: tab grid, inline cards inside the LI form, create / edit slide-over, ad group targeting (placements, keywords, categories, demographics, audience lists and expansion), ad group bid, delete.
5. Ads: create / edit slide-over, fields, URLs and tracking, "Show trackers", status chip, delete, review status display.
6. **Ad preview** pane (format, device, surface), including the preview data model.
7. YouTube-specific: video lookup, derived ad formats from video orientation and duration, business name and logo defaults from Advertiser settings (14), Merchant Center product feed option, related videos, view frequency, target frequency.
8. YouTube metrics display (TrueView views, view rate, CPV, co-viewed impressions) on LI and ad group grids.

### Out of scope
| Item | Owner |
|---|---|
| LI picker, shared LI form engine, Troubleshooter, LI list shell | 08 |
| Targeting editors (ad group editors are the same slide-overs, availability per MX-10 column YTAG) | 10 |
| Creative library (YouTube LIs do not use library creatives, VAL MX-09 A) | P4-01 |
| YouTube creator partnerships, YouTube assets (Resources) | P4-04 |
| Audience taxonomy | P4-03 |
| Engine YouTube modelling | `engine.md` |

### Blocked in demo, filled from public docs
| Item | Decision |
|---|---|
| YouTube audio form | Same structure as video with ad format "Audio ads"; step 1 optimization fixed to Reach; subtype `AUDIO_REACH` (DM 4.4). Q-09-01 |
| Target frequency, TrueView views, Ad sequence step 2 forms (only Reach seen) | Differences per VAL MX-07: bid strategy and frequency block per subtype; Target frequency adds required exposure target (LI-YT-012) |
| Ad sequence builder UI | Minimal builder, 2 to 5 steps, each step picks an ad group's ad and a rule; Q-09-02. `(from public docs)`, approximate |
| Video action subtype | Not modelled (VAL Q27); only the four optimizations of explore 06 |
| "More options" expander on the ad | Contents `(from public docs)`: Impression tracking URL, URL suffix / custom parameters. Δ-09-6 |
| Ad review outcomes and appeals | Same state machine idea as creatives (ENG 3.4); Δ-09-8 |
| Ad group list "Ad source" values | `(from public docs)`: "Display & Video 360" (default) or "Google Ads" |
| Demand Gen ad types and limits | VAL LI-DG-007..009 `(from public docs)` |

---

## 2. Screens and views

### 2.1 New YouTube & partners video LI, step 1  `[IO]/lis/new?type=YT_VIDEO` (frame F)
Header "New YouTube & partners video line item". Fields:
1. **Line item name** (required, hint "Required", `0 / 240`) + `DvStatusSelect` Draft ▾.
2. **Optimization** card, "Select what your line item will optimize towards" (`DvRadioGroup`): Reach (default; "Reach as many unique users as possible") · Target frequency ("Reach the same users multiple times", Learn more) · TrueView views ("Drive as many TrueView views as possible"). Link **Show more** reveals Ad sequence ("Tell a story by showing ads in a sequence (bumper, skippable, non-skippable)").
3. **Ad format** card (depends on optimization, MX-07):
   - Reach: ● Efficient ad formats (bumper, skippable, in-feed, Shorts) / ○ Non-skippable ad formats (mix of non-skippable 5 to 30 s).
   - Target frequency: ● Bumper, skippable, in-feed or Shorts / ○ Only in-stream ad formats (skippable, bumper, non-skippable up to 15 s).
   - TrueView views, Ad sequence: card hidden.
4. Footer **Next** (disabled until a name exists, LI-YT-001) / Cancel. URL carries `optimization=REACH&format=EFFICIENT` (RT 6.1). The chosen pair maps to the subtype key (2.7).

States: Loading none; Error: if advertiser lacks Google & partner inventory the page shows the VAL LI-YT-021 error as an `E` banner and Next stays disabled; Read-only: not reachable (route access STD).

### 2.2 Step 2 and details: the YouTube LI form  `[IO]/lis/new` step 2 and `[LI]/details`
Uses `LiForm` from module 08 with the YouTube section set. Order and content:
| # | Section | Content |
|---|---|---|
| 0 | Template carousel | YouTube templates (`TPL` type `YT_VIDEO`) |
| 1 | Name and status | as 08 |
| 2 | **Line item subtype** | read-only, e.g. "Efficient reach (help) — Reach people using bumper, skippable, in-feed, or Shorts ads." (LI-YT-004) |
| 3 | **Ad format** (help) | text "Your video ad will be shown using as many ad formats as possible…"; checkboxes ☑ In-stream ads (skippable, bumper) · ☑ In-feed ads · ☑ Shorts ads (all ticked on new, at least one, LI-YT-005). Hidden for non-skippable and TrueView? see matrix MX-07 |
| 4 | **Targeting** (LI level) | pre-added Geography (All locations), Brand suitability (Inventory mode locked), Inventory sources (✓ YouTube, Google TV, Video partners; at least one, LI-YT-017); optional Device; "Add targeting" menu for YouTube: Content: Keyword exclusions, Language, Inventory sources; Audience: Geography, Day & time; Technology: Device (MX-10 YTLI); "Save as template" |
| 5 | Flight dates | same dates as IO / custom |
| 6 | **Budget and pacing** | Daily (new default) or Flight ▾ · Even ▾ · ₹ amount (**Required**, LI-YT-006/007) · note LI-YT-008 "Actual spend on a given day may vary." |
| 7 | **Bid strategy** (help) | "Automated bidding, optimized towards [Maximize reach ▾] [while prioritizing spending my full budget ▾]"; dropdown locked by subtype (LI-YT-009, MX-07) |
| 8 | **Frequency cap** (help) | two blocks: **Exposure Frequency** (No limit / Limit frequency to [n] exposures per [Day/Week…]) and **View Frequency** (No limit / Limit to [n] views per [period]); Target frequency subtypes add "Target frequency" (n exposures per period, required, LI-YT-012) |
| 9 | **Product feed** (help) | ☐ Use a Google Merchant Center product feed to show relevant products in your ads (LI-YT-013) |
| 10 | **Related videos** (help) | "Add videos related to your video ads to increase engagement" ✎ opens a video lookup list (Δ-09-5) |
| 11 | **Conversion tracking** (help) | search box "Search conversion Floodlight activities"; counting dropdown; attribution model (LI-070..073) |
| 12 | Disclosures | EU political ads, required (LI-YT-015) |
| 13 | **Ad groups** (inline) | cards, see 2.4 |
| 14 | Additional settings | expander (revenue model, partner costs, integration code) |
| Footer | | Create / Save · Cancel / Reset · change note |

LI page tabs for YouTube: **Ad groups** (default) | **Line item details** | **Troubleshooter** | **History** (RT 3.6). Troubleshooter is module 08 (diagnostics also per ad group, filter by ad group, Δ-09-9).

### 2.3 Ad groups tab  `[LI]/adgroups` (frame LI, access RO / STD)
- Toolbar: **New ad group** (opens slide-over), date dropdown, filter (default chip `Status: Active`), column view menu.
- Grid `DvGrid` key `ad-groups`, header groups Ad group | Delivery | Interactions | Conversions. Columns: checkbox · alert · status · **Responsive** (ad group name, sorted; the column title shows the ad format label of the first ad) · ID · Ad source · CM360 ID · Impressions · Impr. (Co-viewed) · Revenue · Avg. CPM · TrueView: Views · TrueView: View Rate · TrueView: Avg. CPV · Conversions (YouTube) · Avg. CPA. Total row. Pager "Show rows: 100".
- Row click opens the ad group slide-over (`?sim_panel=adgroup:{id}`).
- Bulk Action bar: Activate, Pause (Δ ad group bulk uses `BulkEntity 'AD_GROUP'`), no Archive (ad groups have no archive state, VAL 4.4; conflict C-09-5), Duplicate `(from public docs)`.
- States: Empty "No ad groups" with **New ad group**; Warning row icon for ad group without ads (`AG-005`); Loading skeleton; Read-only chip + disabled New; Error banner.

### 2.4 Ad group card in the LI form and ad group slide-over
**Card** (inside LI form): name, "Responsive ads" label, Targeting summary (e.g. Demographics: Gender All, Age Range 18-24/25-34, Parental status All, Household income All; Audience lists: "Target people on any of the following lists: Display & Video 360 Audiences » Affinity Categories » …"), Settings (Bid strategy Target CPM ₹75.00), Ads (warning `AG_NO_ADS` when none), ✎ opens slide-over; link **Create new ad group**.

**Ad group slide-over** `DvSlideOver` (right, `?sim_panel=adgroup:new|{id}`):
- Header "✕ New ad group" / ad group name.
- **Ad group name** (required, `0 / 255`).
- **Ad group targeting**: "No targeting" + **Add targeting** menu: Content: Placements, keywords, & categories; Audience: Demographics; Audience lists & expansion (MX-10 YTAG). Editors are module 10 slide-overs stacked over this one.
- **Settings → Bid strategy** (help): bid field depends on LI bid strategy: Target CPM ₹ (Reach / Target frequency / Ad sequence) or Max CPV ₹ (TrueView views) (MX-07); required (AG-003, AG-004).
- **Ads**: info `AG-007` text ("Get more reach by including at least: 1 horizontal video ad, 10-60 sec. (Skippable in-stream and in-feed); 1 horizontal video ad, 6 sec. (Bumper); 1 vertical video ad, 5 sec. (Shorts)"), warning `AG_NO_ADS`, button **Create new ad**; after creation each ad is a thumbnail card "Responsive" with "Show trackers" and status chip ● Active ▾.
- Footer **Create ad group** / **Save** · Cancel · 🗑 delete (DLG-08).
- Unsaved edits inside the slide-over: Cancel/✕/scrim closes it; because the slide-over is an entity slide-over that saves on its own (RT 5.4), dirty state shows DLG-01 `[SIM]` (RT Q23).

### 2.5 Ad slide-over  (`?sim_panel=ad:new&adgroup={id}` or `ad:{id}`)
Wide `DvSlideOver` with form left, **Ad preview** right (2.6).
- Banner: "From 12 Oct 2026 business name and logo are required for YouTube ads. Defaults are set in Advertiser settings › YouTube and Demand Gen." (Learn more, Edit settings).
- **Ad name** (required, `0 / 255`).
- **Media**: Video (help; "Search for a video or paste the URL from YouTube"; required; shows a video card after pick) · Logo (help; Add logo; prefilled from advertiser default; AD-014) · Companion banner (help; desktop in-stream only): ● No companion banner / ○ Upload my own image (AD-018). Info note about AI-generated asset labeling (AD-020).
- **Text**: Headline (`0 / 30`) · Long headline (required, `0 / 90`) · Description (required, `0 / 90`) · Call to action (`0 / 10`) · Business name (`0 / 25`, prefilled default, AD-011..013).
- **URLs and tracking**: Display URL `example.com / [Path 1 0/15] / [Path 2 0/15]` · Landing page URL (protocol dropdown http:// / https:// + field, required) · Click tracker URL (protocol + field) · **More options** expander (Δ-09-6).
- Footer **Create ad** · Cancel · 🗑.
- States: Loading skeleton while editing; Video lookup loading spinner in the field; Error "We couldn't find that video. Check the URL or ID." (AD-004); Read-only: inputs disabled, preview works.

### 2.6 Ad preview pane `AdPreview`
Controls (top): format dropdown **All formats / In-stream / In-feed video / Shorts**; ‹ › cycle through the available formats; device toggles phone / computer / TV; surface tabs **YouTube / Google video partners / Google TV**. Caption below the mock player, template `"{Device} example of your {format} ad on {surface}"` (e.g. "Mobile phone example of your bumper ad on YouTube"). Device labels: `Mobile phone`, `Computer`, `TV`.
Mock player: `DvVideoMock` renders the video thumbnail, play bar, skip button (skippable in-stream after 5 s), ad badge ("Ad · {business name}"), headline / long headline / description / CTA per format, companion banner slot (computer in-stream only), Shorts vertical frame, TV frame with remote hint. No real video playback; static thumbnails (Δ-09-4).
Availability matrix (`(from public docs)` except where noted):
| Format | Phone | Computer | TV | Surfaces |
|---|---|---|---|---|
| In-stream skippable | ✓ | ✓ | ✓ | YouTube, Video partners, Google TV |
| Bumper | ✓ | ✓ | ✓ | YouTube, Video partners, Google TV |
| In-feed video | ✓ | ✓ | - | YouTube |
| Shorts | ✓ | - | - | YouTube |
| Non-skippable in-stream | ✓ | ✓ | ✓ | YouTube, Video partners, Google TV |
Formats shown are the intersection of the matrix, the video-derived formats (2.7) and the LI ad format ticks.

### 2.7 Derived ad formats and subtype mapping
`deriveAdFormats(video)`:
| Orientation | Duration | Formats available |
|---|---|---|
| Horizontal | ≤ 6 s | Bumper |
| Horizontal | > 6 and < 10 s | In-feed (skippable in-stream not eligible) |
| Horizontal | 10 to 60 s | Skippable in-stream, In-feed |
| Horizontal | > 60 s | In-feed |
| Horizontal | 5 to 30 s (non-skippable LI) | Non-skippable in-stream |
| Vertical | ≤ 60 s | Shorts (5 s minimum) |
Hints in `AG-007` correspond to this table. An ad shows the format chips it can serve; the engine uses them to choose surface volumes (5.1).

Subtype mapping (UI step 1 → key; MX-07):
| Optimization | Ad format | VAL key | DM key | RT key |
|---|---|---|---|---|
| Reach | Efficient | `EFFICIENT_REACH` | `EFFICIENT_REACH` | `REACH_EFFICIENT` |
| Reach | Non-skippable | `NON_SKIPPABLE_REACH` | `NON_SKIPPABLE_REACH` | `REACH_NON_SKIPPABLE` |
| Target frequency | Any | `TARGET_FREQUENCY` | `TARGET_FREQUENCY` | `TARGET_FREQUENCY` |
| Target frequency | In-stream only | `TARGET_FREQUENCY_IN_STREAM` | `TARGET_FREQUENCY_IN_STREAM` | `TARGET_FREQUENCY_IN_STREAM` |
| TrueView views | n/a | `TRUEVIEW_VIEWS` | `TRUEVIEW_VIEWS` | `TRUEVIEW_VIEWS` |
| Ad sequence | n/a | `AD_SEQUENCE` | `AD_SEQUENCE` | `AD_SEQUENCE` |
Resolved RC-005: DM keys (`EFFICIENT_REACH`, `NON_SKIPPABLE_REACH`, `TARGET_FREQUENCY`, `TARGET_FREQUENCY_IN_STREAM`, `TRUEVIEW_VIEWS`, `AD_SEQUENCE`, `AUDIO_REACH`). The VAL and RT columns above are the old spellings.

---

## 3. Data

### 3.1 Tables used (DM)
`LineItem` (`ytSubtype`, `ytSurfaces`, `viewFreq*`, `productFeedEnabled`, `relatedVideoIds`), `AdGroup`, `Ad` (DM 5.6), `TargetingAssignment` (adGroupId owner), `TargetingOption`, `Audience`, `GoogleAudience`, `CreativeAsset` (logo, companion), `Advertiser` (business name, logo, Demand Gen settings), `LineItemFloodlightActivity`, `SimDailyMetric` (slices `adGroup`, `ad`, `format`), `DeliveryDiagnostic` (adGroupId), `Alert`, `ChangeGroup`, `ChangeEntry`, `BulkJob`.

### 3.2 Field mapping
| UI | DM |
|---|---|
| LI subtype | `LineItem.ytSubtype` |
| Ad format ticks | `ytSurfaces` (IN_STREAM, IN_FEED, SHORTS); RT uses `adFormats {inStream, inFeed, shorts}` |
| Exposure cap / view cap | `freq*` / `viewFreq*` |
| Target frequency | **missing** (Δ-09-1) |
| Product feed, related videos | `productFeedEnabled`, `relatedVideoIds` |
| Ad group name, status, bid | `AdGroup.name`, `status`, `bidValue` |
| Ad group targeting | `TargetingAssignment` with `adGroupId` |
| Ad fields | `Ad.name`, `status`, `format`, `youtubeVideoId`, `logoAssetId`, `companionAssetId`, `headline`, `longHeadline`, `description`, `callToAction`, `businessName`, `displayUrl`, `path1`, `path2`, `landingPageUrl`, `clickTrackerUrl`, `reviewStatus`, `reviewFeedback` |

### 3.3 Spec deltas
| # | Delta | Target |
|---|---|---|
| Δ-09-1 | Add `LineItem.targetFreqExposures Int?`, `targetFreqUnit`, `targetFreqUnitCount` (LI-YT-012 needs it; neither DM nor RT has the field). RT `YoutubeLiSettings.frequencyCap` needs `targetFrequency?: FrequencyCap` | DM 5.6, RT 8.7 |
| Δ-09-2 | Subtype key unification (2.7). Also add `AUDIO_REACH` to the VAL key registry | VAL 1.3, DM 4.4, RT 8.7 |
| Δ-09-3 | `AdGroup.version`, `Ad.version`, `LineItem.version` | DM Appendix A |
| Δ-09-4 | `YoutubeVideo` global seed table (`videoId`, `title`, `channelName`, `durationSec`, `orientation`, `thumbnailUrl`, `category`, `isPublic`); `Ad.youtubeVideoId` references it softly; ~60 synthetic videos covering all derive-format rows. No real video IDs (R5) | DM 5.6 |
| Δ-09-5 | `LineItem.relatedVideoIds` entries must resolve in `YoutubeVideo` | DM |
| Δ-09-6 | Ad fields for "More options": `impressionTrackerUrl`, `urlSuffix`; "Show trackers" lists `clickTrackerUrl` and these | DM 5.6 |
| Δ-09-7 | `AdSequenceStep(adGroupId, ordinal, adId, condition)`, `(from public docs)`, DM Q13 | DM |
| Δ-09-8 | Ad review simulation: `Ad.reviewStatus` transitions PENDING → APPROVED / REJECTED / RESTRICTED by engine with delay 1 to 3 sim hours (same machine as creative DV360 review, ENG 3.4); scenario fault "reject ad". Not in ENG | ENG 3.4 |
| Δ-09-9 | `DeliveryDiagnostic` already has `adGroupId` (ENG 3.5); Troubleshooter filter "Ad group" `(from public docs)` for YouTube LIs | RT 8.6 |
| Δ-09-10 | `PreviewModel` (RT 8.7 undefined): `{ formats: AdFormatKey[]; selected: { format; device; surface }; caption: string; frame: { orientation: 'HORIZONTAL'|'VERTICAL'; thumbnailUrl: string; durationSec: number; skippableAfterSec?: number; headline?: string; longHeadline?: string; description?: string; cta?: string; businessName?: string; displayUrl?: string; logoUrl?: string; companionBannerUrl?: string }; warnings: string[] }` and `AdFormatKey = 'IN_STREAM_SKIPPABLE'|'BUMPER'|'NON_SKIPPABLE_IN_STREAM'|'IN_FEED'|'SHORTS'` | RT 8.7 |
| Δ-09-11 | RT 8.7 lacks `setAdGroupStatus`, `setAdStatus`, `listAds` row type, ad group row type. Define in 4.1 | RT 8.7 |
| Δ-09-12 | `Advertiser.defaultBusinessName`, `defaultLogoAssetId` are in RT 8.14 (`youtubeDemandGen`) but not clearly in DM Advertiser | DM 5.3 |
| Δ-09-13 | Engine slice for YouTube surface (YouTube / Video partners / Google TV): add slice kind `surface` or reuse `format` | ENG 9.3 |
| Δ-09-14 | `Ad.format` DM default RESPONSIVE. Keep RESPONSIVE as the only stored value for video ads in v1; derived formats are computed (2.7) | DM 4.4 |

### 3.4 Seed data requirements
- One advertiser with Google & partners inventory enabled and a default business name and logo.
- At least 6 YouTube LIs in Brand awareness / None IOs covering every subtype (Efficient reach, Non-skippable, Target frequency both variants, TrueView views, Ad sequence) and 1 YouTube audio LI.
- Ad groups: 2 to 4 per LI; at least: one ad group without ads (warning and `AD_GROUP_NOT_RUNNING` alert), one paused ad group, one with demographics + audience paths (affinity "Sports Fans » Basketball Fans", in-market), one with placements and keywords.
- Ads: 1 to 3 per ad group; one REJECTED ad (alert `YT_AD_REJECTED`), one RESTRICTED, one PENDING (sim hours old).
- Video catalogue (Δ-09-4) 60 videos: horizontal 6 s, 15 s, 30 s, 90 s; vertical 5 s, 20 s.
- Demand Gen: 1 LI with 1 ad group and 2 ads (image and video) in an advertiser with Floodlight optimization.
- Metrics for TrueView: views, view rate, CPV, co-viewed impressions, conversions (YouTube) generated by the engine for seeded ticks.

---

## 4. Behaviour

Role shorthand as in 06. Common wrapper: `assertAccess` → validate → `withChangeLog` → `SimEditLog` → `Result<T>`.

Types from RT 8.7: `YoutubeLiSettings`, `AdGroupInput`, `AdInput`. Extra types:

```ts
type YtSubtype = 'EFFICIENT_REACH'|'NON_SKIPPABLE_REACH'|'TARGET_FREQUENCY'|'TARGET_FREQUENCY_IN_STREAM'|'TRUEVIEW_VIEWS'|'AD_SEQUENCE'|'AUDIO_REACH';
interface YtLiStep1 { type: 'YT_VIDEO'|'YT_AUDIO'; name: string; optimization: 'REACH'|'TARGET_FREQUENCY'|'TRUEVIEW_VIEWS'|'AD_SEQUENCE'; adFormatChoice?: 'EFFICIENT'|'NON_SKIPPABLE'|'ALL_FORMATS'|'IN_STREAM_ONLY' }
interface AdGroupRow { id: Id; lineItemId: Id; name: string; status: 'ACTIVE'|'PAUSED'; alertCount: number; adFormatLabel: string; adSource: string; cm360Id?: string;
  impressions: number; coViewedImpressions: number; revenue: Money; avgCpm: Money|null; views: number; viewRate: number|null; avgCpv: Money|null; conversions: number; avgCpa: Money|null; adCount: number }
interface AdRow { id: Id; adGroupId: Id; name: string; status: 'ACTIVE'|'PAUSED'; format: 'RESPONSIVE'; reviewStatus: 'PENDING'|'APPROVED'|'REJECTED'|'RESTRICTED'; reviewFeedback?: string; thumbnailUrl: string; formats: AdFormatKey[]; trackers: { kind: 'CLICK'|'IMPRESSION'; url: string }[] }
interface YoutubeVideoHit { videoId: string; title: string; channelName: string; durationSec: number; orientation: 'HORIZONTAL'|'VERTICAL'; thumbnailUrl: string }
interface AdGroupDetail extends AdGroupInput { id: Id; version: Version; lineItemBidKind: 'TARGET_CPM'|'MAX_CPV'; adCount: number }
interface AdDetail extends AdInput { id: Id; version: Version; reviewStatus: AdRow['reviewStatus']; reviewFeedback?: string; formats: AdFormatKey[] }
```

### 4.1 Action table
| # | UI action | Server action / endpoint | Input → Output | Rules | Roles | Side effects |
|---|---|---|---|---|---|---|
| Y1 | Step 1 Next | client check on `YtLiStep1` | | LI-YT-001..003, LI-YT-019, LI-YT-021 | W | none |
| Y2 | Create YT LI | `createLineItem(ioId, LineItemInput & {type:'YOUTUBE_VIDEO'\|'YOUTUBE_AUDIO'; youtube: YoutubeLiSettings})` | → `Result<{id}>` | LI shared rules + LI-YT-004..017, 020, 021, LI-070..073, TGT limited to MX-10 YTLI | W | ChangeLog CREATE; redirect `[LI]/adgroups`; engine registers pseudo-exchange supply (5.1) |
| Y3 | Save YT LI | `updateLineItem(id, ...)` | → `Result<LineItemDetail>` | as Y2 + LI-YT-004 (subtype read-only) | W | ChangeLog; affected ad group allowance recomputed |
| Y4 | List ad groups | `GET /api/dv/line-items/:liId/ad-groups` | `ListQuery<{status}>` → `ListResult<AdGroupRow>` | none | V: ADM STD RO PC; REP - | `ensureCaughtUp` |
| Y5 | Open ad group | `GET /api/dv/ad-groups/:id` | → `AdGroupDetail` | | V | |
| Y6 | Create ad group | `createAdGroup(liId, AdGroupInput)` | → `Result<{id}>` | AG-001..004, AG-006, MX-10 YTAG, TGT-* | W | ChangeLog CREATE; alert `AD_GROUP_NOT_RUNNING` raised by engine if no ads |
| Y7 | Update ad group | `updateAdGroup(id, AdGroupInput)` | → `Result<AdGroupDetail>` | same + `expectedVersion` | W | ChangeLog; engine replays at next tick |
| Y8 | Pause / Activate | `setAdGroupStatus(id, 'ACTIVE'|'PAUSED')` Δ-09-11 | → `Result` | VAL 4.4 | W | ChangeLog STATUS_CHANGE |
| Y9 | Delete ad group | `deleteAdGroup(id)` after DLG-08 | → `Result<void>` | AG-008 | W | hard delete, cascades to ads; ChangeLog `DELETE` kept (DM 7.3); metrics rows for that ad group kept (history) |
| Y10 | Bulk (ad group grid) | `POST /api/dv/ad-groups/bulk` `BulkRequest{entity:'AD_GROUP'}` | | Activate, Pause, Duplicate only | W | BulkJob |
| Y11 | List ads | `GET /api/dv/ad-groups/:id/ads` | → `AdRow[]` | | V | |
| Y12 | Create ad | `createAd(adGroupId, AdInput)` | → `Result<{id}>` | AD-001..020 | W | ChangeLog; review PENDING; business name and logo default from advertiser |
| Y13 | Update ad | `updateAd(id, AdInput)` | → `Result<AdDetail>` | same | W | editing video or text resets review to PENDING (`[SIM]`, 1 to 3 sim hours) and ChangeLog `SIM_ENGINE` entries for review |
| Y14 | Ad status | `setAdStatus(id, 'ACTIVE'|'PAUSED')` Δ-09-11 | | | W | ChangeLog |
| Y15 | Delete ad | `deleteAd(id)` | | AG-008 style DLG-08 | W | hard delete |
| Y16 | Video lookup | `GET /api/dv/youtube/video-lookup?q=` | → `YoutubeVideoHit[]` | AD-004 | W | none; accepts watch URLs, youtu.be, shorts URLs, 11-char ids resolving in `YoutubeVideo` |
| Y17 | Preview | `POST /api/dv/ads/preview {draft, format, device, surface}` | → `PreviewModel` (Δ-09-10) | none | W and V | pure function, no writes |
| Y18 | Upload logo / companion | `POST /api/dv/uploads/sign` then `uploadId` in `AdInput` (RT 8.0) | | file rules `[SIM]`: png/jpg/gif ≤ 5 MB; companion 300×60 `(from public docs)` | W | asset row |
| Y19 | Demand Gen ad group / ad | same endpoints, `AdInput` replaced by `DgAdInput` (4.6) | | LI-DG-005..011 | W | as above |

### 4.2 Validation mapping
| UI | Rules |
|---|---|
| Step 1 | LI-YT-001..003, MX-07 |
| LI form | LI-YT-004..018, 020, 021, LI-001..003, LI-020..037, LI-050..053 (frequency caps via YT-010/011), LI-070..073, LI-080, LI-092 |
| Ad group | AG-001..008 |
| Ad | AD-001..020 |
| Preview | none (advisory warnings, e.g. "This video can't serve as a Shorts ad because it is horizontal" `[SIM]`) |
| Demand Gen ad group / ad | LI-DG-005..011 (+ AG rules) |

### 4.3 Form logic
1. `LI-YT-005`: at least one of in-stream / in-feed / Shorts for Efficient reach and Target frequency (all formats). Non-skippable and in-stream-only subtypes hide the checkboxes.
2. The LI bid dropdown is locked by subtype; ad group bid field label and unit change with `lineItemBidKind` (MX-07).
3. Ad sequence: LI-YT-020 requires at least two ads in the sequence across ad groups; the form shows a "Sequence" section listing ordered steps `(from public docs)`.
4. Activating an LI without an active ad group shows warning LI-YT-018; an ad group without ads shows `AG_NO_ADS`; neither blocks.
5. Business name and logo default from advertiser settings; clearing the business name is rejected (AD-013).
6. Landing page URL protocol dropdown and the typed value are combined; GEN-006 and AD-017 validate the result.
7. Preview refreshes 300 ms after any media or text change; it does not require a saved ad.

### 4.4 Permissions
| Capability | ADM | STD | RO | PC | REP | CRE |
|---|---|---|---|---|---|---|
| View ad groups, ads, preview | V | V | V | V | - | V |
| Create / edit / delete ad groups and ads, status | W | W | - | - | - | - |
| Upload logo / companion | W | W | - | - | - | W `(from public docs)` creatives role may upload assets, Q-09-05 |
| Bulk on ad groups | W | W | - | - | - | - |

### 4.5 Side effects
1. ChangeGroup `entityType = AD_GROUP` or `AD`; parent chain snapshot includes `lineItemId` so LI and IO history show them.
2. `SimEditLog`.
3. Engine: new ad groups enter allowance splitting at next tick (ENG 4.8); new ads start review.
4. Alerts: `AD_GROUP_NOT_RUNNING`, `YT_AD_REJECTED` raised and resolved by the engine, not by UI.
5. Delete writes a `DELETE` ChangeEntry with the final field values.

### 4.6 Demand Gen ad group and ad variants `(from public docs)`
`DgAdInput { name; status; format: 'DEMAND_GEN_VIDEO'|'DEMAND_GEN_IMAGE'|'DEMAND_GEN_CAROUSEL'; videoId?: string; imageAssetIds?: Id[] /* 1.91:1, 1:1, 4:5 */; logoAssetId?: Id; headline (≤40, LI-DG-007); description (≤90, LI-DG-008); callToAction?: string; businessName (≤25, LI-DG-009); finalUrl: string }`. Ad group targeting limited to Audience lists and expansion (incl. lookalike), Demographics, Geography, Language, Device, Day & time (MX-10 DG). Bid per LI strategy. Preview formats: Discover feed card, Gmail promotion, YouTube in-feed `[SIM]`; reuse `AdPreview` with surfaces `DISCOVER`, `GMAIL`, `YOUTUBE`.

---

## 5. Engine hooks

### 5.1 Outputs displayed
| UI | Engine output | Source |
|---|---|---|
| Ad group grid: Impressions, Impr. (Co-viewed), Revenue, Avg. CPM, TrueView Views / View Rate / Avg. CPV, Conversions (YouTube), Avg. CPA | `SimDailyMetric` rows with `adGroupId` (`impressions`, `coViewedImpressions`, `revenue`, `videoViews`, `convTotal`) | ENG 9.4, 9.2 |
| LI grid TrueView Views and Goal | `videoViews`, KPI formulas CPV, VTR (ENG 4.6) | ENG 4.6 |
| Ad group allowance split | LI allowance split equally across active ad groups unless bids differ (weights proportional to bid) | ENG 4.8 |
| Diagnostics for YouTube | funnel per LI and per ad group; codes `T.AD_GROUP_TARGETING`, `F.AD_GROUP`; exchange key `youtube` | ENG 3.2, 3.5 |
| Alerts | `YT_AD_REJECTED` (Critical), `AD_GROUP_NOT_RUNNING` (Needs attention) | ENG 3.7 |
| Video metrics | views, skips, completions (video quartiles), co-viewing | ENG 6.3 |
| Subtype behaviours | Reach strategies use the exposure histogram (ENG 3.9, 4.7); target frequency uses it with the target; TrueView views optimise CPV | ENG 4.7 |
| Forecast | LI forecast for YouTube uses pseudo-exchange `youtube` volumes (ENG 2.x, Q10) | ENG 1.6 |
| Preview | none (static) | n/a |
| Ad review status | Δ-09-8 | ENG gap |

Engine gaps found: no YouTube ad review simulation (Δ-09-8), no per-surface volumes (Δ-09-13), no ad sequence delivery logic (needs `AdSequenceStep` handling), no `AUDIO_REACH` rates (ENG 2.5 benchmark table lacks YouTube audio).

---

## 6. Acceptance criteria

### 6.1 Numbered
1. AC-09-01: Step 1 offers Reach (default), Target frequency, TrueView views; Ad sequence appears only after Show more; ad format card changes per MX-07 and hides for TrueView and Ad sequence.
2. AC-09-02: Next stays disabled with empty name.
3. AC-09-03: Step 2 shows the read-only subtype line matching the step 1 choice; all three ad format boxes ticked on new Efficient reach LI; unticking all raises LI-YT-005.
4. AC-09-04: Budget default period Daily; amount required; "Actual spend on a given day may vary." shown.
5. AC-09-05: Bid strategy shows "Maximize reach" locked for Reach subtypes; changing is rejected by LI-YT-009.
6. AC-09-06: Frequency card has Exposure and View blocks; Target frequency subtype adds the required target field.
7. AC-09-07: Product feed ticked with no linked Merchant Center account gives LI-YT-013.
8. AC-09-08: Inventory sources cannot be emptied (LI-YT-017); the Add targeting menu shows only the six YouTube LI items.
9. AC-09-09: LI page opens on Ad groups tab; Ad groups grid has the exact columns, default `Status: Active` chip, total row, "Show rows: 100".
10. AC-09-10: Ad group slide-over: name required, Target CPM required (or Max CPV for TrueView), "No targeting" allowed, targeting menu limited to MX-10 YTAG items.
11. AC-09-11: Active ad group without ads shows `AG_NO_ADS` in the slide-over, on the LI form card and an alert row from the engine after 2 ticks.
12. AC-09-12: Ad create: required fields, counters, limits (30 / 90 / 90 / 10 / 25 / 15); Create blocked with errors; business name and logo prefilled from advertiser defaults.
13. AC-09-13: Video lookup accepts URL and id; unknown id shows AD-004; a pick fills a video card.
14. AC-09-14: Preview updates as text changes; format dropdown, ‹ ›, device toggles and surface tabs work; caption format matches the template; invalid combos (Shorts on TV) are disabled.
15. AC-09-15: Companion banner field visible only with a computer in-stream preview; choosing "Upload my own image" without a file raises AD-018.
16. AC-09-16: Delete ad group and ad confirm with DLG-08 and remove rows; ChangeLog keeps the `DELETE`.
17. AC-09-17: Status chip on an ad toggles Active / Paused and persists.
18. AC-09-18: Seeded REJECTED ad shows the alert on campaign Alerts page as "YouTube ads rejected".
19. AC-09-19: Read-only roles see everything but cannot save; forged writes return `FORBIDDEN`.
20. AC-09-20: Ad group metrics equal engine sums; LI TrueView Views equals the sum of its ad groups' views.
21. AC-09-21: Editing an ad's video resets review to PENDING and writes SYSTEM entries when the engine decides.
22. AC-09-22: YouTube audio LI shows audio ad format and no video-only sections (`(from public docs)`).
23. AC-09-23: Demand Gen ad group and ad forms enforce 40 / 90 / 25 limits.

### 6.2 Playwright outlines (`tests/e2e/youtube.spec.ts`)
| ID | Steps | Expect |
|---|---|---|
| PW-09-01 | Brand awareness IO → New line item → YouTube & partners video; name; Reach + Efficient; Next | step 2 with subtype line |
| PW-09-02 | step 2: amount blank; Create | error, stays |
| PW-09-03 | Create LI | lands on Ad groups tab (empty state) |
| PW-09-04 | New ad group: name, Target CPM 75, Create | row appears with warning icon |
| PW-09-05 | open ad group; Create new ad; paste seeded video URL | video card |
| PW-09-06 | fill text; check preview caption | "Mobile phone example of your bumper ad on YouTube" for a 6 s video |
| PW-09-07 | switch device to TV and surface to Google TV | caption updates; Shorts disabled |
| PW-09-08 | headline of 31 chars | typing stopped at 30 |
| PW-09-09 | Create ad | thumbnail card "Responsive", status Active |
| PW-09-10 | delete ad group | DLG-08, row gone |
| PW-09-11 | seeded rejected ad | alert on campaign Alerts |
| PW-09-12 | Target frequency subtype | target frequency field required |
| PW-09-13 | read-only user | disabled inputs |

### 6.3 Vitest cases
| ID | Case | Expect |
|---|---|---|
| V-09-01 | `subtypeFrom(optimization, choice)` for all rows | MX-07 keys |
| V-09-02 | `deriveAdFormats` table (6 rows + boundaries 6 s, 10 s, 60 s, 5 s vertical) | exact |
| V-09-03 | `parseYoutubeRef` for watch, youtu.be, shorts, plain id, garbage | id or null |
| V-09-04 | `buildPreviewModel` caption for every (format, device, surface) valid combo | template |
| V-09-05 | preview combos matrix: invalid combos disabled | exact |
| V-09-06 | LI-YT-005, 009, 012, 013, 017, 020 cases | rule IDs |
| V-09-07 | AG-001..004, 006 cases | rule IDs |
| V-09-08 | AD-001..020 cases, boundary lengths 30 / 31, 90 / 91, 10 / 11, 25 / 26, 15 / 16 | rule IDs |
| V-09-09 | AD-013: clear business name when default exists | AD-013 |
| V-09-10 | ad group delete cascades ads, keeps ChangeLog | exact |
| V-09-11 | allowance split equal vs bid-weighted (engine unit, ENG 4.8) | weights |
| V-09-12 | LI roll-up equals sum of ad groups (views, revenue, impressions) | equal |
| V-09-13 | `AD_GROUP_NOT_RUNNING` raised for active LI whose only ad group is paused | alert |
| V-09-14 | Demand Gen limits LI-DG-007..009 | rule IDs |
| V-09-15 | URL protocol merge + validation | AD-017 |

---

## 7. Build tasks

| # | Task | Size | Depends on |
|---|---|---|---|
| T09-01 | Deltas Δ-09-1..4, 6, 12, 14: migration, `YoutubeVideo` seed table, subtype key unification | M | P3-05, T08-01 |
| T09-02 | Validation: LI-YT, AG, AD rule files, MX-07 constants, `deriveAdFormats`, `parseYoutubeRef`, tests V-09-* | M | P3-01, T08-02 |
| T09-03 | Services: ad group and ad CRUD, status, delete, bulk, video lookup, roll-ups, field registry | L | P3-05, T09-01 |
| T09-04 | YT step 1 page and step 2 section set in `LiForm` (subtype line, ad formats, frequency blocks, product feed, related videos, ad groups inline cards) | L | T08-05, T09-02 |
| T09-05 | Ad groups tab grid, ad group slide-over (with targeting hook-ups) | L | P4-06 depends P3-04, P3-07, T09-03 |
| T09-06 | Ad slide-over, uploads (logo, companion), business name / logo defaults | M | T09-03, P3-04 |
| T09-07 | `AdPreview` + `DvVideoMock` + preview service | M | T09-02, P3-04 |
| T09-08 | Engine support: YouTube pseudo exchange supply, ad group allowance, ad review state machine, TrueView metrics, `YT_AD_REJECTED` / `AD_GROUP_NOT_RUNNING` alerts, subtype strategies (reach, target frequency, TrueView, sequence) | L | P3-08, P4-11 |
| T09-09 | Demand Gen ad group / ad variants | M | T09-05, T09-06, T08-06 |
| T09-10 | YouTube audio variant | S | T09-04 |
| T09-11 | Seed generator (3.4) | M | P3-05, T09-01 |
| T09-12 | Playwright PW-09-* | M | all |

---

## 8. Open questions and conflicts

### 8.1 Open questions
| # | Question | Default |
|---|---|---|
| Q-09-01 | YouTube audio subtype name and form | `AUDIO_REACH`, mirror of video |
| Q-09-02 | Ad sequence builder rules (min / max steps, conditions) | 2 to 5 steps, condition ALWAYS / IF_VIEWED / IF_SKIPPED |
| Q-09-03 | Is there an Ads tab or list at LI level in DV360 (the demo showed ads only inside the ad group slide-over)? | No separate tab |
| Q-09-04 | Ad group bulk edit and duplicate availability | Activate, Pause, Duplicate |
| Q-09-05 | Can role CREATIVE upload YouTube ad assets? | no in v1 |
| Q-09-06 | Does editing a live ad reset its review? | yes (simulation) |
| Q-09-07 | Logo and companion file rules | png/jpg/gif ≤ 5 MB, `[SIM]` |
| Q-09-08 | "Ad source" values | "Display & Video 360" / "Google Ads" |
| Q-09-09 | Should the preview show real-looking brand imagery? | Synthetic thumbnails only (R5) |
| Q-09-11 | `YT_ON_CTV` form: variant of YouTube video with Device locked to Connected TV? | yes |
| Q-09-10 | The ad group list header says "Responsive" (the ad format label of the first ad). What does it show for mixed formats? | "Mixed" `[SIM]` |

### 8.2 Conflicts between specs

> Resolved: every conflict below is consolidated in [`../conflicts.md`](../conflicts.md) (crosswalk table, rows `RC-nnn`). Where a proposal here and the RC row differ, the RC row wins.
| # | Conflict | Where | Proposal |
|---|---|---|---|
| C-09-1 | Subtype keys differ in three specs (2.7 table) | DM 4.4, VAL 1.3 / MX-07, RT 8.7 | VAL keys |
| C-09-2 | LI-YT-012 requires a target frequency exposure value, but neither DM `LineItem` nor RT `YoutubeLiSettings` has such a field | VAL 2.12 vs DM 5.6, RT 8.7 | Δ-09-1 |
| C-09-3 | RT `PreviewModel` undefined; RT `AdGroupRow`, `AdRow` undefined | RT 8.7 | Δ-09-10, 4 types |
| C-09-4 | YouTube budget field: VAL LI-YT-006 "budget required when Daily or Flight chosen" vs DM `dailyMaxAmount` "Daily amount required"; where is the flight budget amount stored when the period is Flight? | VAL vs DM 5.6 | store as `budgetAmount` (mode FIXED) for Flight and `dailyMaxAmount` for Daily; require one |
| C-09-5 | RT `BulkAction` includes ARCHIVE for entity `AD_GROUP`; VAL 4.4 says ad groups have no archive state (delete only) | RT 8.0 vs VAL 4.4 | remove ARCHIVE for AD_GROUP; add DELETE if bulk needed |
| C-09-6 | ENG treats YouTube as one pseudo-exchange (`youtube`), but LI inventory sources are three (YouTube, Google TV, Video partners) and the preview has three surfaces; reports cannot split them | ENG 2.x Q10, VAL MX-10 | Δ-09-13 (slice kind `surface`) |
| C-09-7 | ENG has no ad-level review simulation, but DM `Ad.reviewStatus` and alert `YT_AD_REJECTED` exist | ENG 3.4, 3.7 | Δ-09-8 |
| C-09-8 | DM `YtAdFormat` lists several formats (`IN_STREAM_SKIPPABLE`, `BUMPER`...) while the demo shows only "Responsive ads" | DM 4.4 vs explore 06 | RESPONSIVE only stored; formats derived (Δ-09-14) |
| C-09-9 | PROJECT.md 5.3 mentions "Video reach / action / view" variants; explore 06 and VAL list Reach, Target frequency, TrueView views, Ad sequence | PROJECT.md 5.3, VAL Q27 | follow explore 06 |
| C-09-10 | VAL lists `YT_ON_CTV` (CTV IOs) but no spec defines its form (probably a variant of YouTube video with CTV device locked) | VAL MX-02/03, TPL-002 | treat as YT_VIDEO with Device locked to Connected TV (Q-09-11) |
| C-09-11 | RT 5.4 puts ad group and ad slide-overs on `?sim_panel` (entity slide-overs, Back closes), but DM / explore also show ad groups inside the LI form (draft-bound). Two mounts of one editor | RT 5.4 | slide-over saves immediately via its own action in both mounts; the LI form card just refreshes |
| C-09-12 | RT `AdGroupInput.status` allows ACTIVE/PAUSED, but ad group has no Draft; the explore step 2 shows "This active ad group doesn't have any ads" so create default ACTIVE | RT 8.7 | default ACTIVE |
| C-09-13 | RT `LineItemInput` YouTube branch is `type:'YOUTUBE_VIDEO'` while 08 uses VAL keys | RT 8.6 | see 08 C-08-1 |

---
**Observed in DV360 (2026-10-29):** read `docs/explore/19-gap-finish.md` sections 2.4, 2.5 before building this module. Where it differs from this spec, the explore file wins (observed behaviour); section 5 there lists the flows this module must implement.
