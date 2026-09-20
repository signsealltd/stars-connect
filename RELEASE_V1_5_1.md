# STARS Connect V1.5.1

Version: V1.0.0 → V1.5.1, establishing the baseline explicitly requested for the dashboard and Client terminology release. `package.json` is authoritative; the lockfile mirrors it and application displays derive from `src/lib/app-version.ts`.

## Changes

- Refined purple dashboard, UK greeting/date, icon shortcuts, compact summary cards, warm paper notes, and meaningful device/alert states. Existing personalised shortcuts and access controls remain in effect.
- Added an accessible version badge to authenticated screens, with safe-area spacing and print suppression. Kiosk provisioning, sync and diagnostics use the same version source.
- Updated current user-facing Student terminology to Client across pages, navigation, messages, permissions, reports, exports, document generators and Clive guidance.
- Billing now follows selection → Prepare billing → review/adjust agreed billable days → issue. Attendance does not determine the charge. A final manual total remains optional. Clients are selected explicitly and the summary stays in normal document flow.
- Users can select a saved billing period or enter From/To dates. Manual ranges cover up to 62 days and do not modify saved periods. Agreed days are not automatically prorated; review them before issuing.
- Added an explicit bank-holiday deduction toggle, on by default for LBE. Other/manual periods use the England and Wales GOV.UK feed when enabled. The review shows the deduction; entering a final manual total does not deduct holidays again.
- Previous invoices use their original billing-run label where no client name was saved. Exact-period replacements require confirmation; partial overlaps are blocked.
- Expanded Clive's billing knowledge and added read-only Show me highlights for relevant controls. Guidance never selects clients, changes amounts or issues invoices.

## Terminology audit

Reviewed TypeScript/TSX user-facing literals and template text, dynamic audit/report/permission labels, generated help knowledge, and current Python document-template copy. The remaining 150 Student-related literal matches in application source are stable imports/routes, database/offline/sync names, permission and audit identifiers, test fixtures, legacy search aliases, or an internal instruction recognising legacy wording. Dynamic labels translate at presentation time.

Database models/columns, API paths, stored audit identifiers, migration history, older release/handover documents, historical specifications and already-issued/uploaded documents retain their original names. Renaming those would change contracts or rewrite history. This release includes no schema migration or production-data rewrite.

## Validation

- 486 automated tests passed; all 9 separately enabled MariaDB integration tests passed (495 total).
- TypeScript and the production build passed. ESLint reported no errors; existing warnings remain.
- Local HTTP checks covered authorisation, manual dates, verified holiday deductions, day adjustments, explicit replacements, idempotent retries, overlapping invoices, archive labels and unchanged historical PDF hashes.
- Browser checks covered desktop, portrait/landscape tablet and mobile layouts, explicit client selection, day review, version visibility and Clive highlights without covering the highlighted control.
- Invoice and client-record PDF regression tests passed. Test data and generated test documents stayed in the disposable local validation environment.
