# Safety & Compliance and vehicle checks

Existing patterns inspected: Next.js 15.5.22 / React 19 / Prisma 6.19.3 (locked), MariaDB, Zod 4, idb 8, Vitest 3. No dependency upgrades. Existing Premises identifiers and routes retained. Fleet uses the same users, capability overrides, sessions, private DocumentRecord storage and audit log. PIN sign-in on provisioned tablets issues a vehicle-only scope in the existing Session table; normal manager endpoints reject that scope. Vehicle permissions must be explicitly enabled for existing custom Access Levels.

Submitted check answers and displayed questions are immutable JSON snapshots with checklist version. Defects have one canonical record and append-only lifecycle events, surfaced in shared Corrective Actions. Safety decisions are calculated on the server under a vehicle lock; returning to service is separate and permission-controlled. Offline drafts use the existing IndexedDB metadata store, scoped by account, with UUID retries. Main service worker and install identity remain in place.

Records and private evidence are retained; no automatic deletion policy is introduced. Organisation should document its fleet retention period before production use. No GPS collected. No new external notification provider. In-app alerts expose out-of-service vehicles and unresolved defects. This is a workflow record, not certification of roadworthiness.

## Browser and installation behaviour

The dedicated manifest has id/start URL `/VehicleCheck`, scope `/VehicleCheck`, 192/512 PNG icons and its own displayed name. The existing main manifest is unchanged. Both use the existing root service worker and shared IndexedDB; this avoids competing service-worker registrations. Chromium recognises manifest IDs, but nested same-origin installations can vary by device/browser. Where a separate install is not offered, add `/VehicleCheck` as a dedicated home-screen shortcut. Do not uninstall the existing STARS Connect app. Actual Samsung tablet/phone installation and outdoor camera acceptance remain on-device checks.

References: https://developer.chrome.com/docs/capabilities/pwa-manifest-id and https://web.dev/articles/building-multiple-pwas-on-the-same-domain . Camera input uses `capture=environment`, which requests a new outward-camera photo where supported; the platform can still offer a picker (https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture). Images are re-encoded client-side and server-side, preserving visual orientation while dropping EXIF/GPS metadata.

## Deployment

Apply `20260920233000_fleet_vehicle_checks` with the normal `prisma migrate deploy` workflow. It adds a default FULL scope to existing Session rows and adds five fleet tables; it does not delete or rewrite Premises, attendance or invoice data. Enable `vehicle.check` for each existing custom staff Access Level and `fleet.view`, `fleet.manage`, `fleet.return` as appropriate for managers. The preset roles grant staff check access and manager fleet access. PIN login requires an existing linked staff account, active credential and provisioned device; personal phones use normal STARS account login. No new credentials are seeded in production.

Fleet Documents uses the shared private DocumentRecord storage for vehicle photographs, certificates and repair evidence, retaining a link to existing Documents & Insurance. Defect transitions can reference supporting documents attached to the same vehicle. Per-vehicle equipment and stop-use item configuration are implemented; no complex checklist designer or external SMS provider is added. Record PDFs are textual with immutable evidence references; photographs are available through authorised check details. Main dashboard in-app unsafe alerts refresh every 30 seconds. Missed checks and approaching expiry dates are surfaced in Fleet.

## Dashboard follow-ups

Dashboard now uses the header brand colour, top-positioned Quick Actions (up to 12, filtered by account capabilities), concise battery/conflict device rows and fewer tiles. Day/night toggle removed and one light-card appearance used. LBE 2026 import button removed without deleting saved periods. Historical unclosed clock-ins remain missing-clock-out exceptions but no longer inflate today's onsite count, matching the live register.

Check date is derived from the recorded start time in Europe/London, so a previous-day offline check does not satisfy today’s check. The separate server submission timestamp remains authoritative evidence of when it reached STARS Connect.

## Validation completed

All 31 migrations, including the new additive fleet migration, applied successfully to a disposable local MariaDB database. No production data was used or changed during validation. The automated suite passed 476 tests across 102 files, including nine real MariaDB workflow tests. Simultaneous check submissions were tested against MariaDB and through HTTP; bounded transaction retries and read-committed isolation prevent transient concurrent row-update failures without duplicating records, defects, alerts or audit events.

HTTP validation covered private image upload/retry, concurrent check submission, immutable records, staff permission denials, manager repair/no-fault verification, separate return to service, private vehicle documents and PDF export. Browser validation at a 390-pixel phone viewport covered the guided check, required defect evidence, unsafe warning, confirmed synchronisation, manager review and the revised dashboard. IndexedDB tests cover reopening saved drafts with photographs, account separation, failed uploads and stable retry UUIDs.

Production build and TypeScript validation passed. Lint reports no errors and 17 warnings (existing unused-variable warnings and direct image-element recommendations). Physical Samsung/phone installation, outdoor camera use and a complete browser offline cold launch still require on-device acceptance testing; these are not claimed as verified. The service worker explicitly caches the vehicle page assets after first installation and controller replacement.
