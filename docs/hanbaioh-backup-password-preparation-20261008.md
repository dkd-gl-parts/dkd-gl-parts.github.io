# Backup password preparation — v1.1.1137

The administrator-only backup setup request explicitly opts into personal password preparation with fixed booleans `confirmStartup:true` and `allowPasswordPreparation:true`. The dedicated Windows GUI performs its own sign-in/MFA, verifies the current company/device and Google connection, then accepts a masked backup password for three minutes.

Personal preparation is stored with CurrentUser DPAPI in a separate format and directory. The only completion status is `pending_recovery`. The Japanese, English and Chinese UI reports that recovery setup and full registration remain. It does not mark readiness green, copy a password into the browser, authorize a backup/import, or change the existing production registration gates.

The public request remains administrator-only. Browser presentation and fixed flags do not grant server authorization. The existing signed bootstrap permit only opens the view. No database, Edge, secret, CSP or permission change is included.

Verification:

- All 129 commands from `.github/workflows/search-performance-guard.yml` passed, including syntax, feature contracts, static build and response headers.
- 65 headless UI cases passed across Japanese/English/Chinese at 1280/390/320px, with missing startup notification, silent issuer, opened, failed, saved, pending, 403 and hidden-role states. No private session was copied; no user browser tab was opened.
- Native 528 related tests: 526 passed, zero failures, two optional legacy product-EXE tests skipped. The new packaged host and private-pipe WinForms test passed.
- Separate synthetic CurrentUser DPAPI check and immutable preparation/full-registration separation passed.

Native compatibility: host/GUI password-preparation package and extension 0.5.8. An old extension rejects the new fixed request and receives the existing update guidance. Personal extension activation remains a user action.

Rollback: review a coordinated frontend/extension/native rollback using retained previous artifacts. Do not erase protected settings or preparations. Actual rollback has not been executed.

Evidence is local under `D:\Documents\New project\.codex-artifacts\hanbaioh-backup-password-preparation-20261008`. Real personal password entry and full backup/recovery remain unverified; no vendor import/export was repeated.
