# Core stock in manufacturing compatibility results

Manufacturing compatibility results displayed finished-product stock but omitted physical core stock. The existing stock cell now also shows core quantity from production_core_list_entries, summed per compatible product. No new stock classification or allocation workflow.

The read uses existing stock.view presentation permission and database RLS. A failed read displays a dash rather than a false zero. Delayed responses cannot overwrite a newer product selection. Other compatibility screens keep their existing behavior.

Validation: all 74 commands in search-performance-guard.yml passed, including stock receipt aggregation (10 + 13 = 23), unknown vs zero, denied access, and stale search regression checks. The actual renderer with the existing stylesheet was inspected in Chrome at desktop and 390 × 844 mobile widths; core 23 and other stock values remain visible without overflow. No stock mutations were made through the browser. Build and security response header checks passed.

Release: v1.1.897. Previous production commit fe32a76e39e312ab37832ad3d26ac39b43c2e514. A future frontend reversal requires a new versioned release; reverting the renderer does not remove stock or compatibility data. The separate private database import has its own guarded recovery procedure.
