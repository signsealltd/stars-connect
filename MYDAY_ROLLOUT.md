# My Day staff rollout

## Access and deployment

My Day opens at `/myday` on the existing application host. Every active, non-archived staff member with a current clocking PIN can sign in. No Staff Area invitation, key-worker assignment, sample activity import or individual My Day activation is required. A staff dashboard shortcut and installable portrait manifest are included. This follows the operator's request to enable all staff; it supersedes the brief's disabled-by-default pilot setting. No announcements, notifications or emails are sent.

Code being pushed is not proof that the VPS has deployed it. On the VPS use the existing `bash scripts/deploy-vps.sh` deployment process. It backs up the database, updates main, installs dependencies, runs additive migrations, builds, and restarts PM2. Confirm `https://app.starsconnect.co.uk/myday` and `/api/myday/auth` after deployment. This feature requires `20261119120000_myday_pilot`; never use `db push`, reset or a seed on the live database.

`SETTINGS_ENCRYPTION_KEY` must retain the existing production value. It encrypts the server's persistent offline-decryption key. Losing either the setting key or the `mydayQueueEncryption` AppSetting can make pending tablet submissions unrecoverable. Preserve both in recovery arrangements. No new external AI credentials are required.

The implementation fails closed if the application has more than one organisation, since the current Student table has no per-service identifier. The supplied November 18 backup contains one organisation. Do not enable this module in a multi-service deployment without implementing client/service ownership first.

## Flag off and recovery

- Set `MYDAY_DISABLED=true` in the VPS runtime environment and restart PM2 with updated environment values to switch off all My Day routes and hide dashboard shortcuts. Existing register/profile routes continue working.
- Alternatively an operator can set AppSetting `mydayEnabled` to JSON `false`. Restore JSON `true` (and remove the environment override) to reopen access.
- Turning off does not delete diaries, plan history, reports or encrypted tablet queues. Queues wait while the feature is off. Drain queues before changing offline encryption keys.
- Take a pre-deployment database and private-document backup using the existing deployment process. Keep the existing `.env`/settings key separately protected. On a failed deployment restore the prior application build, retain the additive tables, and disable My Day. Database restoration should be an operator decision with the newer audit/diary records preserved first.

## Authoritative source mapping

| Screen/field | Source and write behaviour |
| --- | --- |
| Client identity and search | Existing Student ID, displayName, firstName and lastName; no duplicate directory |
| Allergies | Student.medicalProfile.allergies; blank means not recorded, explicit `none`/NKA maps to “No known allergies” for display only |
| Dietary requirements/preferences | Explicit medicalProfile.dietaryRequirements/dietaryPreferences, falling back to the same explicit careInformation keys; narrative notes are never mined |
| Halal badge | Explicit boolean medicalProfile.halal or careInformation.halal; the medical profile editor includes a checkbox |
| Plan | Student.personCentredProfile's existing seven sections; targeted edits update the same JSON and append MyDayPlanHistory |
| Additional notes | New authored notes in personCentredProfile.mydayAdditionalNotes; existing additionalNotes text/arrays stay intact and remain visible |
| Management notes | Student.notes is not returned to My Day staff |
| Photograph | Student.profilePhotoUrl points to the existing private StudentPhoto DocumentRecord; new photo saves use that canonical pointer |
| Photo permission | Latest approved StudentConsentHistory photography decision, specifically internalCareRecords or an explicit boolean true; absence does not block diaries |
| Staff identity | Existing StaffCredential PIN and active StaffMember; a separate short-lived HttpOnly My Day session does not broaden the register's existing device permissions |
| Directory hide/restore | MyDayClient flag; no attendance or canonical profile changes |
| Activities | Service-scoped MyDayActivity, initially empty; saved entries retain their own historical label |
| Diary | Independently authored MyDayEntry rows grouped by client and London date; MyDayRevision retains the exact submissions |
| Handover marker | Today's handover=true entries; no attendance writes, completion workflow or automatic next-day carry-over |
| Monthly report | One MyDayReport per client, with versioned replacement checks and atomically stored text/PDF |

There is no existing canonical PCP approval/version model in this checkout. My Day adds change history and competing-edit checks without inventing an approval chain. No approved AI summary or grammar integration exists here: monthly summaries offer manual writing, real PDF preview and download; Generate summary reports unavailability without altering the current report. Activity-name matching uses the library; text entry remains independent of external services.

## Offline and concurrent edits

PIN sign-in issues a seven-day, write-only offline authorisation grant. Its secret remains in the signed-in page's memory, never in plaintext browser storage. Each exact, canonicalised submission is authenticated and encrypted with a random AES-GCM key wrapped for the server's RSA public key. IndexedDB stores only an opaque request ID and sealed envelope. It does not cache a PIN, staff session, readable diary or reusable plaintext grant. Locking clears the page's private state and temporary photo previews.

The server rechecks staff and PIN access at replay. Revoked/expired grants and hidden or archived clients go to admin review. Access-check outages leave the queue waiting. A replay's original author/time are retained even after switching staff or signing out. Background retry runs while the app is open on any route, and resumes when the app is reopened after closure/restart; it does not claim OS background execution while the browser is terminated.

Request IDs prevent duplicate saves, including lost acknowledgements. Independent staff contributions use separate rows. Edits carry a base revision; losing versions go to review while the shared current entry stays visible. Admin acceptance adds an attributed follow-up instead of overwriting a newer shared version. MariaDB deadlocks are retried within a bounded transaction helper.

## Verification

- `npm test -- --reporter=dot`: complete existing suite plus My Day rule, queue, transaction and PDF tests.
- `npx tsc --noEmit`, Prisma schema validation, focused ESLint and `npm run build`.
- `scripts/verify-myday-database.ts`: refuses all hosts except loopback port 3317 and the named disposable QA database. Apply the **prior** schema to an empty database first. The script creates only fictional fixtures, snapshots old records, executes the new migration, and verifies preservation, real two-worker saves, retry idempotency and edit conflict retention.
- `scripts/verify-myday-live.cjs`: exercises the real local Next APIs and disposable MariaDB, including PIN/manager separation, revocation, hidden-client requests, register markers, plan conflicts, legacy notes, private/canonical photos, failed replacements, report overflow, stale sources and flag-off. It uses the fixture IDs written by the database check.
- `scripts/verify-myday-ui.cjs`: portrait Chrome checks with synthetic intercepted APIs, including declined alternative/rating attribution, hidden-field clearing, crop save/cancel/failure, encrypted offline saves, lock privacy and reload/reconnect. Install Playwright separately or set NODE_PATH to the bundled runtime; set MYDAY_QA_URL to a local dev server if needed.
- Fictional portrait screenshots and rendered one-page PDF QA are written under ignored `tmp/myday-qa/` only. No production backup is imported, and no real client data is used in tests.

Use `APP_URL` matching the local dev origin during local API checks. The scripts assume a disposable instance; they are not production setup or activation scripts.

## Device checks still required

Desktop Chrome and a reduced-height keyboard viewport can be verified here. A physical Samsung tablet is not connected. Native camera permission/refusal, Android photo orientation/chooser behaviour, actual Android keyboard layout, browser/OS storage eviction policy, and a physical tablet power-cycle/reconnect remain operator device checks. Closing/reopening and signed-out replay are tested; they do not substitute for those hardware checks. Managed tablets should retain site storage and avoid private browsing.

The report renderer keeps one readable A4 page and rejects overflow. Its embedded standard-font path supports Latin-1 text with common smart punctuation normalisation; unsupported symbols are reported for editing rather than silently omitted. No report is automatically sent, archived, approved or replaced after a source change.
