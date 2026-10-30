// Tables that hold UI state, not DV360 data. Writes to them need no change log entry (module 05 DELTA-05-6, RC-031).
export const UI_STATE_TABLES: readonly string[] = [
  'Workspace',
  'WorkspaceShare',
  'PinnedItem',
  'RecentlyViewed',
  'UserPreference',
  'AdvisorSession',
  'AdvisorMessage',
  'NotificationDismissal',
  'UserEmailPreference',
  'SavedView',
  'ChartCard',
  // History notes are annotations on a day, not changes to an entity (module 05 4.6, DM 6.1)
  'HistoryNote',
];

// Engine output and the log itself. The engine's tick writes are exempt by path in module 05 4.1.1;
// the scan also skips these tables for services that touch them (for example an alert read model).
export const ENGINE_OWNED_TABLES: readonly string[] = [
  'SimClock',
  'SimHourlyMetric',
  'SimDailyMetric',
  'DeliveryDiagnostic',
  'Alert',
  'ChangeGroup',
  'ChangeEntry',
];
