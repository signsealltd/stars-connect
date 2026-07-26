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
SMTP_USER="change-me"
SMTP_PASSWORD="change-me"
SMTP_FROM="STARS Connect <stars-connect@example.org>"
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

The server stores only a SHA-256 token hash. Rotating a token invalidates the previous tablet credential. Revoked devices cannot synchronise. Browser storage is not a hardware secure enclave, so use Android screen lock/pinning and physically controlled tablets.

## Reports and permissions

Managers and administrators can view attendance reports and request server-generated UTF-8 CSV exports. Each export is audited. Reception accounts do not receive report, credential, device, settings, audit or restricted-note access.

Navigation visibility is not relied on as security; management APIs perform server-side role checks.


## Visitor management

The kiosk home links to `/visitors`. Visitors can sign in without seeing any other visitor identity. Sign-out requires the visitor's full name plus the private eight-character reference shown at sign-in; reception can assist from `/dashboard/visitors`.

Administrators configure visitor reasons, required fields, immutable site-rule versions and retention periods in **Settings**. Publishing rules creates a new version; it never edits historic acceptance text. Managers can open `/dashboard/visitors/[id]` to inspect the accepted version. Signature access is a separate manager-only API and every successful view is audited.

Visitor sign-in/out uses the tablet UUID queue. Signature strokes, mobile numbers and accepted rule text are processed by the receiving server but are deliberately removed from replicated `SyncEvent` payloads. Other tablets receive only the operational details required for live and emergency registers.

Run the protected visitor-retention endpoint daily. It clears expired signature stroke data, removes expired phone numbers and anonymises fully elapsed visitor histories according to Settings. Take a database backup before changing retention values or manually anonymising records.
## SMTP and daily summaries

Configure the SMTP variables in `.env`, then use **Settings** to:

- enable/disable summaries
- set the Europe/London send time
- configure recipients
- send a test summary

Emails contain HTML and plain text, include visitor counts and visitors still signed in, and never include visitor signatures, mobile numbers or attendance photographs.

The app does not use an in-process timer. Run the protected endpoint every five minutes; it checks the configured Europe/London time and prevents duplicate successful sends:

```cron
*/5 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://app.starsconnect.co.uk/api/cron/daily-summary >/dev/null
15 2 * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://app.starsconnect.co.uk/api/cron/visitor-retention >/dev/null
```

Store `CRON_SECRET` in the cron user’s protected environment; do not write the actual value into the crontab command if process visibility is a concern. A root-owned wrapper or protected environment file is preferable.

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
