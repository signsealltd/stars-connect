# V1.10.0 — Direct vehicle-check links for drivers

Previous version: V1.9.1. New version: V1.10.0.

Fleet → Driver links lets authorised managers enter a driver's name and generate a personal link and QR code in a modal. The link opens a dedicated vehicle-check page without a PIN, password, Staff Area login or management account setup. No link is issued to a real driver automatically by this release.

Driver access uses a high-entropy secret link, stored only as a hash. Opening the link establishes a restricted HTTP-only cookie and redirects to a clean page URL. Each check, upload, record and PDF request revalidates the link. Drivers can view their own check history only; there are no staff, calendar or management navigation links. Existing Fleet check storage, photo validation and immutable submissions are reused.

Managers can disable links or replace them. Replacing a link revokes previous links for the driver while keeping the same report identity and history. Link creation, replacement and revocation are audited. The report identity cannot log in to the application and is not a Staff Area account.

Validation: 572 tests passed in the full suite (18 database integration tests skipped), followed by 15 focused driver/Staff Area permission tests, including five additional driver-management tests. New-source lint passed. No database migration is required.
Production build, including TypeScript validation, passed.
