# Customer management workspace

Opening a customer previously placed a full account invitation form above the display, price and delivery settings. The page now keeps a searchable customer directory beside a named customer workspace, with Overview, Products & pricing, Delivery and Login tabs.

The save action stays visible while settings scroll. Inputs remain mounted across tabs so edits to price class, categories, billing and delivery are collected together. Overview cards reflect the current draft. Registered login accounts appear before a collapsed invitation form. Mobile switches between the directory and workspace.

Search filters the loaded directory without resetting the selected customer's draft. A selected row stays selected, and refreshing or changing customers preserves the existing discard confirmation. A cancelled visibility-filter refresh restores the previous filter. Late detail responses cannot replace a newer customer's settings. Failed or expired settings loads display retry guidance and keep saving disabled.

Existing save APIs, authorization checks, category defaults, order publication rules, invitation actions and customer registration remain in place. No database migration or business-data update accompanies this release.

Validation: the workflow's 150 local commands pass, including a new workspace verifier for keyboard tabs, permissions, draft retention, customer filtering, canonical rank values, stale responses and failed reads. Hidden browser QA covers desktop/mobile, three languages, 12 visual cases, loading/empty/error/retry/expired/limited-role states, account listing, registration entry and a synthetic multi-tab save. Production is checked read-only after publication.
