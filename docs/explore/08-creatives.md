# 08 — Creatives
Path: Advertiser → Creative ▸ Creatives / Format gallery / Appeal history   Level: Advertiser
Explored: 2026-10-28. Nothing saved. Creative forms render inside a cross-origin frame (read from screenshots). Names/IDs are placeholders (R5).

## Routes
| Page | Route |
|---|---|
| Creatives library | `/p/{pid}/a/{aid}/creatives` |
| New creative | `/creatives/new?type={n}&hostingSrc={n}` (third-party display = type 0, hostingSrc 1) |
| Creative page | `/creatives/{creativeId}` (tabs Creative details / Creative status / History) |
| Format gallery | `/a/{aid}/formats` |
| Appeal history | `/a/{aid}/appeals-history` |

## Views

### Creatives library
- Title "Creatives". Toolbar: **New ▾** (primary), filter bar ("Enter a search term or select filters"), refresh, view toggle (list / grid "view_module").
- Columns: checkbox · Name (link, wraps) + ✎ · ID · Status (Active) · Type (Standard, …) · Format (e.g. Third-party display) · AI label · **DV360 status** (Servable …) · **Exchange status** (e.g. "Servable (1 of 2)", dotted underline = hover detail) · Companions · Dimensions (300 × 250) · Duration · Source (e.g. Third party (CM360)) · Created ↓ · Modified · Tag wrapping (No) · Line Items (e.g. "2 line items").
- New ▾ menu:
  - Creative from format gallery
  - Upload ▸ HTML5 or image · Video file · YouTube video · Audio file
  - Bulk add creatives ▸ Audio · HTML5 or image · Native site · Native video · Third-party audio · Third-party display · Third-party video · ↗ Download templates
  - Third party ▸ Third-party audio · Third-party display · Third-party video

### New third-party display creative (full page "X New third-party display creative")
Card **Basic details**:
| Field | Type | Notes |
|---|---|---|
| Name | text (0/512) + help | |
| Dimensions | "W × H" input (default 0 × 0) + help | |
| Landing page URL | URL (prefilled "http://", 0/1024) + help | |
| (edit only) Don't scale to fit device width | checkbox + help | |
| Technologies (help) | ☐ Requires MRAID · ☐ Requires HTML5 | |
| Expanding direction | dropdown + help | None · Up · Down · Left · Right · Up and left · … (diagonals) |
| Expands on hover | checkbox | |
| Third-party tag | textarea (paste ad tag, macros like ${CLICK_URL}, ${GDPR}, ${GDPR_CONSENT_755}) | Amber notice: you are responsible for user-data collection compliance (EU User Consent Policy) |
| Test tag | link (renders tag preview) | |
Card **Additional details** (collapsible): ☐ Requires ping for attribution (help) · Integration code (Optional) · Notes (Optional).
Footer: Save · Cancel.

### Creative page (`/creatives/{id}`)
- Header X + creative name; tabs **Creative details | Creative status | History**.
- Summary strip: status (Active) · ID · CM360 ID · Type · Format · Dimensions · Source.
- **Creative details**: same form, prefilled, + Name status dropdown (Active / …), "Preview" link; Save · Cancel.
- **Creative status**:
  - Creative summary: Created, Modified, Review completed (help) timestamps.
  - **Display & Video 360 review** — status chip (✓ Servable); Feedback box ("Creative is servable" + Appeal); Restrictions (e.g. "Legal: China — must comply with local laws…; This creative is restricted from serving in line items that target China", Show more details, "Is this useful? 👍👎"); Detected destination URLs (help).
  - **Exchange review** — summary "Approved by 1 of 2 exchanges"; info "Contact the respective exchange directly to resolve issues. For GAM issues contact DV360 support" (Dismiss); table Exchange (name + ID) · Status (✓ Approved / ⋯ Pending / ✕ Disapproved) · SSL · Feedback ("How to fix this?" expander) · Last sync time; "Appeal" link.
  - **Line items** — "N associated line items." (expand).
  - **Line item eligibility** (help, expand).
- History: change log (P1-16).

### Format gallery
- Tabs: All Formats · Video · Display · Native · Optimized.
- "Recommended formats" row + "All formats" grid. Each card: phone mock-up preview, name + badges (NEW, BETA, ONLY IN GWD), environments (Mobile app · Mobile web · Desktop), one-line description, actions Create (when buildable in DV360) / Details.
- Formats seen: **Optimized** (NEW; Google picks best asset combination per customer), **Native display** (fits look and feel of publisher page), **Native video**, **Parallax** (BETA, ONLY IN GWD; layered scene on scroll), **Swirl** (ONLY IN GWD; interactive 3D models).

### Appeal history
- Title "Appeal history"; table "Appeal History (help)": Ad or creative appealed · Campaign impact · Appeal type · Inventory · Policy · Status · Created · Completed · Result. Empty "No appeals found". Pager "Items per page: 50".

## Simulator rules (derived)
- Creative review state machine: Pending → Servable / Not servable (DV360 review) and per-exchange Pending → Approved / Disapproved; LI only serves on exchanges where creative approved and size matches inventory.
- Restrictions (e.g. country policy) block serving for LIs targeting that geo.
- Appeal → creates Appeal history row; engine flips status after delay.

## Open questions
- Upload forms (HTML5/image zip, video file, YouTube video, audio), native site/video, bulk upload template format.
- Third-party video (VAST) and audio forms.
- Grid view of library; filter field list; bulk actions on creatives (archive, assign to LIs).
- Creative History tab content.
