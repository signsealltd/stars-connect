# V1.7.0 — Payments

Previous release: V1.6.1. Finance → Payments replaces Payments Checklist.

## Workflow
Issued positive invoices are automatically eligible. Before first use, an authorised manager must preview and confirm the payment tracking start date. Older invoices then appear under Ignored. Mark as paid accepts full remaining balances only; partial payments are deliberately deferred. Bulk actions are transactional: if any selected invoice changed, nothing is saved and the response identifies it. Ignore, restore and reversal preserve invoice documents and immutable action history. Full credits and superseded/void invoices are excluded from outstanding balances. Paid history remains visible even when an invoice is later credited; refunds are outside this checklist.

The dashboard shows a live outstanding count/value separately from Invoices awaiting approval. Clive includes Payments guidance and contextual Show me highlights. Desktop tables become stacked cards on tablets. Selection is per page (25 invoices).

## Main files and routes
- `src/lib/payments.ts`: decimal calculation, automatic classification, filters, transactions, history and settings preview.
- `src/components/payments.tsx` and `payments.css`: page, dialogs, responsive list and bulk actions.
- `/dashboard/billing/payments`, `/api/payments`, `/api/payments/settings`.
- Invoice generation/correction and credit lifecycle checks; dashboard API/page; navigation, permission catalogue and Clive guidance.

## Schema, migration and backfill
`20260922010000_payment_tracking` adds `Invoice.paymentState` (AUTO default), `paymentRevision`, and related `PaymentEvent` with a unique invoice/revision key and restrictive foreign key. Existing invoices, PDFs and values are preserved. AUTO is an internal mode, not a user-facing payment status. Effective classification derives from issued date and the confirmed start date, so migration/backfill is inherently idempotent, with no duplicate tracking rows and no automatic paid records. Individual manual decisions override the date rule. Settings and impact counts are recorded in the existing audit log; event writes and audit writes share each financial transaction.

The application has one organisation per database, as does existing billing. Payment queries use that deployment/session boundary and accept no browser-supplied tenant identifier. This release does not add multi-tenancy.

## Permissions
Separate configurable `payments.view`, `payments.record`, `payments.reverse`, and `payments.settings` capabilities are enforced server-side. Management roles receive defaults; ordinary staff/kiosk roles do not. Existing PDF-view permissions remain in force. Mutations retain same-origin/session protection.

## Deployment and rollback
Use the existing `scripts/deploy-vps.sh` after backing up MariaDB and document storage. It installs dependencies, applies `prisma migrate deploy`, builds and restarts. Do not seed production. Open Finance → Payments and confirm the real SOP start date after reviewing the impact.

For code rollback, keep the additive columns/table and audit history; do not drop them after payments have been recorded. Previous code can run with these additions. Export/retain payment history before any future schema rollback. No bank integration or refunds/partial-payment workflow is included.

The package remains the single version source. No service-worker cache change is needed: Payments/API data is not cached and existing static chunks are content-hashed/network-first.

## Validation
- 540 tests passed, including real MariaDB payment and fleet integration tests.
- Schema validated; migration applied to the disposable database, repeated safely, and schema diff reported no differences.
- Type checking passed. Full lint completed with zero errors and 17 existing warnings in unrelated files.
- Local HTTP checks confirmed anonymous/staff/origin rejection, input validation, matching dashboard/payment totals, credit PDF creation and duplicate-credit rejection.
- Browser checks covered first-time setup, historic restore, full payment, reversal, persisted reference/date/actor, desktop/tablet/mobile layout, dialog focus restoration, version display and Clive's highlighted Mark as paid guidance.
- Production build passed (138 static pages generated).
