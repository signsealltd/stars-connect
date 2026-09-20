# Funded billing, safeguarding and staff access release

## Current status

Integrated with main and validated locally. No production deployment or database migration has been performed by this task. The configured local MySQL service at 127.0.0.1:3306 was unavailable, so migration execution and live database acceptance testing remain outstanding.

## Effect on existing data

The migration `20260920180000_funded_billing_staff_access` adds columns, tables, indexes and two role values. It contains no data deletion, database reset or invoice regeneration. Existing students, attendance, staff, users, billing runs and invoice PDFs are retained.

Deploying the new application changes future billing calculations: they use confirmed FUNDED charge rules, not attendance. Existing ATTENDED rules remain stored but must be confirmed as funding agreements before recalculation. Empty or unconfirmed allocations produce blocking review warnings rather than assumed weekdays.

Automatic monthly preparation starts **off**. Enable it on the billing page and select an activation month after confirming the funding setup. Historical periods are selected and regenerated manually. New draft calculations do not alter issued invoices. Explicit approval and generation of a replacement retains the earlier PDF and marks its invoice SUPERSEDED. This is invoice revision history, not automatic cancellation with an external payer or reconciliation of payments; the application has no payment ledger.

Refreshing an existing editable draft replaces its calculated charges with funded charges and retains recorded funded-day removals. Approved and issued runs cannot be recalculated in place. A new revision is required. Historical issued documents cannot be deleted through the billing-run delete action.

Safeguarding enquiries are created when the manager dashboard or scheduled worker checks the register. The default counts three recorded ABSENT entries not already covered by a closed enquiry. Management can change the counting window and consecutive/accumulated mode. Register data and billing are not changed by opening or closing enquiries.

Existing accounts keep their stored roles and overrides. Managers receive funded-billing editing and care/document workflow defaults; invoice approval remains a separate permission. Team Leader and Care Assistant defaults provide staff portal access without management or finance access. Assigning an access level to a staff member links or creates their account; changing that level updates its linked accounts and revokes sessions. This is an explicit administrator action, not an automatic reassignment of existing staff.

## Deployment and activation

1. Verify and retain a restorable database backup. The documented `scripts/deploy-vps.sh` workflow backs up, pulls main, installs dependencies, applies migrations, builds and restarts the application. Verify the actual VPS trigger configuration before pushing: no repository GitHub Actions deployment workflow was present in this checkout.
2. Run the migration against a restored staging database first with `npx prisma migrate deploy`. Do not use `migrate reset` or `db push --accept-data-loss`.
3. Verify existing student, staff, attendance and invoice counts and sample historical PDFs before and after migration.
4. Have Kellie confirm each student's funded weekdays, rate, effective date and PO in Students or Billing setup. For several historical schedules, save each agreement with its actual effective date. The register's expected weekdays are separate.
5. Prepare a historical period, review the dated allocations, remove only agreed dates with a reason, and inspect the total. An LBE invoice cannot be generated without a PO. Check a replacement revision and verify its predecessor remains downloadable.
6. Configure Access Levels under Settings, then assign the level in each staff record. Existing accounts are linked by the staff email when no account link exists. New accounts require an initial password; distribute credentials securely. Test a representative Team Leader and Care Assistant account, including direct API access restrictions.
7. Upload completed policies, SDS, RAMS and RIDDOR guidance in the Staff portal; review and publish them. Student RAMS generated from returned care information begin as drafts. Resolve missing information before publication. Viewing, confirming reading and agreeing are separate version-specific actions.
8. Enter student care information and upload photographs. Review the generated Herbert Protocol against the supplied information and the linked Metropolitan Police source form. Unknown fields are explicitly marked NOT PROVIDED.
9. Review safeguarding counting settings. Verify that an enquiry can be closed as No concerns found with notes, manager and timestamp, and that its episode does not immediately recur.
10. Enable monthly preparation when ready. The existing authenticated daily-report job also invokes preparation and safeguarding checks. A standalone authenticated POST `/api/cron/funded-billing` is available using the existing `REPORT_JOB_SECRET`. Preparation creates the current full month once and never issues or emails invoices. It does not backfill missed months. Billing calendar tasks default to month-end; management adjusts payer deadlines and owners.

## Verification performed locally

- TypeScript checks and automated unit/regression tests, including funded-day calculations, date-effective schedules, retained removals, no attendance reads, missing PO blocking, one-line invoice output, generation retries, zero invoices, safeguarding closure deduplication and access-level restrictions.
- Production compilation/build and lint checks.
- Rendered visual inspection of the invoice PDF and paginated care-profile PDF using synthetic information.

Database-backed browser acceptance, migration execution against real MySQL and production deployment cannot be claimed from this local environment.
