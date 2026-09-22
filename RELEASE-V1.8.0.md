# STARS Connect V1.8.0 — Staff Area

Version: V1.7.1 → V1.8.0 (feature release).

## Staff entry and shared records

Open `/staff/` (or `/staff`, which normalises to the scoped entry). STARS Staff has its own manifest, identity, start URL, icons and `/staff/` scope. It remains part of STARS Connect and uses the existing staff, training, working patterns, approved absences, operational assignments and permissions. The management app remains separate in presentation, not data.

Mobile navigation provides Home, Schedule, Requests and Profile. Training and policy resources are available from quick actions. Staff can review their own shifts and assignments, respond to training invitations, download calendar entries, request leave, report sickness, submit self-certification and supporting files, raise named/confidential concerns, edit permitted contact information and request approval for employment-detail changes. Training completion writes to the existing master training records.

Managers use People → Staff tasks and Staff access. Tasks support review, messages, assignment, due dates, approval, rejection, further information, cancellation and history. Staff events support selected/all/no staff, weekly recurrence and safe staff-facing notes. Approved leave and sickness use existing calendar absence records; partial-day leave adjusts projected working intervals.

## Deployment

1. Back up the database and deploy with Node 20 or later, HTTPS, and APP_URL set to the public application origin.
2. Run `npx prisma migrate deploy` and `npx prisma generate` before serving the release. New migrations are `20260922020000_staff_area` and `20260922021000_staff_training_evidence`. They add tables/fields; they do not replace staff or billing records.
3. Configure persistent private storage using STAFF_DOCUMENT_STORAGE_PATH, outside public web assets, shared between application instances. Back it up with the database. The default `.data/staff-private` is suitable only where the application filesystem is persistent.
4. Set STAFF_DOCUMENT_RETENTION_DAYS to the organisation's approved retention period (default 365 days). `node scripts/purge-expired-staff-documents.mjs` previews expired documents; `--apply` deletes expired private files and their metadata with an audit event. Schedule this through the deployment's maintenance mechanism after reviewing retention requirements.
5. Review access-level permissions. Staff must have Staff Portal access. Managers need the relevant staff task, leave, sickness, profile, scheduling and access-management capabilities. Private case files additionally require the HR document capability.
6. Explicitly grant the confidential-concern review capability only to designated reviewers. Administrators do not receive it automatically. Named/involved reviewers are excluded from a case. Do not give everyone the same broad access override.
7. Link each existing staff member to their existing user account, then create an activation link from Staff access. Deliver the one-time link securely. There is no automatic invitation email sender in this release.

## Access and privacy

Activation links expire after 24 hours, are stored hashed and consumed once. Activation establishes a separate 8–12 digit Staff PIN; clocking PINs are unchanged. Login has IP throttling and account lockout. Staff sessions use HttpOnly cookies, a 15-minute idle timeout and an eight-hour maximum lifetime, and are independent of management sessions. Signing into either experience clears the other session.

Staff can register a device passkey after signing in. WebAuthn requires user verification and validates origin, challenge and signature. Actual biometric behaviour depends on the device. Staff access supports reset, disable, unlock, sign-out and passkey removal, with mandatory reasons and audit history. Full reset revokes sessions and optionally passkeys without deleting HR records.

Concern details and supporting documents require ownership or appropriate case-review permissions; confidential concerns do not expose their details in ordinary calendar entries. Anonymous submission is deliberately not offered. A named/confidential concern remains linked to its submitter for authorised case handling.

Files are authenticated downloads with no-store headers and no public URLs. PDF/PNG/JPEG uploads are limited to 10 MB with signature checks. Training certificates are available to their owner in the Staff Area and to appropriately authorised managers from the training records.

The service worker caches only the public offline screen, logo and icons. It does not cache staff responses, requests, documents or authenticated HTML. Offline use displays a reconnect screen rather than private HR data. The installation QR contains only the public staff entry URL, never a login token. Native installation and iOS Add to Home Screen guidance are provided; push notifications are not enabled.

## Verification

- TypeScript checks pass; ESLint has no errors (17 existing warnings).
- All 555 automated tests passed, including database integration tests. Tests cover PIN validation, dates, self-certification, permissions, case conflicts, partial-day scheduling and manifest/cache boundaries.
- The local HTTP verification script exercises activation replay, staff isolation, CSRF, leave idempotency/approval/cancellation, sickness declarations, profile approval, master training writes, private files, lockout/unlock and full resets.
- WebAuthn tests generate a real EC credential and signed assertion, checking authentication, replay rejection and reset revocation.
- Browser checks at mobile and tablet widths verify the Staff entry, scoped manifest, bottom navigation and personal schedule without horizontal overflow.
- `scripts/verify-staff-area.mjs` is restricted to the disposable local validation database and is not a production smoke-test script.

Physical iPhone/Android home-screen installation, Face ID/Touch ID prompts and production multi-instance storage need deployment/device acceptance checks. The release does not imply that a production deployment or a physical-device test has already occurred.
