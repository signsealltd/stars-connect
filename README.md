# Pulse

Pulse is a tablet-first, offline-capable attendance and register PWA for STARS Day Service. It uses Next.js App Router, TypeScript, Prisma, MariaDB, IndexedDB and a service worker.

## Current V1 architecture

- The kiosk writes clock, attendance and roll-call events to IndexedDB before attempting the network.
- Every locally created event has a UUID. The sync endpoint stores UUIDs uniquely, making retries idempotent.
- Each tablet uses a revocable device ID/token pair. The server returns changes after a monotonic `BigInt` cursor.
- Concurrent stale register changes and duplicate clock events create manager-reviewable `SyncConflict` records; events are never silently overwritten.
- Manager sessions use opaque random tokens, HTTP-only cookies, hashed server-side session tokens, role checks, rate limits, and audit events.
- PINs and device tokens are hashed. The deterministic PIN lookup hash is only used to find a candidate; bcrypt verifies it.
- Emergency roll calls use the latest local staff and student state and persist locally across refresh or screen lock.

## Local setup

Requirements: Node.js 20+, MariaDB 10.6+ (or MySQL 8+) and npm.

1. Copy `.env.example` to `.env` and replace every placeholder.
2. Create the database and least-privilege account:

   ```sql
   CREATE DATABASE pulse CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'pulse_user'@'localhost' IDENTIFIED BY 'a-long-random-password';
   GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON pulse.* TO 'pulse_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

3. Run `npm install`, `npx prisma migrate dev --name initial`, `npm run db:seed`, then `npm run dev`.
4. Seeded development logins use `admin@pulse.test`, `manager@pulse.test`, or `reception@pulse.test` with `ChangeMe!123`. Development staff PINs are 4101–4110. Change all seeded credentials before shared use.

The seed prints each tablet setup token once. Put its device ID/token into the tablet provisioning UI or local storage keys `pulse-device-id`, `pulse-device-token`, and `pulse-device-name` for local development.

## Production

Use a dedicated Linux user, Node.js 20 LTS, MariaDB, a process manager such as systemd, and an HTTPS reverse proxy. Run `npm ci`, `npx prisma migrate deploy`, and `npm run build`; serve with `npm start`. Back up MariaDB daily with encrypted off-host retention and periodically test restores. Back up uploaded attendance photos separately if enabled.

Set `NODE_ENV=production`, use 32+ byte independent random values for session and cron secrets, restrict database network access, rotate tablet tokens after loss, and terminate TLS at the reverse proxy. Do not expose the upload directory directly; authenticated photo routes should authorise and audit every view. Schedule the summary endpoint with cron at 17:30 Europe/London and protect it with `CRON_SECRET`.

## PWA and Android tablets

Open the HTTPS site in Chrome, choose **Install app**, grant camera permission only if configured, and disable battery optimisation for reliable foreground synchronisation. Pin the app or use Android screen pinning. Provision each physical tablet with its own server-created device credential.

To test offline behavior: load the app online once; in Chrome DevTools choose Network → Offline; create clock/register changes; refresh the emergency route; then reconnect and confirm the queued counter reaches zero on both tablets. Do not depend on Background Sync—the app retries on open, focus and browser `online` events.

## Email

Configure the SMTP variables in `.env`. Use a TLS-capable transactional mail relay. Daily emails contain attendance summaries only and never photographs. Failed sends must remain recorded with a retry count and failure reason.

## Retention

Defaults are 30 days for photos, 365 days for audit records, seven previous local days, and 730 days for archived roll calls. Pending local events are excluded from deletion until acknowledged. Run retention jobs daily, audit their results, and confirm applicable UK GDPR policy with the organisation’s data controller.

## Tests and acceptance

Run `npm test`, `npm run lint`, and `npm run build`.

- [ ] Valid PIN alternates clock-in and clock-out and displays a confirmation.
- [ ] Invalid PIN is generic, delayed and rate limited.
- [ ] A duplicate scan inside 20 seconds is retained/reviewed, not silently overwritten.
- [ ] Offline clock and student changes survive refresh and synchronise once.
- [ ] Repeated upload of one UUID produces one server event.
- [ ] Conflicting tablet changes create a review item.
- [ ] Emergency register launches offline, persists progress and shows data age.
- [ ] Reception cannot access payroll, settings, photos or audit records.
- [ ] Camera denial does not prevent clocking and creates a review flag.
- [ ] Photo viewing is permission checked and audited; expired photos are deleted.
- [ ] Timesheet totals and missing clock-out warnings match manual calculation.
- [ ] Install, orientation, touch targets and screen-lock recovery work on both Android tablets.
- [ ] End-of-day test email and retry behavior work without photo attachments.

Student invoicing, payroll integrations, biometrics, door access, rotas, visitor management and tablet-to-tablet networking are intentionally outside V1.
