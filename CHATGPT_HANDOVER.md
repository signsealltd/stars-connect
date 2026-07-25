# STARS Connect — ChatGPT Project Handover

Last updated: 25 July 2026  
Local workspace: `J:\Documents\Pulse`  
GitHub: https://github.com/signsealltd/stars-connect  
Production domain: `starsconnect.co.uk`  
Suggested application hostname: `app.starsconnect.co.uk`

## Instructions for the next ChatGPT session

You are continuing development of **STARS Connect**, formerly called **Pulse**. Inspect the repository before changing it and treat this document as orientation, not as a substitute for verifying the current code.

Do not claim that the system is ready for real staff or student data yet. The safety-critical offline foundation exists, but several V1 management and production features remain unfinished.

Never request or commit:

- VPS passwords
- SSH private keys
- MariaDB production passwords
- SMTP passwords
- session or cron secrets
- real staff PINs
- real staff or student data

Use environment variables and keep `.env` out of Git.

## Product overview

STARS Connect is a tablet-first progressive web application for STARS Day Service. It is intended to support:

- Staff PIN clock-in and clock-out
- Daily student attendance
- A live “who is on site?” register
- An offline emergency fire register
- Staff timesheets and attendance reports
- Two or more independently authorised Android tablets
- Offline event creation and later server synchronisation
- Optional attendance confirmation photographs
- End-of-day attendance summary emails
- Manager and administrator oversight with audit history

Student invoicing, payroll integrations, facial recognition, biometric identity verification, door access, visitor management, rotas, holiday requests, and direct tablet-to-tablet networking are outside V1.

## Product identity

The application was initially generated under the name **Pulse**. The user subsequently registered:

- Product/domain name: **STARS Connect**
- Domain: `www.starsconnect.co.uk`
- GitHub repository: `signsealltd/stars-connect`

Visible branding, metadata, package naming and documentation now use **STARS Connect**. The legacy `pulse-tablet` IndexedDB name and `pulse-*` browser keys are intentionally preserved so deployed alpha tablets retain offline data.

Recommended naming:

- Product: **STARS Connect**
- Subtitle: **Attendance and Register Management**
- Public canonical domain: `https://starsconnect.co.uk`
- Test/application hostname: `https://app.starsconnect.co.uk`
- Redirect `www.starsconnect.co.uk` to the chosen canonical address

Be careful when renaming internal identifiers. IndexedDB database names and local-storage keys affect existing offline data. Before production this is safe to change, but after tablet use begins it requires a migration.

## Repository state

The initial project was committed and pushed:

- Branch: `main`
- Initial commit: `6129ccb`
- Commit message: `Initial STARS Connect application`
- Remote: `https://github.com/signsealltd/stars-connect.git`
- Repository visibility at handover: **public**

The user explicitly chose to push while public. No `.env` file or production secret was committed. The repository should ideally be made private before real operational configuration or data is introduced.

Before doing work:

```powershell
cd J:\Documents\Pulse
git status -sb
git remote -v
git pull --ff-only
```

Preserve unrelated user changes. Do not reset or overwrite a dirty working tree.

## Technology

- Next.js 15 with App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Prisma 6
- MariaDB/MySQL
- IndexedDB via `idb`
- Custom service worker
- bcrypt password/PIN hashing
- Opaque session tokens stored as hashes server-side
- Zod validation
- Vitest
- Nodemailer dependency included, but email delivery is not implemented
- `date-fns` and `date-fns-tz` dependencies included

Target deployment:

- Linux VPS
- Node.js 20+
- MariaDB
- Nginx or Caddy
- HTTPS
- systemd or another production process manager

## Important files

- `README.md` — installation, production, offline testing, security, and acceptance notes
- `.env.example` — placeholder environment variables
- `prisma/schema.prisma` — complete initial relational model
- `prisma/seed.ts` — fake development users, staff, students, devices, attendance, and roll call
- `src/app/page.tsx` — tablet kiosk home
- `src/app/clock/page.tsx` — staff PIN keypad and local-first clock event workflow
- `src/app/register/page.tsx` — touch-first student register
- `src/app/live/page.tsx` — locally derived on-site register
- `src/app/emergency/page.tsx` — persistent offline emergency roll call
- `src/app/dashboard/page.tsx` — initial management dashboard
- `src/app/api/sync/route.ts` — authenticated idempotent push/pull sync
- `src/lib/local-db.ts` — IndexedDB stores and sync queue
- `src/lib/security.ts` — session and role utilities
- `src/lib/domain.ts` — clock/timesheet/permission domain helpers
- `public/sw.js` — application shell service worker
- `public/manifest.webmanifest` — PWA metadata

## Implemented and verified

### Project foundation

- Next.js App Router project
- Responsive tablet-first visual system
- PWA manifest, SVG icon, and service-worker registration
- Offline fallback route
- UK-style date/time presentation in major UI flows
- Environment-variable example with placeholders
- Prisma/MariaDB schema
- Fake seed data
- Installation and deployment documentation

### Authentication and security foundation

- Manager login endpoint
- bcrypt password checking
- Opaque random session token
- SHA-256 session-token hash stored server-side
- HTTP-only session cookie
- Secure cookie in production
- SameSite `lax`
- Role hierarchy: Reception, Manager, Administrator
- In-memory rate limiting for login and PIN verification
- PIN lookup hash plus bcrypt verification
- Audit helper and selected authentication/clock/sync audit events
- Security response headers in Next configuration
- Revocable device model and hashed device tokens

The in-memory rate limiter is suitable only as a basic single-process safeguard. Production should use a shared store such as Redis or a database-backed limiter if multiple Node processes are used.

### Kiosk and offline workflows

- Tablet home screen
- Current date/time
- Online/offline indication
- Device name
- Queued-change count
- Last sync presentation
- Large Clock, Student Register, Emergency Register, and Manager Login actions
- Emergency route available without manager login
- PIN keypad
- Generic invalid-PIN response
- Local-first clock event creation with a UUID
- Local staff clock state
- Student register with touch-friendly statuses
- Attendance saved locally on each change
- Live local register
- Emergency roll call created from the latest local staff/student state
- Accounted/missing filtering
- Roll-call progress persisted in IndexedDB across refresh

### Synchronisation foundation

- Per-device ID/token authentication
- Local pending-event queue
- UUID-based idempotency
- Monotonic server cursor using `BigInt`
- Push and pull response structure
- Server acknowledgements
- Retry triggers on app open/focus/online events
- Duplicate clock-event detection window
- Student attendance version comparison
- Conflict-record creation
- Device and server timestamps in the data model

The client currently focuses on uploading and acknowledging queued events. Carefully verify whether pulled server events are fully applied back into IndexedDB before calling cross-tablet synchronisation complete.

### Management foundation

- Initial dashboard API and page
- Recent clock events
- Basic site totals
- Local live register
- Basic server-rendered timesheet calculation
- Reports and settings navigation/pages

The report export buttons and settings save buttons are not operational.

### Verification completed before the initial push

- Prisma Client generation passed
- Production Next.js build passed
- Six Vitest domain tests passed
- ESLint passed with one non-blocking warning concerning the PostCSS configuration export style

Commands:

```powershell
npm test
npm run lint
npm run build
```

## Database model

The Prisma schema includes:

- `User`
- `Session`
- `StaffMember`
- `StaffCredential`
- `Student`
- `Device`
- `ClockEvent`
- `ClockCorrection`
- `AttendancePhoto`
- `StudentAttendance`
- `EmergencyRollCall`
- `EmergencyRollCallEntry`
- `SyncEvent`
- `SyncConflict`
- `DailySummaryEmail`
- `AuditLog`
- `AppSetting`

Clock events and attendance records use UUID-style string IDs. Original clock events are intended to remain immutable. Corrections should be represented by `ClockCorrection`, including manager, reason, original value, replacement value, and timestamp.

## Development seed data

The seed script creates clearly fake:

- One administrator
- One manager
- One reception user
- Ten staff
- Twenty students
- Reception Tablet
- Activity Room Tablet
- Sample clock events
- Sample student attendance
- One sample emergency roll call
- Default settings

Development-only seeded login password:

```text
ChangeMe!123
```

Development user emails:

```text
admin@starsconnect.test
manager@starsconnect.test
reception@starsconnect.test
```

Development staff PIN range:

```text
4101–4110
```

These are public development credentials because they are documented and committed. Never use them in production. Either alter the seed behavior for production or do not run development seeding on the live database.

The seed creates devices and staff with unique fields and is not guaranteed to be safely repeatable after a partial run. Make it fully idempotent before relying on repeated development seeding.

## Environment variables

The committed `.env.example` currently defines placeholders for:

```text
DATABASE_URL
SESSION_SECRET
APP_URL
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
CRON_SECRET
```

Recommended production URL:

```env
APP_URL="https://app.starsconnect.co.uk"
```

Generate independent random values for `SESSION_SECRET` and `CRON_SECRET`. Do not copy example strings into production.

## Local MariaDB history

The user installed MariaDB 12.3 on Windows through Winget. Start Menu shortcuts appeared, including:

- Command Prompt (MariaDB 12.3 x64)
- Database directory
- Error log
- HeidiSQL
- `my.ini`
- MySQL Client

However, `mariadb -u root` returned:

```text
ERROR 2002 (HY000): Can't connect to server on 'localhost' (10061)
```

No MariaDB service was found using the initial PowerShell service search. Local database setup was paused. The user later decided that VPS deployment would be easier for tablet testing.

If local setup resumes, first determine whether the server service is registered:

```cmd
where mariadbd
sc query state= all | findstr /I "maria mysql"
```

Do not assume a root password was configured; the user reported that they were never asked to set one.

## VPS and domain deployment plan

The VPS has not yet been configured in this chat. No VPS specifications, Linux distribution, SSH host, or public IP have been provided.

Recommended sequence:

1. Inspect and harden the current code.
2. Verify the completed STARS Connect branding pass on the deployed alpha.
3. Finish missing V1 functions or clearly deploy as private alpha.
4. Create DNS `A`/`AAAA` records for the chosen hostname.
5. Install Node.js 20+, MariaDB, Git, and Nginx/Caddy on the VPS.
6. Create a least-privilege Linux service account.
7. Create a dedicated MariaDB database and restricted database account.
8. Clone the GitHub repository.
9. Create the production `.env` directly on the VPS.
10. Run `npm ci`.
11. Run `npx prisma migrate deploy`.
12. Do not run the public development seed on a real production database.
13. Run `npm run build`.
14. Configure systemd.
15. Configure reverse proxy and HTTPS.
16. Set the canonical hostname redirect.
17. Configure firewall rules.
18. Test authentication, sync, offline behavior, emergency roll calls, and PWA installation.
19. Configure encrypted, off-host database backups and test a restoration.

Use fake data only during the initial VPS test deployment.

## Major unfinished V1 work

The following are not production-complete:

### Product rename

- Replace visible `Pulse` branding with `STARS Connect`
- Update metadata, manifest, README, package name, email templates, and PWA title
- Decide whether to migrate internal `pulse-*` storage identifiers
- Update seed email domains if appropriate

### Staff and student administration

- Staff list/create/edit/archive screens
- Student list/create/edit/archive screens
- PIN reset workflow
- Duplicate active PIN management
- Restricted notes
- Validation and complete audit entries
- Profile photograph upload

### Device administration

- Secure device registration/provisioning UI
- One-time token display
- Token rotation
- Device revocation
- Last-seen and pending counts
- Tablet setup flow

### Clocking completeness

- Server-side clock-event creation endpoint separate from verification
- Strong duplicate-event policy and manager review flow
- Offline PIN verification architecture
- Missing-clock-out detection
- Manual clock-event corrections
- Configurable duplicate window
- Stronger failed-attempt persistence and audit handling

Important: PIN verification currently calls the server. Truly offline staff clocking requires a safe local verification design. Do not download raw PINs or reversible credentials to tablets.

### Camera confirmation

- Front-camera permission and preview
- Image capture and compression
- Optional/required mode handling
- Secure upload validation and storage
- Photo unavailable/review path
- Authenticated manager viewing
- Audit every photo view
- 30-day default retention deletion job

Camera failure must never prevent the attendance event.

### Student register completeness

- Manual arrival/departure editing UI
- Notes UI and role restrictions
- Expected-today calculation using Europe/London
- Server-side attendance API with role checks
- Conflict-review UI
- Apply pulled tablet changes locally

### Emergency register completeness

- Server persistence of roll-call creation and entries
- Safe pull/merge between tablets
- Manager close/archive workflow
- Full audit coverage
- Staleness thresholds and clearer warnings

### Timesheets and corrections

- Date navigation and weekly view
- Break support if enabled later
- Warnings
- Manual correction workflow
- Immutable original event plus adjustments
- Correction reasons and manager identity

### Reports

- Daily staff report
- Weekly staff report
- Student attendance report
- Daily site report
- Date-range filters
- Permission-protected CSV generation
- Export audit events

Current report buttons are visual placeholders.

### End-of-day email

- SMTP transport
- Europe/London scheduled job
- Configurable recipients/time
- Summary construction
- Missing-clock-out and review sections
- Email status, error, and retry persistence
- Test email
- Administrator resend
- Cron authentication

Photographs must never be attached or embedded.

### Settings and audit UI

- Persisted settings API
- Administrator-only setting changes
- Settings validation
- Full audit-log viewer/filtering
- Retention jobs
- Conflict-review workflow

Current settings controls are visual placeholders.

### Security hardening

- CSRF strategy for authenticated mutations
- Shared/distributed rate limiting
- Session rotation and logout
- Session cleanup
- Content Security Policy
- Secure upload scanning and storage isolation
- Reverse-proxy IP handling
- Production secret rotation procedures
- Complete server-side permission checks on every API
- Security review before real data

## Known architectural risks

1. **Offline PIN verification is not solved.** The current PIN verification API needs the server. The app can save accepted events locally, but staff cannot be newly verified while fully offline.
2. **Sync pull application needs verification/completion.** The server returns events after a cursor, but the client may not merge all returned events into IndexedDB.
3. **Some management pages are placeholders.** Reports/settings display controls that do not persist or export.
4. **Role enforcement is incomplete.** Navigation visibility and every server endpoint must be reviewed systematically.
5. **The repository is public.** Do not introduce secrets, real data, deployment inventory, or sensitive operational documentation.
6. **Development credentials are public.** Never use the seed identities/passwords/PINs in production.
7. **Service-worker strategy is basic.** Review cache versioning, update behavior, route caching, and safe treatment of authenticated/API data.
8. **Date handling needs a Europe/London audit.** Some code uses `toISOString().slice(0,10)`, which can give the wrong local date near midnight or DST boundaries.
9. **In-memory rate limits reset on restart and do not coordinate across processes.**
10. **No migration files were committed.** The Prisma schema exists, but a MariaDB-backed migration should be generated, reviewed, and committed before deployment.

## Recommended immediate next actions

Perform these in order:

1. Pull and inspect the repository; run tests and the build.
2. Rename visible product branding to STARS Connect.
3. Add a proper Europe/London date utility and replace UTC date slicing.
4. Generate and review the initial Prisma migration against a disposable MariaDB database.
5. Implement safe device provisioning.
6. Complete server-created clock events and sync pull application.
7. Decide and document the offline PIN-verification security model.
8. Implement staff/student CRUD and PIN reset.
9. Complete emergency server persistence and archive workflow.
10. Implement corrections, reports, email, photographs, retention, and audit UI.
11. Add integration and browser/PWA tests.
12. Deploy a private alpha with fake data.
13. Conduct security, safeguarding, retention, and disaster-recovery review.
14. Only then consider real staff/student data.

## Acceptance focus for the private alpha

- Valid PIN alternates clock-in and clock-out
- Invalid PIN response is generic and rate limited
- Duplicate scans are not silently lost
- Register changes survive refresh
- Offline queue survives browser restart
- Reconnecting uploads each UUID once
- Tablet A changes appear on Tablet B after sync
- Conflicts create manager-reviewable records
- Emergency mode launches without manager login
- Emergency progress survives refresh and screen lock
- Stale attendance is clearly identified
- Reception cannot access payroll/settings/photos/audit
- Manager corrections preserve original events
- PWA installs over HTTPS on both Android tablets
- Camera denial never blocks clocking
- Email summaries contain no photographs
- Database restore procedure is tested

## Useful commands

```powershell
# Install dependencies
npm ci

# Generate Prisma Client
npx prisma generate

# Development migration, only against a development database
npx prisma migrate dev --name initial

# Development seed, never use unchanged for production
npm run db:seed

# Local development
npm run dev

# Checks
npm test
npm run lint
npm run build

# Repository state
git status -sb
git log --oneline -5
git remote -v
```

## Definition of production-ready

Do not describe STARS Connect as production-ready until:

- All V1 workflows listed above are implemented
- All authenticated mutations have server-side authorisation
- Offline PIN and sync behavior have been security-reviewed
- Initial migrations are committed and tested
- Retention jobs are implemented and verified
- Backup restoration is tested
- Tablet acceptance testing passes
- HTTPS and secure headers are verified
- Real deployment secrets are stored outside Git
- The organisation approves the privacy, safeguarding, photo-retention, and emergency-register procedures
- A manager can resolve conflicts and correct records without altering original events

