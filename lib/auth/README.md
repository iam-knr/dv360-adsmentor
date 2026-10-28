# lib/auth

Owner session: P3-02.
Spec: modules/18 (4.1), modules/19 (4.4 to 4.6), routes.md 2 and 5.3. Do not edit from another session (build-plan 3.2).

Where things live:

- Sign in: `signin.ts` (`authenticate`, one routine for every outcome), `throttle.ts` (AuthThrottle), `lockout.ts` (`registerUserFailure`, `clearLockout` for Unlock and Reset password), `messages.ts` (SIM-001/002, ACC texts).
- Passwords: `password-policy.ts` (`checkPassword`, client safe), `argon.ts` (hash, verify, generate; no `server-only`, used by scripts), `password.ts` (the same behind `server-only`), `password-change.ts`, `provision.ts` (`provisionStudent`), `common-passwords.ts`.
- Sessions: `config.ts` (edge safe Auth.js config), `index.ts` (adds the credentials provider; Node only), `session.ts` (`getSessionUser`, `requireUser`, `requireUserOrRedirect`), `session-core.ts` and `session-check.ts` (sessionVersion, sid, idle and absolute limits), `policy.ts` (AccountPolicy), `view-as.ts`.
- Edge: `guard.ts` (pure routing decisions of `middleware.ts`), `roles.ts`, `dev-bypass.ts`.
- Account safety helpers for P3-02b: `super-admin.ts` (`assertNotLastActiveSuperAdmin`), `audit.ts` (`writeAudit`, allowed payload keys).

Never log or return a password, hash or session secret. `AUTH_DEV_BYPASS` is honoured only when `NODE_ENV` is development or test.
