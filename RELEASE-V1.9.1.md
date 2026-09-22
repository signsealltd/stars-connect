# V1.9.1 — Vehicle checks in STARS Staff

Previous version: V1.9.0. New version: V1.9.1.

The Staff Area home page includes Vehicle check for accounts enabled under Fleet → User access. The check and submitted-record screens stay within the /staff/ PWA scope and use the existing Staff Area session. No second password or tablet provisioning is needed.

Staff-specific API routes reuse the existing vehicle, evidence, submission and PDF handlers. They authenticate only the staff session, enforce individual Vehicle check permission, and restrict records and evidence to the current staff account. A management cookie in the same browser cannot change the acting user or grant fleet-wide access through these routes.

Photo uploads, saved-draft syncing and submitted records use the Staff Area endpoints. Existing management and kiosk routes remain supported. An empty fleet displays a clear no-vehicles message. The Staff app retains its existing service worker and never loads the management cached identity as a fallback.

Validation: 567 tests passed (18 database integration tests skipped), including Staff Area identity isolation, disabled/expired access, and staff-endpoint upload routing. No migration is needed.
Production build, including TypeScript checks, passed. Targeted lint passed with existing image warnings.
