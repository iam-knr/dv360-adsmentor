# components/campaigns

Owner session: P3-06b. Fidelity pass (audit 1): FID-CAMPAIGNS. See `docs/gaps/fid-campaigns.md`.
Spec: modules/03-campaigns.md. Do not edit from another session (build-plan 3.2).

- `CampaignsList`: sub-tabs, toolbar (New campaign, date range, filter toggle, ⋮), chip filter bar, fixed columns.
- `ListChrome`: sub-tabs, `d` param writer, Intelligence panel open on load.
- `CampaignForm`: New campaign and Campaign settings, in the real field order; validation wording in `lib/campaigns/form-issues.ts`.
- `CampaignChartStrip`: five fixed chart cards.
