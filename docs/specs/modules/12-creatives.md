# Module 12: Creatives (P2-06c)

Status: draft v1, 2026-10-28. Owner session: P2-06c. Build phase: P4-01 (library, forms, review UI) with engine hooks from P3-08.
Inputs: `docs/explore/08-creatives.md`, `17-gap-sweep.md` (image creative page, creative History), `docs/specs/data-model.md` (5.7, 4.5, 6), `routes.md` (3.7, 8.9), `validation.md` (CRE, MX-09, MX-09b, 4.5), `engine.md` (3.2, 3.4, 3.7, 10.1), `design-system.md` (2.4, 2.8, 2.10, 2.11, 2.14).

Tags: nothing is tagged when seen in the demo. `(from public docs)` marks forms and behaviour blocked in the demo (the **New** menu was hidden by Limited Access, 17). `[SIM]` marks wording or constants invented here. `Δ` marks a **spec delta** (a change or addition other specs must absorb, listed again in section 8).

---

## 1. Scope and out-of-scope

### In scope
| Area | Notes |
|---|---|
| Creatives library | List and grid views, filter bar, 16 columns (08), refresh, bulk Action bar, **New ▾** menu in all four groups |
| Create forms, every kind | Third-party display (seen). `(from public docs)`: Upload HTML5 or image, Video file, YouTube video, Audio file, Native site, Native video, Third-party video (VAST), Third-party audio, Creative from format gallery (Optimized, Native display, Native video) |
| Bulk add creatives | Template download per kind (Audio, HTML5 or image, Native site, Native video, Third-party audio, Third-party display, Third-party video), CSV upload, result file, `BulkJob` |
| Creative page | Tabs Creative details, Creative status, History; Preview; Test tag; AI label; Additional details |
| Review model | DV360 review, per-exchange review, SSL, restrictions, feedback, "Line item eligibility", appeals |
| Appeal history page | Table, empty state |
| Format gallery | Tabs All Formats, Video, Display, Native, Optimized; recommended row; Create / Details actions |
| Creative History renderer | Filterable table (Date, User, Change) reading `ChangeGroup` (17) |
| Assignment helpers | `getEligibleCreatives(liId)` for the LI "Select creatives" panel (tabs All / Eligible / Assigned) and `assignCreativesToLineItems()` for the library bulk bar. The LI form itself belongs to the LI module (P3-06). |

### Out of scope
- YouTube ads and Demand Gen ads (built in ad groups, spec 06 / module for P4-06). A YouTube **video creative** here only references a video ID.
- Real transcoding, virus scanning, zip unpacking beyond reading the entry file name, and real CM360 sync. `Third party (CM360)` creatives are seeded rows with `source = CM360`.
- Studio / Google Web Designer authoring ("ONLY IN GWD" formats show **Details** only, CRE-080).
- Dynamic creatives and creative templates for dynamic ads.
- Engine internals (review timing, funnel counts): owned by `engine.md`; this module only calls and displays them (section 5).

### Blocked in the demo, filled from public docs
Upload (HTML5 or image, video, YouTube, audio), native site and video, VAST (third-party video and audio), format gallery **Create** flows, bulk upload template layout, grid view of the library, library filter field list, creative bulk actions, appeal submit dialog, preview dialog.

---

## 2. Screens and views

All routes from `routes.md` 3.7. `[A]` = `/p/{pid}/a/{aid}`. Frame A = advertiser shell, F = full-screen form. Access is `view / write` (RO = Read only and above, STD = Standard, CRE = Creative role also writes here).

| # | Screen | Route | Frame | Access |
|---|---|---|---|---|
| S1 | Creatives library | `[A]/creatives` | A | RO / STD, CRE |
| S2 | New creative (all kinds) | `[A]/creatives/new?type={n}&hostingSrc={n}` or `?kind=` | F | STD, CRE / STD, CRE |
| S3 | Creative page: Creative details | `[A]/creatives/{creativeId}` | F | RO / STD, CRE |
| S4 | Creative page: Creative status | `[A]/creatives/{creativeId}/status` † | F | RO / - |
| S5 | Creative page: History | `[A]/creatives/{creativeId}/history` † | F | RO / - |
| S6 | Format gallery | `[A]/formats` | A | RO / STD |
| S7 | Appeal history | `[A]/appeals-history` | A | RO / - |
| S8 | Bulk add creatives dialog | client dialog from S1 | modal | STD, CRE |
| S9 | Appeal dialog | client dialog from S4 | modal | STD |
| S10 | Preview dialog | client dialog from S3, S1 row | modal | RO |

### Proposed `type` / `hostingSrc` codes (answers routes Q7) †
Only third-party display (`type=0&hostingSrc=1`) was seen. The rest are simulator-chosen and live in `lib/routes/creative-kinds.ts`; `?kind=` is always accepted.

| `kind` (query) | `CreativeKind` (data-model 4.5) | `type` | `hostingSrc` |
|---|---|---|---|
| `third-party-display` | `THIRD_PARTY_DISPLAY` | 0 | 1 |
| `third-party-video` | `THIRD_PARTY_VIDEO` | 1 | 1 |
| `third-party-audio` | `THIRD_PARTY_AUDIO` | 2 | 1 |
| `upload-image`, `upload-html5` | `STANDARD_IMAGE`, `STANDARD_HTML5` | 0 | 0 |
| `upload-video` | `VIDEO_FILE` | 1 | 0 |
| `youtube-video` | `YOUTUBE_VIDEO` | 1 | 2 |
| `upload-audio` | `AUDIO_FILE` | 2 | 0 |
| `native-site` | `NATIVE_SITE` | 3 | 0 |
| `native-video` | `NATIVE_VIDEO` | 4 | 0 |
| `format-optimized` | `NATIVE_SITE` + `formatKey = OPTIMIZED` (Q3 in section 8) | 3 | 3 |

### S1 Creatives library
- **Layout**: `DvPageHeader` title "Creatives" (+ "Limited Access" chip for READ_ONLY), primary **New ▾** button, `DvFilterBar` ("Enter a search term or select filters"), refresh icon, list / grid toggle (`view_module`), `DvGrid`, `DvBulkBar` when rows are selected.
- **Menu** (exact, 08): Creative from format gallery · Upload ▸ HTML5 or image / Video file / YouTube video / Audio file · Bulk add creatives ▸ Audio / HTML5 or image / Native site / Native video / Third-party audio / Third-party display / Third-party video / ↗ Download templates · Third party ▸ Third-party audio / Third-party display / Third-party video. Each item navigates to S2 with the matching `kind`, or opens S8, or goes to S6.
- **List columns** (default order, 08): ☐ · Name (link, ✎) · ID · Status · Type · Format · AI label · DV360 status · Exchange status · Companions · Dimensions · Duration · Source · Created ↓ · Modified · Tag wrapping · Line Items. Column picker: all of them hideable except Name and ID.
- **Cell rules**: Type = `Standard` for uploads, native, video, audio, YouTube; `Third party` otherwise `[SIM]` (08 only shows `Standard`). Format = derived label ("Third-party display", "Image", "HTML5", "Video", "Audio", "Native site", "Native video", "Optimized"). DV360 status chip: Servable (green check) / Not servable (red) / Pending (dots). Exchange status text `Servable (n of m)` with dotted underline and hover card listing each exchange and status. Line Items text `{n} line items` linking to `[A]/explorerlis?f.creative={id}` †. Tag wrapping `Yes` / `No` (third-party tag creatives only, `appendTrackingTag`).
- **Filter keys** `f.*` `(from public docs)`: `status` (Active default, Paused, Archived), `type`, `format`, `dv360Status`, `exchangeStatus`, `source`, `lineItem`, `size`, `aiLabel`, `created` (date range). Default chip: `Status: Active`.
- **Grid view**: card tiles 220 px wide: thumbnail (placeholder asset), name, size or duration, status dot, DV360 status chip, `Servable (n of m)`. Click opens S3. Selection checkbox on hover.
- **Bulk bar** (`{n} row(s) selected`, 4.10): **Action ▾** = Activate, Pause, Archive, Unarchive, Assign to line items…, Download (CSV of selected rows) `[SIM]`. Disabled rules: BLK-010; READ_ONLY gets all items greyed (BLK-011); CRE-070 warning dialog when pausing or archiving creatives that are assigned to active LIs.
- **States**: loading = `DvSkeleton` rows; empty (no creatives) = `DvEmptyState` "No creatives yet" with **New** (hidden when read-only); empty filtered = "No results."; error = row banner "Couldn't load creatives" with Retry; **read-only** = New hidden (CRE-090), bulk edit items greyed.

### S2 New creative
Full-screen `DvFormPage`, header ✕ + title "New {kind label} creative" (example in 08: "New third-party display creative"). Cards stacked: **Basic details**, kind-specific cards, **AI label** (expander), **Additional details** (expander). Footer: **Create** (primary), **Cancel**, change note input (create mode, 2.8.6). Unsaved Changes dialog DLG-01 on ✕. After Create go to `[A]/creatives/{id}` (routes 6.3). Field tables per kind are in section 4.2.

### S3 Creative page: Creative details
Header ✕ + creative name; tabs Creative details · Creative status · History; summary strip: status · ID · CM360 ID (if any) or DV360 ID · Type · Format · Dimensions · Source. Same cards as create, prefilled, plus the **Status** dropdown (Active / Paused / Archived, CRE-010) and a **Preview** link. Footer in edit mode: **Save** (disabled until dirty), **Reset**, change note. CM360-source creatives: all fields read-only except Name and Status (CRE-060). Leaving with edits uses DLG-01 (soft guard, routes Q8).

### S4 Creative status
Cards in order (08):
1. **Creative summary**: Created, Modified, Review completed (help) timestamps in the advertiser time zone.
2. **Display & Video 360 review**: status chip, Feedback box ("Creative is servable" with **Appeal** when not servable), Restrictions list ("Legal: {country}, must comply with local laws…; This creative is restricted from serving in line items that target {country}", **Show more details**, "Is this useful? 👍👎" stores a `FeedbackVote` row `[SIM]` or nothing), Detected destination URLs (help).
3. **Exchange review**: summary "Approved by {n} of {m} exchanges"; info banner "Contact the respective exchange directly to resolve issues. For GAM issues contact DV360 support" (Dismiss, remembered per user in prefs); table Exchange (name + ID) · Status (✓ Approved / ⋯ Pending / ✕ Disapproved) · SSL · Feedback ("How to fix this?" expander with the reason text) · Last sync time; **Appeal** link per disapproved row.
4. **Line items**: "{n} associated line items." expander listing name + ID links.
5. **Line item eligibility** (help): expander. For each associated LI one row: LI name, "Can serve" yes/no, and the first failing MX-09 B condition in plain words (section 5).
- States: Pending creatives show a spinner chip "Review in progress" and the earliest `decideAt` hint "Usually takes a few hours" `[SIM]`. No exchanges enabled: "No exchanges are enabled for this partner." with link to Partner exchanges.

### S5 History tab
`DvHistoryTable` (table not day cards, 17): filter bar chip "Date range: dd/mm/yyyy to dd/mm/yyyy" ✕ + **Add a filter** (User, Field); columns ▾ · Date · User · Change; 25 per page; "1 - n of n". Change cell = summary ("12 changes made." / "CM Audit feedback changed from Pending validation to Ok"), expand shows one line per entry: creation `"{Field} is {value}"`, updates `"{Field} changed from {old} to {new}"`. System users shown as constants (`CREATIVE_APPROVAL_SYNC`, `DFA_TAG_VALIDATION_SYNC`). No "Include system changes" toggle here (system rows are part of this history in the demo).

### S6 Format gallery
Tabs All Formats · Video · Display · Native · Optimized. "Recommended formats" row (Optimized, Native display, Native video) then "All formats" grid. Card: phone mock-up (static illustration), name, badges (NEW, BETA, ONLY IN GWD), environments (Mobile app · Mobile web · Desktop), one-line description, actions **Create** (only when buildable) and **Details** (opens a side `DvSlideOver` with description, requirements and the supported LI types from MX-09). Static catalogue in `lib/creatives/formats.ts`:

| key | Name | Tab(s) | Badges | Buildable | Environments |
|---|---|---|---|---|---|
| `OPTIMIZED` | Optimized | Optimized, Display | NEW | yes | Mobile app, Mobile web, Desktop |
| `NATIVE_DISPLAY` | Native display | Native, Display | | yes | Mobile app, Mobile web, Desktop |
| `NATIVE_VIDEO` | Native video | Native, Video | | yes | Mobile app, Mobile web |
| `PARALLAX` | Parallax | Display | BETA, ONLY IN GWD | no | Mobile web |
| `SWIRL` | Swirl | Display | ONLY IN GWD | no | Mobile web |
| `HTML5_DISPLAY` | HTML5 or image | Display | | yes `(from public docs)` | all |
| `VIDEO_FILE` | Video | Video | | yes `(from public docs)` | all |
Descriptions are Adsmetor-written paraphrases (R2, R5).

### S7 Appeal history
Title "Appeal history"; table "Appeal History (help)": Ad or creative appealed · Campaign impact · Appeal type · Inventory · Policy · Status · Created · Completed · Result; pager "Items per page: 50". Empty state "No appeals found". Rows link to the creative status tab.

### S8 Bulk add dialog
Title "Bulk add {kind} creatives". Steps: 1) **Download template** link (`GET /api/dv/creatives/templates/:kind`), 2) drop zone (CSV, plus optional ZIP of assets), 3) **Upload**. Result toast "Bulk add started" with link to Bulk status (`/bulk-status`). Failed rows land in a result CSV with the rule ID (CRE-050).

### S9 Appeal dialog
Title "Appeal {name}" `[SIM]`. Body: list of disapproved exchanges (checkboxes, all ticked) or the DV360 review; optional reason textarea (0/1000). **Submit appeal** / **Cancel**. Result: toast "Appeal submitted", rows appear in S7.

### S10 Preview dialog
Renders the creative in a sandboxed `<iframe srcDoc>`: image/HTML5 placeholder, third-party tag (**Test tag** renders the pasted tag with macros replaced by `example` URLs, never executes network calls: iframe `sandbox=""` with CSP `default-src 'none'; img-src data:`), video/audio player on a generated 5 s placeholder file.

---

## 3. Data

Tables are from data-model 5.7. Names only here; new fields are **Δ**.

### 3.1 Tables used
`Creative`, `CreativeAsset`, `CreativeReview`, `CreativeRestriction`, `CreativeUrl`, `CreativeAppeal`, `CreativeAssignment`, `Exchange`, `PartnerExchange`, `LineItem` (counts only), `ChangeGroup`/`ChangeEntry` (History), `Alert` (read), `BulkJob`/`BulkJobItem` (bulk add), `Advertiser` (logo assets), `DeliveryDiagnostic` (read, eligibility panel).

### 3.2 Spec deltas (new or changed fields)
| # | Table.field | Change | Why |
|---|---|---|---|
| Δ12-1 | `Creative.version int N default 1` | add (and to every editable entity) | `routes.md` 8.0 sends `expectedVersion`; data-model base columns have no version |
| Δ12-2 | `Creative.skippable bool`, `skipOffsetSec int` | add | video file and VAST skip button (public docs) |
| Δ12-3 | `Creative.nativeFields json` | add `{headline, body, callToAction, advertiserName, displayUrl, ratings?}` | native site / video text assets |
| Δ12-4 | `Creative.vastVersion str Y`, `youtubeVideoId str Y`, `thumbnailAssetId cuid Y` | add | VAST, YouTube video, grid thumbnails |
| Δ12-5 | `Creative.reviewRequestedAt ts Y` | add | start of the current review round; engine derives `decideAt` from it |
| Δ12-6 | `CreativeReview.reasonCode str Y`, `appealCount int default 0`, `lastAppealAt ts Y` | add | feedback text "How to fix this?" mapped from a code; appeal limit |
| Δ12-7 | `CreativeAppeal.exchangeId cuid Y`, `reviewId cuid Y`, `reasonText str Y`, `initiatedById cuid`, `decideAt ts Y` | add | per-exchange appeals; the engine needs `decideAt` |
| Δ12-8 | `CreativeAppeal.status` | map `AppealStatus` (`OPEN, ACCEPTED, REJECTED`) to UI "Pending / Approved / Rejected" | engine text says "APPROVED"; keep data-model enum |
| Δ12-9 | `Upload` table (`id, sandboxId, purpose enum, fileName, sizeBytes, contentType, storageKey, status, createdById, createdAt`) | add | `uploads/sign` flow (routes 8.0); no table in data-model |
| Δ12-10 | `BulkAction.UPLOAD_CREATIVES`, `BulkSource.CREATIVE_BULK_ADD` | add enum values | creative bulk add job; `BulkJob.description` "Adding {n} {kind} creatives" |
| Δ12-11 | `Exchange.supportsDisplay/Video/Audio/Native bool`, `Exchange.requiresSsl bool` | add (if the sim profile does not already hold them) | decides which `CreativeReview` rows a creative gets, and CRE-011 |
| Δ12-12 | `CreativeRestriction.kind` add `AGE_RATING` `(from public docs)` | optional | not required for v1 |
| Δ12-13 | `PartnerFeatureFlag` key `creativeRandomDisapprovalRate` (or classroom param) | add | engine 3.4 disapproves 3% of new third-party tags at random; scenario sandboxes must set it to 0 (section 8, C4) |

### 3.3 Seed data requirements (extends data-model 3.2)
- `starter-agency`: about 30 creatives per advertiser: 8 third-party display (sizes from MX-09b), 6 image, 3 HTML5, 4 video file, 2 YouTube video, 2 audio, 2 native site, 1 native video, 2 third-party video (VAST stubs). Review mix: 70% fully approved, 10% approved on some exchanges only, 8% pending, 7% disapproved on one exchange (SSL or policy), 3% `NOT_SERVABLE`, 2% restricted (China legal text from 08, `blocksGeoTargeting = true`).
- `troubleshooting-lab`: one creative disapproved on all exchanges, one size mismatch (160x600 only while the LI buys 300x250), one restricted-country creative assigned to an LI that targets that country, one creative with no click macro.
- Assets: generated placeholders (solid colour + text), 1x1 VAST stubs, 5 s mp4 and 5 s mp3 placeholders in object storage (Vercel Blob), shared across sandboxes via `storageKey` so seeds are cheap.
- Appeal history: 2 completed appeals in `starter-agency` (one accepted, one rejected) so S7 is not empty; empty in `blank`.
- Format gallery catalogue is code, not DB.

---

## 4. Behaviour

Conventions: every write returns `Result<T>` (routes 8.0), takes `WriteMeta` (`expectedVersion`, `changeNote`), runs through `withChangeLog` (data-model 6.3), checks `assertAccess(session, ref, 'write')`, and runs the `CRE` rules from `lib/validation/rules/creative.ts` with `ValidationContext`.

### 4.1 Permissions (per DV360 role, `routes.md` section 2)
| Action | ADMIN | STANDARD | CREATIVE | READ_ONLY | PARTNER_CLIENT | REPORTING_ONLY |
|---|---|---|---|---|---|---|
| View library, creative page, status, history, formats, appeals | yes | yes | yes | yes | yes | no (404 page) |
| Create, edit, pause, archive, bulk add, assign to LIs | yes | yes | yes (creatives only) | no (CRE-090) | no | no |
| Appeal | yes | yes | yes | no | no | no |
| Scenario override | A scenario can lower a student to READ_ONLY to practise "why is New missing?" (routes section 2) | | | | | |
Permission key: `creative.write` (data-model 5.1). Assigning to line items additionally needs `entity.write` for the LI; the action reports each LI it could not change.

### 4.2 Forms and fields by kind
Common cards on every kind (08, 17):
| Field | Type / rule | Rule IDs |
|---|---|---|
| Name | text 0/512, required | CRE-001, CRE-002 |
| Status (edit only) | Active / Paused / Archived | CRE-010 |
| Landing page URL | URL 0/1024, prefilled `http://` on third-party display | CRE-004 |
| Don't scale to fit device width (edit) | checkbox | |
| AI label (expander) | radio Label this creative as created or edited with AI / Don't label this creative; default unset; info text | CRE-030 |
| Append tracking tag (expander) | checkbox "Append HTML tracking tag" | |
| Integration code | text optional, 500 bytes | CRE-009 |
| Notes | text optional | |

**K1 THIRD_PARTY_DISPLAY** (seen, 08): Dimensions W × H (default 0 × 0, CRE-003, CRE-026 warn), Technologies ☐ Requires MRAID ☐ Requires HTML5 (CRE-008 warn), Expanding direction (9 values), Expands on hover (CRE-007), Third-party tag textarea (CRE-005, CRE-006 warn, notice CRE-012), **Test tag** link, Additional details: ☐ Requires ping for attribution, Integration code, Notes.

**K2 STANDARD_IMAGE / STANDARD_HTML5** `(from public docs)`, chosen by the file dropped on **Main asset**:
- Main asset drop zone (file chip + ⊗, 17): image `gif/png/jpg/jpeg` ≤ 150 KB (CRE-020); HTML5 `.zip` ≤ 10 MB with one entry HTML (CRE-021). Dimensions read from the image placeholder metadata or entered for HTML5 (default read from `<meta name="ad.size" content="width=300,height=250">` in the entry file, else asked). Landing page URL required for images; HTML5 uses `clickTag` from the page so URL is required too.
- Additional: ☐ Don't scale, AI label, Append tracking tag, Integration code, Notes. Image creatives show **Preview**.

**K3 VIDEO_FILE** `(from public docs)`: Main asset video (CRE-022), duration read from file metadata (placeholder mp4 = 5 s; student file read via `ffprobe`-free parser of mp4 `mvhd` box, otherwise asked), Skippable ☐ + Skip offset (5 s default, ≤ duration), Landing page URL, Companion banner (optional, one image asset 300x250 or 728x90, appears in Companions column), Impression tracker URL, Click tracker URL (stored as `CreativeUrl`), AI label.

**K4 YOUTUBE_VIDEO**: YouTube video URL or 11-character ID (CRE-025); the simulator resolves any well-formed ID to a synthetic title and duration (seeded hash of ID, 15 to 180 s) `[SIM]`; shows the title as a read-only line. Landing page URL, companions optional.

**K5 AUDIO_FILE** `(from public docs)`: Main asset audio `mp3/ogg` 5 to 180 s (CRE-023), Landing page URL optional, Companion banner optional, trackers.

**K6 NATIVE_SITE / NATIVE_VIDEO** `(from public docs)`: Headline (≤ 25 `[SIM]`), Body (≤ 90), Call to action (≤ 15), Advertiser name (≤ 25), Display URL, Landing page URL, Main image 1200x628 or 1200x1200 (150 KB), Logo (square, ≥ 128), Native video adds a video asset. Constants go to `MX-16` as `NATIVE_HEADLINE_MAX`, `NATIVE_BODY_MAX`, `NATIVE_CTA_MAX` (Δ12-14, validation delta). Live preview card shows a feed-style mock.

**K7 THIRD_PARTY_VIDEO / THIRD_PARTY_AUDIO**: VAST tag URL or XML (CRE-024; versions 2, 3, 4.x), Duration (required for audio; read from VAST for video when it contains `<Duration>`), Skippable (video), Landing page URL optional (VAST carries click-through), Dimensions for video player (default 640 x 360).

**K8 FORMAT_GALLERY**: `OPTIMIZED` asset group form: Headlines (up to 5, ≤ 30), Descriptions (up to 5, ≤ 90), Images (up to 15), Logos (up to 5), Videos (optional, up to 5), Business name, CTA, Landing page URL. The engine treats it as a native-display-capable creative (qualityMult `1.05`, Q3 in section 8). Native display / native video reuse K6.

### 4.3 Server actions and API (TypeScript)
```ts
// Types extend routes.md 8.9 (CreativeInput, CreativeRow). Kinds map to data-model CreativeKind (section 8, C1).
type CreativeKindDb = 'STANDARD_IMAGE'|'STANDARD_HTML5'|'THIRD_PARTY_DISPLAY'|'NATIVE_SITE'|'NATIVE_VIDEO'|'VIDEO_FILE'|'YOUTUBE_VIDEO'|'AUDIO_FILE'|'THIRD_PARTY_VIDEO'|'THIRD_PARTY_AUDIO';

// GET /api/dv/advertisers/:aid/creatives
listCreatives(aid: Id, q: ListQuery<CreativeFilters>): ListResult<CreativeRow>        // view
// GET /api/dv/creatives/:id
getCreative(id: Id): Creative & { assets: CreativeAsset[]; urls: CreativeUrl[]; version: Version }

// action createCreative
createCreative(aid: Id, input: CreativeInput): Result<{ id: Id; publicId: number }>
// rules: CRE-001..012, 020..026 per kind, 030; perm creative.write
// effects: Creative row, assets (from uploadId), CreativeUrl rows, CreativeReview rows (one per enabled exchange where Exchange.supports{format}),
//          dv360Review=PENDING, reviewRequestedAt=simNow, ChangeGroup CREATE (<=60 entries, "N changes made."),
//          engine.scheduleReview(creativeId) (Δ12-15), Alert refresh (none now)

// action updateCreative
updateCreative(id: Id, input: Partial<CreativeInput> & WriteMeta): Result<{ version: Version; reviewRestarted: boolean }>
// rules as create + CRE-060 (CM360 read-only), CRE-070 on pause/archive with active LIs (warning)
// effects: if asset, tag, vastTag, youtubeVideoId, dimensions or landing URL changed => reviewRestarted:
//          dv360Review=PENDING, every CreativeReview=PENDING, reviewRequestedAt=simNow, engine.scheduleReview; ChangeGroup UPDATE entries per field

// action setCreativeStatus (single-row hover dropdown and bulk bar both call bulkCreativeAction)
bulkCreativeAction(req: { ids: Id[]; action: 'ACTIVATE'|'PAUSE'|'ARCHIVE'|'UNARCHIVE' }): Result<BulkResponse>
// BulkJob source BULK_EDIT, description "Status edited on {n} creatives", ChangeGroup STATUS_CHANGE per creative sharing bulkJobId; BLK-010 count; CRE-070 warning returned in warnings[]

// action assignCreativesToLineItems (library bulk bar "Assign to line items…")
assignCreativesToLineItems(req: { creativeIds: Id[]; lineItemIds: Id[]; mode: 'ADD'|'REMOVE' }): Result<BulkResponse>
// per pair: MX-09 A compatibility (format vs LI type) else issue LI-064 ("... aren't compatible"), unique (lineItemId,creativeId); ChangeGroup on the LI ("1 creative added")

// query used by the LI form panel (tabs All / Eligible / Assigned)
getEligibleCreatives(liId: Id, q: { tab: 'ALL'|'ELIGIBLE'|'ASSIGNED'; q?: string }): ListResult<CreativeRow & { eligible: boolean; why?: string }>
// Eligible = MX-09 A format fits the LI type (and size / duration plausible), status ACTIVE, not ARCHIVED. Review state does not make a creative ineligible for assignment (DV360 allows assigning pending creatives).

// bulk add
downloadCreativeTemplate(kind: BulkCreativeKind): CSV                 // GET /api/dv/creatives/templates/:kind
bulkAddCreatives(aid: Id, req: { kind: BulkCreativeKind; uploadId: Id; assetsZipUploadId?: Id }): Result<BulkResponse>
// parses CSV (rows <= 500 [SIM]), validates each row with CRE-001..026 (CRE-050), creates creatives in one transaction per row,
// BulkJob action UPLOAD_CREATIVES, BulkJobItem per row (OK/FAILED + rule ID + message); result file "Creative-bulk-result.csv"

// helpers
testTag(req: { tag: string }): { html: string }                       // POST /api/dv/creatives/test-tag, macro substitution only
getCreativePreview(id: Id): { kind: 'IFRAME'|'IMAGE'|'VIDEO'|'AUDIO'; srcDoc?: string; url?: string }

// review and status tab
getCreativeStatus(id: Id): CreativeStatusView                         // shape in routes.md 8.9, plus eligibility rows
appealCreative(id: Id, req: { exchangeIds?: Id[]; reason?: string }): Result<{ appealIds: Id[] }>
// rules: CRE-043 (only disapproved or not servable); engine limit: one open appeal per (creative, exchange) [SIM]
// effects: CreativeAppeal OPEN (decideAt from engine.scheduleAppeal), CreativeReview DISAPPROVED->PENDING, dv360 NOT_SERVABLE->PENDING (when DV360 appeal),
//          ChangeGroup UPDATE (actor USER), appears on S7

// read only
getCreativeHistory(id: Id, q: ListQuery<{ d?: DateRangeParam; user?: string; field?: string }>): ListResult<{ date: IsoDateTime; user: string; summary: string; lines: string[] }>
listFormats(aid: Id, tab: 'ALL'|'VIDEO'|'DISPLAY'|'NATIVE'|'OPTIMIZED'): FormatCard[]
listAppeals(aid: Id, q: ListQuery): ListResult<AppealRow>
```
Upload flow (routes 8.0, Q16): `POST /api/dv/uploads/sign { purpose: 'CREATIVE'|'BULK_CREATIVE'; fileName; size; contentType }` returns `{ uploadId, url, headers }`; browser PUTs to Vercel Blob; the action receives `uploadId`. Server reads size and type from the `Upload` row, never from the client. Max file size 5 MB (data-model Q15) except HTML5 10 MB (MX-09b) which needs a limit raise: conflict C6.

### 4.4 Validation rule IDs enforced
CRE-001 to CRE-012, CRE-020 to CRE-026, CRE-030, CRE-040 to CRE-043 (display only), CRE-050, CRE-060, CRE-070, CRE-080, CRE-090; BLK-010, BLK-011; LI-064 (compatibility) when assigning; GEN-004 (length) on server. New rules proposed (Δ12-14, to be added to validation.md CRE block):
| Rule ID | Field | Condition | Sev | Message `[SIM]` |
|---|---|---|---|---|
| CRE-100 | nativeFields.headline | empty or over limit | E | `Enter a value` / `Use {max} characters or fewer.` |
| CRE-101 | nativeFields.* | image/logo asset missing for native | E | `Add a main image and a logo.` |
| CRE-102 | skipOffsetSec | greater than duration, or skippable with duration under 5 s | E | `The skip offset must be shorter than the video.` |
| CRE-103 | assets | file bigger than the upload limit (MX-09b) | E | `That file is too large.` |
| CRE-104 | format gallery | **Create** on an `ONLY IN GWD` format via URL hacking | E | `This format can only be built in Google Web Designer.` (reword for the simulator: "outside this simulator") |

### 4.5 Review state machine (written by the engine, read here)
Mirrors validation 4.5 and engine 3.4. Module responsibilities:
1. On create or reviewable edit, create/reset `CreativeReview` rows `PENDING`, `dv360Review = PENDING`, set `reviewRequestedAt = simNow`.
2. Call `engine.scheduleReview(creativeId, reason)` which writes `decideAt` on each review row using the pure function `reviewSchedule(params, sandboxSeed, creativeId, simNow)` (Δ12-15: engine public API addition; engine.md 1.6 lists no such call, only `advanceReviews` in the tick).
3. Each tick the engine's `advanceReviews` flips rows whose `decideAt <= simNow`, writes `ChangeGroup` as `CREATIVE_APPROVAL_SYNC`, updates `reviewCompletedAt`, and raises/clears `CREATIVE_REJECTED` and `CREATIVE_RESTRICTED` alerts (engine 3.7).
4. Deterministic overrides for scenarios (`FaultSpec DISAPPROVE_CREATIVE`, `UNSERVABLE_SIZE`, `WEAK_CREATIVE`, engine 10.1) write through the same service layer.
5. SSL: CRE-011 sets that exchange `DISAPPROVED` with `reasonCode = SSL` for exchanges with `requiresSsl = true` at submit time. Feedback texts come from `lib/creatives/feedback.ts` keyed by `reasonCode` (SSL, POLICY_TAG_MISSING_CLICK_MACRO, POLICY_DESTINATION, SIZE_UNSUPPORTED, ASSET_QUALITY, OTHER) with "How to fix this?" steps written by Adsmetor.

### 4.6 Library derived values
- `exchangeStatus = { servable: count(reviews APPROVED), total: count(reviews) }`. Text `Servable ({servable} of {total})`; when `servable = 0` text "Not servable (0 of {total})" `[SIM]`.
- DV360 status column = `dv360Review`. Restricted creatives show an amber `info` icon with tooltip (CRE-042).
- Line Items = count of `CreativeAssignment` where the LI is not archived.
- Companions = count of creatives with `companionOfCreativeId = id`.

### 4.7 Side effects summary
| Action | ChangeLog | BulkJob | Alerts |
|---|---|---|---|
| create / update | yes, `entityType = CREATIVE`, source UI | no | engine raises CREATIVE_REJECTED / RESTRICTED after review |
| status bulk | one group per creative, `source = BULK_EDIT` | yes | engine clears alerts when archived creatives drop out |
| bulk add | one group per row, `source = BULK_EDIT` | yes (`UPLOAD_CREATIVES`) | |
| assign to LIs | group on the LI (`entityType = LINE_ITEM`) | yes when more than one LI | `NO_APPROVED_CREATIVE` diagnostic cleared by engine |
| appeal | `CREATIVE` update, actor USER | no | |

---

## 5. Engine hooks (engine.md)

| Engine output | Where shown here | Source section |
|---|---|---|
| Review state machine, `decideAt`, 3% random disapproval of new third-party tags, 12 to 36 sim hour appeal | S4 DV360 review, Exchange review, S7 results, library statuses | engine 3.4 |
| `C.*` reason codes (`C.NONE_ASSIGNED`, `C.NOT_APPROVED_EXCHANGE:*`, `C.SIZE_MISMATCH`, `C.GEO_POLICY`, `C.FORMAT_MISMATCH`, `C.ENV_REQUIREMENT`) | S4 **Line item eligibility**: each associated LI shows the top `C.*` code of the last 24 sim hours from `DeliveryDiagnostic` plus the live MX-09 B check from the current rows | engine 3.1, 3.2, 3.5 |
| Alerts `CREATIVE_REJECTED`, `CREATIVE_RESTRICTED` | red bell on library rows (join `Alert` by creative id in `payload`), Alerts page chip "Creatives" | engine 3.7 |
| Creative optimisation and per-creative CTR | Library does not show metrics. A "Performance" mini table on S3 `(from public docs)` lists impressions, clicks, CTR of the last 7 sim days per creative from `SimDailyMetric` slice `creative` | engine 6.2, 9.3 |
| Fault injection `DISAPPROVE_CREATIVE`, `UNSERVABLE_SIZE`, `WEAK_CREATIVE` | Visible only as state changes with actor `SIM_SCENARIO_LOADER` | engine 10.1 |
| Slot-size fit (`params.slotSizes`) | Eligibility explanation for size mismatch | engine 3.4 |

Engine deltas requested: Δ12-15 `engine.scheduleReview` / `scheduleAppeal`; Δ12-16 a `Creative` row field `qualityMult` (engine reads it, default 1.0) or derive it from `kind`/`formatKey` in code. State where the table lives is left to P3-08.

---

## 6. Acceptance criteria

### 6.1 Numbered, testable
1. The library lists the 16 columns of 08 in the stated order; default sort Created descending; default filter chip `Status: Active`.
2. **New ▾** shows the four groups and all items listed in S1, in order; it is hidden for READ_ONLY (CRE-090) and the page shows the "Limited Access" chip.
3. Creating a third-party display creative with empty name shows `Enter a value`; with `0 × 0` shows the CRE-003 text; with empty tag shows `Enter a value` under the tag; no navigation occurs.
4. A valid third-party display creative saves, navigates to `[A]/creatives/{id}`, and the History tab shows "N changes made." with lines `"Name is …"`, `"Creative type is …"`, `"Archived is false"`.
5. After creation the creative shows DV360 status Pending and every exchange row Pending; after the sim clock advances (engine tick), statuses move to Servable / Approved for at least 90% of seeds without a forced fault (engine calibrated).
6. Editing the tag, landing URL, dimensions or an asset resets review to Pending and writes a History row "… changed from … to …"; editing only the name or notes does not.
7. A creative disapproved on one exchange shows `Servable (1 of 2)` style text, the Exchange review table lists the reason under "How to fix this?", and **Appeal** appears; a fully approved creative shows no Appeal control (CRE-043 server side too).
8. Submitting an appeal creates an OPEN row on S7, moves the exchange to Pending, and after the engine delay resolves it to Accepted or Rejected with Completed and Result filled; the creative History shows the system user row.
9. Pausing or archiving a creative assigned to active LIs shows the CRE-070 warning with the count; after confirming, the library shows the new status and the LI's Troubleshooter later shows `C.NONE_ASSIGNED` if it was the only creative.
10. Bulk add with a 10-row CSV where 2 rows are invalid yields a `BulkJob` COMPLETED with 8 creatives created and a result CSV listing the 2 failures with rule IDs.
11. Assigning a video creative to a Display LI returns LI-064 and does not create an assignment; assigning to a Video LI succeeds and the library Line Items count increments.
12. Format gallery: Parallax and Swirl show **Details** only; Optimized, Native display, Native video show **Create**; **Create** opens S2 with the right kind.
13. CM360-source creative: only Name and Status are editable; other fields are read-only with the CRE-060 message on a forged save.
14. Test tag renders the pasted tag in a sandboxed iframe; scripts cannot reach the parent page (iframe sandbox attribute is empty).
15. Foreign IDs and other advertisers' creatives return the 404 page (routes R10).
16. REPORTING_ONLY users get the 404 page on all creative routes; PARTNER_CLIENT can open every page but cannot create.
17. Restriction text "This creative is restricted from serving in line items that target China" appears on S4 for restricted seeds, and an LI that targets that country records `C.GEO_POLICY` filtering for that creative.
18. All validation messages come from `MSG` constants; the docs-sync test (validation 6.2) passes for the CRE rules.

### 6.2 Playwright scenario outlines
| ID | Steps |
|---|---|
| E2E-CRE-01 | Login as student; open Creatives; assert 16 column headers; open **New ▾**; assert menu items |
| E2E-CRE-02 | Create third-party display creative with valid tag; assert redirect, Pending chips; advance clock via instructor API; reload; assert Servable |
| E2E-CRE-03 | Open `troubleshooting-lab`; open the disapproved creative; assert Disapproved rows; click Appeal; submit; fast-forward 36 sim hours; assert appeal result on S7 |
| E2E-CRE-04 | Upload a PNG over 150 KB; assert CRE-020 error; upload a valid one; assert preview |
| E2E-CRE-05 | Bulk add: download template, fill 3 rows, upload; assert Bulk status row and 3 creatives |
| E2E-CRE-06 | READ_ONLY student: New hidden, bulk items greyed, direct URL `/creatives/new` shows 404 or redirect per routes |
| E2E-CRE-07 | Library bulk-assign 2 creatives to 1 Display LI; assert LI creative count and the incompatible video creative rejection |
| E2E-CRE-08 | Format gallery: tabs filter cards; Create from Optimized lands on the Optimized form |

### 6.3 Vitest unit cases (`tests/creatives/`)
- `rules.creative.test.ts`: one case per rule CRE-001..CRE-012, 020..026, 043, 060, 070 with valid and invalid fixtures (extends validation 6.7 table).
- `compat.test.ts`: MX-09 A matrix, 10 formats × 8 LI types, expected Y/N.
- `serving-eligibility.test.ts`: MX-09 B six conditions, each failing alone, plus all pass.
- `review-schedule.test.ts`: `reviewSchedule` is deterministic for a fixed seed; delays fall in 1 to 3 h (DV360) and 2 to 12 h (exchange); random disapproval rate converges to 3% over 10,000 seeds (tolerance 0.5 points) and to 0 when the param is 0.
- `exchange-summary.test.ts`: `Servable (n of m)` and "Approved by n of m exchanges" strings.
- `history-render.test.ts`: create entries render `"{Field} is {value}"` and cap at 60 with "N changes made."; update entries render `"{Field} changed from {old} to {new}"`.
- `bulk-csv.test.ts`: template header per kind, row parser, 500-row cap, per-row failures carry rule IDs.
- `vast.test.ts`: VAST 2/3/4 accepted, malformed rejected, `<Duration>` parsed.
- `kind-map.test.ts`: routes DTO kind ↔ `CreativeKindDb` ↔ validation `MX-09` key round trip for all kinds.
- `feedback.test.ts`: every `reasonCode` has text and fix steps.

---

## 7. Build tasks

Sizes: S under half a day, M about a day, L about two days of cloud-session work.

| # | Task | Size | Depends on |
|---|---|---|---|
| M12-01 | Constants: `creative-kinds.ts`, `formats.ts`, `feedback.ts`, MX-09/09b in `lib/validation/constants/creatives.ts`, kind maps | S | P3-01, P3-06 (validation scaffold) |
| M12-02 | Schema deltas Δ12-1..13 (migration + seed fields) and `Upload` table, Vercel Blob adapter, `uploads/sign` route | M | P3-01, P3-05 |
| M12-03 | Seed generator for creatives, reviews, restrictions, appeals (starter-agency, troubleshooting-lab) | M | P3-05 |
| M12-04 | CRE rules module + Vitest cases | M | P3-06 validation scaffold |
| M12-05 | Library list/grid, filters, columns, bulk bar (`DvGrid`, `DvFilterBar`, `DvBulkBar`) and `listCreatives` | L | P3-03, P3-04, M12-02 |
| M12-06 | Create/edit forms K1 (third-party display) + creative page shell with Details, Preview, Test tag | M | P3-04, M12-04 |
| M12-07 | Upload kinds K2 to K5, K7 forms and asset handling | L | M12-06, M12-02 |
| M12-08 | Native and format-gallery forms K6, K8; format gallery page | M | M12-06 |
| M12-09 | Creative status tab, exchange review table, eligibility panel, `getCreativeStatus` | M | M12-05, P3-08 (`DeliveryDiagnostic` rows) |
| M12-10 | Appeal flow, appeal history page, engine `scheduleReview` / `scheduleAppeal` and `advanceReviews` | M | P3-08 |
| M12-11 | Creative History table renderer (reads `ChangeGroup`) | S | P3-05 (`withChangeLog`) |
| M12-12 | Bulk add (templates, CSV parse, result file, `BulkJob`) | M | P3-05 (BulkJob), M12-04 |
| M12-13 | Assignment helpers `getEligibleCreatives`, `assignCreativesToLineItems`, wire into LI form panel | M | P3-06 |
| M12-14 | Playwright E2E-CRE-01..08 | M | all above |

Order: 01, 02, 03, 04 in parallel, then 05, 06, 11, then 07, 08, 09, 10, 12, 13, then 14.

---

## 8. Open questions and conflicts

### Conflicts found between specs

> Resolved: every conflict below is consolidated in [`../conflicts.md`](../conflicts.md) (crosswalk table, rows `RC-nnn`). Where a proposal here and the RC row differ, the RC row wins.
| # | Conflict | Files and sections | Proposed resolution |
|---|---|---|---|
| C1 | Three vocabularies for creative kind: routes `CreativeInput.kind` (`UPLOAD_IMAGE_OR_HTML5`, `UPLOAD_VIDEO`, `UPLOAD_AUDIO`, `FORMAT_GALLERY`...), data-model `CreativeKind` (`STANDARD_IMAGE`, `STANDARD_HTML5`, `VIDEO_FILE`, `AUDIO_FILE`...), validation MX-09 (`IMAGE`, `HTML5`, `VIDEO_FILE`, `TP_DISPLAY`, `TP_VIDEO`, `TP_AUDIO`) | routes.md 8.9; data-model.md 4.5; validation.md MX-09 | DB value = data-model. `lib/creatives/kinds.ts` holds the three-way map (tested by `kind-map.test.ts`). Routes DTO is a wire shape only |
| C2 | AI label enums differ: data-model `UNSET/AI_GENERATED/NOT_AI_GENERATED`, routes `'AI'|'NONE'`, validation `LABEL_AI/NO_LABEL` | same files, CRE-030 | DB = data-model; the DTO maps; add `UNSET` to the wire type |
| C3 | `expectedVersion` (optimistic lock) in routes 8.0, but no `version` column in data-model base columns | routes.md 8.0; data-model.md header | Δ12-1: add `version int` to every editable entity (data-model delta) |
| C4 | Engine disapproves 3% of new third-party tags at random; validation 4.5 says NOT_SERVABLE comes from a "policy failure (scenario seed or validation)". Random failures break graded exercises such as "Launch a CTV campaign" | engine.md 3.4; validation.md 4.5 | Make the rate a param, default 0.03 for free play and forced to 0 in scenario sandboxes (Δ12-13); scenario setup can force outcomes |
| C5 | Appeal outcome words: engine "APPROVED/DISAPPROVED", data-model `AppealStatus` OPEN/ACCEPTED/REJECTED | engine.md 3.4; data-model.md 4.5 | UI maps ACCEPTED → "Approved", REJECTED → "Disapproved" in Result column |
| C6 | HTML5 limit 10 MB (MX-09b) versus 5 MB upload limit (data-model Q15) and about 4.5 MB Vercel body limit (routes Q16) | validation.md MX-09b; data-model.md Q15; routes.md Q16 | Browser uploads go straight to Vercel Blob via signed URL, so the body limit does not apply. Set the cap to 10 MB for HTML5 and video placeholders only, 5 MB for other files; data-model Q15 to be updated |
| C7 | Routes: library/status/history tab paths marked † (not recorded). Creative page in the demo is `/a/{aid}/creatives/{id}` with tabs inside the SPA | routes.md 3.7 | Keep path-segment tabs (routes R3); acceptable deviation |
| C9 | Module 08-line-items defines `assignCreatives(liId, {add, remove})` (L13) as the per-LI action; this spec adds the library-side wrappers `assignCreativesToLineItems` and `getEligibleCreatives` | modules/08-line-items.md L13 | The wrapper calls `assignCreatives` per LI; one implementation of the LI-060/061/064 rules |
| C8 | Engine has no scheduling call for reviews (only `advanceReviews` in the tick) | engine.md 1.6, 11.5 | Δ12-15 add `engine.scheduleReview` as a pure helper called by the service layer |

### Open questions
- Q1. Default of exchange rows when the partner enables a new exchange after creatives exist: backfill reviews as PENDING (assumed) or leave missing (no serving)? Assumed backfill, decided at M12-10.
- Q2. Can students upload their own real files (data-model Q15 says yes, 5 MB, no scanning)? Needs a decision on content policy for a classroom tool; assumed yes with MIME sniffing and no scanning.
- Q3. Optimized format: separate `CreativeKind` or `NATIVE_SITE` + `formatKey`? Assumed the latter; the engine multiplier lives in `params`.
- Q4. Real DV360 creative-bulk template columns are unknown (blocked). The columns in section 4.3 are `[SIM]`; confirm with a full-access account.
- Q5. Does the filter bar offer `size` and `aiLabel` keys? Unknown, `(from public docs)`.
- Q6. Do we show "AI label" on Third-party creatives? 08 shows none on the third-party form but 17 shows it on the image page. Assumed shown on all non-third-party kinds, hidden on third-party tags (CRE-030 applies to uploaded kinds).
- Q7. Whether pending creatives can already be assigned. Assumed yes.
- Q8. Companion banners: separate library creatives (data-model `companionOfCreativeId`) or inline assets? Assumed inline asset that creates a hidden child creative row so the Companions column works.
