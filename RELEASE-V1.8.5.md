# V1.8.5 — Individual Vehicle check access

Previous version: V1.8.4. New version: V1.8.5.

Fleet → User access lets authorised managers enable Vehicle check for individual active users. Both Fleet management and User management permissions are required to change access. Administrators always retain access. Other users are disabled until explicitly enabled here, regardless of grade defaults.

Enabled users see Vehicle check in dashboard quick actions. The same account permission is resolved on each authenticated request and tablet PIN login, so hiding the shortcut is not the security boundary. This grant does not provide Fleet management permissions. Changes are audited and stored separately from grade permissions, so changing a grade does not overwrite them.

No database migration is needed; access settings use existing application settings storage.

Validation: 554 tests passed, including eight new per-user permission and endpoint checks; 18 database integration tests were skipped. Production build passed. Targeted lint passed with one existing image warning in Fleet.
