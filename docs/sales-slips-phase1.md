# Sales phase 1: default-off database implementation

This frontend connection keeps the existing five-argument `confirm_sales_order_dispatch` RPC contract. This document does not activate the sales feature.

## Scope

Full shipments only. When enabled, shipment, reservations, warranty snapshots, sales header/items and audit commit together. Partial dispatch is rejected. OFF or an absent flag retains the legacy shipment behavior; a configuration read failure is an error.

Customer identity uses trimmed `cTkskCd` / `source_customer_code`, preserving leading zeros. Customer tax timing and half-up rounding are frozen on each slip. Closing-time tax, net amount and final total remain NULL until a future closing workflow. Source price rounding is not a tax rule.

Shipping and core are taxable product detail rows. Core already included in the order unit price is separated without double addition. Product tax method 6 follows its product rule. Saved D-CATS total cost is frozen with provenance; missing or ambiguous cost remains unknown/NULL and does not block posting.

Full reversal appends a negative copy with original snapshots and an audit record. It does not return physical stock. Sale and reversal evidence cannot be edited, deleted or truncated through the application.

## Existing RPC connection

`confirm_sales_order_dispatch(target_dispatch_id, target_shipped_on, target_warranty_months, target_note, target_expected_version)` remains the dispatch entry. The database additionally returns `sales_posting` status, slip ID and tax state on the ON path. Existing B2 import/final serial entry points converge on the same transaction.

`get_sales_posting_outcome(p_dispatch, p_key)` retrieves the committed result after an uncertain reply. An unknown outcome returns `retry_allowed: false`; it does not authorize automatic resubmission.

`reverse_sales_slip(p_slip, p_payload, p_key)` accepts only a full reversal with a reason. Posting requires an active internal user with both sales-order management and finished-product shipment permissions, within the company scope enforced by the server. A role label alone does not grant posting permission. Reversal is system/company admin only. Server checks enforce this independently of UI visibility.

## Release status

The reviewed database changes were applied on 2026-11-10 with both feature gates OFF. Sales posting remains disabled. This documentation change does not activate it or change business data. The first subsequent real shipment must be checked to confirm legacy dispatch succeeds and no sales slip is created.
