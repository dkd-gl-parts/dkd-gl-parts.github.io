# Sales phase 1: default-off database implementation

This frontend branch keeps the existing five-argument `confirm_sales_order_dispatch` RPC contract. No production migration, deployment, or feature activation is included.

## Scope

Full shipments only. When enabled, shipment, reservations, warranty snapshots, sales header/items and audit commit together. Partial dispatch is rejected. OFF or an absent flag retains the legacy shipment behavior; a configuration read failure is an error.

Customer identity uses trimmed `cTkskCd` / `source_customer_code`, preserving leading zeros. Customer tax timing and half-up rounding are frozen on each slip. Closing-time tax, net amount and final total remain NULL until a future closing workflow. Source price rounding is not a tax rule.

Shipping and core are taxable product detail rows. Core already included in the order unit price is separated without double addition. Product tax method 6 follows its product rule. Saved D-CATS total cost is frozen with provenance; missing or ambiguous cost remains unknown/NULL and does not block posting.

Full reversal appends a negative copy with original snapshots and an audit record. It does not return physical stock. Sale and reversal evidence cannot be edited, deleted or truncated through the application.

## Existing RPC connection

`confirm_sales_order_dispatch(target_dispatch_id, target_shipped_on, target_warranty_months, target_note, target_expected_version)` remains the dispatch entry. The database additionally returns `sales_posting` status, slip ID and tax state on the ON path. Existing B2 import/final serial entry points converge on the same transaction.

`get_sales_posting_outcome(p_dispatch, p_key)` retrieves the committed result after an uncertain reply. An unknown outcome returns `retry_allowed: false`; it does not authorize automatic resubmission.

`reverse_sales_slip(p_slip, p_payload, p_key)` accepts only a full reversal with a reason. Posting roles are system admin, company admin and manufacturing department admin within the allowed company; reversal is system/company admin only. Server checks enforce this independently of UI visibility.

## Release status

Feature defaults remain OFF. No production changes, screen changes or release are included. This PR documents the existing frontend connection.
