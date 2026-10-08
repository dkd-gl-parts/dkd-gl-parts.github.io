# Tencent query-only readiness UI

## Safe diagnostic extension — v1.1.1140 (local candidate, not released)

On October 8 at17:15JST, additional human screenshot requests were stopped.
Code tests remain distinct from pending desktop/mobile/keyboard visual gates.
Concurrent upstream PR259/260/261 (main d15545a, v1.1.1139) were preserved by a
normal candidate-branch merge. All 13 conflicting files/28 chunks were confirmed
to differ only in version1137 versus1139; cache/runtime/guard versions were
synchronized to local candidate1140. This is not a production release. Earlier
1137 synthetic screenshots remain scoped historical evidence, not1140 acceptance.

The approved admin-only query control can append an exact allowlisted public
error code and a validated 36-character UUID RequestId using textContent only.
The client mirrors the server's 47 documented code enums. Unknown extra fields,
arbitrary text, URLs, malformed IDs and raw messages are omitted. Known status
text remains compatible with older endpoint replies. Diagnostics are shown only
for the three provider-error outcomes, after all existing stale-session/role/
target/pane/DOM checks; they never imply authentication or generation success.
Japanese, English and Chinese labels are provided. The status wraps on mobile.

Automatic tests: 11 focused Hunyuan behavioral tests, 190 product3D tests and all
128 authoritative workflow commands pass, as do static build/security-header
checks. Client/server allowlist parity is 47/47. The first focused assertion
matched SecretId inside an official enum; it now still forbids key identifiers
while permitting the documented error enum, without relaxing network/auth rules.

Hidden synthetic browser QA was blocked by a denied localhost browser permission.
No ordinary browser, credential/session copy or indirect browser workaround was
used. Desktop/mobile visual and keyboard QA and publication remain pending.
On October 8 at14:21JST, the human's screenshot confirmed the exact local
origin's Browse permission was saved as Always allow. A same-origin hidden
attempt still returned a saved-policy denial before producing a tab or UI.
The effective blocking source is unknown; no permission bypass was attempted.
Source CI can run on draft PRs, independently of the blocked visual QA. The
draft must not merge or deploy until the required QA actually passes. Concurrent
upstream PR257 was preserved by a normal merge; cache versions were advanced to
v1.1.1137 rather than reuse its v1.1.1136. This diagnostic candidate is not live.
The prior verified release below is retained as historical evidence, not proof
that this new diagnostic UI has passed visual QA or been deployed.

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
