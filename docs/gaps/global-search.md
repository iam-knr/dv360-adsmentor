# Global search (module 01 S3, task 01-T11): what is built and what is not

Branch `global-search`. Owner report 31 Oct: the top-bar Search overlay said "Search is not built yet (module 01, Phase 4)". No migration.

## Built

| Area | What | Where |
|---|---|---|
| Overlay | 640 px panel with scrim, placeholder, "Try searching this advertiser for:", the 7 chips, footnote. States: closed, open with chips, typing (250 ms debounce, "Searching" spinner), result (interpretation line + **Open**), no match (text with a "Search by name or ID" link), error. `/` opens it (not while typing, not under another modal: `useHotkeys`), Esc closes, focus is trapped by the Dialog and returns to the trigger | `components/shell/SearchOverlay.tsx`, used by `TopBar` (live) and `DvAppBar` (static: chips and submit from props) |
| Chips | Saved filter links, navigate at once (no API call). The two "over X" chips use default thresholds (CPC 1, CPA 20, advertiser currency) because the chip text has no number; edit the URL or type "LIs with CPC over 2.5 last week" for another value | `lib/search/suggestions.ts` (DELTA-01-10) |
| Resolver | Pure phrase to filter link: status words, entity words (campaigns, IOs / insertion orders, line items / LIs), YouTube, expiring soon, unused pacing, pacing type, CPC / CPA thresholds with a period (last week default). Every word must be understood; a leftover word or two different entities give `target: null` and the name/ID fallback, because dropping a word would show the wrong list | `lib/search/resolve.ts` |
| API | `POST /api/dv/advertisers/:aid/search`, `GET /api/dv/advertisers/:aid/search/suggestions`, plus `POST /api/dv/partners/:pid/search` for partner pages (advertisers by name or ID). RO, query 1 to 200 characters (GEN-004, 400 `INVALID`), sandbox scoped through `withSandbox` (RLS on) | `app/api/dv/advertisers/[aid]/search*`, `app/api/dv/partners/[pid]/search`, `lib/search/service.ts` |
| Direct hits | Name (contains) or numeric ID match across campaigns, IOs, line items, creatives and audiences of the advertiser, 10 in total, each with a link | `lib/search/service.ts` |
| List filters | The lists the chips land on honour the `f.*` params: Advertiser `explorerlis` (`f.status`, `f.type`, `f.endsWithin`, `f.pacing=UNDER`, `f.pacingType`, `f.cpcOver`, `f.cpaOver`, `d`, `q`), `explorerios` (`f.status`, `f.pacingType`, `d`, `q`), `cs` (`f.status`, `q`, `d`). `f.status` sets the grid's Status select ("Status: Paused"); every other filter is a removable chip ("Type: YouTube", "Pacing type: Ahead", ...) | `lib/search/list-filters.ts`, `components/search/ListFilterChips.tsx`, the three `page.tsx` files |
| Tests | `tests/unit/search-resolve.test.ts`, `tests/unit/search-list-filters.test.ts`, `tests/shell/search-overlay.test.tsx`, `tests/e2e/search.spec.ts` (PW-01-5) | |

## Definitions chosen (the spec does not give them)

- **Expiring soon**: an ACTIVE line item whose flight (own dates when custom, else the IO's first start and last end) ends within 7 sim days of today.
- **Unused pacing**: an ACTIVE line item with a fixed budget and a flight, whose spend over its lifetime (revenue column, `d=LIFETIME`) is more than 10 points behind the share of the flight that has passed.
- **CPC over X**: revenue / clicks in the `d` range (default last week) above X. **CPA over X**: the grid's CPA column above X. Rows without clicks or conversions are left out.
- **Pacing type AHEAD** on IOs reads `InsertionOrder.pacingType`; line items also accept `f.pacingType`.
- `d=LAST_WEEK` is the previous Monday-to-Sunday week (`lib/metrics/date-range.ts`); `listLineItems` now accepts `d` and returns `simToday`.

## Not done

| # | Gap | Reason / where it goes |
|---|---|---|
| 1 | The grids read the URL once on load. Changing the Status select does not rewrite `f.status`, and the extra filters are applied on the server, so a chip's x reloads the page | Full `useListParams` wiring of the three grids belongs to the list modules; this PR keeps the edit small |
| 2 | Filters apply to the advertiser-level lists only. Campaign and IO level `explorerlis` / `explorerios` ignore the new `f.*` keys (status already worked there through the grid's own select only) | The overlay only emits advertiser-level links |
| 3 | The partner Advertisers list (`[P]/advertisers?q=`) is the target of the partner fallback link; it is not changed here and may ignore `q`. The overlay lists matching advertisers directly, so nothing is lost | Partner list is owned by module 02 |
| 4 | Name/ID results are not ranked: ordered by name inside each type, campaigns first, 10 in total | Good enough for classroom sandboxes |
| 5 | No full-text search of other entities (templates, floodlight groups, deals, custom lists) | Out of module 01 scope |
| 6 | Free text such as "line items with budget over 500" is not understood; it falls back to name/ID | Rule-based resolver by design (DS Q12) |
| 7 | Resolver unit tests live in `tests/unit/` (the vitest `unit` project only includes `tests/**`), not `lib/search/resolve.test.ts` as module 01 says | Project test layout |
