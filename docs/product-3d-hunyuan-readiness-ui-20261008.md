# Tencent query-only readiness UI

Purpose: let the signed-in administrator check the already deployed
`product-3d-hunyuan-readiness` endpoint without exposing credentials or starting
generation. Product 2639 / `aftermarket_new` only, in internal sales/production
3D panes. Customer/staff/other-product/other-kind panes do not show the button.

The client uses its existing Supabase client/session. It does not retrieve,
copy, set, or accept a Tencent key or a user token. Server authorization remains
fresh Auth `getUser` followed by the existing DB system_admin/GLB preflight;
browser role checks are presentation only. No server, DB, grants, or secrets
changes are part of this frontend release.

Only an explicit click sends this fixed payload:

```json
{"action":"check_connection","consent":"query-only-no-product-data"}
```

The existing server queries one fixed fictitious JobId, with an 8-second bound,
no retry, and no photo/product input or Submit call. A response is NOT proof of
authentication, generation permission, Model 3.1 availability, credit balance,
price, or quality. Both authentication_verified and generation_enabled must be
strictly false. Unknown/malformed replies fail closed. Error bodies and exception
messages are not read or shown. HTTP401/403 have fixed safe guidance.

One in-flight client lock prevents double-click/cross-pane duplication. The
result is discarded after session, role, target, kind, pane or DOM changes.
Opening the pane does not invoke the Tencent endpoint. No automatic polling,
retry, generation, publication, or fallback is implemented.

Verification: 8 new behavioral tests plus existing Tripo/Viewer/session tests;
187 product3D tests and all 128 Node commands from the authoritative release
workflow passed. Japanese/English/Chinese dictionaries passed the existing
language guard. Synthetic hidden IAB QA at 1280x900 and 390x844 checked response,
loading/disabled, missing keys, denied auth/permissions, expired session, network
failure, timeout, stale response, unauthorized/other-target absence, keyboard
Tab/Enter and mobile wrapping (zero horizontal overflow). No actual credentials,
authenticated session, Tencent call or generation was used in synthetic QA.

The initial test assertion incorrectly matched the safe phrase "connection
success is unverified"; its correction tests claims, not that mere word. Release
checks then caught two incomplete cache-version updates. Failure logs are retained
in the task artifact; all linked versions were synchronized without relaxing
any predicates, and the complete workflow was rerun successfully.

Release assets are v1.1.1135. Actual live readiness remains pending a personal
administrator click after deployment. Further photo submission or generation
requires separate precise input/terms/cost authorization. Rollback preparation:
remove the new UI in a reviewed forward release; preserve credentials, existing
Tripo/GLBs/photos and all product data. Do not automatically revert production.
