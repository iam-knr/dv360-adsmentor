# 16 — Change history, notifications, misc
Path: Advertiser → History · Campaign / IO / LI page → History tab · top bar bell · right rail   Level: Advertiser, Campaign, IO, LI
Explored: 2026-10-28. Read-only: toggles and date range changed for viewing only; note panel opened and cancelled. Names/IDs are placeholders (R5).

## Routes
| Page | Route |
|---|---|
| Advertiser history | `/a/{aid}/history` |
| IO history | `/a/{aid}/c/{cid}/io/{ioId}/history` |
| LI history | `/li/{liId}/history` (see 05) |
| Query params | `?d={YYYYMMDD}:{YYYYMMDD}` date range · `&s=1` include system changes |

IO page tabs: **Line items** (`/explorerlis`) · **Insertion order details** · **History**. Breadcrumb above title: "Overview ›".

## Views

### History page (same layout at every level)
- Title "History" (advertiser) or the entity's History tab; "Limited Access" chip.
- Tab strip with one tab **Spend** → spend-over-time chart card; empty state "No performance chart data available".
- Toolbar row:
  | Control | Behaviour |
  |---|---|
  | Date range (label "90 days to today" / "Custom") | default last 90 days; opens the standard date picker (see 02): presets Custom · Today · Yesterday · This week (Sun – Today) ▸ · Last 7 days · Last week (Sun – Sat) ▸ · Last 14 days · This month · Last 30 days · Last month · Last 2 years · "[30] days up to today" · "[30] days up to yesterday"; Start/End date inputs + month calendar |
  | Include local timezone | toggle (off) — show times in viewer's zone instead of advertiser zone |
  | Include system changes | toggle (off) — adds automated/system-user entries |
  | Download | link — export change log |
  | Expand/collapse all (unfold_more / unfold_less) | icon button |
- Change log grouped by **year** heading → **day card**:
  - Left: date ("Mar 26") + weekday.
  - Header: "{n} changes to {entity type}" (e.g. advertiser, insertion order) + link **Add a note**.
  - Table columns: **Time** (e.g. "10:55:08 IST") · **Description** (expandable ▾ summary) · **User** (email, or system user name such as `PARTNER_SETTING_UPDATER` / account-manager label).
  - Expanded description shows field-level detail, e.g.:
    - "1 ad exchange added" → "{Exchange}"
    - "1 approval status change" → "{Exchange}: Ad exchange approval status changed from "default (Unchecked)" to "Approved""
    - Advertiser: "Customer changed" → list of feature-flag lines "Product feature … enabled/disabled".
  - Pattern for simulator: "{field}: {label} changed from "{old}" to "{new}"".
- Empty state: list icon + "There is no history for this date range."

### Notes panel ("Add a note")
- Right side panel "{Mon D, YYYY} notes" ✕.
- Text box "Add your note here"; hint "Your note will be seen by anyone who has access to this page"; **Save** · **Cancel**.
- List below; empty "There are currently no notes."

### Notifications (top bar bell) — see 01
- Card "Notifications" ✕; item: type label "Announcement" + dot, age ("9 d"), title (e.g. "Coming soon: … updates in Q4 2026"), body, **Learn more** · **Dismiss**.

### Right rail (see 01)
- Ask Advisor (BETA chat panel: AI disclaimer, history/new chat/⋮/✕ icons, "Type message" box), Help, Intelligence (15).

## Actions & state changes
| Action | Result |
|---|---|
| Any create/edit/status change on an entity | Writes ChangeLog row(s): entity, time, user, field, old → new; shows on that entity's History and its parents' (advertiser = all) |
| Toggle Include system changes | Shows/hides rows whose user is a system account |
| Toggle local timezone | Re-renders times |
| Add a note → Save | Note attached to that day for that entity (not executed) |
| Download | Export of the filtered log (not executed) |
| Dismiss notification | Removes it from the bell list for this user |

## Simulator notes
- ChangeLog model: id, entityType, entityId, parent chain, userId or systemActor, timestamp, field, oldValue, newValue, groupId (one save = one group, e.g. "2 changes to insertion order").
- Engine/scenario actions (instructor resets, exchange approvals, auto-bidding) should log as system users so the "Include system changes" toggle is meaningful.
- Notes: HistoryNote(entity, date, author, text).
- Spend chart reads SimDailyMetric.
- Notifications: instructor-authored announcements (replaces Google announcements).

## Dependencies on other modules
- Every CRUD module writes ChangeLog; 01 (bell, right rail), 02 (date picker), 15 (Intelligence).

## Open questions / gaps
- A user-made field change (e.g. budget edit) was not present in the demo log; row format inferred from system rows.
- Download file format not checked.
