# V1.8.4 — Staff saving and Administrator access

Previous version: V1.8.3. New version: V1.8.4.

- Administrator always has every capability. Its level remains enabled and its permission controls are read-only; restrictive legacy overrides cannot reduce administrator access.
- Administrators can save their own level without losing their current management session.
- Staff creation performs password hashing before its database transaction, and grade setup avoids repeated writes. Staff save transactions allow additional time for linked-account updates.
- Editing or resetting a PIN no longer collides with a revoked credential's unique lookup value. Active PINs still cannot be shared.
- Disabled grades and duplicate staff details return useful messages instead of a generic request failure.

Validation: disposable-database HTTP checks cover fresh staff creation, full profile edits, same-PIN resaving, grade changes, own-level saving, Administrator permissions, duplicate details and transaction rollback. No production records were modified during verification. No database migration is required.

Checks: 564 tests passed; targeted permission regression checks passed; lint completed with no errors (17 existing warnings).
Production build, including TypeScript validation, passed.
