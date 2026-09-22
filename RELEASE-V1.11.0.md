# STARS Connect V1.11.0

Previous version: V1.10.0. New version: V1.11.0.

Vehicle checks now follow the same daily workflow in management, STARS Staff and the private driver-link page:

- Reopening a vehicle resumes the signed-in person's latest check for the current Europe/London day.
- Submitted checks offer **Edit today’s check**. Saving creates a new version, retains original evidence and requires the declaration again. Record views link previous and next versions.
- The next UK day opens a fresh checklist. Earlier unfinished checks and photographs remain on the originating device under **Resume saved check**.
- Only the original submitting identity can amend its check, and only on its original UK day. Repeated uploads remain idempotent.
- Amendments do not clear reported defects or return an out-of-service vehicle to service. Managers retain the existing review/verification workflow.
- Normal check lists and CSV exports show latest versions; individual historic records and PDFs remain available.

## Deployment

Apply `npx prisma migrate deploy` before starting the new build. Migration `20260923010000_vehicle_check_revisions` adds revision links and numbers to VehicleCheck. Existing records remain version 1; no checks, photographs or other operational data are deleted. The migration was validated against the disposable local MariaDB database.

## Validation

Full Vitest suite including Fleet and Payments MariaDB integration tests passed (603 tests); an additional entry-point resumption test passed separately. TypeScript, ESLint and production build verified.
