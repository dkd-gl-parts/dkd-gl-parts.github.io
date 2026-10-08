# Backup setup window startup

## Report and observed evidence

- D-CATS v1.1.1135 remained at the opening message with disabled setup controls.
- The 2026-10-08 04:38:26 UTC opening-permit request returned HTTP 200 in 1317 ms.
- Installed native host and GUI matched the reviewed hashes. No newer setup replay marker or running helper was found at inspection.
- These observations do not identify the exact failed transport step. Existing code had an unbounded issuer wait, silently ignored a second active setup request, and waited ten minutes without confirming that a window opened.

## Changes

- Bound issuer waiting to 30 seconds. Page exit, owner change and cancellation discard late permits without starting or retrying a native operation.
- Allow 20 seconds for startup. Only a strict matching window-open notification changes the message to the instruction to use the dedicated window. After that, retain the existing ten-minute interaction limit and three-minute password registration permit.
- The native GUI emits a fixed private-pipe notification after its Form is shown. The host waits up to 15 seconds for this notification. The extension relays only the exact current request ID and fixed notification type.
- Report connection failures and duplicate active requests instead of silently ignoring them. A missing startup acknowledgement restores controls with a fixed recovery instruction.
- Native host and extension 0.5.7 must be installed together. The user must reload the unpacked extension and update the D-CATS page to activate the new transport in an already running browser.

## Scope and verification

No database, Edge Function, secrets, grants, vendor data, saved credentials, recovery roster, or operation flags change. Existing authorization and independent native authentication remain in place.

Synthetic tests cover stalled/late issuer responses, startup timeouts, matching notifications, rejected private fields, cancellation, stale owners and old extensions. Desktop/mobile UI is verified in a headless browser with synthetic transport. Real personal authentication and visible startup remain to be confirmed by the user.

Rollback candidate: frontend commit 9478eb3; previous native host and GUI plus changed extension files are archived by the pinned updater. Actual rollback execution is not tested.
