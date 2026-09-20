# Stars Connect: agreed-day billing and staff access changes

Recorded 20 September 2026 from the service owner's requirements.
Status: implemented in the local application; database migration, production deployment and operational data setup remain outstanding. See FUNDED_BILLING_RELEASE.md for activation and data impact.

## Governing billing rule

Every student is billed for their agreed funded days within the applicable billing period, regardless of actual attendance. The register records presence and absence for operational and safeguarding purposes. Register entries, missing entries, late arrivals and departures must not create, remove or alter invoice charges. Only authorised management corrections may remove otherwise allocated days.

Example: a student allocated 12 days at £100 per day is billed £1,200 even if they attend only 9. If management approves removal of one allocated day, the invoice becomes 11 days / £1,100. Record the removed date, reason, manager and timestamp.

## Required changes

1. Replace attendance-based charging with dated funding allocations for all students. Store agreed weekdays, effective dates, rate and payer. Preserve historical allocations when future agreements change. Do not infer a funding agreement from actual attendance or assume five weekdays when information is missing.
2. Show one service summary line per student: From–To, billable allocated days and total payable. Keep the underlying dates and management corrections available for review. Handle changes in rates internally without presenting an inaccurate single rate.
3. Add a clearly labelled PO / client payment reference section to the student profile's billing area, with entry, editing and display alongside their funding agreement. Include the reference on every student's invoice. LBE invoices require a supplied PO before issue. Snapshot the reference used on each invoice so later profile edits cannot rewrite historical documents. For consolidated invoices, preserve each student's own reference.
4. Automatically prepare the full monthly term allocation for management review, including future allocated dates in that month. Management can correct allocations and remove agreed holiday dates with a reason. Re-running generation must not duplicate charges or restore approved removals. Automatic issue/email timing remains to be specified; generation alone must not imply dispatch.
5. Trigger a safeguarding enquiry after **3 absences**, displayed in a dedicated **Safeguarding — investigate absences** box on the management dashboard. Show the student's name, absence count, supporting dates and a link to investigate. Record the assigned manager, status, investigation notes and resolution. Avoid duplicate enquiries for the same episode. The threshold of three and dashboard-box presentation are confirmed; whether absences must be consecutive, the counting window and treatment of explained absences remain to be specified. Missing register entries must be distinguishable from confirmed absence. Safeguarding actions must not change billing.
6. Add operational calendar tasks for LBE and other payer billing periods, with period start/end, preparation and issue deadlines, owner, status and links to the billing run. Avoid duplicate tasks. Confirm each payer's timetable.
7. Kellie supplies and maintains the agreed funding days for each client, including the effective date of changes. Provide a list of missing or unconfirmed allocations, rates and references. Show agreed funded days separately from the site register. Historical billing must not change when today's schedule is edited.
8. Generate a draft student-specific RAMS from information returned by parents, carers and social services. Link source information and the reviewed, versioned RAMS to the student profile. Identify missing information rather than inventing facts. Record review owner, approval and review date.
9. Add a dedicated photograph section to the student profile, accessible within the student profile/billing workflow, with upload, preview and replacement of the current profile photograph. Support a downloadable Herbert Protocol document populated from verified profile information. The photograph is for the profile and protocol; its inclusion on invoices has not been requested. Verify the applicable police template and fields before implementation; a photo alone does not constitute a complete protocol. Restrict access to the sensitive profile and document and record downloads.
10. Publish completed, approved policies in Stars Connect. Track viewing, explicit confirmation of reading and agreement as distinct events against the exact policy version and staff identity. Opening a document must not automatically record agreement. A replacement version needs fresh acknowledgement.
11. Give every staff member individual system access to policies, RIDDOR, SDS, RAMS, the operational calendar and the training matrix, with permissions appropriate to their duties. Distinguish access to module guidance from access to sensitive individual records. Produce individual onboarding guidance covering sign-in, available modules, policy acknowledgement and relevant reporting tasks.
12. Support manual regeneration of several historical billing months. The manager selects each period to regenerate; there is no single historical month to assume or automatic bulk rewrite to perform. Allow deliberate invoice generation even when an invoice already covers the same student and period. Create a separately identifiable revision, retain the previous document and link the history. An existing invoice must not act as a blanket generation block. Technical retries of one generation request must still avoid accidental duplicates.
13. Replace the long, unstructured completed-invoice list with a searchable invoice archive grouped by billing year/month and payer, with student, invoice number, PO, date-range and status filters. Show invoice number, student/payer, period, PO, total and status clearly. Make view/download and generate-again actions easy to find. Display the current revision prominently and put earlier versions in expandable history. Paginate results and preserve filters when returning from an invoice.

## Safeguarding enquiry closure

Management must be able to close an enquiry when investigation finds no problems, using an explicit **Close — no concerns found** outcome. Require a brief investigation/resolution note and record the closing manager and timestamp. Remove the closed enquiry from the dashboard's open-investigation count and list, while retaining it in accessible enquiry history with its supporting absence dates and notes. Closure must not delete attendance records or change billing. The same already-investigated absence episode must not immediately recreate the enquiry; subsequent qualifying absences must still be able to trigger a new enquiry under the agreed counting/reset rules. Those rules remain to be confirmed.

Acceptance: an authorised manager can close an open enquiry as no concerns found; the enquiry leaves the open dashboard box, remains available in history with its outcome, notes and closure details, and is not recreated from the same investigated episode.

## Manual regeneration and invoice history

Confirmed by the service owner: several months will be regenerated manually, and an existing invoice for a period must not prevent generation of another invoice for that period.

Provide a Generate again action from the period and student invoice views. Show the existing invoice reference and resulting revision relationship. Retain existing issued documents unchanged; a newly generated draft does not silently cancel an issued invoice. Clearly distinguish draft replacements, current issued invoices and superseded records. Link the replacement when it is finalised and prevent old/new versions from being counted twice as current amounts due. Preserve payment history and flag any required reconciliation of already-paid invoices. Exact finalisation and correction handling for previously issued or paid invoices must be defined during implementation.

Historical regeneration requires the applicable funded days, rates and PO information for each selected period. Missing historical allocations should be surfaced for management entry rather than filled from today's schedule or the register. Approved day removals must carry forward to the replacement unless management explicitly changes them.

## Repository findings

- `src/lib/billing.ts` contains attendance-status billing helpers.
- `src/lib/billing-profile-management.ts` creates an ATTENDED day rule and defaults an empty weekday selection to Monday–Friday. This is unsuitable as evidence of agreed funding days.
- `prisma/schema.prisma` already has billing-profile PO and funding-reference fields, dated charge rules, student photo storage, invoice/run records and compliance acknowledgements. These are foundations to extend, not evidence that the requested workflows are complete.
- The quick student billing workflow passes expected attendance days into charge-rule setup. Funding allocations need a separate, historically stable source.
- Existing compliance acknowledgement support requires assessment before adding separate viewed/read/agreed events.

## Decisions needed before activation

- Historical periods will be selected and regenerated manually, as confirmed. Confirm the start date for future automatic monthly preparation separately; it does not block the manual period-selection design.
- Term-date source and whether published non-term days and closures are excluded automatically or require management removal.
- Safeguarding trigger is 3 recorded ABSENT entries. Default: accumulated absences since the previous enquiry, with no time limit; management can select consecutive counting or a bounded window. Closed episode IDs are retained so they do not retrigger. NOT_MARKED entries do not count.
- Monthly generation date, invoice issue timing and payer-specific billing deadlines.
- Required client information and applicable police template for the Herbert Protocol.
- Staff access scope for sensitive incident records, student RAMS and colleagues' training records.

## Delivery sequence and acceptance checks

First deliver agreed funding schedules, profile photograph and PO sections, management removals, monthly draft generation, manual regeneration, invoice output and the organised invoice archive together. Validate allocations with Kellie before activation. Then add billing calendar tasks and absence enquiries, followed by student RAMS/Herbert Protocol and staff publication/access workflows.

Billing acceptance must demonstrate that present, absent, late, cancelled, offsite and unmarked register states produce identical charges for the same funding allocation; a manager removal reduces the correct date once; non-managers cannot remove it; regeneration preserves it; schedule changes respect effective dates; missing funding information is surfaced; LBE issue is blocked without a PO; and historical issued documents remain stable.

Additional acceptance: a manager can regenerate multiple selected historical months individually; an existing invoice for the same period does not block deliberate generation; retries do not create extra revisions; previous invoice documents remain downloadable; revision links and current status are clear; historical allocations and approved removals are respected; totals do not double-count superseded versions; archive filters find invoices by period, payer, student and PO; and authorised users can upload/replace a profile photo and edit a PO from the student workflow.

Safeguarding acceptance must demonstrate that the third qualifying absence creates an enquiry visible in the management dashboard box, with the student's name and supporting dates; fewer than three do not trigger it. Also verify deduplication, manager investigation and resolution, and no billing side effects. Document/access acceptance must demonstrate version-specific acknowledgements, individual staff identity, permitted module access and protection against unauthorised sensitive-record access.
