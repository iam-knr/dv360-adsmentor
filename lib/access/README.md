# lib/access

Owner session: P3-02.
Spec: modules/18 (4.3), routes.md 7.4. Do not edit from another session (build-plan 3.2).

- `windows.ts`: `isClassOpen`, `getClassAccessState`, `getWindowBanner`, `assertWindowOpen` and `checkWindowOpen` (`ACCESS_WINDOW_CLOSED`), `tickAccessWindows` (statuses, freeze and unfreeze).
- `window-rules.ts`: the pure rules behind them. The window times decide, not the status column, so a late tick never extends a class.
- `class-context.ts`: which class, sandbox and partner a person works in (RC-061).
- `guard.ts`: `requireOpenClass(user)` for student pages and the DV360 layouts.
