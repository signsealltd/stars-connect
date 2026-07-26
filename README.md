# STARS Connect

**Attendance and Register Management for STARS Day Service**

STARS Connect is a tablet-first, offline-capable attendance and register PWA. The private alpha runs at [app.starsconnect.co.uk](https://app.starsconnect.co.uk); the public website is [starsconnect.co.uk](https://starsconnect.co.uk).

It uses Next.js App Router, React, TypeScript, Prisma, MariaDB, IndexedDB and a service worker.

> STARS Connect remains a private alpha. Use fake data only until safeguarding, privacy, security, backup, retention and tablet acceptance reviews are complete.

## Current capabilities

- Staff PIN clock-in/out with hashed credentials and generic failures
- Touch-first student register
- Local-first visitor sign-in/out with private visit references and touch signatures
- Immutable, versioned visitor site-rule acceptance
- Reception-assisted visitor sign-out and manager visitor history
- Administrator-managed visitor reasons, required fields and retention
- Live staff/student/visitor register
- Offline emergency roll call with separate Staff, Students and Visitors sections
- Persistent IndexedDB queue
- Authenticated idempotent cross-tablet push/pull sync
- Local application of pulled clock, attendance and roll-call changes
- Staff and student create/edit/archive/restore management
- One-time tablet provisioning, rotation and revocation
- Operational dashboard
- Staff, student, visitor and site reports with protected CSV exports
- Administrator settings and SMTP test summaries
- Authenticated daily-summary cron endpoint
- Audit records for privileged operations

Attendance photographs, full correction/conflict-resolution interfaces, production-grade distributed rate limiting and some retention automation remain incomplete.

## Architecture

Each tablet retains the established IndexedDB name and `pulse-*` browser keys for compatibility with already deployed alpha tablets. These are internal storage identifiers only; visible branding is STARS Connect.

Local changes are saved before network submission and assigned a UUID. The sync endpoint:

1. Authenticates the revocable tablet credential.
2. Accepts queued events idempotently by UUID.
3. Stores a monotonic server sequence.
4. Returns ordered events after the tablet cursor.
5. Lets the client apply each event locally.
6. Advances the local cursor only after successful application.
7. Records stale/malformed events as conflicts rather than silently discarding data.

The app retries on startup, focus and browser `online` events; it does not rely exclusively on Background Sync.

## Local setup

Requirements:

- Node.js 20+
- MariaDB 10.6+ or MySQL 8+
- npm

Copy `.env.example` to `.env` and replace every placeholder:

```env
DATABASE_URL="mysql://stars_connect_user:CHANGE_ME@127.0.0.1:3306/stars_connect"
SESSION_SECRET="generate-at-least-32-random-bytes"
APP_URL="http://localhost:3000"
SMTP_HOST="smtp.example.org"
SMTP_PORT="587"
SMTP_USERNAME="change-me"
SMTP_PASSWORD="change-me"
SMTP_FROM_NAME="STARS Connect"
SMTP_FROM_EMAIL="stars-connect@example.org"
APP_ENV="development"
REPORT_JOB_SECRET="generate-an-independent-random-secret"
CRON_SECRET="generate-an-independent-random-secret"
```

Create a development database and least-privilege account:

```sql
CREATE DATABASE stars_connect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'stars_connect_user'@'localhost' IDENTIFIED BY 'a-long-random-password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON stars_connect.* TO 'stars_connect_user'@'localhost';
FLUSH PRIVILEGES;
```

Install and start:

```bash
npm ci
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

## Fake development credentials

The seed is idempotent where practical and contains fake data only.

Users, all with password `ChangeMe!123`:

- `admin@starsconnect.test`
- `director@starsconnect.test`
- `manager@starsconnect.test`
- `reception@starsconnect.test`

Fake staff PINs: `4101`–`4110`.

These credentials are public development fixtures. Never use them in production and never run development seeding automatically on the live database.

## Device provisioning

1. Sign in as an administrator.
2. Open **Devices**.
3. Enter a friendly device name and select **Provision device**.
4. Copy the one-time setup code; it is never shown again.
5. On the tablet, open `/setup`.
6. Paste the code and authorise the tablet.

Setup codes are random, stored only as SHA-256 hashes, expire after 15 minutes and are atomically consumed once. Redeeming a code generates the long-lived tablet credential; that credential is shown only to the receiving tablet and stored in its browser. Rotating immediately invalidates the previous credential and creates a fresh one-time setup code. Revocation invalidates the credential and all outstanding setup codes, preventing sync and protected kiosk API access. Browser storage is not a hardware secure enclave, so use Android screen lock/pinning and physically controlled tablets.

The development seed retains two revoked `isSeedData` device records because fake attendance rows reference them. They are demonstration sources, cannot be rotated or activated through the admin page, and do not block provisioning a real tablet with any friendly name.

## Reports and permissions

Managers and administrators can view attendance reports and request server-generated UTF-8 CSV exports. Each export is audited. Reception accounts do not receive report, credential, device, settings, audit or restricted-note access.

Navigation visibility is not relied on as security; management APIs perform server-side role checks.


## Visitor management

The kiosk home links to `/visitors`. Visitors can sign in without seeing any other visitor identity. Sign-out requires the visitor's full name plus the private eight-character reference shown at sign-in; reception can assist from `/dashboard/visitors`.

Administrators configure visitor reasons, required fields, immutable site-rule versions and retention periods in **Settings**. Publishing rules creates a new version; it never edits historic acceptance text. Managers can open `/dashboard/visitors/[id]` to inspect the accepted version. Signature access is a separate manager-only API and every successful view is audited.

Visitor sign-in/out uses the tablet UUID queue. Signature strokes, mobile numbers and accepted rule text are processed by the receiving server but are deliberately removed from replicated `SyncEvent` payloads. Other tablets receive only the operational details required for live and emergency registers.

Run the protected visitor-retention endpoint daily. It clears expired signature stroke data, removes expired phone numbers and anonymises fully elapsed visitor histories according to Settings. Take a database backup before changing retention values or manually anonymising records.
## SMTP diagnostics and daily reports

Administrators and directors can open **Settings → Email** (`/dashboard/settings/email`) to inspect a secret-free SMTP summary, explicitly check the connection, and send a test message to one recipient. Delivery and diagnostic attempts are retained at `/dashboard/reports/email-deliveries`. SMTP acceptance means only that the configured server accepted the message; it does not prove inbox delivery.

Required application variables are `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`, `APP_URL`, `APP_ENV`, and an independent high-entropy `REPORT_JOB_SECRET`. Never place their values in source control or support screenshots.

The protected report endpoint is POST-only at `/api/internal/reports/daily/run` and requires `Authorization: Bearer <REPORT_JOB_SECRET>`.

It runs at 00:05 Europe/London and creates the immutable report for the previous local calendar day. A database lock and stable execution key prevent overlapping schedulers and duplicate successful delivery. Failed jobs can be invoked again without regenerating the report. An uncertain SMTP outcome is not automatically resent; review it in delivery history and use the controlled manual retry after checking the mailbox/provider.

On Ubuntu, put the secret in a root-owned environment file or wrapper (`chmod 600`), then install exactly one scheduler:

```cron
CRON_TZ=Europe/London
5 0 * * * /usr/local/sbin/stars-connect-daily-report >> /var/log/stars-connect-daily-reports.log 2>&1
15 2 * * * /usr/local/sbin/stars-connect-visitor-retention >> /var/log/stars-connect-visitor-retention.log 2>&1
```

The daily-report wrapper should load the protected environment and run:

```bash
/usr/bin/curl -fsS -X POST \
  -H "Authorization: Bearer ${REPORT_JOB_SECRET}" \
  "${APP_URL}/api/internal/reports/daily/run"
```

In Plesk, create a **Run a command** scheduled task for the same protected wrapper, set it to `5 0 * * *`, and confirm the server/task timezone is Europe/London. Do not configure both Plesk and system cron. PM2 keeps the web process running but is not the scheduler; restart with `pm2 restart stars-connect --update-env` after changing environment values.

To test manually, run the wrapper once and inspect **Settings → Email**, delivery history, the daily report, audit log, and the protected cron log. A repeated successful invocation returns an already-processed result. Rotate `REPORT_JOB_SECRET` by replacing it in the application and wrapper together, restarting PM2, testing once, and securely deleting the old value. Disable scheduling by disabling daily reports in application settings or removing the single scheduler.
## Existing alpha database

The live alpha was originally created with `npx prisma db push`. Read [prisma/ALPHA_MIGRATION_PLAN.md](prisma/ALPHA_MIGRATION_PLAN.md) before schema deployment.

The committed initial migration is a baseline for new databases and must not be executed directly against the populated alpha database.

## VPS update sequence

Back up MariaDB first. For the current alpha deployment:

```bash
cd /var/www/vhosts/starsconnect.co.uk/app.starsconnect.co.uk
git pull --ff-only
npm ci
npx prisma generate
npx prisma db push
npm run db:bootstrap-visitors
npm run build
pm2 restart stars-connect --update-env
pm2 save
```

`prisma db push` is temporarily retained for the existing alpha only. After the baseline procedure in `prisma/ALPHA_MIGRATION_PLAN.md`, replace it with:

```bash
npx prisma migrate deploy
```

## Production and security notes

- Keep `.env` readable only by the application service user.
- Terminate HTTPS with Nginx or Caddy.
- Use independent, randomly generated session and cron secrets.
- Restrict MariaDB to localhost/private networking.
- Use a shared rate-limit store before running multiple Node processes.
- Back up MariaDB daily with encrypted off-site retention.
- Test restoration rather than merely checking that backups exist.
- Rotate tablet tokens after loss or reassignment.
- Do not expose attendance-photo storage directly.
- Confirm UK GDPR, safeguarding and retention policy with the organisation’s responsible officers.
- Make the GitHub repository private before adding operational deployment detail.

## Checks

```bash
npx prisma generate
npm test
npm run lint
npm run build
```

## Android tablet acceptance checklist

- [ ] Install from HTTPS and confirm STARS Connect name/icon
- [ ] Provision each tablet with a different credential
- [ ] Confirm valid/invalid PIN behavior
- [ ] Confirm clock, register and visitor changes survive refresh
- [ ] Sign a visitor in offline and confirm it queues and survives restart
- [ ] Confirm visitor changes propagate from Tablet A to Tablet B
- [ ] Confirm kiosk sign-out requires name plus private reference
- [ ] Confirm visitor signature viewing is manager-only and audited
- [ ] Confirm staff, students and visitors appear in separate emergency sections
- [ ] Run visitor retention against fake expired records
- [ ] Create offline changes and reconnect
- [ ] Confirm Tablet A changes appear on Tablet B
- [ ] Confirm duplicate UUIDs are applied once
- [ ] Confirm stale changes create conflicts
- [ ] Launch emergency register fully offline
- [ ] Refresh/lock and resume an active roll call
- [ ] Revoke a device and confirm it can no longer sync
- [ ] Confirm Reception cannot access restricted management routes
- [ ] Export CSV and verify UK dates, UTF-8 names and escaping
- [ ] Send a test daily summary with no photographs
- [ ] Test BST/GMT boundary behavior
- [ ] Restore a database backup in a separate environment

## Deliberately excluded from V1

Student invoicing, payroll-provider integration, facial recognition, biometric verification, door access, staff rotas, holiday requests and direct tablet-to-tablet networking.

## Payroll, billing and immutable documents

Managers can review payroll periods and billing runs. Directors and administrators can approve and lock periods, configure billing profiles, charge rules, invoice numbering and organisation/remittance details, generate payroll summaries and issue invoice PDFs. Reception has no access to these APIs or pages. Permission checks use named capabilities in `src/lib/permissions.ts` and are enforced on the server.

Generated payroll summaries, invoices, daily PDFs and CSV files are written outside `public/` under `DOCUMENT_STORAGE_PATH` (default `.data/documents`). Database records retain the document number, version, source period, MIME type, byte size and SHA-256 hash. Downloads use authenticated, audited, unguessable database identifiers with `private, no-store` responses. Back up this directory with the database. Do not serve it from Nginx.

Payroll exports provide approved hours and absence categories only. STARS Connect deliberately does not calculate tax, National Insurance, pensions or net pay. Invoice sending is manual in this phase; issued invoice records are preserved and numbers are never intentionally reused.

Attendance handling rules:

- open clock/attendance/visitor records remain open and are flagged; durations are never invented
- overnight clock sessions preserve the original pair and are flagged as spanning midnight
- daily reports cover the previous complete Europe/London calendar day and handle GMT/BST boundaries
- late-synchronised or corrected records do not overwrite generated files; an authorised revision creates Version 2 or later and preserves the original
- daily staff totals are labelled recorded attendance hours until payroll has been reviewed and approved
- visitor signatures and private notes are never added to emailed daily reports; telephone, email and vehicle fields default off

## Finance/reporting deployment migration

Migrations `202607260003_finance_reporting` and `202607260004_email_health_jobs` add the Director role, payroll numbers, service-user billing references, visitor email, shared document metadata, payroll periods/entries/adjustments, billing profiles/rules/runs/charges/invoices, immutable daily reports and delivery attempts. It only adds nullable columns/new tables and extends the role enum; it does not invent historic financial data.

After a verified MariaDB and document-storage backup:

```bash
npm ci
npx prisma validate
npx prisma generate
npx prisma migrate deploy
npm run typecheck
npm test
npm run lint
npm run build
pm2 restart stars-connect --update-env
```
## Preparing the live test environment

After a verified MariaDB and document-storage backup, remove all demonstration devices, staff, students and their dependent operational/finance records with:

```bash
CONFIRM_LIVE_TEST_RESET=REMOVE_ALL_STAFF_STUDENTS_DEVICES npm run db:prepare-live-test
```

This preserves manager users, organisation/email settings and the audit log. It also removes visitor activity because visits reference devices. Do not run `npm run db:seed` on the cleaned live environment.

Set a stable secret before saving SMTP credentials in **Settings → Email**:

```env
SETTINGS_ENCRYPTION_KEY="at-least-32-random-characters"
```

SMTP passwords saved in the application are AES-256-GCM encrypted and are never returned by the settings API. Back up this key securely; changing or losing it requires entering the SMTP password again.