# Sales phase 1: default-off database implementation

Database implementation: [dcats-security PR #267](https://github.com/dkd-gl-parts/dcats-security/pull/267).
This frontend branch keeps the existing five-argument `confirm_sales_order_dispatch` RPC contract. No production migration, deployment, or feature activation is included.

## Scope

Full shipments only. When enabled in the synthetic test database, shipment, reservations, warranty snapshots, sales header/items and audit commit together. Partial dispatch is rejected. OFF or an absent flag retains the legacy shipment behavior; a configuration read failure is an error.

Customer identity uses trimmed `cTkskCd` / `source_customer_code`, preserving leading zeros. Customer tax timing and half-up rounding are frozen on each slip. Closing-time tax, net amount and final total remain NULL until a future closing workflow. Source price rounding is not a tax rule.

Shipping and core are taxable product detail rows. Core already included in the order unit price is separated without double addition. Product tax method 6 follows its product rule. Saved D-CATS total cost is frozen with provenance; missing or ambiguous cost remains unknown/NULL and does not block posting.

Full reversal appends a negative copy with original snapshots and an audit record. It does not return physical stock. Sale and reversal evidence cannot be edited, deleted or truncated through the application.

## Existing RPC connection

`confirm_sales_order_dispatch(target_dispatch_id, target_shipped_on, target_warranty_months, target_note, target_expected_version)` remains the dispatch entry. The database additionally returns `sales_posting` status, slip ID and tax state on the ON path. Existing B2 import/final serial entry points converge on the same transaction.

`get_sales_posting_outcome(p_dispatch, p_key)` retrieves the committed result after an uncertain reply. An unknown outcome returns `retry_allowed: false`; it does not authorize automatic resubmission.

`reverse_sales_slip(p_slip, p_payload, p_key)` accepts only a full reversal with a reason. Posting roles are system admin, company admin and manufacturing department admin within the allowed company; reversal is system/company admin only. Server checks enforce this independently of UI visibility.

## Test environment and preserved work

The 2026-11-10 instruction switches further testing to the existing PR #263 Windows/PostgreSQL 17 CI. The supplied schema-baseline-20261110 files are included unchanged in the private PR; its 40-apply-baseline.sh runs before the phase 1 migration. Required initial counts are 542 tables, 11 views, 752 functions and 694 policies. Baseline failure stops the run and records the first error and source line.

The earlier Supabase branch was created at 2026-11-10 12:25:21 JST and deleted at 13:04:55 JST. Its 62 recorded executions (54 passed, 8 failed before corrections or due to harness input/constraint mode) are retained separately from CI results. No business data was copied to the branch.

018 and later work remains frozen. Production, Hanbaiou databases and prior history are unchanged. Feature defaults remain OFF. The SQL rollback disables the feature and restores the three prior entry functions while keeping all sales, item and audit rows.

CI result details are recorded in the private PR. This PR is documentation of the existing frontend connection, not a claim of new screen verification or release.
